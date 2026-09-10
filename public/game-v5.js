(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const ui = Object.fromEntries([
    "score", "highScore", "wave", "lives", "gameOverlay", "overlayTitle", "overlayText",
    "startButton", "pauseButton", "soundButton", "waveBanner", "powerStatus", "accuracy",
    "threatStatus",
  ].map((id) => [id, document.getElementById(id)]));
  const touchDevice = window.matchMedia?.("(pointer: coarse)").matches;

  const colors = {
    cyan: "#22d3ee",
    cyanLight: "#a5f3fc",
    pink: "#f472b6",
    pinkDark: "#be185d",
    gold: "#fbbf24",
    violet: "#a78bfa",
    white: "#f8fafc",
    red: "#fb7185",
  };

  const spritePalette = {
    W: "#f8fafc", S: "#cbd5e1", R: "#fb3b62", B: "#38bdf8",
    C: "#22d3ee", Y: "#fbbf24", G: "#84cc16", P: "#c084fc", D: "#64748b",
  };

  const playerSprite = [
    ".......R.......", "......RWR......", "......WWW......",
    "......WBW......", ".....WWWWW.....", ".....WWWWW.....",
    "...B.WWWWW.B...", "..BBWWWWWWWBB..", ".BBBWWWWWWWBBB.",
    "BBBWWWWWWWWWBBB", "...R.WWWWW.R...", ".....W.W.W.....",
    "....WW.W.WW....",
  ];

  const enemySprites = {
    command: [
      ["....G.....G....", "...GG.BBB.GG...", "..GGBBBBBBBGG..", ".BBBWWBBBWWBBB.", "BBBBBBBBBBBBBBB", "..BBBYYYYYBBB..", "...BBBBBBBBB...", "....BB...BB....", "...BB.....BB..."],
      ["......G.G......", "....GGBBBGG....", "...GGBBBBBGG...", "..BBBWWBWWBBB..", ".BBBBBBBBBBBBB.", "...BBYYYYYBB...", "....BBBBBBB....", "...BB.....BB...", "..BB.......BB.."],
    ],
    striker: [
      ["R.....P.P.....R", "RR...PPPPP...RR", ".RR.PPWWWPP.RR.", "..RRPPPPPPPRR..", "...PPPPPPPPP...", "....PPP.PPP....", ".....P...P.....", "....PP...PP...."],
      ["...R..P.P..R...", "..RR.PPPPP.RR..", ".RR.PPWWWPP.RR.", "..RRPPPPPPPRR..", "...PPPPPPPPP...", "....PPP.PPP....", "...PP.....PP...", "..PP.......PP.."],
    ],
    scout: [
      ["Y.....B.B.....Y", "YY...BBBBB...YY", ".YY.BBWWWBB.YY.", "..YYBBBBBBBYY..", "...BBBBBBBBB...", "....BBY.YBB....", ".....Y...Y.....", "....YY...YY...."],
      ["...Y..B.B..Y...", "..YY.BBBBB.YY..", ".YY.BBWWWBB.YY.", "..YYBBBBBBBYY..", "...BBBBBBBBB...", "....BBY.YBB....", "...YY.....YY...", "..YY.......YY.."],
    ],
  };

  // Hand-drawn, symmetric pixel armor, wing claws and recessed red eyes.
  const bossSprite = [
    'Y.................Y',
    'YY.......S.......YY',
    'SYY.....SYS.....YYS',
    'SSYY...SYYYS...YYSS',
    'YSSYY.SYYYYYS.YYSSY',
    'YYSSYYYYYYYYYYYYYSSYY',
    'SYYSSYYYYSSSYYYYSSYYS',
    'SSYYYSSYYSSSSSYYSSYYYSS',
    'YSSYYYYSSSSSSSSSSSYYYYSSY',
    'YYSSYYYSSRRSSSRRSSYYYSSYY',
    'YYYSSYYYSSR...RSSYYYSSYYY',
    'YYSSSYYYSSSSWSSSSYYYSSSYY',
    'YYSS.YYYYSSWWWSSYYYY.SSYY',
    'YSS..YYYSSWWWWWSSYYY..SSY',
    'YS...YYSSSSWWWSSSSYY...SY',
    'Y....YSSS..SSS..SSSY....Y',
    'S....SSY...R...YSS....S',
    'S....SY.........YS....S',
    'Y...............Y',
  ].map(row => {
    const padding = Math.floor((31 - row.length) / 2);
    return '.'.repeat(padding) + row.replace(/S/g, 'D') + '.'.repeat(31 - row.length - padding);
  });

  let mode = "title";
  const alienVariants = [
    { name: 'ORIGINAL FLEET', flight: 'classic', weapon: 'single', armor: 0, color: 'B' },
    { name: 'TWIN GUNNERS', flight: 'classic', weapon: 'twin', armor: 0, color: 'R' },
    { name: 'ZIGZAG RAIDERS', flight: 'weave', weapon: 'single', armor: 0, color: 'G' },
    { name: 'SPREAD HUNTERS', flight: 'classic', weapon: 'spread', armor: 0, color: 'P' },
    { name: 'CORKSCREW ACES', flight: 'spiral', weapon: 'single', armor: 0, color: 'C' },
    { name: 'ARMORED GUNNERS', flight: 'classic', weapon: 'twin', armor: 1, color: 'Y' },
  ];
  function waveProfile(level) {
    const pair = Math.floor((level - 1) / 2);
    if (pair < alienVariants.length) return alienVariants[pair];
    // Later pairs combine learned threats instead of endlessly increasing bullet counts.
    const mix = pair - alienVariants.length;
    const flight = ['weave', 'spiral', 'classic'][mix % 3];
    const weapon = ['twin', 'spread', 'single'][Math.floor(mix / 3) % 3];
    const armor = Math.floor(mix / 9) % 2;
    const label = { weave: 'ZIGZAG', spiral: 'CORKSCREW', classic: 'ASSAULT', twin: 'GUNNERS', spread: 'HUNTERS', single: 'RAIDERS' };
    return { name: (armor ? 'ARMORED ' : '') + label[flight] + ' ' + label[weapon], flight, weapon, armor, color: ['R', 'G', 'P', 'C', 'Y'][mix % 5] };
  }
  let introRemaining = 0;
  let resumeMode = 'playing';
  let introSource = null;
  const audioBuffers = new Map();
  const activeSamples = new Set();

  function playSample(kind) {
    if (!soundOn) return null;
    ensureAudio();
    if (!audioBuffers.has(kind)) {
      const data = window.ArcadeAudio.render(kind);
      const buffer = audio.createBuffer(1, data.length, window.ArcadeAudio.rate);
      buffer.copyToChannel(data, 0);
      audioBuffers.set(kind, buffer);
    }
    const source = audio.createBufferSource();
    const gain = audio.createGain();
    gain.gain.value = kind === 'laser' ? 0.45 : kind.startsWith('enemyshot-') ? 0.18 : 0.8;
    source.buffer = audioBuffers.get(kind);
    source.connect(gain).connect(audio.destination);
    activeSamples.add(source);
    source.onended = () => activeSamples.delete(source);
    source.start();
    return source;
  }

  function beginLevel() {
    stopMusic();
    mode = 'intro';
    introRemaining = 4.6;
    enemies.length = playerShots.length = enemyShots.length = 0;
    touch.fire = false;
    fireHeldSeconds = 0;
    ui.waveBanner.textContent = 'STAGE ' + wave + ' · ' + waveProfile(wave).name;
    ui.waveBanner.classList.add('visible');
    introSource = playSample('intro-' + ((wave - 1) % 6));
  }
  let score = 0;
  let highScore = Number(localStorage.getItem("packetBlasterHighScore") || 0);
  let wave = 1;
  let lives = 5;
  let nextBonusLife = 20000;
  let shots = 0;
  let hits = 0;
  let formationTime = 0;
  let waveClock = 0;
  let formationReady = false;
  let diveClock = 0;
  let enemyShotClock = 0;
  let nextWaveClock = 0;
  let screenShake = 0;
  let soundOn = localStorage.getItem("packetBlasterSound") !== "off";
  let audio = null;
  let lastTime = performance.now();

  const keys = new Set();
  let fireHeldSeconds = 0;
  const touch = { left: false, right: false, fire: false, dragging: false, pointerId: null, startX: 0, playerStartX: 0, moved: false };
  const player = { x: W / 2, y: H - 72, w: 42, h: 34, speed: 430, cooldown: 0, invulnerable: 0, rapid: 0, shield: 0, dead: 0 };
  const enemies = [];
  const playerShots = [];
  const enemyShots = [];
  const particles = [];
  const powerups = [];
  const stars = Array.from({ length: 125 }, (_, index) => ({
    x: (index * 83.17) % W,
    y: (index * 151.73) % H,
    size: 0.7 + (index % 4) * 0.45,
    speed: 18 + (index % 7) * 8,
    alpha: 0.25 + (index % 5) * 0.13,
  }));

  function ensureAudio() {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
  }

  function tone(frequency, duration, type = "square", volume = 0.035, slide = 0) {
    if (!soundOn) return;
    ensureAudio();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency + slide), audio.currentTime + duration);
    gain.gain.setValueAtTime(volume, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  }

  function sweep(startFrequency, endFrequency, duration, type = "sawtooth", volume = 0.025) {
    if (!soundOn) return;
    ensureAudio();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const filter = audio.createBiquadFilter();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, endFrequency), audio.currentTime + duration);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800, audio.currentTime);
    filter.frequency.exponentialRampToValueAtTime(420, audio.currentTime + duration);
    gain.gain.setValueAtTime(volume, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
    oscillator.connect(filter).connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  }

  function musicVoice(frequency, when, duration, type, volume) {
    if (!soundOn || !audio) return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const filter = audio.createBiquadFilter();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, when);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(type === "triangle" ? 900 : 1450, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(volume, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(filter).connect(gain).connect(audio.destination);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.02);
  }

  function playLevelFanfare() {
    if (!soundOn) return;
    ensureAudio();
    const now = audio.currentTime + 0.04;
    const melody = [392, 523.25, 659.25, 783.99, 659.25, 880, 783.99, 1046.5];
    const lengths = [0.1, 0.1, 0.1, 0.2, 0.1, 0.1, 0.12, 0.42];
    let offset = 0;
    melody.forEach((note, index) => {
      musicVoice(note, now + offset, lengths[index], "square", 0.032);
      musicVoice(note / 2, now + offset, lengths[index] + 0.04, "triangle", 0.021);
      if (index === 3 || index === 7) musicVoice(note * 1.5, now + offset, lengths[index], "square", 0.012);
      offset += index === 3 ? 0.23 : 0.115;
    });
  }

  function stopMusic() {
    if (introSource) { try { introSource.stop(); } catch {} introSource = null; }
  }

  function laserShot() {
    playSample('laser');
  }

  function updateHud() {
    ui.score.textContent = String(score).padStart(6, "0");
    ui.highScore.textContent = String(highScore).padStart(6, "0");
    ui.wave.textContent = wave;
    ui.lives.textContent = lives > 0 ? Array.from({ length: lives }, () => "◆").join(" ") : "NONE";
    ui.lives.setAttribute("aria-label", lives + (lives === 1 ? " ship" : " ships"));
    ui.accuracy.textContent = "ACCURACY " + (shots ? Math.round(hits / shots * 100) : 0) + "%";
    ui.threatStatus.textContent = "THREATS " + enemies.length;
    if (player.shield > 0) ui.powerStatus.textContent = "SHIELD " + Math.ceil(player.shield) + "s";
    else if (player.rapid > 0) ui.powerStatus.textContent = "RAPID FIRE " + Math.ceil(player.rapid) + "s";
    else ui.powerStatus.textContent = mode === "playing" ? "SYSTEM ONLINE" : "SYSTEM READY";
  }

  function showWave(text) {
    ui.waveBanner.textContent = text;
    ui.waveBanner.classList.add("visible");
    window.setTimeout(() => ui.waveBanner.classList.remove("visible"), 1100);
  }

  function resetPlayer() {
    fireHeldSeconds = 0;
    player.x = W / 2;
    player.y = H - 72;
    player.cooldown = 0;
    player.invulnerable = 1.8;
    player.rapid = 0;
    player.shield = 0;
    player.dead = 0;
  }

  function spawnWave() {
    const currentVariant = waveProfile(wave);
    const previousVariant = waveProfile(Math.max(1, wave - 2));
    enemies.length = 0;
    enemyShots.length = 0;
    waveClock = 0;
    formationReady = false;
    const slots = [];
    const addRow = (type, count, y, spacing) => {
      const startX = W / 2 - (count - 1) * spacing / 2;
      for (let col = 0; col < count; col++) slots.push({ type, baseX: startX + col * spacing, baseY: y, col });
    };
    addRow("command", 4, 82, 70);
    addRow("striker", 8, 132, 67);
    addRow("striker", 8, 180, 67);
    addRow("scout", 10, 232, 66);
    addRow("scout", 10, 280, 66);

    const orderedSlots = [
      ...slots.filter((slot) => slot.type === "scout"),
      ...slots.filter((slot) => slot.type === "striker"),
      ...slots.filter((slot) => slot.type === "command"),
    ];

    orderedSlots.forEach((slotInfo, slot) => {
      const group = Math.floor(slot / 8);
      // Keep complete eight-alien squads together so followers share a flight path.
      const previousSquad = wave > 2 && (group === 3 || (wave % 2 === 1 && group === 1));
      const variant = previousSquad ? previousVariant : currentVariant;
      const type = slotInfo.type;
      const twoHitAlien = wave > 2 && !previousSquad;
      enemies.push({
        type,
        variant,
        twoHitAlien,
        baseX: slotInfo.baseX,
        baseY: slotInfo.baseY,
        x: -120,
        y: -120,
          w: type === "command" ? 38 : 31,
          h: type === "command" ? 32 : 27,
          hp: twoHitAlien ? 2 : (type === "command" ? 2 + Math.floor(wave / 6) : 1) + variant.armor,
          state: "entering",
          enterDelay: group * 1.4 + (slot % 8) * 0.18,
          enterDuration: 4.8,
          entrancePath: group % 4,
          entranceSound: slot % 8 === 0,
          entranceT: 0,
          dive: 0,
          diveStartX: 0,
          phase: slotInfo.col * 0.47 + slotInfo.baseY * 0.01,
          targetX: W / 2,
      });
    });

    if (wave % 5 === 0) {
      enemies.push({ type: "boss", baseX: W / 2, baseY: 42, x: W / 2, y: -80, w: 80, h: 52, hp: 18 + wave * 2, maxHp: 18 + wave * 2, state: "entering", enterDelay: orderedSlots.length * 0.13 + 0.5, enterDuration: 2.2, entrancePath: 4, entranceT: 0, dive: 0, phase: 0 });
    }
    showWave(wave % 5 === 0 ? "BOSS INBOUND // WAVE " + wave : "INCOMING // WAVE " + wave);
    updateHud();
  }

  function startGame() {
    ensureAudio();
    score = 0;
    wave = 1;
    lives = 5;
    nextBonusLife = 20000;
    shots = 0;
    hits = 0;
    formationTime = 0;
    diveClock = 0.8;
    enemyShotClock = 0.7;
    nextWaveClock = 0;
    playerShots.length = 0;
    powerups.length = 0;
    particles.length = 0;
    resetPlayer();
    beginLevel();
    ui.gameOverlay.classList.add("hidden");
    ui.pauseButton.textContent = "Pause";
    updateHud();
  }

  function togglePause() {
    if (mode === "playing" || mode === 'intro') {
      resumeMode = mode;
      if (mode === 'intro') stopMusic();
      mode = "paused";
      ui.overlayTitle.textContent = "Paused";
      ui.overlayText.textContent = "Mission suspended. The network will wait.";
      ui.startButton.textContent = "Resume";
      ui.gameOverlay.classList.remove("hidden");
      ui.pauseButton.textContent = "Resume";
    } else if (mode === "paused") {
      mode = resumeMode;
      if (mode === 'intro') beginLevel();
      ui.gameOverlay.classList.add("hidden");
      ui.pauseButton.textContent = "Pause";
      lastTime = performance.now();
    }
  }

  function gameOver() {
    mode = "over";
    stopMusic();
    highScore = Math.max(highScore, score);
    localStorage.setItem("packetBlasterHighScore", highScore);
    ui.overlayTitle.textContent = "Connection Lost";
    ui.overlayText.textContent = "Final score: " + score + " | Wave reached: " + wave;
    ui.startButton.textContent = "Reboot mission";
    ui.gameOverlay.classList.remove("hidden");
    tone(180, 0.55, "sawtooth", 0.055, -120);
    updateHud();
  }

  function firePlayer() {
    if (mode !== 'playing' || player.cooldown > 0 || player.dead > 0) return;
    playerShots.push({ x: player.x, y: player.y - 24, vy: -720, w: 4, h: 18 });
    player.cooldown = (player.rapid > 0 ? 0.085 : 0.2) * (fireHeldSeconds >= 2 ? 2 : 1);
    shots++;
    laserShot();
  }

  function enemySound(event, enemy) {
    const variant = enemy.variant || {};
    return [event, enemy.type, variant.flight || 'classic', variant.weapon || 'single', variant.armor ? 'armored' : 'light'].join('-');
  }

  function fireEnemy(enemy) {
    playSample(enemySound('enemyshot', enemy));
    if (enemy.type === "boss") {
      [-0.24, 0, 0.24].forEach((angle) => enemyShots.push({ x: enemy.x, y: enemy.y + 25, vx: Math.sin(angle) * 220, vy: Math.cos(angle) * 260, w: 6, h: 14 }));
    } else {
      const dx = player.x - enemy.x;
      const dy = player.y - (enemy.y + 14);
      const speed = 230 + wave * 9;
      const weapon = enemy.variant?.weapon || 'single';
      const angles = weapon === 'spread' ? [-0.2, 0, 0.2] : weapon === 'twin' ? [0, 0] : [0];
      // Angle is measured from straight down. Reserve room for the entire fan:
      // even its outer rays retain at least half their speed vertically downward.
      const aimLimit = Math.PI / 3 - (weapon === 'spread' ? 0.2 : 0);
      const aim = Math.max(-aimLimit, Math.min(aimLimit, Math.atan2(dx, Math.max(1, dy))));
      angles.forEach((angle, index) => {
        const offset = weapon === 'twin' ? (index ? 9 : -9) : 0;
        enemyShots.push({ x: enemy.x + offset, y: enemy.y + 14,
          vx: Math.sin(aim + angle) * speed,
          vy: Math.cos(aim + angle) * speed, w: 5, h: 12 });
      });
    }
  }

  function beginDive(enemy) {
    enemy.state = "diving";
    enemy.dive = 0;
    enemy.diveStartX = enemy.x;
    enemy.targetX = player.x + (Math.random() - 0.5) * 180;
    playSample(enemySound('dive', enemy));
  }

  function addExplosion(x, y, color, count = 12) {
    screenShake = Math.max(screenShake, count > 18 ? 7 : 3);
    particles.push({ x, y, vx: 0, vy: 0, life: 0.32, maxLife: 0.32, color: "#ffffff", size: 3, kind: "ring", radius: 3, rotation: 0, spin: 0 });
    particles.push({ x, y, vx: 0, vy: 0, life: 0.5, maxLife: 0.5, color, size: 2, kind: "ring", radius: 7, rotation: 0, spin: 0 });
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 55 + Math.random() * 210;
      const life = 0.45 + Math.random() * 0.6;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, color, size: 2 + Math.random() * 4, kind: i % 4 === 0 ? "streak" : "spark", rotation: angle, spin: (Math.random() - 0.5) * 10 });
    }
  }

  function addShipExplosion(x, y) {
    screenShake = 13;
    particles.push({ x, y, vx: 0, vy: 0, life: 0.62, maxLife: 0.62, color: "#ffffff", size: 5, kind: "ring", radius: 4, rotation: 0, spin: 0 });
    particles.push({ x, y, vx: 0, vy: 0, life: 0.88, maxLife: 0.88, color: "#22d3ee", size: 3, kind: "ring", radius: 8, rotation: 0, spin: 0 });
    const fragments = [
      { ox: -10, oy: 0, color: "#e5e7eb" }, { ox: 10, oy: 0, color: "#e5e7eb" },
      { ox: -18, oy: 8, color: "#22d3ee" }, { ox: 18, oy: 8, color: "#22d3ee" },
      { ox: 0, oy: -10, color: "#fb7185" }, { ox: 0, oy: 8, color: "#f8fafc" },
    ];
    fragments.forEach((fragment, index) => {
      const angle = -Math.PI * 0.9 + index * Math.PI * 0.36 + Math.random() * 0.25;
      const life = 1.05 + Math.random() * 0.35;
      particles.push({ x: x + fragment.ox, y: y + fragment.oy, vx: Math.cos(angle) * (150 + Math.random() * 150), vy: Math.sin(angle) * (150 + Math.random() * 150), life, maxLife: life, color: fragment.color, size: 8 + Math.random() * 7, kind: "debris", rotation: angle, spin: (Math.random() - 0.5) * 13 });
    });
    ["#ffffff", "#22d3ee", "#fbbf24", "#fb7185"].forEach((color, ring) => {
      for (let i = 0; i < 12; i++) {
        const angle = i / 12 * Math.PI * 2 + ring * 0.18;
        const speed = 85 + ring * 58 + Math.random() * 55;
        const life = 0.6 + ring * 0.1;
        particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, color, size: 3 + ring, kind: "spark", rotation: angle, spin: 0 });
      }
    });
  }

  function destroyEnemy(enemy, index) {
    const points = enemy.type === "boss" ? 2500 : enemy.type === "command" ? 180 : enemy.type === "striker" ? 110 : 70;
    score += enemy.state === "diving" ? points * 2 : points;
    highScore = Math.max(highScore, score);
    if (score >= nextBonusLife) {
      lives++;
      nextBonusLife += 50000;
      showWave("BONUS SHIP");
      tone(440, 0.12, "square", 0.04, 220);
      window.setTimeout(() => tone(660, 0.16, "square", 0.04, 220), 115);
    }
    enemies.splice(index, 1);
    const explosionColor = enemy.type === "command" ? "#60a5fa" : enemy.type === "striker" ? "#f472b6" : "#fbbf24";
    addExplosion(enemy.x, enemy.y, enemy.type === "boss" ? colors.gold : explosionColor, enemy.type === "boss" ? 52 : 24);
    if (enemy.type === "boss") sweep(170, 42, 0.72, "sawtooth", 0.06);
    else if (enemy.type === "command") {
      sweep(420, 90, 0.28, "square", 0.034);
      window.setTimeout(() => tone(115, 0.14, "sawtooth", 0.026, -55), 70);
    } else if (enemy.type === "striker") sweep(310, 68, 0.22, "sawtooth", 0.032);
    else sweep(235, 58, 0.16, "square", 0.029);
    if (enemy.type !== "boss" && Math.random() < 0.075) {
      powerups.push({ x: enemy.x, y: enemy.y, vy: 115, type: Math.random() < 0.5 ? "rapid" : "shield", spin: 0 });
    }
  }

  function hitPlayer() {
    if (player.invulnerable > 0 || player.dead > 0) return;
    if (player.shield > 0) {
      player.shield = 0;
      addExplosion(player.x, player.y, colors.cyan, 18);
      tone(420, 0.18, "sine", 0.035, -180);
      return;
    }
    lives--;
    player.dead = 1.35;
    player.invulnerable = 0;
    playerShots.length = 0;
    addShipExplosion(player.x, player.y);
    stopMusic();
    playSample('explosion');
    updateHud();
  }

  function overlaps(a, b) {
    return Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;
  }

  function bezier(a, b, c, d, t) {
    const u = 1 - t;
    return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
  }

  function entrancePosition(enemy, progress) {
    const p = Math.max(0, Math.min(1, progress));
    const targetX = enemy.baseX;
    const targetY = enemy.baseY;
    let x;
    let y;

    if (enemy.entrancePath === 4) {
      x = bezier(W / 2, W * 0.86, W * 0.12, targetX, p);
      y = bezier(-90, 90, 250, targetY, p);
    } else {
      // Every alien follows the same line and low turn as its squad leader.
      // Only the final climb branches off to each alien's formation slot.
      const right = enemy.entrancePath % 2 === 1;
      const mirrorX = value => right ? W - value : value;
      const entryX = enemy.entrancePath < 2 ? W * 0.25 : W * 0.34;
      const turnY = H * 0.625;
      const radiusX = 130;
      const radiusY = H * 0.15;
      if (p < 0.38) {
        const q = p / 0.38;
        x = mirrorX(entryX);
        y = -60 + q * (turnY + 60);
      } else if (p < 0.75) {
        const q = (p - 0.38) / 0.37;
        const angle = Math.PI * (1 - q);
        x = mirrorX(entryX + radiusX + radiusX * Math.cos(angle));
        y = turnY + radiusY * Math.sin(angle);
      } else {
        const q = (p - 0.75) / 0.25;
        const exitX = mirrorX(entryX + 2 * radiusX);
        x = bezier(exitX, exitX, targetX, targetX, q);
        y = bezier(turnY, turnY - 90, targetY + 80, targetY, q);
      }
    }

    if (enemy.variant?.flight === 'weave' && p < 0.38) {
      const q = p / 0.38;
      x += 55 * Math.sin(q * Math.PI * 6) * Math.sin(q * Math.PI);
    } else if (enemy.variant?.flight === 'spiral' && p >= 0.38 && p < 0.75) {
      const q = (p - 0.38) / 0.37;
      x += 55 * Math.sin(q * Math.PI * 4) * Math.sin(q * Math.PI);
      y += 16 * Math.sin(q * Math.PI * 4) * Math.sin(q * Math.PI);
    }
    return { x, y };
  }

  function divePosition(enemy, t) {
    const flight = enemy.variant?.flight || 'classic';
    let x = enemy.diveStartX * (1 - t) + enemy.targetX * t;
    let y = enemy.baseY + t * (H + 120);
    if (flight === 'weave') x += Math.sin(t * Math.PI * 8) * 95;
    else if (flight === 'spiral') {
      x += Math.sin(t * Math.PI * 4) * 150;
      y += (Math.cos(t * Math.PI * 4) - 1) * 65;
    } else x += Math.sin(t * Math.PI * 4 + enemy.phase) * 125;
    return { x, y };
  }

  function update(dt) {
    stars.forEach((star) => {
      star.y += star.speed * dt;
      if (star.y > H) { star.y = -3; star.x = Math.random() * W; }
    });
    particles.forEach((particle) => {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.985;
      particle.vy *= 0.985;
      particle.rotation += particle.spin * dt;
      if (particle.kind === "ring") particle.radius += 170 * dt;
      particle.life -= dt;
    });
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);

    if (mode === 'intro') {
      introRemaining -= dt;
      ui.waveBanner.textContent = 'STAGE ' + wave + ' · ' + waveProfile(wave).name + ' · ' + Math.max(1, Math.ceil(introRemaining));
      if (introRemaining <= 0) {
        mode = 'playing';
        ui.waveBanner.classList.remove('visible');
        spawnWave();
      }
      return;
    }
    if (mode !== "playing") return;
    formationTime += dt;
    waveClock += dt;
    player.cooldown = Math.max(0, player.cooldown - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.rapid = Math.max(0, player.rapid - dt);
    player.shield = Math.max(0, player.shield - dt);
    screenShake = Math.max(0, screenShake - 24 * dt);

    if (player.dead > 0) {
      player.dead = Math.max(0, player.dead - dt);
      if (player.dead === 0) {
        if (lives <= 0) {
          gameOver();
          return;
        }
        else {
          player.x = W / 2;
          player.invulnerable = 2.1;
          tone(220, 0.08, "square", 0.025, 220);
        }
      }
    }

    const direction = ((keys.has("ArrowLeft") || keys.has("KeyA") || touch.left) ? -1 : 0) + ((keys.has("ArrowRight") || keys.has("KeyD") || touch.right) ? 1 : 0);
    if (player.dead <= 0) player.x = Math.max(34, Math.min(W - 34, player.x + direction * player.speed * dt));
    const holdingFire = keys.has("Space") || touch.fire;
    fireHeldSeconds = holdingFire && player.dead <= 0 ? fireHeldSeconds + dt : 0;
    if (holdingFire) firePlayer();

    for (let i = playerShots.length - 1; i >= 0; i--) {
      const shot = playerShots[i];
      shot.y += shot.vy * dt;
      if (shot.y < -30) playerShots.splice(i, 1);
    }

    const formationOffset = Math.sin(formationTime * (0.78 + wave * 0.014)) * Math.min(54, 24 + wave * 1.5);
    const formationBreath = 1 + Math.sin(formationTime * 1.55) * 0.026;
    enemies.forEach((enemy) => {
      if (enemy.state === "entering") {
        const progress = (waveClock - enemy.enterDelay) / enemy.enterDuration;
        if (progress < 0) {
          enemy.x = -120;
          enemy.y = -120;
          return;
        }
        const oldX = enemy.x;
        const oldY = enemy.y;
        const position = entrancePosition(enemy, progress);
        enemy.x = position.x;
        enemy.y = position.y;
        if (oldX > -100 && oldY > -100) enemy.angle = Math.atan2(enemy.y - oldY, enemy.x - oldX) - Math.PI / 2;
        enemy.entranceT = Math.max(0, Math.min(1, progress));
        const soundStage = Math.floor(enemy.entranceT * 5);
        if (enemy.soundStage !== soundStage && enemy.entranceSound) {
          enemy.soundStage = soundStage;
          if (soundStage === 0) playSample(enemySound('dive', enemy));
        }
        if (progress >= 1) {
          enemy.state = "formation";
          enemy.x = enemy.baseX;
          enemy.y = enemy.baseY;
          enemy.angle = 0;
          tone(260 + (enemy.baseY % 120), 0.055, "square", 0.006, 90);
        }
      } else if (enemy.type === "boss") {
        enemy.angle = 0;
        enemy.x = enemy.baseX + Math.sin(formationTime * 0.75) * 210;
        enemy.y = enemy.baseY + Math.sin(formationTime * 1.6) * 10;
      } else if (enemy.state === "formation") {
        enemy.angle = 0;
        enemy.x = W / 2 + (enemy.baseX - W / 2) * formationBreath + formationOffset;
        enemy.y = enemy.baseY + Math.sin(formationTime * 1.55 + enemy.baseY * 0.025) * 2.5;
      } else {
        const oldX = enemy.x;
        const oldY = enemy.y;
        enemy.dive += dt * (0.28 + wave * 0.006);
        const t = enemy.dive;
        const position = divePosition(enemy, t);
        enemy.x = position.x;
        enemy.y = position.y;
        enemy.angle = Math.atan2(enemy.y - oldY, enemy.x - oldX) - Math.PI / 2;
        if (t > 1.08) {
          enemy.state = "formation";
          enemy.dive = 0;
          enemy.y = enemy.baseY;
          enemy.angle = 0;
        }
      }
    });

    if (!formationReady && enemies.length && !enemies.some((enemy) => enemy.state === "entering")) {
      formationReady = true;
    }

    diveClock -= dt;
    const activeDivers = enemies.filter((enemy) => enemy.state === "diving").length;
    if (formationReady && diveClock <= 0 && activeDivers < Math.min(5, 1 + Math.floor(wave / 2))) {
      const candidates = enemies.filter((enemy) => enemy.state === "formation" && enemy.type !== "boss");
      if (candidates.length) beginDive(candidates[Math.floor(Math.random() * candidates.length)]);
      diveClock = Math.max(0.34, 1.25 - wave * 0.055) + Math.random() * 0.55;
    }

    enemyShotClock -= dt;
    if (formationReady && enemyShotClock <= 0 && enemies.length) {
      const shooters = enemies.filter((enemy) => enemy.y < H - 110);
      if (shooters.length) fireEnemy(shooters[Math.floor(Math.random() * shooters.length)]);
      enemyShotClock = Math.max(0.22, 0.82 - wave * 0.035) + Math.random() * 0.35;
    }

    for (let i = enemyShots.length - 1; i >= 0; i--) {
      const shot = enemyShots[i];
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      if (shot.y > H + 30 || shot.x < -30 || shot.x > W + 30) enemyShots.splice(i, 1);
      else if (player.dead <= 0 && overlaps(shot, player)) { enemyShots.splice(i, 1); hitPlayer(); }
    }

    for (let shotIndex = playerShots.length - 1; shotIndex >= 0; shotIndex--) {
      const shot = playerShots[shotIndex];
      let struck = false;
      for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex--) {
        const enemy = enemies[enemyIndex];
        if (overlaps(shot, enemy)) {
          struck = true;
          hits++;
          enemy.hp--;
          addExplosion(shot.x, shot.y, colors.cyan, 5);
          if (enemy.hp <= 0) destroyEnemy(enemy, enemyIndex);
          else tone(260, 0.06, "square", 0.02, -40);
          break;
        }
      }
      if (struck) playerShots.splice(shotIndex, 1);
    }

    enemies.forEach((enemy) => {
      if (player.dead <= 0 && enemy.state === "diving" && overlaps(enemy, player)) hitPlayer();
    });

    for (let i = powerups.length - 1; i >= 0; i--) {
      const powerup = powerups[i];
      powerup.y += powerup.vy * dt;
      powerup.spin += dt * 4;
      if (powerup.y > H + 25) powerups.splice(i, 1);
      else if (overlaps({ ...powerup, w: 28, h: 28 }, player)) {
        if (powerup.type === "rapid") player.rapid = 9;
        else player.shield = 12;
        powerups.splice(i, 1);
        score += 250;
        tone(520, 0.22, "sine", 0.04, 440);
      }
    }

    if (!enemies.length) {
      nextWaveClock += dt;
      if (nextWaveClock > 1.3) {
        wave++;
        nextWaveClock = 0;
        beginLevel();
      }
    }
    updateHud();
  }

  function drawPixelSprite(rows, scale) {
    const width = Math.max(...rows.map((row) => row.length));
    const height = rows.length;
    rows.forEach((row, y) => {
      [...row].forEach((pixel, x) => {
        if (pixel === ".") return;
        ctx.fillStyle = spritePalette[pixel] || colors.white;
        ctx.fillRect((x - width / 2) * scale, (y - height / 2) * scale, scale + 0.15, scale + 0.15);
      });
    });
  }

  function drawPlayer() {
    if (player.dead > 0) return;
    if (player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0) return;
    ctx.save();
    ctx.translate(player.x, player.y);
    if (player.shield > 0) {
      ctx.strokeStyle = colors.cyanLight;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.55 + Math.sin(performance.now() / 90) * 0.18;
      ctx.beginPath();
      ctx.arc(0, 0, 33, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.imageSmoothingEnabled = false;
    drawPixelSprite(playerSprite, 2.75);
    ctx.fillStyle = Math.random() > 0.35 ? "#fbbf24" : "#fb7185";
    ctx.fillRect(-2.75, 18, 5.5, 5 + Math.random() * 5);
    ctx.restore();
  }

  function drawEnemy(enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(enemy.angle || 0);
    const flap = Math.floor(formationTime * 8 + enemy.phase) % 2;
    const pulse = 0.98 + Math.sin(formationTime * 4 + enemy.phase) * 0.025;
    ctx.scale(pulse, pulse);
    ctx.imageSmoothingEnabled = false;

    if (enemy.type === "boss") {
      const damaged = enemy.hp < enemy.maxHp * 0.35;
      const sprite = damaged ? bossSprite.map(row => row.replace(/Y/g, 'R')) : bossSprite;
      // Engines sit behind the armor and flicker independently of wing movement.
      ctx.fillStyle = damaged ? colors.red : colors.cyan;
      [-18, 0, 18].forEach((x, index) => {
        const flame = 5 + (Math.sin(formationTime * 28 + index * 2) + 1) * 3;
        ctx.fillRect(x - 2, 17, 4, flame);
      });
      drawPixelSprite(sprite, 2.8);
      ctx.fillStyle = colors.red;
      ctx.shadowColor = colors.red;
      ctx.shadowBlur = 5 + Math.sin(formationTime * 5) * 2;
      ctx.fillRect(-13, -2, 7, 3);
      ctx.fillRect(6, -2, 7, 3);
      ctx.shadowBlur = 0;
      const width = 74 * Math.max(0, enemy.hp / enemy.maxHp);
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(-37, 31, 74, 5);
      ctx.fillStyle = colors.red;
      ctx.fillRect(-37, 31, width, 5);
    } else {
      let sprite = enemySprites[enemy.type][flap];
      if (enemy.variant && enemy.variant !== alienVariants[0]) {
        sprite = sprite.map(row => row.replace(/[BP]/g, enemy.variant.color));
      }
      if (enemy.twoHitAlien && enemy.hp === 1) {
        // Persistent damage color, including wings, survives dives and formation changes.
        sprite = sprite.map(row => row.replace(/[BPRYGC]/g, 'S'));
      }
      drawPixelSprite(sprite, 2.45);
      if (enemy.variant?.weapon === 'twin') {
        ctx.fillStyle = colors.white;
        ctx.fillRect(-11, 7, 4, 9);
        ctx.fillRect(7, 7, 4, 9);
      } else if (enemy.variant?.weapon === 'spread') {
        ctx.fillStyle = colors.red;
        [-10, 0, 10].forEach(x => ctx.fillRect(x - 2, 9, 4, 6));
      }
      if (enemy.variant?.armor && enemy.hp > 1) {
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.strokeRect(-12, -7, 24, 13);
      }
    }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#030712";
    ctx.fillRect(0, 0, W, H);

    stars.forEach((star) => {
      ctx.globalAlpha = star.alpha;
      ctx.fillStyle = star.size > 1.5 ? colors.cyanLight : colors.white;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    });
    ctx.globalAlpha = 1;

    ctx.save();
    if (screenShake > 0) ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);

    ctx.strokeStyle = "rgba(34, 211, 238, 0.055)";
    ctx.lineWidth = 1;
    for (let y = 70; y < H; y += 70) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    enemies.forEach(drawEnemy);
    drawPlayer();

    playerShots.forEach((shot) => {
      ctx.shadowColor = colors.cyan;
      ctx.shadowBlur = 12;
      ctx.fillStyle = colors.cyan;
      ctx.fillRect(shot.x - 3, shot.y - shot.h / 2, 6, shot.h);
      ctx.fillStyle = colors.white;
      ctx.fillRect(shot.x - 1, shot.y - shot.h / 2 - 3, 2, shot.h + 2);
    });
    ctx.shadowBlur = 0;
    enemyShots.forEach((shot) => {
      ctx.fillStyle = colors.red;
      ctx.fillRect(shot.x - shot.w / 2, shot.y - shot.h / 2, shot.w, shot.h);
      ctx.fillStyle = colors.gold;
      ctx.fillRect(shot.x - 1, shot.y - shot.h / 2, 2, shot.h * 0.6);
    });

    powerups.forEach((powerup) => {
      ctx.save();
      ctx.translate(powerup.x, powerup.y);
      ctx.rotate(powerup.spin);
      ctx.strokeStyle = powerup.type === "rapid" ? colors.gold : colors.cyan;
      ctx.fillStyle = powerup.type === "rapid" ? "rgba(251,191,36,.22)" : "rgba(34,211,238,.22)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.rect(-11, -11, 22, 22);
      ctx.fill();
      ctx.stroke();
      ctx.rotate(-powerup.spin);
      ctx.fillStyle = colors.white;
      ctx.font = "bold 12px Consolas";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(powerup.type === "rapid" ? "R" : "S", 0, 0);
      ctx.restore();
    });

    particles.forEach((particle) => {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      if (particle.kind === "ring") {
        ctx.strokeStyle = particle.color;
        ctx.lineWidth = particle.size;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (particle.kind === "debris") {
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation);
        ctx.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2);
        ctx.restore();
      } else if (particle.kind === "streak") {
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation);
        ctx.fillRect(0, -particle.size / 3, particle.size * 2.4, particle.size / 1.5);
        ctx.restore();
      } else ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function frame(time) {
    const dt = Math.min(0.034, (time - lastTime) / 1000);
    lastTime = time;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
    keys.add(event.code);
    if (event.code === "KeyP") togglePause();
    if (event.code === "Enter" && (mode === "title" || mode === "over")) startGame();
  });
  function resetReleasedFire() {
    if (!keys.has("Space") && !touch.fire) {
      fireHeldSeconds = 0;
      player.cooldown = Math.min(player.cooldown, player.rapid > 0 ? 0.085 : 0.2);
    }
  }
  window.addEventListener("keyup", (event) => { keys.delete(event.code); resetReleasedFire(); });
  window.addEventListener("blur", () => { keys.clear(); touch.left = touch.right = touch.fire = touch.dragging = false; touch.pointerId = null; resetReleasedFire(); if (mode === "playing") togglePause(); });

  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse" && mode === "playing") {
      const rect = canvas.getBoundingClientRect();
      player.x = Math.max(34, Math.min(W - 34, (event.clientX - rect.left) / rect.width * W));
    } else if (event.pointerType === "touch" && touch.dragging && event.pointerId === touch.pointerId && mode === "playing") {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const delta = (event.clientX - touch.startX) / rect.width * W;
      if (Math.abs(event.clientX - touch.startX) > 7) touch.moved = true;
      player.x = Math.max(34, Math.min(W - 34, touch.playerStartX + delta));
    }
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") {
      touch.fire = true;
      return;
    }
    if (event.pointerType === "touch" && mode === "playing") {
      event.preventDefault();
      ensureAudio();
      touch.dragging = true;
      touch.pointerId = event.pointerId;
      touch.startX = event.clientX;
      touch.playerStartX = player.x;
      touch.moved = false;
      canvas.setPointerCapture?.(event.pointerId);
    }
  });
  canvas.addEventListener("pointerup", (event) => {
    if (event.pointerType === "touch" && event.pointerId === touch.pointerId) {
      event.preventDefault();
      if (!touch.moved) firePlayer();
      touch.dragging = false;
      touch.pointerId = null;
    }
  });
  canvas.addEventListener("pointercancel", (event) => {
    if (event.pointerType === "mouse") { touch.fire = false; resetReleasedFire(); }
    if (event.pointerId === touch.pointerId) {
      touch.dragging = false;
      touch.pointerId = null;
    }
  });
  window.addEventListener("pointerup", (event) => { if (event.pointerType === "mouse") { touch.fire = false; resetReleasedFire(); } });

  ui.startButton.addEventListener("click", () => mode === "paused" ? togglePause() : startGame());
  ui.pauseButton.addEventListener("click", togglePause);
  ui.soundButton.addEventListener("click", () => {
    soundOn = !soundOn;
    localStorage.setItem("packetBlasterSound", soundOn ? "on" : "off");
    ui.soundButton.textContent = soundOn ? "Sound" : "Muted";
    if (soundOn) {
      tone(420, 0.1, "sine", 0.035, 160);
    } else {
      stopMusic();
      activeSamples.forEach(source => { try { source.stop(); } catch {} });
      activeSamples.clear();
    }
  });

  ui.highScore.textContent = String(highScore).padStart(6, "0");
  ui.soundButton.textContent = soundOn ? "Sound" : "Muted";
  if (touchDevice) ui.overlayText.textContent = "Drag anywhere to move. Tap anywhere to fire.";
  updateHud();
  requestAnimationFrame(frame);
})();
