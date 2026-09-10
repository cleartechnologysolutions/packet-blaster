const fs = require('fs'), vm = require('vm'), assert = require('assert');
const nodes = {};
const handlers = {};
const canvasContext = new Proxy({}, { get: (o,k) => o[k] || (()=>{}), set: (o,k,v) => (o[k]=v,true) });
const node = id => nodes[id] ||= { textContent:'', classList:{add(){},remove(){}}, setAttribute(){}, addEventListener(type,fn){handlers[id+':'+type]=fn;}, width:960,height:720,getContext:()=>canvasContext };
const param = () => ({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}});
let buffers = 0;
let renderedKind;
const playedKinds = [];
class AudioContext {
  constructor(){this.state='running';this.currentTime=0;this.destination={};}
  createBuffer(ch,n,r){buffers++;return {kind:renderedKind,copyToChannel(data){assert.equal(data.length,n);}};}
  createBufferSource(){return {connect(){return this;}, start(){playedKinds.push(this.buffer.kind);},stop(){}};}
  createGain(){return {gain:param(),connect(){return this;}};}
  createOscillator(){return {frequency:param(),connect(){return this;},start(){},stop(){}};}
  createBiquadFilter(){return {frequency:param(),connect(){return this;}};}
}
const window = {AudioContext,matchMedia:()=>({matches:false}),addEventListener(type,fn){handlers[type]=fn;},setTimeout(){}};
const context = vm.createContext({window,document:{getElementById:node},localStorage:{getItem(){},setItem(){}},performance:{now:()=>0},requestAnimationFrame(){},console,Float32Array});
vm.runInContext(fs.readFileSync('public/audio-v6.js','utf8'),context);
const renderSound = window.ArcadeAudio.render;
window.ArcadeAudio.render = kind => {renderedKind=kind;return renderSound(kind);};
for(const kind of ['intro','explosion','laser','dive-scout','dive-striker','dive-command']) {
  const a=window.ArcadeAudio.render(kind);
  assert(a.every(Number.isFinite));
  const rms=Math.sqrt(a.reduce((s,v)=>s+v*v,0)/a.length);
  assert(rms>0.02 && rms<0.8);
  console.log(kind, (a.length/22050).toFixed(2)+'s', 'RMS',rms.toFixed(3));
}
let source=fs.readFileSync('public/game-v5.js','utf8');
source=source.replace(/\}\)\(\);\s*$/, 'window.test={startGame,update,firePlayer,fireEnemy,hitPlayer,beginLevel,beginDive,entrancePosition,divePosition,waveProfile,bossSprite,drawEnemy,enemies,enemyShots,playerShots,player,setWave:n=>{wave=n;spawnWave();},state:()=>({mode,waveClock,shots,lives,fireHeldSeconds,count:enemies.length})};})();');
vm.runInContext(source,context);
const t=window.test;t.startGame();
assert.equal(t.state().mode,'intro');t.firePlayer();assert.equal(t.state().shots,0);
for(let i=0;i<40;i++)t.update(0.1);
assert.equal(t.state().mode,'intro');assert.equal(t.state().count,0);
for(let i=0;i<7;i++)t.update(0.1);
assert.equal(t.state().mode,'playing');assert.equal(t.state().count,40);
t.firePlayer();assert.equal(t.state().shots,1);
t.player.invulnerable=0;t.hitPlayer();assert.equal(t.state().lives,4);assert(t.player.dead>0);
for(let i=0;i<15;i++)t.update(0.1);assert.equal(t.player.dead,0);
t.beginLevel();assert.equal(t.state().mode,'intro');assert.equal(t.state().count,0);
assert(buffers>=3);
console.log('PASS: intro blocks gameplay, aliens enter afterwards, laser/death audio triggers, respawn and next intro work.');

