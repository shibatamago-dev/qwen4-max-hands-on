
(()=>{ 'use strict';
/* ================= utils ================= */
const el=id=>document.getElementById(id);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const pick=a=>a[(Math.random()*a.length)|0];
const key=c=>c.x+','+c.y;
const SIZE=10, MAXFLOOR=3;
const DIR4=[[1,0],[-1,0],[0,1],[0,-1]];

/* ================= DOM ================= */
const canvas=el('game'), ctx=canvas.getContext('2d',{alpha:false});
const stage=el('stage'), stageWrap=el('stageWrap');
const floorBadge=el('floorBadge'), hpFill=el('hpFill'), hpText=el('hpText');
const killsVal=el('killsVal'), scoreVal=el('scoreVal'), turnsVal=el('turnsVal'), bestSide=el('bestSide');
const ticker=el('ticker'), logList=el('logList'), banner=el('banner');
const scrTitle=el('scrTitle'), scrOver=el('scrOver'), scrWin=el('scrWin');
const soundBtn=el('soundBtn'), sndLabel=el('sndLabel');

/* ================= audio ================= */
const Snd={
  ctx:null,on:true,master:null,noiseBuf:null,
  ensure(){
    if(!this.ctx){
      const AC=window.AudioContext||window.webkitAudioContext; if(!AC)return;
      this.ctx=new AC();
      this.master=this.ctx.createGain(); this.master.gain.value=this.on?0.55:0;
      this.master.connect(this.ctx.destination);
      const len=this.ctx.sampleRate*0.6, buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate), d=buf.getChannelData(0);
      for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
      this.noiseBuf=buf; this.ambience();
    }
    if(this.ctx.state==='suspended')this.ctx.resume();
  },
  setOn(v){ this.on=v; if(this.master)this.master.gain.linearRampToValueAtTime(v?0.55:0,this.ctx.currentTime+0.06); },
  t(){return this.ctx.currentTime;},
  env(g,t0,a,peak,d){g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(peak,t0+a);g.gain.exponentialRampToValueAtTime(0.0001,t0+a+d);},
  tone(o){ if(!this.ctx||!this.on)return;
    const{f=440,f2=null,dur=0.15,type='sine',vol=0.2,delay=0}=o||{};
    const t0=this.t()+delay, osc=this.ctx.createOscillator(), g=this.ctx.createGain();
    osc.type=type; osc.frequency.setValueAtTime(f,t0);
    if(f2)osc.frequency.exponentialRampToValueAtTime(Math.max(1,f2),t0+dur);
    this.env(g,t0,0.008,vol,dur);
    osc.connect(g); g.connect(this.master); osc.start(t0); osc.stop(t0+dur+0.1);
  },
  noise(o){ if(!this.ctx||!this.on)return;
    const{dur=0.1,vol=0.2,fc=1000,q=1,type='bandpass',delay=0}=o||{};
    const t0=this.t()+delay, src=this.ctx.createBufferSource(); src.buffer=this.noiseBuf; src.loop=true;
    const f=this.ctx.createBiquadFilter(); f.type=type; f.frequency.value=fc; f.Q.value=q;
    const g=this.ctx.createGain(); this.env(g,t0,0.005,vol,dur);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t0); src.stop(t0+dur+0.1);
  },
  ambience(){
    const src=this.ctx.createBufferSource(); src.buffer=this.noiseBuf; src.loop=true;
    const f=this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=220;
    const g=this.ctx.createGain(); g.gain.value=0.045;
    const lfo=this.ctx.createOscillator(); lfo.frequency.value=0.11;
    const lg=this.ctx.createGain(); lg.gain.value=0.02;
    lfo.connect(lg); lg.connect(g.gain);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(); lfo.start();
    const drip=()=>{ if(this.on&&this.ctx.state==='running'){
        this.tone({f:1200,f2:420,dur:0.16,vol:0.035});
        this.tone({f:900,f2:380,dur:0.14,vol:0.018,delay:0.18});
      } setTimeout(drip,5000+Math.random()*9000); };
    setTimeout(drip,4000);
  }
};
const sfx={
  step(){Snd.noise({dur:.05,vol:.11,fc:300,type:'lowpass'});Snd.tone({f:90,f2:60,dur:.06,vol:.07});},
  bump(){Snd.tone({f:70,f2:45,dur:.09,type:'triangle',vol:.24});Snd.noise({dur:.06,vol:.14,fc:200,type:'lowpass'});},
  slash(){Snd.noise({dur:.12,vol:.24,fc:2400,q:2});Snd.tone({f:320,f2:120,dur:.1,type:'square',vol:.05});},
  hit(){Snd.tone({f:180,f2:70,dur:.12,type:'square',vol:.16});},
  die(){Snd.tone({f:340,f2:50,dur:.32,type:'sawtooth',vol:.19});Snd.noise({dur:.25,vol:.18,fc:900});},
  hurt(){Snd.tone({f:130,f2:50,dur:.25,type:'sawtooth',vol:.28});Snd.noise({dur:.15,vol:.18,fc:400,type:'lowpass'});},
  potion(){[523,659,784].forEach((f,i)=>Snd.tone({f,dur:.12,vol:.15,delay:i*.07}));Snd.tone({f:1568,dur:.2,vol:.05,delay:.21});},
  stairs(){Snd.tone({f:180,f2:760,dur:.5,vol:.17});[392,523,659].forEach((f,i)=>Snd.tone({f,dur:.15,vol:.11,delay:.15+i*.09}));},
  win(){[523,659,784,1046,1318].forEach((f,i)=>Snd.tone({f,dur:.22,type:'triangle',vol:.19,delay:i*.12}));},
  over(){[330,262,196,131].forEach((f,i)=>Snd.tone({f,f2:f*.9,dur:.35,type:'sawtooth',vol:.15,delay:i*.22}));},
  ui(){Snd.tone({f:700,f2:900,dur:.05,vol:.09});},
  wait(){Snd.tone({f:220,dur:.06,vol:.07,type:'triangle'});}
};

/* ================= state ================= */
const ETYPES={
  slime:{name:'スライム',hp:10,atk:3,score:100,color:'#a3e635'},
  skel:{name:'骸骨兵',hp:16,atk:5,score:150,color:'#ece7d6'},
  imp:{name:'影魔',hp:18,atk:6,score:200,color:'#b18cff'}
};
const COMP=[['slime','slime','slime'],['skel','skel','slime'],['imp','imp','skel']];
const FLOOR_SUB=['','篝火を頼りに進め','骸骨兵が徘徊する','影魔の巣 — 最深層'];
const CONF_COLORS=['#ffd166','#ffb347','#2dd4bf','#38e1ff','#ff5252','#b18cff'];

