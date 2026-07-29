(() => {
const {roundTypes,drawParticles,makeParticles}=window.TamRounds;
const RESULT_LEVELS=[
  {max:40,rank:"perfect",label:"TAM İSABET!",base:1000},
  {max:90,rank:"great",label:"HARİKA",base:750},
  {max:160,rank:"good",label:"İYİ",base:500},
  {max:250,rank:"near",label:"YAKIN",base:250},
  {max:400,rank:"weak",label:"ZAYIF",base:100},
  {max:Infinity,rank:"miss",label:"KAÇIRDIN",base:0}
];
const MODE_LABELS={classic:"KLASİK",streak:"İSABET SERİSİ",timed:"60 SANİYE",daily:"GÜNLÜK İSABET"};

function hashSeed(value){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function seededRandom(seed){let a=hashSeed(seed);return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

class Game {
  constructor({elements,data,feedback,onFinish,onStatsChange}){
    this.el=elements;this.data=data;this.feedback=feedback;this.onFinish=onFinish;this.onStatsChange=onStatsChange;
    this.ctx=this.el.canvas.getContext("2d");this.boundTap=e=>this.handleTap(e);this.boundFrame=now=>this.frame(now);
    this.el.arena.addEventListener("pointerdown",this.boundTap,{passive:false});this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.el.arena);this.reset();
  }
  reset(){
    cancelAnimationFrame(this.raf);clearTimeout(this.nextTimer);clearTimeout(this.missionTimer);
    this.active=false;this.paused=false;this.locked=true;this.evaluated=false;this.finishing=false;
    this.score=0;this.lives=3;this.round=0;this.combo=0;this.bestCombo=0;this.perfect=0;this.perfectCombo=0;this.bestPerfectCombo=0;
    this.differences=[];this.early=0;this.late=0;this.history=[];this.recentTypes=[];this.typeBag=[];this.seenTypes=new Set();this.particles=[];this.tutorial=false;this.tutorialStep=0;this.mode="classic";this.lastBeat=-1;this.updateHud();
  }
  start({tutorial=false,mode="classic",seed=""}={}){
    this.reset();this.active=true;this.tutorial=tutorial;this.mode=tutorial?"tutorial":mode;this.seed=seed;const entropy=globalThis.crypto?.getRandomValues?globalThis.crypto.getRandomValues(new Uint32Array(1))[0]:Math.floor(Math.random()*4294967295);this.randomSource=mode==="daily"?seededRandom(seed):seededRandom(`${entropy}-${performance.now()}-${Math.random()}`);
    if(mode==="timed")this.sessionEndTime=0;
    this.feedback.unlock();this.updateHud();this.nextRound();
  }
  random(){return this.randomSource?this.randomSource():Math.random();}
  shuffle(items){for(let i=items.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[items[i],items[j]]=[items[j],items[i]];}return items;}
  availableTypes(){
    if(this.tutorial)return[roundTypes[this.tutorialStep===0?0:this.tutorialStep===1?1:5]];
    if(this.mode==="daily")return roundTypes;
    return roundTypes;
  }
  getRoundType(){
    if(this.tutorial)return this.availableTypes()[0];
    const available=this.availableTypes();
    this.typeBag=this.typeBag.filter(type=>available.includes(type));
    if(!this.typeBag.length)this.typeBag=this.shuffle([...available]);
    let index=this.typeBag.findIndex(type=>!this.recentTypes.includes(type.id));if(index<0)index=0;
    let [type]=this.typeBag.splice(index,1);if(this.round===1&&this.mode!=="daily"&&type.id===this.data.lastOpeningType&&this.typeBag.length){const replacementIndex=this.typeBag.findIndex(item=>item.id!==this.data.lastOpeningType);if(replacementIndex>=0){const previous=type;[type]=this.typeBag.splice(replacementIndex,1);this.typeBag.push(previous);}}if(this.round===1&&this.mode!=="daily"){this.data.lastOpeningType=type.id;this.onStatsChange();}this.recentTypes.push(type.id);if(this.recentTypes.length>4)this.recentTypes.shift();return type;
  }
  nextRound(){
    if(!this.active||this.finishing)return;this.round++;this.locked=true;this.evaluated=false;this.lastBeat=-1;this.currentType=this.getRoundType();
    const firstSeen=!this.seenTypes.has(this.currentType.id);this.seenTypes.add(this.currentType.id);
    this.config={variant:Math.floor(this.random()*this.currentType.variants),size:this.random(),flair:this.random(),targetStyle:this.data.targetStyle||"orbit"};
    const base=Math.max(1420,2780-this.round*42),modeSpeed=this.mode==="timed"?-280:0,adaptive=this.mode==="daily"?0:this.adaptiveAdjustment();
    this.duration=Math.max(1200,base+modeSpeed+adaptive+this.random()*420);if(this.tutorial)this.duration=2500;
    this.toleranceScale=this.tutorial?1.55:Math.max(.76,1.18-this.round*.012);
    const now=performance.now(),instructionDuration=this.tutorial?1500:(firstSeen?1200:850);this.startTime=now+instructionDuration;this.targetTime=this.startTime+this.duration;this.timeoutTime=this.targetTime+650*this.toleranceScale;if(this.mode==="timed"&&this.round===1)this.sessionEndTime=this.startTime+60000;this.lastFrame=now;this.particles=[];
    this.el.resultCard.className="result-card";this.el.missionCard.classList.remove("hidden");this.el.missionKicker.textContent=this.tutorial?`EĞİTİM ${this.tutorialStep+1}/3`:this.currentType.title;this.el.missionText.textContent=this.currentType.mission;this.el.roundType.textContent=this.currentType.title;this.feedback.tone("start");
    clearTimeout(this.missionTimer);this.missionTimer=setTimeout(()=>{if(this.active&&!this.paused)this.el.missionCard.classList.add("hidden");},instructionDuration);this.raf=requestAnimationFrame(this.boundFrame);
  }
  adaptiveAdjustment(){const recent=this.history.slice(-5);if(recent.filter(r=>r==="perfect").length>=3)return-220;if(recent.slice(-2).length===2&&recent.slice(-2).every(r=>r==="miss"))return 260;return 0;}
  resize(){const rect=this.el.arena.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);this.el.canvas.width=Math.max(1,Math.round(rect.width*dpr));this.el.canvas.height=Math.max(1,Math.round(rect.height*dpr));this.ctx.setTransform(dpr,0,0,dpr,0,0);this.width=rect.width;this.height=rect.height;}
  frame(now){
    if(!this.active||this.paused)return;
    if(this.mode==="timed"&&now>=this.sessionEndTime){this.finishSession();return;}
    const delta=Math.min(34,now-this.lastFrame);this.lastFrame=now;this.ctx.clearRect(0,0,this.width,this.height);const progress=Math.max(0,(now-this.startTime)/this.duration);this.ctx.save();
    const styles=getComputedStyle(document.documentElement);this.currentType.draw(this.ctx,this.width,this.height,progress,now,{primary:styles.getPropertyValue("--primary").trim(),secondary:styles.getPropertyValue("--secondary").trim(),accent:styles.getPropertyValue("--accent").trim(),danger:styles.getPropertyValue("--danger").trim(),duration:this.duration,config:this.config,difficulty:this.round});this.ctx.restore();this.particles=drawParticles(this.ctx,this.particles,delta);
    if(this.currentType.id==="rhythm"&&progress>=0){const beat=Math.min(3,Math.floor(progress*4));if(beat!==this.lastBeat&&beat>=0&&beat<4){this.lastBeat=beat;this.feedback.tone(beat===3?"combo":"start");this.feedback.vibrate([8]);}}
    if(now>=this.startTime&&!this.evaluated)this.locked=false;if(!this.locked&&now>this.timeoutTime)this.evaluate(now,true);this.updateTimer(now);if(this.active&&!this.paused)this.raf=requestAnimationFrame(this.boundFrame);
  }
  handleTap(event){event.preventDefault();if(!this.active||this.paused||this.locked||this.evaluated)return;this.evaluate(performance.now(),false);}
  classify(abs){for(const level of RESULT_LEVELS)if(abs<=level.max*this.toleranceScale)return level;return RESULT_LEVELS.at(-1);}
  evaluate(playerTime,timedOut){
    if(this.locked||this.evaluated||this.finishing)return;this.evaluated=true;this.locked=true;const difference=timedOut?this.timeoutTime-this.targetTime:playerTime-this.targetTime,abs=Math.abs(difference);let result=timedOut?RESULT_LEVELS.at(-1):this.classify(abs);
    const progress=(playerTime-this.startTime)/this.duration;let specialReason="";if(!timedOut&&this.currentType.id==="forbidden"&&progress>.3&&progress<.66){result=RESULT_LEVELS.at(-1);specialReason=this.currentType.reason;}
    this.history.push(result.rank);this.differences.push(abs);if(difference<0)this.early++;else if(difference>0)this.late++;
    const success=result.rank!=="miss";if(success&&result.rank!=="weak")this.combo++;else this.combo=0;this.bestCombo=Math.max(this.bestCombo,this.combo);
    if(result.rank==="perfect"){this.perfect++;this.perfectCombo++;this.bestPerfectCombo=Math.max(this.bestPerfectCombo,this.perfectCombo);}else this.perfectCombo=0;
    const multiplier=this.combo>=20?3:this.combo>=15?2.5:this.combo>=10?2:this.combo>=5?1.5:this.combo>=3?1.2:1,points=Math.round(result.base*multiplier);this.score+=points;
    if(!success&&(this.mode==="classic"||this.mode==="daily"))this.lives--;this.feedback.result(result.rank);this.showResult(result,difference,points,timedOut,specialReason);this.updateHud();this.recordRound(result,abs,difference);
    if(result.rank==="perfect"){this.el.arena.classList.add("perfect-flash");this.particles=makeParticles(this.width/2,this.height/2,["#ffffff","#55dec1","#48e39b","#21b98f"],this.data.reducedMotion);setTimeout(()=>this.el.arena.classList.remove("perfect-flash"),600);}else if(!success){this.el.arena.classList.add("shake");setTimeout(()=>this.el.arena.classList.remove("shake"),360);}
    const delay=this.data.reducedMotion?420:(this.mode==="timed"?520:780);this.nextTimer=setTimeout(()=>this.advanceAfterResult(result),delay);
  }
  advanceAfterResult(result){
    if(!this.active||this.finishing)return;
    if(this.tutorial){if(result.rank!=="miss")this.tutorialStep++;else this.round--;if(this.tutorialStep>=3){this.finishSession(true);}else this.nextRound();return;}
    if(this.mode==="streak"&&result.rank!=="perfect"){this.finishSession();return;}
    if((this.mode==="classic"||this.mode==="daily")&&this.lives<=0){this.finishSession();return;}
    if(this.mode==="daily"&&this.round>=12){this.finishSession();return;}
    if(this.mode==="timed"&&performance.now()>=this.sessionEndTime){this.finishSession();return;}
    this.nextRound();
  }
  finishSession(tutorialComplete=false){if(this.finishing)return;this.finishing=true;this.active=false;cancelAnimationFrame(this.raf);clearTimeout(this.nextTimer);clearTimeout(this.missionTimer);if(!tutorialComplete){this.feedback.tone("over");this.feedback.vibrate([50,40,80]);}this.onFinish(this.summary(),tutorialComplete);}
  showResult(result,difference,points,timedOut,specialReason){this.el.resultCard.className=`result-card ${result.rank} show`;this.el.resultLabel.textContent=result.label;if(specialReason)this.el.resultTiming.textContent=specialReason;else if(timedOut)this.el.resultTiming.textContent="Süre doldu";else if(Math.abs(difference)<1)this.el.resultTiming.textContent="Tam zamanında";else this.el.resultTiming.textContent=`${Math.round(Math.abs(difference))} ms ${difference<0?"erken":"geç"}`;this.el.resultPoints.textContent=points?`+${points.toLocaleString("tr-TR")}`:(this.mode==="timed"?"Seri sıfırlandı":this.mode==="streak"?"Seri sona erdi":"Enerji kaybettin");}
  recordRound(result,abs,difference){
    if(this.tutorial)return;this.data.totalRounds=(this.data.totalRounds||0)+1;this.data.totalDifference=(this.data.totalDifference||0)+abs;this.data.measuredTouches=(this.data.measuredTouches||0)+1;if(difference<0)this.data.earlyTouches=(this.data.earlyTouches||0)+1;else if(difference>0)this.data.lateTouches=(this.data.lateTouches||0)+1;
    if(result.rank==="perfect")this.data.totalPerfectHits=(this.data.totalPerfectHits||0)+1;if(result.rank==="great")this.data.totalGreatHits=(this.data.totalGreatHits||0)+1;this.data.bestCombo=Math.max(this.data.bestCombo||0,this.combo);this.data.bestPerfectCombo=Math.max(this.data.bestPerfectCombo||0,this.bestPerfectCombo);this.data.roundTypeCounts||={};this.data.roundTypeCounts[this.currentType.id]=(this.data.roundTypeCounts[this.currentType.id]||0)+1;
    const task=this.data.dailyChallenge;if(task&&!task.claimed){if(task.type==="rounds")task.progress++;if(task.type==="perfect"&&result.rank==="perfect")task.progress++;if(task.type==="score")task.progress=this.score;if(task.progress>=task.target)task.claimed=true;}
    this.onStatsChange();
  }
  updateHud(){
    this.el.score.textContent=this.score.toLocaleString("tr-TR");this.el.round.textContent=Math.max(1,this.round);const displayCombo=this.mode==="streak"?this.perfectCombo:this.combo,multiplier=displayCombo>=20?3:displayCombo>=15?2.5:displayCombo>=10?2:displayCombo>=5?1.5:displayCombo>=3?1.2:1;this.el.combo.textContent=this.mode==="streak"?`TAM SERİ ×${displayCombo}`:`SERİ ×${multiplier}`;this.el.comboFill.style.width=`${Math.min(100,(displayCombo%5)*20)}%`;
    [...this.el.energy.children].forEach((orb,i)=>orb.classList.toggle("lost",i>=this.lives));const showEnergy=this.mode==="classic"||this.mode==="daily"||this.mode==="tutorial";this.el.energy.classList.toggle("hidden",!showEnergy);this.el.energy.setAttribute("aria-label",`${this.lives} enerji`);if(this.el.modeLabel)this.el.modeLabel.textContent=MODE_LABELS[this.mode]||"EĞİTİM";if(this.el.timer)this.el.timer.classList.toggle("hidden",this.mode!=="timed");
  }
  updateTimer(now=performance.now()){if(this.el.timer&&this.mode==="timed")this.el.timer.textContent=Math.max(0,(this.sessionEndTime-now)/1000).toFixed(1);}
  pause(){if(!this.active||this.paused)return;this.paused=true;this.pauseTime=performance.now();cancelAnimationFrame(this.raf);}
  async resume(countdown){if(!this.active||!this.paused)return;await countdown();const now=performance.now(),shift=now-this.pauseTime;this.startTime+=shift;this.targetTime+=shift;this.timeoutTime+=shift;if(this.mode==="timed")this.sessionEndTime+=shift;this.lastFrame=now;this.paused=false;this.raf=requestAnimationFrame(this.boundFrame);}
  stop(){this.active=false;this.paused=false;this.locked=true;this.evaluated=false;this.finishing=true;cancelAnimationFrame(this.raf);clearTimeout(this.nextTimer);clearTimeout(this.missionTimer);}
  summary(){const average=this.differences.length?Math.round(this.differences.reduce((a,b)=>a+b,0)/this.differences.length):0,best=this.differences.length?Math.round(Math.min(...this.differences)):0;return{mode:this.mode,score:this.score,round:this.round,bestCombo:this.bestCombo,bestPerfectCombo:this.bestPerfectCombo,perfect:this.perfect,average,best,early:this.early,late:this.late,types:new Set(this.recentTypes).size};}
}
window.TamGame=Game;
})();