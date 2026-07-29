(() => {
const STORAGE_KEY="tamIsabet.v2";
const defaults={
  highScore:0,timedHighScore:0,bestStreak:0,totalGames:0,totalRounds:0,totalPerfectHits:0,totalGreatHits:0,bestCombo:0,bestPerfectCombo:0,totalDifference:0,measuredTouches:0,earlyTouches:0,lateTouches:0,
  gamesByMode:{classic:0,streak:0,timed:0,daily:0},roundTypeCounts:{},dailyScores:{},achievements:{},dailyChallenge:null,
  soundEnabled:true,vibrationEnabled:true,highContrast:false,reducedMotion:false,tutorialCompleted:false,theme:"sunset",themeRevision:2,targetStyle:"orbit"
};
function mergeData(saved){const merged={...defaults,...saved,gamesByMode:{...defaults.gamesByMode,...(saved.gamesByMode||{})},roundTypeCounts:{...(saved.roundTypeCounts||{})},dailyScores:{...(saved.dailyScores||{})},achievements:{...(saved.achievements||{})}};if((saved.themeRevision||0)<2){merged.theme="sunset";merged.themeRevision=2;}return merged;}
function loadData(){try{return mergeData(JSON.parse(localStorage.getItem(STORAGE_KEY)||localStorage.getItem("tamIsabet.v1")||"{}"));}catch{return mergeData({});}}
function saveData(data){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}catch{}}
function resetStats(data){const settings={soundEnabled:data.soundEnabled,vibrationEnabled:data.vibrationEnabled,highContrast:data.highContrast,reducedMotion:data.reducedMotion,tutorialCompleted:data.tutorialCompleted,theme:data.theme,targetStyle:data.targetStyle};Object.assign(data,mergeData({}),settings);saveData(data);}
window.TamStorage={defaults,loadData,saveData,resetStats};
})();