const G={
  state:'title', floor:1, kills:0, score:0, turns:0, best:0,
  grid:[], seen:[], deco:[], bright:[], lit:[],
  exit:{x:8,y:8}, enemies:[], potions:[],
  player:{x:1,y:1,rx:1,ry:1,hp:36,maxHp:36,atk:8,dir:{x:0,y:1},flash:0,lunge:null,spawnT:1},
  lock:0, queued:null, shake:0, hurtFlash:0, fade:0, time:0, lightR:3.7, ambT:0, confT:0
};
for(let y=0;y<SIZE;y++){G.bright.push(Array(SIZE).fill(0));G.lit.push(Array(SIZE).fill(0));}
try{G.best=parseInt(localStorage.getItem('torchlit_best')||'0',10)||0;}catch(e){}
const particles=[], popups=[];
let pending=0, bannerTimer=0;

/* ================= map ================= */
function bfs(grid,sx,sy){
  const d=Array.from({length:SIZE},()=>Array(SIZE).fill(-1));
  const q=[[sx,sy]]; d[sy][sx]=0;
  for(let i=0;i<q.length;i++){
    const[x,y]=q[i];
    for(const[dx,dy]of DIR4){
      const nx=x+dx,ny=y+dy;
      if(nx<0||ny<0||nx>=SIZE||ny>=SIZE)continue;
      if(grid[ny][nx]===1||d[ny][nx]!==-1)continue;
      d[ny][nx]=d[y][x]+1; q.push([nx,ny]);
    }
  }
  return d;
}
function genFloor(f){
  let grid,start,dist,reach,ok=false;
  for(let a=0;a<200&&!ok;a++){
    if(a>=150){
      grid=Array.from({length:SIZE},(_,y)=>Array.from({length:SIZE},(_,x)=>(x===0||y===0||x===SIZE-1||y===SIZE-1)?1:0));
      start={x:1,y:1}; dist=bfs(grid,1,1); reach=[];
      for(let y=1;y<9;y++)for(let x=1;x<9;x++)reach.push({x,y});
      ok=true; break;
    }
    grid=Array.from({length:SIZE},(_,y)=>Array.from({length:SIZE},(_,x)=>(x===0||y===0||x===SIZE-1||y===SIZE-1)?1:(Math.random()<0.19?1:0)));
    const cells=[];
    for(let y=1;y<SIZE-1;y++)for(let x=1;x<SIZE-1;x++)if(grid[y][x]===0)cells.push({x,y});
    if(cells.length<40)continue;
    start=pick(cells); dist=bfs(grid,start.x,start.y);
    reach=cells.filter(c=>dist[c.y][c.x]>=0);
    if(reach.length>=42)ok=true;
  }
  const maxD=Math.max(...reach.map(c=>dist[c.y][c.x]));
  const exC=reach.filter(c=>dist[c.y][c.x]>=Math.max(5,maxD*0.55));
  const exit=pick(exC.length?exC:reach);
  const used=new Set([key(start),key(exit)]);
  const enemies=[];
  for(const type of COMP[f-1]){
    let cands=reach.filter(c=>dist[c.y][c.x]>=4&&!used.has(key(c)));
    if(!cands.length)cands=reach.filter(c=>!used.has(key(c)));
    const c=pick(cands); used.add(key(c));
    const d=ETYPES[type], hp=d.hp+(f-1)*3;
    enemies.push({type,x:c.x,y:c.y,rx:c.x,ry:c.y,hp,maxHp:hp,atk:d.atk+(f-1),flash:0,lunge:null,seed:Math.random()*10,spawnT:0});
  }
  const potions=[];
  for(let i=0;i<2;i++){
    const cands=reach.filter(c=>dist[c.y][c.x]>=2&&!used.has(key(c)));
    const c=pick(cands); used.add(key(c));
    potions.push({x:c.x,y:c.y,seed:Math.random()*10});
  }
  G.grid=grid; G.exit=exit; G.enemies=enemies; G.potions=potions;
  G.seen=Array.from({length:SIZE},()=>Array(SIZE).fill(false));
  G.deco=Array.from({length:SIZE},()=>Array.from({length:SIZE},()=>Math.random()));
  const p=G.player;
  p.x=start.x; p.y=start.y; p.rx=start.x; p.ry=start.y; p.dir={x:0,y:1}; p.lunge=null; p.flash=0; p.spawnT=0;
}

/* ================= fx ================= */
function addP(o){ if(particles.length>280)particles.shift();
  particles.push(Object.assign({kind:'dot',x:0,y:0,vx:0,vy:0,grav:0,t:0,life:.6,size:.05,color:'#fff',add:false,seed:Math.random()*7,rot:0,vr:0,ang:0,r0:.1,r1:.5},o)); }
function popup(x,y,txt,color,big){ if(popups.length>20)popups.shift();
  popups.push({x:x+0.5,y:y+0.15,txt,color,big:!!big,t:0,life:.9}); }
function sparks(tx,ty,color,n){ for(let i=0;i<n;i++){ const a=Math.random()*Math.PI*2, sp=1.5+Math.random()*2.2;
  addP({x:tx+0.5,y:ty+0.5,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-0.6,grav:5,life:.3+Math.random()*.25,size:.045,color,add:true}); } }
function dust(tx,ty){ for(let i=0;i<3;i++)addP({x:tx+0.5+(Math.random()-.5)*.4,y:ty+0.75,vx:(Math.random()-.5)*.5,vy:-.3-Math.random()*.3,life:.4,size:.05,color:'#8b93a7'}); }
function deathFx(tx,ty,color){
  sparks(tx,ty,color,16);
  for(let i=0;i<7;i++)addP({kind:'wisp',x:tx+0.5+(Math.random()-.5)*.4,y:ty+0.5,vx:(Math.random()-.5)*.4,vy:-1-Math.random()*.8,life:.9,size:.08,color,add:true});
  addP({kind:'ring',x:tx+0.5,y:ty+0.5,life:.35,r0:.1,r1:.55,color,add:true});
}
function slashFx(tx,ty,dir){ addP({kind:'slash',x:tx+0.5,y:ty+0.5,ang:Math.atan2(dir.y,dir.x),life:.16,size:.42,color:'#ffe9b0',add:true}); }
function sparkleFx(tx,ty){ for(let i=0;i<12;i++)addP({x:tx+0.5+(Math.random()-.5)*.5,y:ty+0.6,vx:(Math.random()-.5)*.8,vy:-1-Math.random()*1.4,life:.7,size:.045,color:Math.random()<.5?'#38e1ff':'#4ade80',add:true}); }
function portalFx(){ const e=G.exit; for(let i=0;i<24;i++){ const a=Math.random()*Math.PI*2,sp=1+Math.random()*2.5;
  addP({x:e.x+0.5,y:e.y+0.5,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1,grav:2,life:.6,size:.05,color:'#ffd166',add:true}); } }

