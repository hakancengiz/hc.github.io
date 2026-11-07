/* Hakan Cengiz portfolio. No runtime framework. Images are loaded per universe. */
(()=>{
  'use strict';
  const root=document.documentElement,$=selector=>document.querySelector(selector),all=selector=>[...document.querySelectorAll(selector)];
  const sprite='universe-portfolio-assets/universe-images/sprite.svg#',reduced=matchMedia('(prefers-reduced-motion: reduce)'),desktop=matchMedia('(min-width:761px) and (pointer:fine)'),mobile=matchMedia('(max-width:640px)');
  const worlds=[
    {id:'pixel',slug:'pixel',name:'HIS OWN WORLD',caption:'IN HIS OWN WORLD',greeting:"Hello, world. I'm",label:'A DEVELOPER',window:'hakan.avatar',meta:'#f5f4ed',description:'A developer in his own world'},
    {id:'elf',slug:'elf',name:'ELVEN REALM',greeting:"Hello, traveler. I'm",label:'THE ELVEN RANGER',window:'hakan.woodland',meta:'#10241d',description:'An elven ranger in his own realm'},
    {id:'wizard',slug:'wizard',name:'ARCANE ACADEMY',greeting:"Hello, spellcaster. I'm",label:'THE WIZARD',window:'hakan.arcana',meta:'#241a20',description:'A wizard in his own academy'},
    {id:'jedi',slug:'cosmic',name:'COSMIC GUARDIAN',greeting:"Hello, galaxy. I'm",label:'THE STAR GUARDIAN',window:'hakan.galaxy',meta:'#080f21',description:'A guardian in his own galaxy'}
  ];
  const narration={
    pixel:{about:'A passion for programming.\nA soft spot for good design.',abilities:'Different tools.\nThe same love for building.',blog:'Notes made to be shared.',contact:'A question, an idea,\nor just a hello.',dispatch:'YOUR NEXT MESSAGE STARTS HERE'},
    elf:{about:'Every journey begins\nwith a little curiosity.',abilities:'Learned over many quests.',blog:'Pages from the field journal.',contact:'Send a letter\nbeyond the forest.',dispatch:'A LETTER FROM YOUR CORNER OF THE REALM'},
    wizard:{about:'Curiosity is\nits own kind of magic.',abilities:'Practiced, refined,\nand ready to cast.',blog:'Fresh notes from the study.',contact:'A few words\ncan begin something magical.',dispatch:'YOUR NEXT CHAPTER STARTS WITH A LETTER'},
    jedi:{about:'A curious mind.\nAn expanding universe.',abilities:'Systems online.',blog:'New entries in the mission log.',contact:'Open a channel.\nStart a conversation.',dispatch:'COMMUNICATION CHANNEL / READY'}
  };
  const read=key=>{try{return localStorage.getItem(key);}catch{return null;}},save=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
  const findWorld=value=>worlds.find(world=>world.id===value||world.slug===value);
  const initialWorld=()=>findWorld(new URLSearchParams(location.search).get('world'))||findWorld(read('hcengiz.preferred-world'))||worlds[0];
  const menu=$('.menu-toggle'),nav=$('#navigation'),navLinks=all('#navigation .nav-link'),header=$('.site-header'),hero=$('#home'),backdrop=$('.world-backdrop'),workspace=$('.portrait-workspace');
  const button=$('#world-switch'),portraits=all('[data-portrait-world]'),aboutImages=all('[data-about-world]'),notes=all('[data-world-note]'),dots=all('[data-world-dot]');
  const motionButton=$('#motion-toggle'),stage=$('#portrait-stage'),brand=$('.brand'),arrival=$('#universe-arrival'),bar=$('#pixel-progress'),blocks=[...bar.children];
  let active=initialWorld(),traveling=false,userPaused=read('hc-motion-paused')==='true',heroVisible=true,frame=0,lastTime=0,scrollY=window.scrollY,maxScroll=0,headerHeight=0,heroHeight=1,sections=[];
  let depth=0,painted=-1,percent=-1,selected,arrivalTimer,logoTimer,touchTimer,pressed,toastTimer;
  const pending=new Set();let observer;
  const motionOff=()=>userPaused||reduced.matches;
  function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS(svg.namespaceURI,'use');svg.setAttribute('class','ui-icon');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');use.setAttribute('href',sprite+'ui-'+name);svg.append(use);return svg;}
  function toast(text){const node=$('#toast');node.textContent=text;node.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('visible'),3000);}
  function hydrate(image,eager=false){if(!image||image.getAttribute('src'))return;image.loading=eager?'eager':'lazy';image.fetchPriority=eager?'high':'low';if(image.dataset.srcset)image.srcset=image.dataset.srcset;image.src=image.dataset.src;}
  function closeMenu(){nav.classList.remove('is-open');menu.setAttribute('aria-expanded','false');}
  menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';nav.classList.toggle('is-open',open);menu.setAttribute('aria-expanded',String(open));});
  nav.addEventListener('click',event=>{if(event.target.closest('a'))closeMenu();});
  document.addEventListener('click',event=>{if(!event.target.closest('.site-header'))closeMenu();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(menu.getAttribute('aria-expanded')==='true')menu.focus();closeMenu();}});
  matchMedia('(max-width:760px)').addEventListener('change',closeMenu);
  $('#year').textContent=new Date().getFullYear();
  $('#contact-form').addEventListener('submit',event=>{
    event.preventDefault();if(!event.currentTarget.reportValidity())return;
    const name=$('#cf-name').value.trim(),email=$('#cf-email').value.trim(),subject=$('#cf-subject').value.trim(),message=$('#cf-message').value.trim(),status=$('#form-status');status.hidden=false;
    if(!name||!email||!subject||!message){status.textContent='Please fill in all fields before sending.';return;}
    status.textContent='Your email app will open with the message ready. Send it there to complete delivery.';
    location.href='mailto:hakancengiz@mail.com?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
  });
  function applyWorld(world,announce=false,syncAddress=false){
    active=world;const index=worlds.indexOf(world),next=worlds[(index+1)%worlds.length];
    hydrate(portraits[index],true);hydrate(aboutImages.find(image=>image.dataset.aboutWorld===world.id));
    root.dataset.world=world.id;save('hcengiz.preferred-world',world.id);
    portraits.forEach(image=>{const selected=image.dataset.portraitWorld===world.id;image.classList.toggle('is-active',selected);image.setAttribute('aria-hidden',String(!selected));});
    $('#hero-greeting').textContent=world.greeting;$('#world-name').textContent=world.caption||world.name;$('#portrait-mode-label').textContent=world.label;
    $('#world-window-name').textContent=world.window;$('#world-count').textContent=String(index+1).padStart(2,'0')+' / 04';$('#world-next-label').textContent='NEXT: '+next.name;
    $('#theme-emblem-use').setAttribute('href',sprite+'sigil-'+world.id);$('#mobile-world-emblem').setAttribute('href',sprite+'sigil-'+world.id);$('#mobile-world-caption').textContent=world.description;
    dots.forEach((dot,i)=>dot.classList.toggle('is-active',i===index));notes.forEach(node=>{node.textContent=narration[world.id][node.dataset.worldNote];});
    button.setAttribute('aria-label','Switch universe: '+world.name+'. Next: '+next.name);button.title='Travel to '+next.name;
    $('meta[name="theme-color"]').content=world.meta;
    if(syncAddress){try{const url=new URL(location.href);url.searchParams.set('world',world.slug);history.replaceState(history.state,'',url.href);}catch{}}
    if(announce)$('#world-announcement').textContent=world.name+' theme activated. Next: '+next.name+'.';
    root.classList.remove('world-booting');
    schedule();
  }
  function clearArrival(){clearTimeout(arrivalTimer);arrival.replaceChildren();}
  function burst(){
    clearArrival();if(motionOff()||document.hidden||!heroVisible)return;
    const kinds={pixel:['sparkle'],elf:['leaf','sparkle'],wizard:['rune','candle'],jedi:['star-trail','sparkle']}[active.id],count=desktop.matches?8:4;
    const fragment=document.createDocumentFragment();
    for(let i=0;i<count;i++){const span=document.createElement('span');span.className='arrival-glyph arrival-'+kinds[i%kinds.length];span.style.cssText=`--launch-x:${i%2?90:5}%;--launch-y:${20+i*9}%;--arrival-dx:${i%2?-24:24}px;--arrival-spin:${i%2?20:-20}deg;--arrival-delay:${i*30}ms;--arrival-size:18px`;span.append(icon(kinds[i%kinds.length]));fragment.append(span);}
    arrival.append(fragment);arrivalTimer=setTimeout(clearArrival,1900);
  }
  button.addEventListener('click',async()=>{
    if(traveling)return;traveling=true;button.disabled=true;button.setAttribute('aria-busy','true');
    try{const next=worlds[(worlds.indexOf(active)+1)%worlds.length],image=portraits.find(image=>image.dataset.portraitWorld===next.id);hydrate(image,true);if(image.decode)await image.decode();applyWorld(next,true,true);burst();if(!motionOff()){stage.classList.add('motion-arriving');}}
    catch{toast('This portrait could not be loaded. Please try again.');}
    finally{traveling=false;button.disabled=false;button.removeAttribute('aria-busy');}
  });
  button.addEventListener('animationend',event=>{if(event.target===button)button.classList.remove('is-traveling');});
  stage.addEventListener('animationend',()=>stage.classList.remove('motion-arriving'));
  window.addEventListener('popstate',()=>applyWorld(initialWorld(),true));
  // Reparent existing elements only when crossing the mobile breakpoint.
  const card=$('#portrait-card'),summary=$('.mobile-world-summary'),identity=$('.mobile-identity'),greeting=$('#hero-greeting'),stack=$('.hero-stack'),blogLink=$('.hero-social .social-blog'),actions=$('.hero-actions'),slot=$('#mobile-portrait-slot');
  const homes=new Map([card,button,summary,greeting,stack,blogLink].map(node=>{const marker=document.createComment('desktop position');node.before(marker);return[node,marker];}));
  function layout(){
    const focused=document.activeElement===button;
    if(mobile.matches){identity.prepend(greeting);identity.append(stack);slot.append(card,button);stage.after(summary);actions.append(blogLink);}else{for(const [node,marker]of homes)marker.after(node);}
    root.classList.toggle('mobile-portrait-ready',mobile.matches);if(focused)button.focus({preventScroll:true});measure();
  }
  mobile.addEventListener('change',layout);
  // All scroll-driven work shares this scheduler. Only desktop parallax settles afterward.
  function schedule(){if(!frame&&!document.hidden)frame=requestAnimationFrame(tick);}
  function measure(){scrollY=window.scrollY;maxScroll=Math.max(0,root.scrollHeight-window.innerHeight);headerHeight=header.getBoundingClientRect().height;heroHeight=hero.getBoundingClientRect().height;sections=navLinks.map(link=>({link,node:$(link.hash)})).filter(item=>item.node).map(item=>({...item,top:item.node.getBoundingClientRect().top+scrollY}));schedule();}
  function tick(now){
    frame=0;if(document.hidden)return;
    const ratio=maxScroll?Math.max(0,Math.min(1,scrollY/maxScroll)):0,index=Math.min(blocks.length-1,Math.floor(ratio*blocks.length)),value=Math.round(ratio*100);
    if(index!==painted){if(painted>=0)blocks[painted].classList.remove('is-current');for(let i=Math.max(0,Math.min(index,painted));i<=Math.max(index,painted);i++)blocks[i].classList.toggle('is-read',i<index);blocks[index].classList.add('is-current');painted=index;}
    if(value!==percent){bar.setAttribute('aria-valuenow',String(value));percent=value;}
    let current=null;for(const item of sections)if(item.top<=scrollY+headerHeight+24)current=item.node.id;
    if(maxScroll>0&&scrollY>=maxScroll-2)current=sections.at(-1)?.node.id||null;
    if(current!==selected){selected=current;sections.forEach(({link,node})=>{if(node.id===current)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});}
    if(desktop.matches&&!motionOff()&&heroVisible){
      const target=Math.min(54,Math.max(0,scrollY*.1)),dt=lastTime?Math.min(50,now-lastTime):16.7;lastTime=now;depth+=(target-depth)*(1-Math.exp(-dt/140));
      backdrop.style.setProperty('--scroll-depth',depth.toFixed(2)+'px');if(Math.abs(target-depth)>.1)schedule();else lastTime=0;
    }else if(depth){depth=0;lastTime=0;backdrop.style.setProperty('--scroll-depth','0px');}
  }
  window.addEventListener('scroll',()=>{scrollY=window.scrollY;schedule();},{passive:true});window.addEventListener('resize',measure,{passive:true});window.addEventListener('load',measure,{once:true});window.addEventListener('hashchange',measure);window.addEventListener('pageshow',measure);
  if('ResizeObserver'in window){const resize=new ResizeObserver(measure);resize.observe(document.body);resize.observe(header);}
  desktop.addEventListener('change',measure);
  // Cache skill counts instead of traversing their tags after every click.
  const skills=all('[data-skill-category]').map(node=>({node,id:node.dataset.skillCategory,count:node.querySelectorAll('.skill-tags span').length,name:node.querySelector('h3').textContent.toUpperCase()})),filters=all('[data-skill-filter]');
  function filterSkills(category){
    if(category!=='all'&&!skills.some(item=>item.id===category))return;
    let count=0,groups=0;for(const item of skills){const show=category==='all'||item.id===category;item.node.hidden=!show;if(show){count+=item.count;groups++;}}
    filters.forEach(filter=>filter.setAttribute('aria-pressed',String(filter.dataset.skillFilter===category)));$('#skills-grid').classList.toggle('is-filtered',category!=='all');
    $('#skills-result').textContent=count+' TOOLS · '+(category==='all'?groups+' CATEGORIES':skills.find(item=>item.id===category).name);measure();
  }
  $('.skill-filters').addEventListener('click',event=>{const filter=event.target.closest('[data-skill-filter]');if(filter)filterSkills(filter.dataset.skillFilter);});
  $('.service-list').addEventListener('click',event=>{const link=event.target.closest('[data-skill-shortcut]');if(link)filterSkills(link.dataset.skillShortcut);});
  function finish(node){node.classList.remove('motion-pending','motion-enter');pending.delete(node);}
  function reveal(node){pending.delete(node);node.classList.remove('motion-pending');node.classList.add('motion-enter');}
  function observeReveals(scope=document){if(motionOff()||!observer)return;scope.querySelectorAll('.section-heading,.about-layout,.stat,.skills-controls,.skill-card,.skills-footer,.post,.contact-panel,.footer-inner').forEach(node=>{if(node.dataset.revealSeen)return;node.dataset.revealSeen='true';if(node.hidden)return;node.style.setProperty('--motion-delay',desktop.matches?'60ms':'0ms');node.classList.add('motion-pending');pending.add(node);observer.observe(node);});}
  if('IntersectionObserver'in window){
    observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.target===hero){heroVisible=entry.isIntersecting;[workspace,backdrop,button].forEach(node=>node.classList.toggle('motion-offscreen',!heroVisible));schedule();}else if(entry.isIntersecting){observer.unobserve(entry.target);reveal(entry.target);}}},{rootMargin:'0px 0px -12px 0px'});observer.observe(hero);
  }
  document.addEventListener('animationend',event=>{if(event.animationName==='motion-reveal-in')finish(event.target);});
  document.addEventListener('focusin',event=>{for(const node of pending)if(node.contains(event.target)){observer?.unobserve(node);finish(node);}});
  function clearLogo(){clearTimeout(logoTimer);brand.classList.remove('logo-play');}
  function syncMotion(){
    const off=motionOff();root.classList.toggle('motion-disabled',off);motionButton.disabled=reduced.matches;motionButton.setAttribute('aria-pressed',String(off));motionButton.textContent=reduced.matches?'Motion: reduced':off?'Motion: off':'Motion: on';motionButton.setAttribute('aria-label',off?'Enable animations':'Pause animations');
    if(off){for(const node of [...pending]){observer?.unobserve(node);finish(node);}clearLogo();clearArrival();stage.classList.remove('motion-arriving');button.classList.remove('is-traveling');}schedule();
  }
  motionButton.addEventListener('click',()=>{userPaused=!userPaused;save('hc-motion-paused',String(userPaused));syncMotion();});reduced.addEventListener('change',syncMotion);
  function playLogo(){if(motionOff()||!desktop.matches||document.hidden||brand.classList.contains('logo-play'))return;brand.classList.add('logo-play');logoTimer=setTimeout(clearLogo,800);}
  brand.addEventListener('pointerenter',playLogo);brand.addEventListener('focusin',playLogo);
  function clearPress(){clearTimeout(touchTimer);pressed?.classList.remove('is-touch-pressed');pressed=null;}
  $('#blog-posts').addEventListener('pointerdown',event=>{if(!['touch','pen'].includes(event.pointerType))return;clearPress();pressed=event.target.closest('.post');if(pressed){pressed.classList.add('is-touch-pressed');touchTimer=setTimeout(clearPress,700);}});
  window.addEventListener('pointerup',()=>{if(pressed){clearTimeout(touchTimer);touchTimer=setTimeout(clearPress,160);}},{passive:true});window.addEventListener('pointercancel',clearPress,{passive:true});
  document.addEventListener('visibilitychange',()=>{root.classList.toggle('motion-paused',document.hidden);if(document.hidden){cancelAnimationFrame(frame);frame=0;lastTime=0;clearLogo();clearPress();clearArrival();}else measure();});
  // Fresh RSS articles and covers replace the saved cards automatically.
  const cachedPosts=window.PORTFOLIO_BLOG||[],postKey=link=>{try{const url=new URL(link);return url.origin+url.pathname;}catch{return '';}};
  function httpsUrl(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}}
  function feedDate(value){const text=String(value||'').trim();return new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)?text.replace(' ','T')+'Z':text);}
  function coverUrl(post){
    const decode=value=>value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi,entity=>{
      const named={'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'};if(named[entity.toLowerCase()])return named[entity.toLowerCase()];
      const hex=/^&#x/i.test(entity),code=parseInt(entity.slice(hex?3:2,-1),hex?16:10);return code>0&&code<=0x10ffff?String.fromCodePoint(code):'';
    });
    const candidates=[post.thumbnail,post.enclosure?.link,post.enclosure?.url];
    for(const [tag]of String(post.content||post.description||'').matchAll(/<img\b[^>]*>/gi)){
      if(/\b(?:width|height)\s*=\s*["']?[12](?:["'\s>])/i.test(tag))continue;
      const src=tag.match(/\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);if(src)candidates.push(src[1]||src[2]||src[3]);
    }
    for(const candidate of candidates){if(typeof candidate!=='string'||!candidate.trim())continue;const url=httpsUrl(decode(candidate));if(url&&!new URL(url).pathname.startsWith('/_/stat'))return url;}
    return null;
  }
  function makePost(post){
    const url=httpsUrl(post.link);if(!url||typeof post.title!=='string'||!post.title.trim())return null;
    const card=document.createElement('a');card.className='post';card.href=url;card.target='_blank';card.rel='noopener noreferrer';
    const art=document.createElement('div');art.className='post-art post-cover';art.setAttribute('aria-hidden','true');const placeholder=document.createElement('span');placeholder.className='post-cover-fallback';placeholder.textContent='NOTES & IDEAS';art.append(placeholder);
    const cached=cachedPosts.find(item=>postKey(item.link)===postKey(post.link));
    const remote=coverUrl(post),source=remote||cached?.cover;
    if(source){const image=document.createElement('img');image.alt='';image.loading='lazy';image.decoding='async';image.fetchPriority='low';image.referrerPolicy='no-referrer';image.width=cached?.width||960;image.height=cached?.height||320;image.sizes='(max-width:640px) calc(100vw - 40px), 552px';
      if(!remote&&cached?.small)image.srcset=cached.small+' 640w, '+cached.cover+' 960w';
      if(remote){const cover=new URL(remote);if(/(^|\.)medium\.com$/.test(cover.hostname)&&/^\/max\/\d+\//.test(cover.pathname)){const sized=width=>{const url=new URL(remote);url.pathname=url.pathname.replace(/^\/max\/\d+\//,'/max/'+width+'/');return url.href;};if(navigator.connection?.saveData)image.src=sized(640);else{image.srcset=sized(640)+' 640w, '+sized(960)+' 960w';image.src=sized(960);}}else image.src=remote;}else image.src=source;
      image.addEventListener('error',()=>image.remove(),{once:true});art.append(image);
    }
    const body=document.createElement('div');body.className='post-body';const meta=document.createElement('div');meta.className='post-meta';const label=document.createElement('span');label.textContent='FROM THE BLOG';const date=document.createElement('span'),value=feedDate(post.pubDate);date.textContent=Number.isNaN(value.getTime())?'':value.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase();meta.append(label,date);
    const title=document.createElement('h3');title.lang='tr';title.textContent=post.title;const more=document.createElement('span');more.className='post-read';more.append(document.createTextNode('READ THE ARTICLE'));const arrow=document.createElement('b');arrow.setAttribute('aria-hidden','true');arrow.append(icon('arrow-up-right'));more.append(arrow);body.append(meta,title,more);card.append(art,body);return card;
  }
  let blogRequested=false;
  async function refreshBlog(){
    if(blogRequested)return;blogRequested=true;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000),container=$('#blog-posts');container.setAttribute('aria-busy','true');
    try{
      const response=await fetch('https://api.rss2json.com/v1/api.json?rss_url='+encodeURIComponent('https://medium.com/feed/@hakancengiz'),{signal:controller.signal,cache:'no-store',credentials:'omit'});if(!response.ok)throw Error('feed');const data=await response.json();if(data.status!=='ok'||!Array.isArray(data.items)||!data.items.length)throw Error('empty');
      const seen=new Set(),posts=data.items.filter(post=>post&&typeof post.title==='string'&&post.title.trim()&&httpsUrl(post.link)).sort((a,b)=>(feedDate(b.pubDate).getTime()||0)-(feedDate(a.pubDate).getTime()||0)).filter(post=>{const key=postKey(post.link);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,4);
      const cards=posts.map(makePost).filter(Boolean);if(!cards.length)throw Error('invalid');
      for(const node of [...pending])if(container.contains(node)){observer?.unobserve(node);finish(node);}
      container.replaceChildren(...cards);observeReveals(container);measure();$('#blog-note').hidden=true;
      const status=$('#blog-status');status.classList.add('sr-only');status.textContent=cards.length+' latest articles loaded.';
    }catch{const note=$('#blog-note');note.hidden=false;note.textContent='Showing saved articles. Visit the blog page for the latest posts.';}finally{clearTimeout(timeout);container.setAttribute('aria-busy','false');}
  }
  all('.post-cover img').forEach(image=>image.addEventListener('error',()=>image.remove(),{once:true}));
  if('requestIdleCallback'in window)requestIdleCallback(refreshBlog,{timeout:1500});else setTimeout(refreshBlog,400);
  applyWorld(active);layout();syncMotion();observeReveals();
  const entrance=new Promise(resolve=>setTimeout(()=>{root.classList.add('motion-intro-complete');resolve();},1400));
  const image=portraits.find(image=>image.dataset.portraitWorld===active.id);
  Promise.allSettled([entrance,document.fonts?.ready,image.decode?.()]).then(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>root.classList.add('switch-hint-ready'))));
  document.fonts?.ready.then(measure).catch(()=>{});
})();
