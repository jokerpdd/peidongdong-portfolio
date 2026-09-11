(() => {
  'use strict';
  const $=selector=>document.querySelector(selector);
  const hero=$('.hero'),stage=$('#stage'),poster=$('.hero-poster'),video=$('#transitionVideo');
  const nextCue=$('#nextCue'),cueText=$('#cueText'),status=$('#transitionStatus');
  const dialog=$('#projectDialog'),projectScroll=$('#projectScroll'),projectMedia=$('#projectMedia');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),mobile=matchMedia('(max-width:760px)');
  const water=new window.WaterScene($('#waterCanvas'));
  const titles=['首屏','个人简介','项目经历'];
  const projects=window.PORTFOLIO_PROJECTS;
  const labels={aigc:'AIGC',brand:'品牌创意 / IP 视觉',explore:'更多视觉探索'};
  const imageCache=new Map();
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  let savedScroll=0,lastFocus=null,lastWheelAt=0,wheelSum=0,lockedUntil=0,touchStart=null,needsFreshWheel=false;

  function assetFor(index){return `./assets/${mobile.matches?'mobile':'scene'}-${String(index+1).padStart(2,'0')}.webp`;}
  function loadImage(src){
    if(imageCache.has(src))return imageCache.get(src);
    const result=new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});
    imageCache.set(src,result);return result;
  }
  async function showStill(index,fade=false){
    const source=assetFor(index);
    let image;
    try{image=await loadImage(source);}catch(e){image=null;}
    let ghost;
    if(fade&&!water.available&&!reduced.matches){
      ghost=poster.cloneNode(true);ghost.setAttribute('aria-hidden','true');ghost.querySelector('img').removeAttribute('id');stage.insertBefore(ghost,video);
    }
    poster.querySelector('source').srcset=`./assets/mobile-${String(index+1).padStart(2,'0')}.webp`;
    $('#heroImage').src=`./assets/scene-${String(index+1).padStart(2,'0')}.webp`;
    if(image)water.setMedia(image);
    if(ghost){const animation=ghost.animate([{opacity:1},{opacity:0}],{duration:430,fill:'forwards'});animation.finished.then(()=>ghost.remove()).catch(()=>ghost.remove());}
  }
  function preloadTransition(index){
    if(index>1||reduced.matches)return;
    const source=`./assets/transition-${String(index+1).padStart(2,'0')}.mp4`;
    if(video.getAttribute('src')!==source){video.src=source;video.load();}
  }
  function videoReady(){
    if(video.readyState>=2)return Promise.resolve(true);
    return new Promise(resolve=>{
      let timeout;
      const finish=ready=>{clearTimeout(timeout);video.removeEventListener('loadeddata',loaded);video.removeEventListener('error',failed);resolve(ready);};
      const loaded=()=>finish(true),failed=()=>finish(false);
      video.addEventListener('loadeddata',loaded,{once:true});video.addEventListener('error',failed,{once:true});timeout=setTimeout(failed,6500);
    });
  }
  async function playTransition(from,to){
    if(reduced.matches||to<from){await showStill(to,true);if(!reduced.matches)await wait(430);return;}
    preloadTransition(from);
    if(!await videoReady()){await showStill(to,true);return;}
    video.currentTime=0;video.muted=true;
    video.playbackRate=Number.isFinite(video.duration)&&video.duration>0?video.duration/2:1.5;
    if(mobile.matches){video.style.objectPosition=`${[50,25,70][from]}% center`;video.style.transition='none';}
    await new Promise(resolve=>{
      let done=false,timeout;
      const finish=()=>{if(done)return;done=true;clearTimeout(timeout);video.removeEventListener('ended',finish);video.removeEventListener('error',finish);resolve();};
      video.addEventListener('ended',finish,{once:true});video.addEventListener('error',finish,{once:true});
      timeout=setTimeout(finish,8500);
      video.play().then(()=>{
        if(done)return;
        video.classList.add('is-playing');cueText.textContent='人物转场中';water.setMedia(video);
        if(mobile.matches){video.style.transition='object-position 2s linear, opacity .22s';video.style.objectPosition=`${[50,25,70][to]}% center`;}
      }).catch(finish);
    });
    await showStill(to,false);
    video.pause();video.classList.remove('is-playing');
  }
  function updateCopy(index){
    stage.dataset.scene=String(index);
    document.querySelectorAll('[data-copy]').forEach(el=>{el.hidden=Number(el.dataset.copy)!==index;});
    document.querySelectorAll('.scene-dots [data-go-scene]').forEach(button=>{
      Number(button.dataset.goScene)===index?button.setAttribute('aria-current','step'):button.removeAttribute('aria-current');
    });
    cueText.textContent=index===2?'向下浏览作品':'点击或向下滑动';
    status.textContent=titles[index];
    loadImage(assetFor(Math.min(2,index+1))).catch(()=>{});
  }
  const flow=new window.SceneFlow({
    transition:playTransition,
    onScene:updateCopy,
    onBusy:busy=>{stage.dataset.busy=String(busy);nextCue.disabled=busy;if(busy){status.textContent='人物转场中';cueText.textContent='正在切换场景…';}else{cueText.textContent=flow.scene===2?'向下浏览作品':'点击或向下滑动';lockedUntil=performance.now()+350;needsFreshWheel=true;wheelSum=0;preloadTransition(flow.scene);}},
    onExit:async()=>{location.hash==='#works'||history.replaceState(null,'','#works');window.scrollTo({top:hero.offsetTop+hero.offsetHeight,behavior:reduced.matches?'instant':'smooth'});await wait(600);}
  });
  const atHero=()=>window.scrollY<=hero.offsetTop+5;
  async function goToScene(index){
    if(dialog.open||flow.busy)return;
    if(!atHero()){window.scrollTo({top:0,behavior:'instant'});history.replaceState(null,'',location.pathname+location.search);}
    await flow.goTo(index);
  }
  nextCue.addEventListener('click',()=>flow.step(1));
  document.querySelectorAll('[data-go-scene]').forEach(el=>el.addEventListener('click',()=>goToScene(Number(el.dataset.goScene))));
  $('#homeButton').addEventListener('click',()=>goToScene(0));
  stage.addEventListener('click',e=>{if(e.target.closest('button,a,video')||getSelection()?.toString()||!atHero()||dialog.open)return;flow.step(1);});
  stage.addEventListener('pointermove',e=>water.pointerMove(e),{passive:true});
  window.addEventListener('wheel',e=>{
    if(dialog.open||!atHero()||Math.abs(e.deltaY)<Math.abs(e.deltaX)||e.ctrlKey)return;
    const now=performance.now(),idle=now-lastWheelAt;lastWheelAt=now;
    e.preventDefault();
    if(flow.busy||now<lockedUntil){wheelSum=0;return;}
    if(needsFreshWheel){if(idle<180)return;needsFreshWheel=false;}
    if(idle>170||Math.sign(wheelSum)!==Math.sign(e.deltaY))wheelSum=0;
    wheelSum+=e.deltaY*(e.deltaMode===1?16:1);
    if(Math.abs(wheelSum)>=48){const direction=Math.sign(wheelSum);wheelSum=0;flow.step(direction);}
  },{passive:false});
  stage.addEventListener('touchstart',e=>{if(e.touches.length===1&&!dialog.open)touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
  stage.addEventListener('touchmove',e=>{
    if(!touchStart||dialog.open||!atHero()||e.touches.length!==1)return;
    const dy=touchStart.y-e.touches[0].clientY,dx=touchStart.x-e.touches[0].clientX;
    if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>12)e.preventDefault();
  },{passive:false});
  stage.addEventListener('touchend',e=>{
    if(!touchStart||dialog.open||!atHero())return;
    const dy=touchStart.y-e.changedTouches[0].clientY,dx=touchStart.x-e.changedTouches[0].clientX;touchStart=null;
    if(Math.abs(dy)>55&&Math.abs(dy)>Math.abs(dx)){lockedUntil=performance.now()+350;flow.step(Math.sign(dy));}
  },{passive:true});
  mobile.addEventListener('change',()=>{if(!flow.busy)showStill(flow.scene);});
  window.addEventListener('scroll',()=>{$('.site-nav').classList.toggle('on-works',window.scrollY>hero.offsetHeight-80);},{passive:true});
  const visibilityObserver=new IntersectionObserver(([entry])=>water.setVisible(entry.isIntersecting&&!dialog.open),{threshold:0});visibilityObserver.observe(hero);
  const categoryObserver=new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting)document.querySelectorAll('.work-nav a').forEach(a=>a.classList.toggle('is-current',a.hash==='#'+entry.target.id));
  },{rootMargin:'-15% 0px -65% 0px'});
  document.querySelectorAll('.project-group').forEach(group=>categoryObserver.observe(group));

  function textElement(tag,className,text){const e=document.createElement(tag);e.className=className;e.textContent=text;return e;}
  function buildCards(){
    for(const group of ['aigc','brand','explore']){
      const items=projects.filter(p=>p.group===group),grid=$(`#${group}Grid`);
      $(`#${group}Count`).textContent=String(items.length).padStart(2,'0')+' PROJECTS';
      for(const [index,project] of items.entries()){
        const button=document.createElement('button');button.type='button';button.className='project-card'+(project.featured?' featured':'');button.dataset.project=project.id;button.setAttribute('aria-label','浏览作品：'+project.title);
        const visual=textElement('div','card-visual','');
        const image=new Image();image.src=project.featured?project.media[0].poster:project.cover;image.alt=project.title;image.width=960;image.height=600;image.loading='lazy';image.decoding='async';
        visual.append(image,textElement('span','card-arrow','↗'));
        if(project.media.some(m=>m.type==='video'))visual.append(textElement('span','card-badge','▷ 影像作品'));
        const meta=textElement('div','card-meta',''),title=document.createElement('div');title.append(textElement('span','card-title',project.title),textElement('span','card-tag',project.tag));meta.append(title,textElement('span','card-index',String(index+1).padStart(2,'0')));
        button.append(visual,meta);button.addEventListener('click',()=>openProject(project.id,true));grid.append(button);
      }
    }
  }
  function lockBody(){savedScroll=window.scrollY;lastFocus=document.activeElement;document.body.style.position='fixed';document.body.style.top=`-${savedScroll}px`;document.body.style.width='100%';water.setVisible(false);}
  function unlockBody(){document.body.style.position='';document.body.style.top='';document.body.style.width='';window.scrollTo({top:savedScroll,behavior:'instant'});water.setVisible(savedScroll<hero.offsetHeight);lastFocus?.focus({preventScroll:true});}
  function openProject(id,push=false){
    const project=projects.find(p=>p.id===id);if(!project)return;
    if(!dialog.open)lockBody();
    $('#projectCategory').textContent=labels[project.group];$('#projectBarTitle').textContent=project.title;
    $('#projectLabel').textContent=project.tag;$('#projectTitle').textContent=project.title;$('#projectDescription').textContent=project.description;
    projectMedia.replaceChildren();projectMedia.classList.toggle('is-longform',Boolean(project.longform));
    project.media.forEach((media,index)=>{
      if(media.type==='video'){
        const v=document.createElement('video');v.src=media.src;v.poster=media.poster;v.controls=true;v.playsInline=true;v.muted=true;v.preload='metadata';v.setAttribute('aria-label',project.title+'视频');projectMedia.append(v);
      }else{
        const image=new Image();image.src=media.src;image.alt=`${project.title} · ${index+1}`;image.width=media.width;image.height=media.height;image.loading=index===0?'eager':'lazy';image.decoding='async';
        image.addEventListener('error',()=>image.replaceWith(textElement('p','media-error','图片加载失败，请关闭作品后重新打开。')),{once:true});
        const figure=document.createElement('figure');figure.append(image);projectMedia.append(figure);
      }
    });
    if(!dialog.open)dialog.showModal();projectScroll.scrollTop=0;
    if(push)history.pushState({portfolioProject:true},'',`#project/${id}`);
  }
  function closeProject(){
    if(!dialog.open)return;
    dialog.close();
    if(history.state?.portfolioProject)history.back();
    else if(location.hash.startsWith('#project/'))history.replaceState(null,'',location.pathname+location.search+'#works');
  }
  dialog.addEventListener('close',()=>{projectMedia.querySelectorAll('video').forEach(v=>v.pause());projectMedia.replaceChildren();unlockBody();});
  dialog.addEventListener('cancel',e=>{e.preventDefault();closeProject();});
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeProject();}});
  $('#closeProject').addEventListener('click',closeProject);$('#endClose').addEventListener('click',closeProject);
  function syncHash(){const id=location.hash.startsWith('#project/')?location.hash.slice(9):null;if(id)openProject(id,false);else if(dialog.open)dialog.close();}
  window.addEventListener('hashchange',syncHash);
  buildCards();showStill(0).then(()=>{loadImage(assetFor(1)).catch(()=>{});preloadTransition(0);});updateCopy(0);syncHash();
})();