/* ================= log / hud ================= */
function addLog(msg,type){
  type=type||'info';
  const li=document.createElement('li'); li.className=type; li.textContent=msg;
  logList.prepend(li);
  while(logList.children.length>30)logList.lastChild.remove();
  ticker.textContent=msg; ticker.className=type;
  ticker.classList.remove('flash'); void ticker.offsetWidth; ticker.classList.add('flash');
}
function updateHUD(){
  floorBadge.textContent='B'+G.floor+'F';
  const r=G.player.hp/G.player.maxHp;
  hpFill.style.width=(r*100)+'%';
  hpFill.className=r<=0.25?'low':r<=0.55?'mid':'';
  hpText.textContent=G.player.hp+'/'+G.player.maxHp;
  killsVal.textContent=G.kills;
  scoreVal.textContent=G.score.toLocaleString();
  turnsVal.textContent=G.turns;
  bestSide.textContent=G.best.toLocaleString();
}
function saveBest(){
  const nb=G.score>G.best;
  if(nb){G.best=G.score; try{localStorage.setItem('torchlit_best',String(G.best));}catch(e){}}
  el('bestTitle').textContent=G.best.toLocaleString();
  return nb;
}

/* ================= game logic ================= */
const enemyAt=(x,y)=>G.enemies.find(e=>e.x===x&&e.y===y);
const potionAt=(x,y)=>G.potions.findIndex(p=>p.x===x&&p.y===y);

function tryMove(dx,dy){
  if(G.state!=='playing')return;
  if(G.lock>0){G.queued={dx,dy};return;}
  act(dx,dy);
}
function waitTurn(){
  if(G.state!=='playing')return;
  if(G.lock>0){G.queued={wait:true};return;}
  sfx.wait(); popup(G.player.x,G.player.y,'…','#8b93a7'); endTurn();
}
function act(dx,dy){
  const p=G.player; p.dir={x:dx,y:dy};
  const nx=p.x+dx, ny=p.y+dy;
  if(nx<0||ny<0||nx>=SIZE||ny>=SIZE||G.grid[ny][nx]===1){
    p.lunge={dx,dy,t:0}; G.shake=Math.max(G.shake,2.5); sfx.bump(); return;
  }
  const en=enemyAt(nx,ny);
  if(en){ playerAttack(en); endTurn(); return; }
  p.x=nx; p.y=ny; sfx.step(); dust(nx,ny);
  const pi=potionAt(nx,ny);
  if(pi>=0){
    G.potions.splice(pi,1);
    const heal=Math.min(14,p.maxHp-p.hp); p.hp+=heal;
    popup(nx,ny,heal>0?'+'+heal:'MAX','#4ade80');
    sparkleFx(nx,ny); sfx.potion();
    addLog(heal>0?'回復薬を拾った（HP+'+heal+'）':'回復薬を拾ったがHPは満タンだ','good');
  }
  if(nx===G.exit.x&&ny===G.exit.y){ descend(); return; }
  endTurn();
}
function playerAttack(en){
  const p=G.player;
  p.lunge={dx:en.x-p.x,dy:en.y-p.y,t:0};
  let dmg=p.atk+((Math.random()*5)|0)-2;
  const crit=Math.random()<0.18; if(crit)dmg=Math.round(dmg*1.6);
  en.hp-=dmg; en.flash=1;
  G.shake=Math.max(G.shake,crit?6:3.5);
  slashFx(en.x,en.y,p.dir); sparks(en.x,en.y,ETYPES[en.type].color,crit?14:8);
  popup(en.x,en.y,String(dmg)+(crit?'!':''),crit?'#ffd166':'#ffffff',crit);
  sfx.slash(); sfx.hit();
  if(en.hp<=0){
    G.enemies.splice(G.enemies.indexOf(en),1);
    G.kills++;
    const sc=ETYPES[en.type].score*G.floor; G.score+=sc;
    deathFx(en.x,en.y,ETYPES[en.type].color);
    popup(en.x,en.y-0.4,'+'+sc,'#ffd166');
    sfx.die();
    addLog(ETYPES[en.type].name+'を倒した！ +'+sc,'gold');
  }else{
    addLog(ETYPES[en.type].name+'に'+dmg+'ダメージ'+(crit?'（会心！）':''),'info');
  }
}
function endTurn(){ G.turns++; G.lock=0.16; enemyTurn(); updateHUD(); }
function enemyTurn(){
  if(G.state!=='playing')return;
  const p=G.player, dist=bfs(G.grid,p.x,p.y);
  const occ=new Set(G.enemies.map(e=>key(e)));
  for(const en of G.enemies){
    if(G.state!=='playing')break;
    const md=Math.abs(en.x-p.x)+Math.abs(en.y-p.y);
    if(md===1){ enemyAttack(en); continue; }
    const here=dist[en.y][en.x]; if(here<0)continue;
    const opts=[];
    for(const[dx,dy]of DIR4){
      const nx=en.x+dx, ny=en.y+dy;
      if(nx<0||ny<0||nx>=SIZE||ny>=SIZE)continue;
      const dd=dist[ny][nx];
      if(dd<0||dd>=here)continue;
      if(occ.has(nx+','+ny))continue;
      if(nx===p.x&&ny===p.y)continue;
      opts.push({nx,ny,dd});
    }
    if(!opts.length)continue;
    const min=Math.min(...opts.map(o=>o.dd));
    const m=pick(opts.filter(o=>o.dd===min));
    occ.delete(key(en)); en.x=m.nx; en.y=m.ny; occ.add(key(en));
  }
}
function enemyAttack(en){
  const p=G.player;
  en.lunge={dx:p.x-en.x,dy:p.y-en.y,t:0};
  const dmg=Math.max(1,en.atk+((Math.random()*3)|0)-1);
  p.hp-=dmg; p.flash=1; G.hurtFlash=1; G.shake=Math.max(G.shake,5);
  popup(p.x,p.y,'-'+dmg,'#ff5252'); sparks(p.x,p.y,'#ff5252',6); sfx.hurt();
  addLog(ETYPES[en.type].name+'の攻撃！ '+dmg+'ダメージ','bad');
  if(p.hp<=0){ p.hp=0; gameOver(); }
}
function gameOver(){
  G.state='over'; G.queued=null;
  deathFx(G.player.x,G.player.y,'#ff5252');
  sparks(G.player.x,G.player.y,'#ffb347',14);
  G.shake=12; sfx.over();
  addLog('力尽きた… 篝火は消えた','bad');
  updateHUD();
  pending=setTimeout(showOver,950);
}
function descend(){
  if(G.floor>=MAXFLOOR){ winGame(); return; }
  G.state='transition'; G.queued=null;
  G.score+=200*G.floor;
  sfx.stairs(); portalFx();
  addLog('降り階段を見つけた… B'+(G.floor+1)+'Fへ（+'+(200*G.floor)+'）','sys');
  showBanner('B'+(G.floor+1)+'F',FLOOR_SUB[G.floor+1]);
  updateHUD();
  pending=setTimeout(()=>{
    G.floor++; genFloor(G.floor); G.state='playing'; hideBanner();
    updateHUD(); addLog('B'+G.floor+'F に到達 — 敵が強化されている','sys');
  },1050);
}
function winGame(){
  G.state='win'; G.queued=null;
  const bonus=1000+G.player.hp*10;
  G.score+=bonus;
  sfx.win(); portalFx(); sparks(G.player.x,G.player.y,'#ffd166',20);
  addLog('迷宮踏破！ 踏破ボーナス +'+bonus,'gold');
  updateHUD();
  pending=setTimeout(showWin,1150);
}
function showOver(){
  const nb=saveBest();
  el('ovFloor').textContent='B'+G.floor+'F';
  el('ovKills').textContent=G.kills;
  el('ovTurns').textContent=G.turns;
  el('ovScore').textContent=G.score.toLocaleString();
  el('ovBest').textContent=G.best.toLocaleString();
  el('ovRecord').hidden=!nb;
  scrOver.classList.add('on'); updateHUD();
}
function showWin(){
  const nb=saveBest();
  el('wnKills').textContent=G.kills;
  el('wnTurns').textContent=G.turns;
  el('wnScore').textContent=G.score.toLocaleString();
  el('wnBest').textContent=G.best.toLocaleString();
  el('wnRecord').hidden=!nb;
  scrWin.classList.add('on'); updateHUD();
}
function showBanner(f,sub){
  clearTimeout(bannerTimer);
  banner.querySelector('.bFloor').textContent=f;
  banner.querySelector('.bSub').textContent=sub;
  banner.classList.add('show');
}
function hideBanner(){ clearTimeout(bannerTimer); banner.classList.remove('show'); }
function startRun(){
  clearTimeout(pending); hideBanner();
  scrTitle.classList.remove('on'); scrOver.classList.remove('on'); scrWin.classList.remove('on');
  G.floor=1; G.kills=0; G.score=0; G.turns=0;
  G.lock=0; G.queued=null; G.shake=0; G.hurtFlash=0; G.fade=0;
  particles.length=0; popups.length=0;
  G.player.hp=G.player.maxHp;
  genFloor(1); G.state='playing';
  updateHUD();
  addLog('新たな探索が始まる — B1F','sys');
  showBanner('B1F',FLOOR_SUB[1]);
  bannerTimer=setTimeout(hideBanner,1100);
  sfx.ui();
}