for (let path=0;path<4;path++) {
  const enemy={entrancePath:path,baseX:300,baseY:132};
  let lowSeconds=0, previous=t.entrancePosition(enemy,0);
  for(let step=1;step<=480;step++) {
    const pos=t.entrancePosition(enemy,step/480);
    assert(Number.isFinite(pos.x) && Number.isFinite(pos.y));
    assert(Math.hypot(pos.x-previous.x,pos.y-previous.y)<8,'entrance must not teleport');
    assert(pos.y<580,'low pass must stay above player');
    if(pos.y>430)lowSeconds+=0.01;
    previous=pos;
  }
  assert(lowSeconds>1.5,'need time to shoot low entrants');
  assert.equal(previous.x,enemy.baseX);assert.equal(previous.y,enemy.baseY);
  assert.equal(t.entrancePosition(enemy,0.2).x,t.entrancePosition(enemy,0.3).x,'descent is a straight line');
  const wingman={...enemy,baseX:500};
  assert.deepEqual(t.entrancePosition(enemy,0.55),t.entrancePosition(wingman,0.55),'squad must follow one path until climb');
}
t.startGame();for(let i=0;i<47;i++)t.update(0.1);
for(let i=0;i<200;i++)t.update(0.01);
const target=t.enemies[0];assert.equal(target.state,'entering');assert(target.y>430);
t.player.x=target.x;t.playerShots.length=0;t.firePlayer();
for(let i=0;i<35;i++)t.update(0.01);
assert(t.state().count<40,'real player shot must destroy an alien during its low entrance');
console.log('PASS: four low trailing paths, continuous turns, exact formation endpoints, and shootable entrants.');

// Isolate fire timing from random powerups dropped by incidental alien kills.
const step = seconds => { for(let i=0;i<Math.round(seconds*100);i++){t.playerShots.length=0;t.update(0.01);} };
const key = type => handlers[type]({code:'Space',preventDefault(){}});
t.startGame();step(4.7);t.player.invulnerable=100;
key('keydown');step(1.9);
t.player.cooldown=0;t.firePlayer();assert.equal(t.player.cooldown,0.2);
step(0.2);t.player.cooldown=0;t.firePlayer();assert.equal(t.player.cooldown,0.4);
// Repeated keydown must not reset a held trigger.
key('keydown');assert(t.state().fireHeldSeconds>=2);
t.player.rapid=10;t.player.cooldown=0;t.firePlayer();assert.equal(t.player.cooldown,0.17);
key('keyup');key('keydown'); // Release/repress within one frame still resets.
assert.equal(t.state().fireHeldSeconds,0);
t.player.cooldown=0;t.firePlayer();assert.equal(t.player.cooldown,0.085);
key('keyup');t.player.rapid=0;
const down=Object.keys(handlers).find(k=>k.endsWith(':pointerdown'));
handlers[down]({pointerType:'mouse'});step(2.1);
t.player.cooldown=0;t.firePlayer();assert.equal(t.player.cooldown,0.4);
key('keydown');handlers.pointerup({pointerType:'mouse'});
assert(t.state().fireHeldSeconds>=2,'Space still held: mouse release must not reset');
key('keyup');assert.equal(t.state().fireHeldSeconds,0);
t.player.cooldown=0;t.firePlayer();assert.equal(t.player.cooldown,0.2);
for(const type of ['scout','striker','command']) {
  const e={type,x:300};t.beginDive(e);assert.equal(e.state,'diving');
}
console.log('PASS: two-second slowdown, keyboard repeat, release/repress, mouse, combined inputs, rapid fire, and dive sound triggers.');

