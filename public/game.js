(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const ui = Object.fromEntries([
    "score", "highScore", "wave", "lives", "gameOverlay", "overlayTitle", "overlayText",
    "startButton", "pauseButton", "soundButton", "waveBanner", "powerStatus", "accuracy",
    "threatStatus", "leftButton", "rightButton", "fireButton",
  ].map((id) => [id, document.getElementById(id)]));

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

  let mode = "title";
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
  let musicTimer = null;
  let musicStep = 0;
  let lastTime = performance.now();

  const keys = new Set();
  const touch = { left: false, right: false, fire: false };
  const player = { x: W / 2, y: H - 72, w: 44, h: 34, speed: 430, cooldown: 0, invulnerable: 0, rapid: 0, shield: 0 };
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

  function startMusic() {
    if (!soundOn || musicTimer || mode !== "playing") return;
    ensureAudio();
    const bass = [82.41, 82.41, 98, 110, 82.41, 123.47, 110, 98];
    const lead = [329.63, 493.88, 392, 587.33, 440, 523.25, 392, 493.88,
      349.23, 523.25, 440, 659.25, 493.88, 587.33, 440, 523.25];
    musicTimer = window.setInterval(() => {
      if (!audio || mode !== "playing" || !soundOn) return;
      const now = audio.currentTime + 0.025;
      musicVoice(bass[Math.floor(musicStep / 2) % bass.length], now, 0.16, "triangle", 0.022);
      musicVoice(lead[musicStep % lead.length], now, 0.085, "square", 0.011);
      if (musicStep % 4 === 2) musicVoice(lead[(musicStep + 5) % lead.length] / 2, now + 0.055, 0.065, "square", 0.007);
      musicStep++;
    }, 135);
  }

  function stopMusic() {
    if (musicTimer) window.clearInterval(musicTimer);
    musicTimer = null;
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
    player.x = W / 2;
    player.y = H - 72;
    player.cooldown = 0;
    player.invulnerable = 1.8;
    player.rapid = 0;
    player.shield = 0;
  }

  function spawnWave() {
    enemies.length = 0;
    enemyShots.length = 0;
    waveClock = 0;
    formationReady = false;
    const cols = 10;
    const rows = Math.min(6, 4 + Math.floor((wave - 1) / 3));
    const spacingX = 70;
    const spacingY = 54;
    const startX = W / 2 - (cols - 1) * spacingX / 2;

    let slot = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const type = row === 0 ? "command" : row < 3 ? "striker" : "scout";
        const group = Math.floor(slot / 5);
        enemies.push({
          type,
          baseX: startX + col * spacingX,
          baseY: 95 + row * spacingY,
          x: startX + col * spacingX,
          y: 95 + row * spacingY,
          w: type === "command" ? 38 : 31,
          h: type === "command" ? 32 : 27,
          hp: type === "command" ? 2 + Math.floor(wave / 6) : 1,
          state: "entering",
          enterDelay: group * 0.46 + (slot % 5) * 0.075,
          enterDuration: 1.65 + (group % 3) * 0.14,
          entrancePath: group % 4,
          entranceSound: slot % 5 === 0,
          entranceT: 0,
          dive: 0,
          diveStartX: 0,
          phase: col * 0.47 + row * 0.29,
          targetX: W / 2,
        });
        slot++;
      }
    }

    if (wave % 5 === 0) {
      enemies.push({ type: "boss", baseX: W / 2, baseY: 48, x: W / 2, y: -80, w: 92, h: 46, hp: 18 + wave * 2, maxHp: 18 + wave * 2, state: "entering", enterDelay: slot * 0.095 + 0.5, enterDuration: 2.2, entrancePath: 4, entranceT: 0, dive: 0, phase: 0 });
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
    musicStep = 0;
    resetPlayer();
    spawnWave();
    mode = "playing";
    ui.gameOverlay.classList.add("hidden");
    ui.pauseButton.textContent = "Pause";
    tone(240, 0.12, "square", 0.045, 280);
    startMusic();
    updateHud();
  }

  function togglePause() {
    if (mode === "playing") {
      mode = "paused";
      ui.overlayTitle.textContent = "Paused";
      ui.overlayText.textContent = "Mission suspended. The network will wait.";
      ui.startButton.textContent = "Resume";
      ui.gameOverlay.classList.remove("hidden");
      ui.pauseButton.textContent = "Resume";
      stopMusic();
    } else if (mode === "paused") {
      mode = "playing";
      ui.gameOverlay.classList.add("hidden");
      ui.pauseButton.textContent = "Pause";
      lastTime = performance.now();
      startMusic();
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
    if (player.cooldown > 0) return;
    playerShots.push({ x: player.x, y: player.y - 24, vy: -720, w: 4, h: 18 });
    player.cooldown = player.rapid > 0 ? 0.085 : 0.2;
    shots++;
    tone(player.rapid > 0 ? 660 : 520, 0.055, "square", 0.022, 120);
  }

  function fireEnemy(enemy) {
    if (enemy.type === "boss") {
      [-0.24, 0, 0.24].forEach((angle) => enemyShots.push({ x: enemy.x, y: enemy.y + 25, vx: Math.sin(angle) * 220, vy: Math.cos(angle) * 260, w: 6, h: 14 }));
    } else {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const length = Math.hypot(dx, dy) || 1;
      const speed = 230 + wave * 9;
      enemyShots.push({ x: enemy.x, y: enemy.y + 14, vx: dx / length * speed, vy: dy / length * speed, w: 5, h: 12 });
    }
  }

  function beginDive(enemy) {
    enemy.state = "diving";
    enemy.dive = 0;
    enemy.diveStartX = enemy.x;
    enemy.targetX = player.x + (Math.random() - 0.5) * 180;
    tone(340, 0.12, "sawtooth", 0.018, -160);
  }

  function addExplosion(x, y, color, count = 12) {
    screenShake = Math.max(screenShake, count > 18 ? 7 : 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 55 + Math.random() * 210;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.35 + Math.random() * 0.55, maxLife: 0.9, color, size: 1.5 + Math.random() * 3.5 });
    }
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
    addExplosion(enemy.x, enemy.y, enemy.type === "boss" ? colors.gold : colors.pink, enemy.type === "boss" ? 42 : 14);
    tone(enemy.type === "boss" ? 120 : 180, enemy.type === "boss" ? 0.5 : 0.13, "sawtooth", 0.035, -80);
    if (enemy.type !== "boss" && Math.random() < 0.075) {
      powerups.push({ x: enemy.x, y: enemy.y, vy: 115, type: Math.random() < 0.5 ? "rapid" : "shield", spin: 0 });
    }
  }

  function hitPlayer() {
    if (player.invulnerable > 0) return;
    if (player.shield > 0) {
      player.shield = 0;
      addExplosion(player.x, player.y, colors.cyan, 18);
      tone(420, 0.18, "sine", 0.035, -180);
      return;
    }
    lives--;
    player.invulnerable = 2;
    playerShots.length = 0;
    addExplosion(player.x, player.y, colors.red, 30);
    tone(150, 0.35, "sawtooth", 0.05, -100);
    if (lives <= 0) gameOver();
    else player.x = W / 2;
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
    } else if (enemy.entrancePath < 2) {
      const mirror = enemy.entrancePath === 0 ? 1 : -1;
      if (p < 0.56) {
        const q = p / 0.56;
        x = bezier(mirror > 0 ? -70 : W + 70, mirror > 0 ? W * 0.12 : W * 0.88, mirror > 0 ? W * 0.18 : W * 0.82, W / 2, q);
        y = bezier(155, 22, 350, 252, q);
      } else {
        const q = (p - 0.56) / 0.44;
        x = bezier(W / 2, mirror > 0 ? W * 0.88 : W * 0.12, targetX + mirror * 95, targetX, q);
        y = bezier(252, 345, 35, targetY, q);
      }
    } else {
      const mirror = enemy.entrancePath === 2 ? 1 : -1;
      if (p < 0.5) {
        const q = p / 0.5;
        x = bezier(mirror > 0 ? W * 0.2 : W * 0.8, mirror > 0 ? W * 0.08 : W * 0.92, mirror > 0 ? W * 0.78 : W * 0.22, W / 2, q);
        y = bezier(-55, 170, 85, 224, q);
      } else {
        const q = (p - 0.5) / 0.5;
        x = bezier(W / 2, mirror > 0 ? W * 0.83 : W * 0.17, targetX - mirror * 70, targetX, q);
        y = bezier(224, 306, 40, targetY, q);
      }
    }

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
      particle.life -= dt;
    });
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);

    if (mode !== "playing") return;
    formationTime += dt;
    waveClock += dt;
    player.cooldown = Math.max(0, player.cooldown - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.rapid = Math.max(0, player.rapid - dt);
    player.shield = Math.max(0, player.shield - dt);
    screenShake = Math.max(0, screenShake - 24 * dt);

    const direction = ((keys.has("ArrowLeft") || keys.has("KeyA") || touch.left) ? -1 : 0) + ((keys.has("ArrowRight") || keys.has("KeyD") || touch.right) ? 1 : 0);
    player.x = Math.max(34, Math.min(W - 34, player.x + direction * player.speed * dt));
    if (keys.has("Space") || touch.fire) firePlayer();

    for (let i = playerShots.length - 1; i >= 0; i--) {
      const shot = playerShots[i];
      shot.y += shot.vy * dt;
      if (shot.y < -30) playerShots.splice(i, 1);
    }

    const formationOffset = Math.sin(formationTime * (0.9 + wave * 0.018)) * Math.min(80, 38 + wave * 2);
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
          tone(240 + soundStage * 70, 0.07, "sawtooth", 0.009, 95);
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
        enemy.x = enemy.baseX + formationOffset;
        enemy.y = enemy.baseY + Math.sin(formationTime * 2 + enemy.phase) * 5;
      } else {
        const oldX = enemy.x;
        const oldY = enemy.y;
        enemy.dive += dt * (0.28 + wave * 0.006);
        const t = enemy.dive;
        enemy.x = enemy.diveStartX * (1 - t) + enemy.targetX * t + Math.sin(t * Math.PI * 4 + enemy.phase) * 125;
        enemy.y = enemy.baseY + t * (H + 120);
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
      showWave("FORMATION LOCKED");
      tone(330, 0.1, "square", 0.028, 110);
      window.setTimeout(() => tone(494, 0.14, "square", 0.025, 165), 90);
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
      else if (overlaps(shot, player)) { enemyShots.splice(i, 1); hitPlayer(); }
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
      if (enemy.state === "diving" && overlaps(enemy, player)) hitPlayer();
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
        spawnWave();
      }
    }
    updateHud();
  }

  function drawPlayer() {
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
    ctx.fillStyle = colors.cyan;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(22, 17);
    ctx.lineTo(8, 12);
    ctx.lineTo(0, 21);
    ctx.lineTo(-8, 12);
    ctx.lineTo(-22, 17);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = colors.white;
    ctx.fillRect(-3, -12, 6, 19);
    ctx.fillStyle = colors.pink;
    ctx.beginPath();
    ctx.moveTo(-7, 17);
    ctx.lineTo(0, 31 + Math.random() * 6);
    ctx.lineTo(7, 17);
    ctx.fill();
    ctx.restore();
  }

  function drawEnemy(enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(enemy.angle || 0);
    const pulse = 0.94 + Math.sin(formationTime * 4 + enemy.phase) * 0.06;
    ctx.scale(pulse, pulse);

    if (enemy.type === "boss") {
      ctx.fillStyle = colors.gold;
      ctx.beginPath();
      ctx.moveTo(-46, -8);
      ctx.lineTo(-25, -23);
      ctx.lineTo(0, -14);
      ctx.lineTo(25, -23);
      ctx.lineTo(46, -8);
      ctx.lineTo(32, 18);
      ctx.lineTo(0, 23);
      ctx.lineTo(-32, 18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = colors.pinkDark;
      ctx.fillRect(-24, -5, 48, 11);
      ctx.fillStyle = colors.white;
      ctx.fillRect(-4, -8, 8, 17);
      const width = 74 * Math.max(0, enemy.hp / enemy.maxHp);
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(-37, 31, 74, 5);
      ctx.fillStyle = colors.red;
      ctx.fillRect(-37, 31, width, 5);
    } else if (enemy.type === "command") {
      ctx.fillStyle = colors.violet;
      ctx.beginPath();
      ctx.moveTo(0, -17);
      ctx.lineTo(19, -5);
      ctx.lineTo(13, 15);
      ctx.lineTo(0, 8);
      ctx.lineTo(-13, 15);
      ctx.lineTo(-19, -5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = colors.gold;
      ctx.fillRect(-7, -4, 14, 7);
    } else if (enemy.type === "striker") {
      ctx.fillStyle = colors.pink;
      ctx.beginPath();
      ctx.moveTo(-16, -12);
      ctx.lineTo(0, -5);
      ctx.lineTo(16, -12);
      ctx.lineTo(11, 14);
      ctx.lineTo(0, 8);
      ctx.lineTo(-11, 14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = colors.white;
      ctx.fillRect(-3, -4, 6, 6);
    } else {
      ctx.fillStyle = colors.cyanLight;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(15, 8);
      ctx.lineTo(5, 13);
      ctx.lineTo(0, 6);
      ctx.lineTo(-5, 13);
      ctx.lineTo(-15, 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#082f49";
      ctx.fillRect(-4, -3, 8, 6);
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

    ctx.fillStyle = colors.cyanLight;
    playerShots.forEach((shot) => ctx.fillRect(shot.x - shot.w / 2, shot.y - shot.h / 2, shot.w, shot.h));
    ctx.fillStyle = colors.red;
    enemyShots.forEach((shot) => ctx.fillRect(shot.x - shot.w / 2, shot.y - shot.h / 2, shot.w, shot.h));

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
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
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

  function bindHold(button, key) {
    const on = (event) => { event.preventDefault(); touch[key] = true; ensureAudio(); };
    const off = (event) => { event.preventDefault(); touch[key] = false; };
    button.addEventListener("pointerdown", on);
    button.addEventListener("pointerup", off);
    button.addEventListener("pointercancel", off);
    button.addEventListener("pointerleave", off);
  }

  window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
    keys.add(event.code);
    if (event.code === "KeyP") togglePause();
    if (event.code === "Enter" && (mode === "title" || mode === "over")) startGame();
  });
  window.addEventListener("keyup", (event) => keys.delete(event.code));
  window.addEventListener("blur", () => { keys.clear(); touch.left = touch.right = touch.fire = false; if (mode === "playing") togglePause(); });

  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse" && mode === "playing") {
      const rect = canvas.getBoundingClientRect();
      player.x = Math.max(34, Math.min(W - 34, (event.clientX - rect.left) / rect.width * W));
    }
  });
  canvas.addEventListener("pointerdown", (event) => { if (event.pointerType === "mouse") touch.fire = true; });
  window.addEventListener("pointerup", () => { touch.fire = false; });

  bindHold(ui.leftButton, "left");
  bindHold(ui.rightButton, "right");
  bindHold(ui.fireButton, "fire");

  ui.startButton.addEventListener("click", () => mode === "paused" ? togglePause() : startGame());
  ui.pauseButton.addEventListener("click", togglePause);
  ui.soundButton.addEventListener("click", () => {
    soundOn = !soundOn;
    localStorage.setItem("packetBlasterSound", soundOn ? "on" : "off");
    ui.soundButton.textContent = soundOn ? "Sound" : "Muted";
    if (soundOn) {
      tone(420, 0.1, "sine", 0.035, 160);
      startMusic();
    } else stopMusic();
  });

  ui.highScore.textContent = String(highScore).padStart(6, "0");
  ui.soundButton.textContent = soundOn ? "Sound" : "Muted";
  updateHud();
  requestAnimationFrame(frame);
})();