/* ================= input ================= */
const DIRS={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0],W:[0,-1],S:[0,1],A:[-1,0],D:[1,0]};
window.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  const k=e.key;
  if(DIRS[k]||k===' ')e.preventDefault();
  Snd.ensure();
  if(G.state==='title'){ if(k==='Enter'||k===' ')startRun(); return; }
  if(G.state==='over'||G.state==='win'){ if(k==='Enter'||k===' '||k==='r'||k==='R')startRun(); return; }
  if(k==='r'||k==='R'){ startRun(); return; }
  if(G.state!=='playing')return;
  if(DIRS[k])tryMove(DIRS[k][0],DIRS[k][1]);
  else if(k===' ')waitTurn();
});
function bindHold(btn,fn){
  let t1=0,t2=0;
  const stop=()=>{clearTimeout(t1);clearInterval(t2);btn.classList.remove('press');};
  btn.addEventListener('pointerdown',e=>{
    e.preventDefault(); Snd.ensure(); btn.classList.add('press');
    fn(); t1=setTimeout(()=>{t2=setInterval(fn,150);},280);
  });
  ['pointerup','pointerleave','pointercancel'].forEach(ev=>btn.addEventListener(ev,stop));
  btn.addEventListener('contextmenu',e=>e.preventDefault());
}
document.querySelectorAll('.dbtn[data-dir]').forEach(b=>{
  const[dx,dy]=b.dataset.dir.split(',').map(Number);
  bindHold(b,()=>tryMove(dx,dy));
});
bindHold(el('waitBtn'),waitTurn);
let swipe=null;
canvas.addEventListener('pointerdown',e=>{Snd.ensure();swipe={x:e.clientX,y:e.clientY};});
canvas.addEventListener('pointerup',e=>{
  if(!swipe)return;
  const dx=e.clientX-swipe.x, dy=e.clientY-swipe.y; swipe=null;
  if(Math.hypot(dx,dy)<24)return;
  if(G.state==='title'){startRun();return;}
  if(G.state!=='playing')return;
  if(Math.abs(dx)>Math.abs(dy))tryMove(Math.sign(dx),0); else tryMove(0,Math.sign(dy));
});
stage.addEventListener('contextmenu',e=>e.preventDefault());
el('startBtn').addEventListener('click',()=>{Snd.ensure();startRun();});
el('ovRestart').addEventListener('click',()=>{Snd.ensure();startRun();});
el('wnRestart').addEventListener('click',()=>{Snd.ensure();startRun();});
el('restartBtn').addEventListener('click',()=>{Snd.ensure();startRun();});
soundBtn.addEventListener('click',()=>{
  Snd.ensure(); Snd.setOn(!Snd.on);
  soundBtn.classList.toggle('muted',!Snd.on);
  sndLabel.textContent=Snd.on?'ON':'OFF';
  soundBtn.setAttribute('aria-pressed',String(Snd.on));
  if(Snd.on)sfx.ui();
});

/* ================= rendering ================= */
let dpr=1; const view={tile:40};
function resize(){
  const w=stageWrap.clientWidth, h=stageWrap.clientHeight;
  const s=Math.max(180,Math.floor(Math.min(w,h)));
  stage.style.width=s+'px'; stage.style.height=s+'px';
  dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.round(s*dpr); canvas.height=Math.round(s*dpr);
  view.tile=s/SIZE;
}
new ResizeObserver(resize).observe(stageWrap);
window.addEventListener('resize',resize);
window.addEventListener('orientationchange',()=>setTimeout(resize,120));

function rr(x,y,w,h,r){
  r=Math.min(r,w/2,h/2);
  ctx.beginPath(); ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}
