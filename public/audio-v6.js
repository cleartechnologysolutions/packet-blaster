// Original procedural soundtrack and effects. No external audio downloads.
(() => {
  const rate = 22050;
  function render(kind) {
    const introduction = kind === 'intro' || kind.startsWith('intro-');
    const introVariation = introduction ? (Number(kind.split('-')[1]) || 0) % 6 : 0;
    const transpose = [0,-2,1,-1,2,-3][introVariation];
    const diving = kind.startsWith('dive-');
    const enemyShot = kind.startsWith('enemyshot-');
    const [, role, flight = 'classic', weapon = 'single', armor = 'light'] = kind.split('-');
    const weight = (role === 'boss' ? 0.48 : role === 'command' ? 0.72 : role === 'striker' ? 0.9 : 1.12)
      * (armor === 'armored' ? 0.82 : 1) * (weapon === 'twin' ? 0.93 : weapon === 'spread' ? 1.07 : 1);
    const warbleRate = flight === 'weave' ? 12 : flight === 'spiral' ? 7 : 19;
    const warbleDepth = flight === 'weave' ? 0.14 : flight === 'spiral' ? 0.22 : 0.065;
    const duration = introduction ? 4.4 : kind === 'explosion' ? 1.65 : diving ? 1.15 : enemyShot ? 0.36 : 0.24;
    const samples = new Float32Array(Math.ceil(duration * rate));
    let seed = 73, low = 0, phase = 0;
    // Low E-minor motif, flattened-second tension, and an unresolved ending.
    const melody = [
      [52,52,55,53,52,47,50,46,52,55,58,55,53,52,47,47],
      [52,47,52,53,55,53,50,46,52,58,55,53,52,50,47,46],
      [47,52,53,52,55,52,50,47,58,55,53,52,50,46,47,47],
    ][introVariation % 3];
    const roots = [28,29,28,35];
    for (let i = 0; i < samples.length; i++) {
      const t = i / rate;
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      const noise = seed / 2147483648;
      low += 0.09 * (noise - low);
      let v = 0;
      if (introduction) {
        const beat = Math.floor(t / 0.24), local = t % 0.24;
        const note = melody[Math.min(15, beat)] + transpose;
        const f = 440 * 2 ** ((note - 69) / 12);
        const env = Math.min(1, local / 0.008) * Math.exp(-local * 6);
        const lead = Math.sin(2*Math.PI*f*t) + 0.45*Math.sin(4*Math.PI*f*t)
          + 0.2*Math.sin(6*Math.PI*f*t);
        const bass = 440 * 2 ** ((roots[Math.min(3, Math.floor(beat/4))] + transpose - 69)/12);
        v = 0.22*lead*env + 0.2*(Math.sin(2*Math.PI*bass*t)
          + 0.4*Math.sin(4*Math.PI*bass*t))*Math.exp(-local*5);
        const accent = beat%4 === 0 ? 1 : 0.42;
        v += accent*0.28*Math.sin(2*Math.PI*(42*local+9*(1-Math.exp(-local*30))))*Math.exp(-local*19);
        if (beat%4 === 2) v += noise*0.08*Math.exp(-local*34);
        if (t > 3.84) {
          v = [35,47,53,58].reduce((sum,n)=>sum+0.12*Math.sin(2*Math.PI*440*2**((n+transpose-69)/12)*t),0)*Math.exp(-(t-3.84)*4);
        }
      } else if (diving) {
        // Falling alien engine: bending pitch, metallic growl and fluttering air.
        const frequency = weight * (85 + 1150*Math.exp(-t*3.8));
        phase += 2*Math.PI*frequency*(1+warbleDepth*Math.sin(2*Math.PI*warbleRate*t))/rate;
        const flutter = 0.78 + 0.22*Math.sin(2*Math.PI*((weapon === 'twin' ? 18 : 12)*t+9*t*t));
        const envelope = Math.min(1,t/0.035)*Math.exp(-t*1.9);
        v = envelope*flutter*(0.25*Math.sin(phase+1.8*Math.sin(phase*2))
          + 0.17*Math.sin(phase*0.5) + 0.09*low);
      } else if (enemyShot) {
        // Related laser voices: twin pulses, spread harmonics and heavier armor/boss pitch.
        phase += 2*Math.PI*weight*(140+1250*Math.exp(-t*20))
          *(1+warbleDepth*Math.sin(2*Math.PI*warbleRate*t))/rate;
        let envelope = Math.exp(-t*16);
        if (weapon === 'twin' && t >= 0.065) envelope += 0.7*Math.min(1,(t-0.065)/0.006)*Math.exp(-(t-0.065)*20);
        v = 0.42*Math.sin(phase+1.4*Math.sin(phase*1.5))*envelope;
        if (weapon === 'spread') v += 0.13*(Math.sin(phase*0.94)+Math.sin(phase*1.06))*envelope;
        if (armor === 'armored' || role === 'boss') v += 0.14*Math.sin(phase*0.5)*Math.exp(-t*10);
      } else if (kind === 'explosion') {
        // Broadband crack, gritty midrange debris, and falling bass pressure.
        phase += 2*Math.PI*(32+110*Math.exp(-t*13))/rate;
        v = 0.5*noise*Math.exp(-t*11) + 1.1*low*Math.exp(-t*2.8);
        v += 0.46*Math.sin(phase)*Math.exp(-t*4.2);
        v += 0.18*noise*Math.max(0,Math.sin(t*83))*Math.exp(-t*4);
      } else {
        phase += 2*Math.PI*(110+2400*Math.exp(-t*22))/rate;
        v = (Math.sin(phase+2.4*Math.sin(phase*1.61))+0.22*noise*Math.exp(-t*65))*0.55*Math.exp(-t*18);
      }
      samples[i] = Math.tanh(v) * Math.min(1, t/0.003, (duration-t)/0.025);
    }
    return samples;
  }
  window.ArcadeAudio = { rate, render };
})();