for (let level=1;level<=48;level+=2) {
  assert.deepEqual(t.waveProfile(level),t.waveProfile(level+1),'same variant for each pair');
  if(level>1)assert.notDeepEqual(t.waveProfile(level),t.waveProfile(level-2),'next pair changes');
  t.setWave(level);
  const e=t.enemies.find(e=>e.type==='scout');
  assert.equal(e.hp,level>2?2:1);
  e.x=400;e.y=200;
  t.enemyShots.length=0;t.fireEnemy(e);
  const count={single:1,twin:2,spread:3}[e.variant.weapon];
  assert.equal(t.enemyShots.length,count);
  t.enemyShots.forEach(s=>assert(Number.isFinite(s.vx)&&s.vy>0));
  if(count===2) {
    assert.equal(t.enemyShots[0].vx,t.enemyShots[1].vx);
    assert.equal(t.enemyShots[1].x-t.enemyShots[0].x,18);
  }
  if(count===3)assert(new Set(t.enemyShots.map(s=>s.vx)).size===3);
  let previous=t.entrancePosition(e,0), low=0;
  for(let i=1;i<=480;i++) {
    const p=t.entrancePosition(e,i/480);
    assert(Math.hypot(p.x-previous.x,p.y-previous.y)<12,'variant entrance stays continuous');
    assert(p.x>0&&p.x<960&&p.y<580,'entrance stays in safe corridor');
    if(p.y>430)low+=0.01;
    previous=p;
  }
  assert(low>1.5,'preserves low shooting pass');
  assert.equal(previous.x,e.baseX);assert.equal(previous.y,e.baseY);
  t.beginDive(e);
  assert(Number.isFinite(t.divePosition(e,0.5).x));
  t.drawEnemy(e);
}
const diver={diveStartX:400,targetX:420,baseY:132,phase:0};
const paths=['classic','weave','spiral'].map(flight=>t.divePosition({...diver,variant:{flight}},0.2));
assert.equal(new Set(paths.map(p=>p.x)).size,3,'flight variants must have different paths');
t.setWave(5);let boss=t.enemies.find(e=>e.type==='boss');assert(boss);
t.enemyShots.length=0;t.fireEnemy(boss);assert.equal(t.enemyShots.length,3);
t.drawEnemy(boss);boss.hp=1;t.drawEnemy(boss);
t.setWave(6);assert(!t.enemies.some(e=>e.type==='boss'));
assert(t.bossSprite.every(row=>row.length===31));
console.log('PASS: paired progression through level 48, real spawn HP/volleys, low entrance paths, distinct dives, boss cadence and drawing.');

for(let level=1;level<=24;level++) {
  t.setWave(level);
  const fleet=t.enemies.filter(e=>e.type!=='boss');
  const current=t.waveProfile(level), previous=t.waveProfile(Math.max(1,level-2));
  assert.equal(fleet.length,40);
  const currentCount=fleet.filter(e=>e.variant.name===current.name).length;
  assert.equal(currentCount,level<=2?40:level%2?24:32);
  assert(fleet.every(e=>e.variant.name===current.name||e.variant.name===previous.name),'only one previous group');
  for(let i=0;i<40;i+=8)assert(fleet.slice(i,i+8).every(e=>e.variant.name===fleet[i].variant.name),'whole squads share variant');
  fleet.forEach(e=>{
    const currentAlien=level>2&&e.variant.name===current.name;
    assert.equal(e.twoHitAlien,currentAlien);
    assert.equal(e.hp,currentAlien?2:(e.type==='command'?2+Math.floor(level/6):1)+e.variant.armor);
    t.enemyShots.length=0;t.fireEnemy(e);
    assert.equal(t.enemyShots.length,{single:1,twin:2,spread:3}[e.variant.weapon]);
  });
}
t.setWave(3);t.player.x=480;t.player.y=648;
for(const weapon of ['single','twin','spread']) {
  for(const x of [0,480,960])for(const y of [100,630,648,710]) {
    t.enemyShots.length=0;
    t.fireEnemy({type:'scout',x,y,variant:{weapon}});
    for(const s of t.enemyShots) {
      const speed=Math.hypot(s.vx,s.vy);
      assert(s.vy>=speed*0.5-1e-9,'even shots at/below player height must fall decisively');
      if(x!==480)assert(Math.sign(s.vx)===Math.sign(480-x),'still aims sideways toward player');
    }
  }
}
// Exercise actual movement on a spread shot near the player's height.
t.enemyShots.length=0;t.enemies.length=0;t.player.invulnerable=100;
t.fireEnemy({type:'scout',x:0,y:630,variant:{weapon:'spread'}});
const positions=t.enemyShots.map(s=>({x:s.x,y:s.y}));t.update(0.1);
assert.equal(t.enemyShots.length,3);
t.enemyShots.forEach((s,i)=>{assert(s.y>positions[i].y+12);assert(s.x>positions[i].x);});
console.log('PASS: 24/16 and 32/8 mixed fleets, inherited weapons/armor, and downward laser trajectories at screen edges and bottom.');