const brightAt=(rx,ry)=>G.bright[clamp(Math.round(ry),0,9)][clamp(Math.round(rx),0,9)];
function lungeOff(e){
  if(!e.lunge)return{x:0,y:0};
  const k=Math.sin(Math.PI*Math.min(1,e.lunge.t/0.2))*view.tile*0.2;
  return{x:e.lunge.dx*k,y:e.lunge.dy*k};
}
function computeBright(){
  const p=G.player;
  const R=(G.state==='title'?4.6:3.7)+Math.sin(G.time*6.3)*0.18+Math.sin(G.time*11.7)*0.1;
  G.lightR=R;
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const d=Math.hypot(x-p.rx,y-p.ry);
    let lit=clamp(1-(d-1.4)/(R-1.4),0,1); lit=lit*lit*(3-2*lit);
    if(lit>0.06)G.seen[y][x]=true;
    let b=Math.max(G.seen[y][x]?0.15:0.04,lit);
    if(G.seen[G.exit.y][G.exit.x]){
      b=Math.max(b,0.6*clamp(1-Math.hypot(x-G.exit.x,y-G.exit.y)/2.4,0,1));
    }
    for(const pot of G.potions){
      if(G.seen[pot.y][pot.x])b=Math.max(b,0.45*clamp(1-Math.hypot(x-pot.x,y-pot.y)/1.8,0,1));
    }
    G.bright[y][x]=Math.min(1,b); G.lit[y][x]=lit;
  }
}
function shadeTile(px,py,b,lit){
  const t=view.tile;
  if(b<0.99){ctx.fillStyle='rgba(4,5,11,'+((1-b)*0.97).toFixed(3)+')';ctx.fillRect(px,py,t,t);}
  if(lit>0.02){ctx.fillStyle='rgba(255,150,60,'+(lit*0.07).toFixed(3)+')';ctx.fillRect(px,py,t,t);}
}
function drawFloor(x,y){
  const t=view.tile,px=x*t,py=y*t,s=G.deco[y][x];
  ctx.fillStyle=(x+y)%2?'#252b3b':'#222837'; ctx.fillRect(px,py,t,t);
  ctx.strokeStyle='rgba(8,10,17,0.6)'; ctx.lineWidth=1; ctx.strokeRect(px+0.5,py+0.5,t-1,t-1);
  if(s>0.82){
    ctx.fillStyle='rgba(255,255,255,0.05)'; ctx.beginPath();
    ctx.arc(px+t*(0.2+s*0.5),py+t*0.3,t*0.03,0,7);
    ctx.arc(px+t*0.7,py+t*(0.5+s*0.3),t*0.025,0,7); ctx.fill();
  }else if(s<0.12){
    ctx.strokeStyle='rgba(8,10,17,0.5)'; ctx.beginPath();
    ctx.moveTo(px+t*0.2,py+t*0.7); ctx.lineTo(px+t*0.45,py+t*0.5); ctx.lineTo(px+t*0.6,py+t*0.62); ctx.stroke();
  }
  shadeTile(px,py,G.bright[y][x],G.lit[y][x]);
}
function drawWall(x,y){
  const t=view.tile,px=x*t,py=y*t,s=G.deco[y][x];
  ctx.fillStyle='#39415a'; ctx.fillRect(px,py,t,t*0.74);
  ctx.fillStyle='#232a3c'; ctx.fillRect(px,py+t*0.74,t,t*0.26);
  ctx.fillStyle='rgba(255,255,255,0.07)'; ctx.fillRect(px,py,t,2);
  ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(px,py+t*0.74-1,t,2);
  ctx.strokeStyle='rgba(8,10,16,0.5)'; ctx.lineWidth=1; ctx.strokeRect(px+0.5,py+0.5,t-1,t-1);
  if(s>0.72){
    ctx.strokeStyle='rgba(8,10,16,0.55)'; ctx.beginPath();
    ctx.moveTo(px+t*(s-0.5),py+t*0.1); ctx.lineTo(px+t*(s-0.35),py+t*0.35); ctx.lineTo(px+t*(s-0.55),py+t*0.6); ctx.stroke();
  }
  if(s<0.14){
    ctx.fillStyle='rgba(132,204,22,0.16)'; ctx.beginPath();
    ctx.ellipse(px+t*0.3,py+t*0.85,t*0.22,t*0.09,0,0,7); ctx.fill();
  }
  shadeTile(px,py,G.bright[y][x],G.lit[y][x]);
}
function drawExit(){
  const e=G.exit; if(!G.seen[e.y][e.x])return;
  const t=view.tile,px=e.x*t,py=e.y*t,cx=px+t/2,cy=py+t/2;
  const b=Math.max(G.bright[e.y][e.x],0.75);
  ctx.save(); ctx.globalAlpha=b;
  ctx.fillStyle='#0d1019'; rr(px+t*0.12,py+t*0.12,t*0.76,t*0.76,t*0.08); ctx.fill();
  const shades=['#1c2233','#141a29','#0c101c'];
  for(let i=0;i<3;i++){
    ctx.fillStyle=shades[i]; ctx.fillRect(px+t*0.18,py+t*(0.2+i*0.2),t*0.64,t*0.15);
    ctx.fillStyle='rgba(255,209,102,0.25)'; ctx.fillRect(px+t*0.18,py+t*(0.2+i*0.2),t*0.64,1.5);
  }
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(G.time*0.7);
  ctx.strokeStyle='#ffd166'; ctx.globalAlpha=b*(0.55+0.25*Math.sin(G.time*2.4));
  ctx.lineWidth=t*0.035; ctx.setLineDash([t*0.14,t*0.1]);
  ctx.beginPath(); ctx.arc(0,0,t*0.36,0,7); ctx.stroke(); ctx.restore();
  ctx.setLineDash([]);
  ctx.fillStyle='#ffd166'; ctx.globalAlpha=b*(0.5+0.4*Math.sin(G.time*3));
  ctx.beginPath(); ctx.moveTo(cx-t*0.09,cy-t*0.05); ctx.lineTo(cx+t*0.09,cy-t*0.05); ctx.lineTo(cx,cy+t*0.09); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawPotions(){
  const t=view.tile;
  for(const pot of G.potions){
    if(!G.seen[pot.y][pot.x])continue;
    const cx=(pot.x+0.5)*t, cy=(pot.y+0.5)*t;
    const bob=Math.sin(G.time*2.3+pot.seed)*t*0.03;
    const b=Math.max(G.bright[pot.y][pot.x],0.8);
    ctx.save(); ctx.globalAlpha=b;
    ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx,cy+t*0.26,t*0.15,t*0.05,0,0,7); ctx.fill();
    const g=ctx.createLinearGradient(cx,cy-t*0.1,cx,cy+t*0.22);
    g.addColorStop(0,'#7ef0ff'); g.addColorStop(1,'#0ea5c4');
    ctx.fillStyle=g; rr(cx-t*0.13,cy-t*0.04+bob,t*0.26,t*0.26,t*0.08); ctx.fill();
    ctx.fillStyle='#9adfef'; ctx.fillRect(cx-t*0.045,cy-t*0.16+bob,t*0.09,t*0.13);
    ctx.fillStyle='#8a5a2b'; rr(cx-t*0.055,cy-t*0.21+bob,t*0.11,t*0.06,t*0.02); ctx.fill();
    const bub=(G.time*0.5+pot.seed)%1;
    ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.beginPath();
    ctx.arc(cx-t*0.03,cy+t*0.14-bub*t*0.14+bob,t*0.02,0,7); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,'+(0.4+0.4*Math.sin(G.time*4+pot.seed)).toFixed(2)+')';
    ctx.lineWidth=1.5;
    const sx=cx+t*0.14, sy=cy-t*0.14+bob;
    ctx.beginPath(); ctx.moveTo(sx-t*0.04,sy); ctx.lineTo(sx+t*0.04,sy); ctx.moveTo(sx,sy-t*0.04); ctx.lineTo(sx,sy+t*0.04); ctx.stroke();
    ctx.restore();
  }
}
function drawPlayer(p){
  const t=view.tile, lo=lungeOff(p);
  const k=Math.min(1,p.spawnT*3);
  let cx=(p.rx+0.5)*t+lo.x, cy=(p.ry+0.5)*t+lo.y+(1-k)*t*0.3;
  const b=brightAt(p.rx,p.ry), bob=Math.sin(G.time*3.1)*t*0.02;
  ctx.save(); ctx.globalAlpha=(0.3+0.7*b)*k;
  ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(cx,cy+t*0.3,t*0.24,t*0.09,0,0,7); ctx.fill();
  const g=ctx.createLinearGradient(cx,cy-t*0.3,cx,cy+t*0.3);
  g.addColorStop(0,'#2dd4bf'); g.addColorStop(1,'#0f766e');
  ctx.fillStyle=g; ctx.beginPath();
  ctx.moveTo(cx,cy-t*0.3+bob);
  ctx.quadraticCurveTo(cx+t*0.26,cy-t*0.05+bob,cx+t*0.22,cy+t*0.28);
  ctx.quadraticCurveTo(cx,cy+t*0.36,cx-t*0.22,cy+t*0.28);
  ctx.quadraticCurveTo(cx-t*0.26,cy-t*0.05+bob,cx,cy-t*0.3+bob);
  ctx.fill();
  ctx.fillStyle='#14b8a6'; ctx.beginPath(); ctx.arc(cx,cy-t*0.14+bob,t*0.16,0,7); ctx.fill();
  ctx.fillStyle='#f2c99a'; ctx.beginPath();
  ctx.arc(cx+p.dir.x*t*0.03,cy-t*0.12+bob+p.dir.y*t*0.02,t*0.105,0,7); ctx.fill();
  ctx.fillStyle='#1f2937';
  const ex=p.dir.x*t*0.035, ey=p.dir.y*t*0.02;
  ctx.beginPath();
  ctx.arc(cx-t*0.04+ex,cy-t*0.13+bob+ey,t*0.018,0,7);
  ctx.arc(cx+t*0.04+ex,cy-t*0.13+bob+ey,t*0.018,0,7); ctx.fill();
  const lx=cx+(p.dir.x!==0?-p.dir.x*t*0.24:t*0.24), ly=cy+t*0.06+bob;
  ctx.strokeStyle='#7c5a2e'; ctx.lineWidth=t*0.03;
  ctx.beginPath(); ctx.moveTo(lx,ly-t*0.1); ctx.lineTo(lx,ly-t*0.02); ctx.stroke();
  ctx.fillStyle='#ffb347'; rr(lx-t*0.055,ly-t*0.02,t*0.11,t*0.14,t*0.03); ctx.fill();
  ctx.fillStyle='#fff3d6'; ctx.fillRect(lx-t*0.02,ly+t*0.02,t*0.04,t*0.06);
  ctx.restore();
  if(p.flash>0){
    ctx.save(); ctx.globalAlpha=p.flash*0.55; ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(cx,cy,t*0.3,0,7); ctx.fill(); ctx.restore();
  }
}
function drawEnemy(e){
  const t=view.tile, lo=lungeOff(e);
  const k=Math.min(1,e.spawnT*3);
  const cx=(e.rx+0.5)*t+lo.x, cy=(e.ry+0.5)*t+lo.y+(1-k)*t*0.3;
  const b=brightAt(e.rx,e.ry), dim=(0.28+0.72*b)*k;
  ctx.save(); ctx.globalAlpha=dim;
  ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(cx,cy+t*0.3,t*0.22,t*0.08,0,0,7); ctx.fill();
  let eyeY=cy, eyeDX=t*0.06;
  if(e.type==='slime'){
    const wob=Math.sin(G.time*4.2+e.seed)*0.05;
    const g=ctx.createLinearGradient(cx,cy-t*0.2,cx,cy+t*0.3);
    g.addColorStop(0,'#bef264'); g.addColorStop(1,'#4d7c0f');
    ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(cx,cy+t*0.08,t*(0.3+wob),t*(0.24-wob),0,0,7); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(cx-t*0.1,cy-t*0.02,t*0.07,t*0.045,-0.5,0,7); ctx.fill();
    eyeY=cy+t*0.02; eyeDX=t*0.09;
    ctx.fillStyle='#1a2e05'; ctx.beginPath();
    ctx.arc(cx-eyeDX,eyeY,t*0.035,0,7); ctx.arc(cx+eyeDX,eyeY,t*0.035,0,7); ctx.fill();
    ctx.strokeStyle='#1a2e05'; ctx.lineWidth=t*0.02; ctx.beginPath(); ctx.arc(cx,cy+t*0.1,t*0.05,0.3,Math.PI-0.3); ctx.stroke();
  }else if(e.type==='skel'){
    const bob=Math.sin(G.time*2.1+e.seed)*t*0.015;
    ctx.strokeStyle='#d9d3c0'; ctx.lineWidth=t*0.045; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(cx,cy+t*0.02+bob); ctx.lineTo(cx,cy+t*0.24); ctx.stroke();
    for(let i=0;i<3;i++){
      const ry=cy+t*(0.06+i*0.06)+bob;
      ctx.beginPath(); ctx.moveTo(cx-t*0.11,ry); ctx.quadraticCurveTo(cx,ry+t*0.05,cx+t*0.11,ry); ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx-t*0.13,cy+t*0.05+bob); ctx.lineTo(cx-t*0.2,cy+t*0.18);
    ctx.moveTo(cx+t*0.13,cy+t*0.05+bob); ctx.lineTo(cx+t*0.2,cy+t*0.18); ctx.stroke();
    ctx.fillStyle='#ece7d6'; ctx.beginPath(); ctx.arc(cx,cy-t*0.12+bob,t*0.16,0,7); ctx.fill();
    ctx.fillRect(cx-t*0.09,cy-t*0.02+bob,t*0.18,t*0.07);
    eyeY=cy-t*0.13+bob; eyeDX=t*0.06;
    ctx.fillStyle='#141824'; ctx.beginPath();
    ctx.arc(cx-eyeDX,eyeY,t*0.045,0,7); ctx.arc(cx+eyeDX,eyeY,t*0.045,0,7); ctx.fill();
  }else{
    const fl=Math.sin(G.time*2.7+e.seed)*t*0.04;
    const g=ctx.createLinearGradient(cx,cy-t*0.3,cx,cy+t*0.3);
    g.addColorStop(0,'#4c3a78'); g.addColorStop(1,'#221838');
    ctx.fillStyle=g; ctx.beginPath();
    ctx.moveTo(cx,cy-t*0.26+fl);
    ctx.quadraticCurveTo(cx+t*0.22,cy-t*0.05+fl,cx+t*0.16,cy+t*0.2+fl);
    ctx.quadraticCurveTo(cx,cy+t*0.3+fl,cx-t*0.16,cy+t*0.2+fl);
    ctx.quadraticCurveTo(cx-t*0.22,cy-t*0.05+fl,cx,cy-t*0.26+fl);
    ctx.fill();
    ctx.fillStyle='#b18cff';
    ctx.beginPath(); ctx.moveTo(cx-t*0.1,cy-t*0.2+fl); ctx.lineTo(cx-t*0.18,cy-t*0.34+fl); ctx.lineTo(cx-t*0.02,cy-t*0.24+fl); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx+t*0.1,cy-t*0.2+fl); ctx.lineTo(cx+t*0.18,cy-t*0.34+fl); ctx.lineTo(cx+t*0.02,cy-t*0.24+fl); ctx.closePath(); ctx.fill();
    eyeY=cy-t*0.08+fl; eyeDX=t*0.07;
    ctx.fillStyle='#ff4fd8'; ctx.beginPath();
    ctx.arc(cx-eyeDX,eyeY,t*0.035,0,7); ctx.arc(cx+eyeDX,eyeY,t*0.035,0,7); ctx.fill();
    ctx.strokeStyle='rgba(177,140,255,0.5)'; ctx.lineWidth=t*0.03;
    ctx.beginPath(); ctx.moveTo(cx,cy+t*0.24+fl);
    ctx.quadraticCurveTo(cx+t*0.15*Math.sin(G.time*3+e.seed),cy+t*0.36,cx+t*0.05,cy+t*0.42); ctx.stroke();
  }
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=k;
  if(e.type==='skel'){
    ctx.fillStyle='rgba(255,60,60,'+(0.5+0.25*Math.sin(G.time*5+e.seed)).toFixed(2)+')';
    ctx.beginPath(); ctx.arc(cx-eyeDX,eyeY,t*0.028,0,7); ctx.arc(cx+eyeDX,eyeY,t*0.028,0,7); ctx.fill();
  }else if(e.type==='imp'){
    ctx.fillStyle='rgba(255,79,216,'+(0.45+0.25*Math.sin(G.time*4+e.seed)).toFixed(2)+')';
    ctx.beginPath(); ctx.arc(cx-eyeDX,eyeY,t*0.04,0,7); ctx.arc(cx+eyeDX,eyeY,t*0.04,0,7); ctx.fill();
  }else if(b<0.45){
    ctx.strokeStyle='rgba(163,230,53,'+((0.45-b)*0.9).toFixed(2)+')'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.ellipse(cx,cy+t*0.08,t*0.3,t*0.24,0,0,7); ctx.stroke();
  }
  ctx.restore();
  if(e.hp<e.maxHp){
    const w=t*0.6, r=clamp(e.hp/e.maxHp,0,1);
    ctx.fillStyle='rgba(0,0,0,0.65)'; rr(cx-w/2,cy-t*0.44,w,t*0.07,t*0.03); ctx.fill();
    ctx.fillStyle=r>0.5?'#a3e635':r>0.25?'#ffb347':'#ff5252';
    if(r>0){rr(cx-w/2+1,cy-t*0.44+1,(w-2)*r,t*0.07-2,t*0.02); ctx.fill();}
  }
  if(e.flash>0){
    ctx.save(); ctx.globalAlpha=e.flash*0.55; ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(cx,cy,t*0.28,0,7); ctx.fill(); ctx.restore();
  }
}
function drawParticles(){
  const t=view.tile;
  for(const p of particles){
    const a=Math.max(0,1-p.t/p.life);
    ctx.save();
    if(p.add)ctx.globalCompositeOperation='lighter';
    ctx.globalAlpha=a;
    if(p.kind==='dot'||p.kind==='wisp'){
      ctx.fillStyle=p.color; ctx.beginPath();
      ctx.arc(p.x*t,p.y*t,Math.max(0.4,p.size*t*(0.5+0.5*a)),0,7); ctx.fill();
    }else if(p.kind==='ring'){
      const k=p.t/p.life;
      ctx.strokeStyle=p.color; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(p.x*t,p.y*t,(p.r0+(p.r1-p.r0)*k)*t,0,7); ctx.stroke();
    }else if(p.kind==='slash'){
      ctx.strokeStyle=p.color; ctx.lineWidth=t*0.06*a+1; ctx.lineCap='round';
      ctx.beginPath(); ctx.arc(p.x*t,p.y*t,p.size*t,p.ang-0.9,p.ang+0.9); ctx.stroke();
    }else if(p.kind==='conf'){
      ctx.fillStyle=p.color;
      ctx.translate(p.x*t,p.y*t); ctx.rotate(p.rot+p.vr*p.t);
      const w=p.size*t; ctx.fillRect(-w/2,-w/4,w,w/2);
    }
    ctx.restore();
  }
}
function drawPopups(){
  const t=view.tile;
  for(const q of popups){
    const k=q.t/q.life, a=Math.max(0,1-k*k);
    const px=q.x*t, py=(q.y-k*0.9)*t;
    ctx.save(); ctx.globalAlpha=a;
    ctx.font='800 '+Math.round(t*(q.big?0.42:0.3))+'px ui-monospace,Consolas,monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.lineWidth=3; ctx.strokeStyle='rgba(5,6,12,0.85)';
    ctx.strokeText(q.txt,px,py); ctx.fillStyle=q.color; ctx.fillText(q.txt,px,py);
    ctx.restore();
  }
}
function lightPass(s){
  const t=view.tile, p=G.player;
  ctx.save(); ctx.globalCompositeOperation='lighter';
  const px=(p.rx+0.5)*t, py=(p.ry+0.5)*t;
  let g=ctx.createRadialGradient(px,py,t*0.2,px,py,G.lightR*t);
  const fl=0.09+0.02*Math.sin(G.time*7.3);
  g.addColorStop(0,'rgba(255,150,60,'+fl.toFixed(3)+')'); g.addColorStop(1,'rgba(255,150,60,0)');
  ctx.fillStyle=g; ctx.fillRect(0,0,s,s);
  if(G.seen[G.exit.y][G.exit.x]){
    const ex=(G.exit.x+0.5)*t, ey=(G.exit.y+0.5)*t;
    g=ctx.createRadialGradient(ex,ey,0,ex,ey,t*1.8);
    g.addColorStop(0,'rgba(255,209,102,0.14)'); g.addColorStop(1,'rgba(255,209,102,0)');
    ctx.fillStyle=g; ctx.fillRect(ex-t*2,ey-t*2,t*4,t*4);
  }
  for(const pot of G.potions){
    if(!G.seen[pot.y][pot.x])continue;
    const qx=(pot.x+0.5)*t, qy=(pot.y+0.5)*t;
    g=ctx.createRadialGradient(qx,qy,0,qx,qy,t*1.2);
    g.addColorStop(0,'rgba(56,225,255,0.12)'); g.addColorStop(1,'rgba(56,225,255,0)');
    ctx.fillStyle=g; ctx.fillRect(qx-t*1.3,qy-t*1.3,t*2.6,t*2.6);
  }
  ctx.restore();
}
function vignette(s){
  let g=ctx.createRadialGradient(s/2,s/2,s*0.35,s/2,s/2,s*0.72);
  g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,0.4)');
  ctx.fillStyle=g; ctx.fillRect(0,0,s,s);
  let hurt=G.hurtFlash;
  if(G.state==='playing'&&G.player.hp<=10&&G.player.hp>0)hurt=Math.max(hurt,0.25+0.15*Math.sin(G.time*5));
  if(hurt>0.02){
    g=ctx.createRadialGradient(s/2,s/2,s*0.3,s/2,s/2,s*0.7);
    g.addColorStop(0,'rgba(255,40,40,0)'); g.addColorStop(1,'rgba(255,30,30,'+(0.45*hurt).toFixed(3)+')');
    ctx.fillStyle=g; ctx.fillRect(0,0,s,s);
  }
}
function draw(){
  const t=view.tile, s=t*SIZE;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#07080d'; ctx.fillRect(0,0,s,s);
  computeBright();
  ctx.save();
  ctx.translate((Math.random()*2-1)*G.shake,(Math.random()*2-1)*G.shake);
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    if(G.grid[y][x]===1)drawWall(x,y); else drawFloor(x,y);
  }
  drawExit(); drawPotions();
  const ents=[...G.enemies,G.player].sort((a,b)=>a.ry-b.ry);
  for(const e of ents){ if(e===G.player)drawPlayer(e); else drawEnemy(e); }
  drawParticles();
  ctx.restore();
  lightPass(s);
  drawPopups();
  vignette(s);
  if(G.fade>0.01){ctx.fillStyle='rgba(5,6,12,'+(G.fade*0.9).toFixed(3)+')';ctx.fillRect(0,0,s,s);}
}

