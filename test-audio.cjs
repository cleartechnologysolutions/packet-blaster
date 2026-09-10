const fs = require('fs'), vm = require('vm'), assert = require('assert');
const nodes = {};
const handlers = {};
const canvasContext = new Proxy({}, { get: (o,k) => o[k] || (()=>{}), set: (o,k,v) => (o[k]=v,true) });
const node = id => nodes[id] ||= { textContent:'', classList:{add(){},remove(){}}, setAttribute(){}, addEventListener(type,fn){handlers[id+':'+type]=fn;}, width:960,height:720,getContext:()=>canvasContext };
const param = () => ({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}});
let buffers = 0;
class AudioContext {
  constructor(){this.state='running';this.currentTime=0;this.destination={};}
  createBuffer(ch,n,r){buffers++;return {copyToChannel(data){assert.equal(data.length,n);}};}
  createBufferSource(){return {connect(){return this;}, start(){},stop(){}};}
  createGain(){return {gain:param(),connect(){return this;}};}
  createOscillator(){return {frequency:param(),connect(){return this;},start(){},stop(){}};}
  createBiquadFilter(){return {frequency:param(),connect(){return this;}};}
}
const window = {AudioContext,matchMedia:()=>({matches:false}),addEventListener(type,fn){handlers[type]=fn;},setTimeout(){}};
const context = vm.createContext({window,document:{getElementById:node},localStorage:{getItem(){},setItem(){}},performance:{now:()=>0},requestAnimationFrame(){},console,Float32Array});
vm.runInContext(fs.readFileSync('public/audio-v6.js','utf8'),context);
for(const kind of ['intro','explosion','laser','dive-scout','dive-striker','dive-command']) {
  const a=window.ArcadeAudio.render(kind);
  assert(a.every(Number.isFinite));
  const rms=Math.sqrt(a.reduce((s,v)=>s+v*v,0)/a.length);
  assert(rms>0.02 && rms<0.8);
  console.log(kind, (a.length/22050).toFixed(2)+'s', 'RMS',rms.toFixed(3));
}
let source=fs.readFileSync('public/game-v5.js','utf8');
source=source.replace(/\}\)\(\);\s*$/, 'window.test={startGame,update,firePlayer,hitPlayer,beginLevel,beginDive,entrancePosition,enemies,playerShots,player,state:()=>({mode,waveClock,shots,lives,fireHeldSeconds,count:enemies.length})};})();');
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

const step = seconds => { for(let i=0;i<Math.round(seconds*100);i++)t.update(0.01); };
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
