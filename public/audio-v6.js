// Original procedural soundtrack and effects. No external audio downloads.
(() => {
  const rate = 22050;
  function render(kind) {
    const duration = kind === 'intro' ? 4.4 : kind === 'explosion' ? 1.65 : 0.24;
    const samples = new Float32Array(Math.ceil(duration * rate));
    let seed = 73, low = 0, phase = 0;
    // Low E-minor motif, flattened-second tension, and an unresolved ending.
    const melody = [52,52,55,53,52,47,50,46,52,55,58,55,53,52,47,47];
    const roots = [28,29,28,35];
    for (let i = 0; i < samples.length; i++) {
      const t = i / rate;
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      const noise = seed / 2147483648;
      low += 0.09 * (noise - low);
      let v = 0;
      if (kind === 'intro') {
        const beat = Math.floor(t / 0.24), local = t % 0.24;
        const note = melody[Math.min(15, beat)];
        const f = 440 * 2 ** ((note - 69) / 12);
        const env = Math.min(1, local / 0.008) * Math.exp(-local * 6);
        const lead = Math.sin(2*Math.PI*f*t) + 0.45*Math.sin(4*Math.PI*f*t)
          + 0.2*Math.sin(6*Math.PI*f*t);
        const bass = 440 * 2 ** ((roots[Math.min(3, Math.floor(beat/4))] - 69)/12);
        v = 0.22*lead*env + 0.2*(Math.sin(2*Math.PI*bass*t)
          + 0.4*Math.sin(4*Math.PI*bass*t))*Math.exp(-local*5);
        const accent = beat%4 === 0 ? 1 : 0.42;
        v += accent*0.28*Math.sin(2*Math.PI*(42*local+9*(1-Math.exp(-local*30))))*Math.exp(-local*19);
        if (beat%4 === 2) v += noise*0.08*Math.exp(-local*34);
        if (t > 3.84) {
          v = [35,47,53,58].reduce((sum,n)=>sum+0.12*Math.sin(2*Math.PI*440*2**((n-69)/12)*t),0)*Math.exp(-(t-3.84)*4);
        }
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