/* ================= main loop ================= */
let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(0.05,(now-last)/1000)||0.016; last=now;
  G.time+=dt;
  if(G.lock>0){
    G.lock-=dt;
    if(G.lock<=0&&G.queued&&G.state==='playing'){
      const q=G.queued; G.queued=null;
      if(q.wait)waitTurn(); else act(q.dx,q.dy);
    }
  }
  const all=[G.player,...G.enemies];
  for(const e of all){
    const k=Math.min(1,dt*13);
    e.rx+=(e.x-e.rx)*k; e.ry+=(e.y-e.ry)*k;
    if(Math.abs(e.x-e.rx)<0.002)e.rx=e.x;
    if(Math.abs(e.y-e.ry)<0.002)e.ry=e.y;
    e.flash=Math.max(0,e.flash-dt*4);
    e.spawnT=Math.min(1,(e.spawnT||0)+dt);
    if(e.lunge){e.lunge.t+=dt; if(e.lunge.t>0.2)e.lunge=null;}
  }
  G.shake*=Math.exp(-5*dt); if(G.shake<0.05)G.shake=0;
  G.hurtFlash*=Math.exp(-2.5*dt);
  G.fade+=((G.state==='transition'?1:0)-G.fade)*Math.min(1,dt*4);
  G.ambT+=dt;
  if(G.ambT>0.15){
    G.ambT=0;
    if(G.state==='playing'||G.state==='title'||G.state==='transition'){
      const p=G.player;
      addP({x:p.rx+0.5+(Math.random()-.5)*.4,y:p.ry+0.35,vx:(Math.random()-.5)*.3,vy:-.5-Math.random()*.4,life:.7,size:.035,color:'#ffb347',add:true});
      if(G.seen[G.exit.y][G.exit.x])
        addP({x:G.exit.x+0.5+(Math.random()-.5)*.5,y:G.exit.y+0.6,vx:(Math.random()-.5)*.2,vy:-.4-Math.random()*.3,life:1.1,size:.04,color:'#ffd166',add:true});
      for(const pot of G.potions){
        if(G.seen[pot.y][pot.x]&&Math.random()<0.4)
          addP({x:pot.x+0.5+(Math.random()-.5)*.3,y:pot.y+0.5,vx:(Math.random()-.5)*.2,vy:-.5,life:.8,size:.03,color:'#38e1ff',add:true});
      }
    }
  }
  if(G.state==='win'){
    G.confT+=dt;
    if(G.confT>0.05){
      G.confT=0;
      for(let i=0;i<3;i++)addP({kind:'conf',x:Math.random()*10,y:-0.3,vx:(Math.random()-.5)*1.5,vy:1+Math.random()*1.5,grav:1.2,life:2.4,size:.1,color:pick(CONF_COLORS),rot:Math.random()*7,vr:(Math.random()-.5)*8});
    }
  }
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i]; p.t+=dt;
    if(p.t>=p.life){particles.splice(i,1);continue;}
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=p.grav*dt;
    if(p.kind==='wisp')p.x+=Math.sin(p.t*8+p.seed)*dt*0.4;
  }
  for(let i=popups.length-1;i>=0;i--){popups[i].t+=dt; if(popups[i].t>=popups[i].life)popups.splice(i,1);}
  draw();
}

/* ================= init ================= */
el('bestTitle').textContent=G.best.toLocaleString();
genFloor(1);
G.state='title';
updateHUD();
resize();
requestAnimationFrame(()=>{resize();requestAnimationFrame(frame);});
})();
