const fs = require('fs'), vm = require('vm'), assert = require('assert');
const nodes = {};
const canvasContext = new Proxy({}, { get: (o,k) => o[k] || (()=>{}), set: (o,k,v) => (o[k]=v,true) });
const node = id => nodes[id] ||= { textContent:'', classList:{add(){},remove(){}}, setAttribute(){}, addEventListener(){}, width:960,height:720,getContext:()=>canvasContext };
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
const window = {AudioContext,matchMedia:()=>({matches:false}),addEventListener(){},setTimeout(){}};
const context = vm.createContext({window,document:{getElementById:node},localStorage:{getItem(){},setItem(){}},performance:{now:()=>0},requestAnimationFrame(){},console,Float32Array});
vm.runInContext(fs.readFileSync('public/audio-v6.js','utf8'),context);
for(const kind of ['intro','explosion','laser']) {
  const a=window.ArcadeAudio.render(kind);
  assert(a.every(Number.isFinite));
  const rms=Math.sqrt(a.reduce((s,v)=>s+v*v,0)/a.length);
  assert(rms>0.02 && rms<0.8);
  console.log(kind, (a.length/22050).toFixed(2)+'s', 'RMS',rms.toFixed(3));
}
let source=fs.readFileSync('public/game-v5.js','utf8');
source=source.replace(/\}\)\(\);\s*$/, 'window.test={startGame,update,firePlayer,hitPlayer,beginLevel,player,state:()=>({mode,waveClock,shots,lives,count:enemies.length})};})();');
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
assert.equal(buffers,3);
console.log('PASS: intro blocks gameplay, aliens enter afterwards, laser/death audio triggers, respawn and next intro work.');