const fingerprints = new Set();
for(const level of [1,3,5,7,9,11]) {
  t.setWave(level);
  const alien=t.enemies.find(e=>e.type==='scout');
  for(const action of [t.beginDive,t.fireEnemy]) {
    action(alien);
    const kind=playedKinds.at(-1), samples=renderSound(kind);
    assert(samples.every(Number.isFinite));
    const rms=Math.sqrt(samples.reduce((sum,n)=>sum+n*n,0)/samples.length);
    assert(rms>0.02&&rms<0.2,'related voices retain controlled levels');
    assert(Math.max(...samples)<1&&Math.min(...samples)>-1);
    assert.equal(samples[0],0);assert(Math.abs(samples.at(-1))<0.001);
    fingerprints.add(require('crypto').createHash('sha256').update(Buffer.from(samples.buffer)).digest('hex'));
  }
}
assert.equal(fingerprints.size,12,'six variants have distinct dive and weapon samples');
t.setWave(5);
const newAlien=t.enemies.find(e=>e.type==='scout');
const oldAlien=t.enemies.find(e=>e.type==='scout'&&e.variant.name!==newAlien.variant.name);
t.beginDive(newAlien);const newSound=playedKinds.at(-1);
t.beginDive(oldAlien);assert.notEqual(playedKinds.at(-1),newSound);
boss=t.enemies.find(e=>e.type==='boss');t.fireEnemy(boss);
assert(playedKinds.at(-1).startsWith('enemyshot-boss-'));
const beforeMute=playedKinds.length;
handlers['soundButton:click']();t.beginDive(newAlien);t.fireEnemy(newAlien);
assert.equal(playedKinds.length,beforeMute,'mute prevents all new effect playback');
handlers['soundButton:click']();
console.log('PASS: distinct bounded waveforms, per-alien sounds in mixed fleets, boss voice, and mute.');

const introHashes=new Set();
for(let level=1;level<=7;level++) {
  t.setWave(level);t.beginLevel();
  const kind=playedKinds.at(-1);
  assert.equal(kind,'intro-'+((level-1)%6));
  const samples=renderSound(kind);
  assert.equal(samples.length,Math.ceil(4.4*22050));
  assert(samples.every(Number.isFinite));
  const rms=Math.sqrt(samples.reduce((sum,n)=>sum+n*n,0)/samples.length);
  assert(rms>0.02&&rms<0.2);
  introHashes.add(require('crypto').createHash('sha256').update(Buffer.from(samples.buffer)).digest('hex'));
  assert.equal(t.state().mode,'intro');assert.equal(t.state().count,0);
}
assert.equal(introHashes.size,6,'six distinct dark intros rotate');
console.log('PASS: six level intro variations, correct rotation, consistent duration and pre-level gameplay delay.');

t.startGame();step(4.7);
function shootAt(target) {
  t.update(0);
  t.playerShots.push({x:target.x,y:target.y,vy:-720,w:4,h:18});
  t.update(0);
}
function spriteColors(target) {
  const colors=new Set();
  canvasContext.fillRect=()=>colors.add(canvasContext.fillStyle);
  t.drawEnemy(target);delete canvasContext.fillRect;
  return [...colors].sort();
}
for(const level of [3,4,5,11,19,30])for(const role of ['scout','striker','command']) {
  t.setWave(level);
  const target=t.enemies.find(e=>e.type===role&&e.twoHitAlien);
  t.enemies.splice(0,t.enemies.length,target);target.state='formation';
  t.playerShots.length=0;
  const initialColors=spriteColors(target);
  shootAt(target);
  assert.equal(target.hp,1);assert(t.enemies.includes(target));
  const damageColors=spriteColors(target);
  assert.notDeepEqual(damageColors,initialColors,'first hit visibly changes palette');
  assert(damageColors.includes('#cbd5e1'),'damage uses silver-gray');
  t.beginDive(target);t.update(0.01);
  assert.equal(target.hp,1);assert.deepEqual(spriteColors(target),damageColors,'damage color persists during flight');
  shootAt(target);assert(!t.enemies.includes(target),'second real shot destroys alien');
}
t.setWave(3);
const oldScout=t.enemies.find(e=>e.type==='scout'&&!e.twoHitAlien);
t.enemies.splice(0,t.enemies.length,oldScout);oldScout.state='formation';
shootAt(oldScout);assert(!t.enemies.includes(oldScout),'old scout still takes one shot');
t.setWave(5);assert.equal(t.enemies.find(e=>e.type==='boss').hp,28);
console.log('PASS: actual two-hit collisions, persistent drawn damage colors for every role, older scout durability, and unchanged boss HP.');
