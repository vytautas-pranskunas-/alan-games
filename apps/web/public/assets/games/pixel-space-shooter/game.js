/**
 * Pixel Space Shooter — Phaser 3 (Arcade Physics)
 * Movement independent of mouse aim; ship orientation stays fixed.
 */
(() => {
  "use strict";

  const W = 960;
  const H = 540;
  const SUPER_COOLDOWN_MS = 30000;
  const MAGNETIC_COOLDOWN_MS = 60000;
  const MAGNETIC_DURATION_MS = 2000;
  const SHIELD_DURATION_MS = 10000;
  const TRIPLE_DURATION_MS = 10000;
  const PLAYER_MAX_HP = 100;
  const INVULN_MS = 900;

  /** Selectable player ships (persisted in Settings). */
  const SHIPS = {
    interceptor: {
      id: "interceptor",
      name: "INTERCEPTOR",
      blurb: "Fast · agile lasers",
      texture: "player",
      speed: 260,
      fireRate: 140,
      tripleRate: 90,
      shotDmg: 12,
      shotSpeed: 560,
      dualGuns: false,
      bodyW: 20,
      bodyH: 16,
      shieldR: 22,
    },
    dreadnought: {
      id: "dreadnought",
      name: "DREADNOUGHT",
      blurb: "Slow · heavy dual cannons",
      texture: "player_dread",
      speed: 145,
      fireRate: 200,
      tripleRate: 120,
      shotDmg: 26,
      shotSpeed: 500,
      dualGuns: true,
      bodyW: 36,
      bodyH: 26,
      shieldR: 30,
    },
  };

  function getSelectedShip() {
    const id = Storage.getShipId();
    return SHIPS[id] || SHIPS.interceptor;
  }
  const MAX_ALLIES = 4;
  const ALLY_FIRE_MS = 480;
  /** Stronger helper ships that join you (100 HP, can grab shield / triple / fuel). */
  const ALLY_MAX_HP = 100;
  const ALLY_HIT_RADIUS = 14;
  const ALLY_PICKUP_RADIUS = 22;
  /** Dev test helper join at start — off for normal play. */
  const TEST_START_HELPER = false;

  const SCORE = {
    smallAsteroid: 10,
    largeAsteroid: 25,
    planetSmall: 50,
    planetLarge: 100,
    planetHuge: 150,
    scout: 50,
    fighter: 100,
    heavy: 250,
    doomstar: 500,
  };

  /** `meters` → human distance label (m / km). */
  function formatDistance(meters) {
    const m = Math.max(0, meters);
    if (m < 1000) {
      return `${Math.floor(m)} m`;
    }
    const km = m / 1000;
    if (km < 10) return `${km.toFixed(2)} km`;
    if (km < 100) return `${km.toFixed(1)} km`;
    return `${Math.floor(km)} km`;
  }

  const Storage = {
    flight: "pss_flight_best",
    fight: "pss_fight_best",
    sound: "pss_sound",
    music: "pss_music",
    volume: "pss_volume",
    ship: "pss_ship",
    getBest(mode) {
      return Number(localStorage.getItem(mode === "flight" ? this.flight : this.fight) || 0);
    },
    setBest(mode, score) {
      const key = mode === "flight" ? this.flight : this.fight;
      const prev = this.getBest(mode);
      const n = Math.floor(score);
      if (n > prev) localStorage.setItem(key, String(n));
      return Math.max(n, prev);
    },
    getShipId() {
      const id = localStorage.getItem(this.ship) || "interceptor";
      return SHIPS[id] ? id : "interceptor";
    },
    setShipId(id) {
      if (SHIPS[id]) localStorage.setItem(this.ship, id);
    },
    getSettings() {
      return {
        sound: localStorage.getItem(this.sound) !== "0",
        music: localStorage.getItem(this.music) !== "0",
        volume: Number(localStorage.getItem(this.volume) ?? "0.6"),
      };
    },
    saveSettings(s) {
      localStorage.setItem(this.sound, s.sound ? "1" : "0");
      localStorage.setItem(this.music, s.music ? "1" : "0");
      localStorage.setItem(this.volume, String(s.volume));
    },
  };

  /* -------------------- Audio (Web Audio beeps) -------------------- */
  const SFX = {
    ctx: null,
    settings: Storage.getSettings(),
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    },
    tone(freq, dur, type, gain) {
      if (!this.settings.sound) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || "square";
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime((gain ?? 0.08) * this.settings.volume, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    },
    laser() {
      this.tone(880, 0.06, "square", 0.05);
      this.tone(1200, 0.04, "triangle", 0.03);
    },
    enemyLaser() {
      this.tone(220, 0.08, "sawtooth", 0.04);
    },
    hit() {
      this.tone(160, 0.12, "square", 0.07);
    },
    explode() {
      this.tone(90, 0.25, "sawtooth", 0.1);
      this.tone(60, 0.35, "triangle", 0.06);
    },
    superCharge() {
      this.tone(200, 0.2, "sine", 0.08);
      this.tone(400, 0.25, "sine", 0.08);
    },
    superFire() {
      this.tone(120, 0.5, "sawtooth", 0.14);
      this.tone(80, 0.6, "triangle", 0.1);
    },
    magnetic() {
      this.tone(90, 0.35, "sine", 0.12);
      this.tone(180, 0.4, "triangle", 0.08);
      this.tone(45, 0.5, "sawtooth", 0.06);
    },
    pickup() {
      this.tone(520, 0.08, "sine", 0.06);
      this.tone(780, 0.1, "triangle", 0.05);
    },
    shield() {
      this.tone(400, 0.15, "sine", 0.08);
      this.tone(600, 0.2, "triangle", 0.06);
    },
    triple() {
      this.tone(700, 0.1, "square", 0.06);
      this.tone(900, 0.12, "square", 0.05);
      this.tone(1100, 0.1, "triangle", 0.04);
    },
    allyJoin() {
      this.tone(480, 0.08, "sine", 0.06);
      this.tone(720, 0.12, "triangle", 0.05);
      this.tone(960, 0.1, "square", 0.04);
    },
    gameOver() {
      this.tone(300, 0.2, "square", 0.08);
      setTimeout(() => this.tone(200, 0.25, "square", 0.08), 180);
      setTimeout(() => this.tone(120, 0.4, "triangle", 0.1), 360);
    },
    ui() {
      this.tone(660, 0.05, "square", 0.04);
    },
  };

  /* -------------------- Procedural textures -------------------- */
  function drawPixels(g, pixels, ox, oy, scale) {
    const s = scale || 1;
    for (const [x, y, c] of pixels) {
      g.fillStyle(c, 1);
      g.fillRect(ox + x * s, oy + y * s, s, s);
    }
  }

  function makeTextures(scene) {
    // Player X-wing inspired (faces UP, fixed orientation)
    {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      const px = [
        [7, 0, 0xe8eef8], [8, 0, 0xe8eef8],
        [6, 1, 0xd0d8e8], [7, 1, 0x3a7ad9], [8, 1, 0x3a7ad9], [9, 1, 0xd0d8e8],
        [6, 2, 0xe8eef8], [7, 2, 0x1a2a44], [8, 2, 0x1a2a44], [9, 2, 0xe8eef8],
        [5, 3, 0xc43c3c], [6, 3, 0xe8eef8], [7, 3, 0xc8d0e0], [8, 3, 0xc8d0e0], [9, 3, 0xe8eef8], [10, 3, 0xc43c3c],
        [2, 4, 0xc43c3c], [3, 4, 0xe8eef8], [4, 4, 0xb0b8c8], [5, 4, 0xe8eef8], [6, 4, 0xe8eef8], [7, 4, 0xe8eef8], [8, 4, 0xe8eef8], [9, 4, 0xe8eef8], [10, 4, 0xe8eef8], [11, 4, 0xb0b8c8], [12, 4, 0xe8eef8], [13, 4, 0xc43c3c],
        [1, 5, 0x9aa8c0], [2, 5, 0xe8eef8], [3, 5, 0xe8eef8], [4, 5, 0xe8eef8], [5, 5, 0xc43c3c], [6, 5, 0xe8eef8], [7, 5, 0xd0d8e8], [8, 5, 0xd0d8e8], [9, 5, 0xe8eef8], [10, 5, 0xc43c3c], [11, 5, 0xe8eef8], [12, 5, 0xe8eef8], [13, 5, 0xe8eef8], [14, 5, 0x9aa8c0],
        [0, 6, 0x708090], [1, 6, 0xe8eef8], [2, 6, 0xc43c3c], [6, 6, 0xe8eef8], [7, 6, 0xe8eef8], [8, 6, 0xe8eef8], [9, 6, 0xe8eef8], [13, 6, 0xc43c3c], [14, 6, 0xe8eef8], [15, 6, 0x708090],
        [0, 7, 0x4ec4ff], [1, 7, 0x9aa8c0], [6, 7, 0xb0b8c8], [7, 7, 0xe8eef8], [8, 7, 0xe8eef8], [9, 7, 0xb0b8c8], [14, 7, 0x9aa8c0], [15, 7, 0x4ec4ff],
        [6, 8, 0x708090], [7, 8, 0x4ec4ff], [8, 8, 0x4ec4ff], [9, 8, 0x708090],
        [7, 9, 0xffaa33], [8, 9, 0xffaa33],
      ];
      drawPixels(g, px, 0, 0, 2);
      g.generateTexture("player", 32, 22);
      g.destroy();
    }

    // Player Dreadnought — big, slow, heavy dual cannons
    {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x1a2230, 1);
      g.fillRect(8, 14, 32, 28);
      g.fillStyle(0x2a3848, 1);
      g.fillRect(4, 18, 40, 22);
      g.fillStyle(0x3a4a5c, 1);
      g.fillRect(12, 6, 24, 16);
      g.fillStyle(0x9aa8c0, 1);
      g.fillRect(18, 2, 12, 10);
      g.fillStyle(0x3a7ad9, 1);
      g.fillRect(20, 4, 8, 6);
      // Wide wings
      g.fillStyle(0xc43c3c, 1);
      g.fillRect(0, 20, 10, 8);
      g.fillRect(38, 20, 10, 8);
      g.fillStyle(0xe8eef8, 1);
      g.fillRect(2, 22, 6, 4);
      g.fillRect(40, 22, 6, 4);
      // Dual heavy cannons
      g.fillStyle(0xffaa33, 1);
      g.fillRect(6, 8, 5, 14);
      g.fillRect(37, 8, 5, 14);
      g.fillStyle(0xffee88, 1);
      g.fillRect(7, 6, 3, 4);
      g.fillRect(38, 6, 3, 4);
      // Engines
      g.fillStyle(0x4ec4ff, 1);
      g.fillRect(14, 40, 6, 8);
      g.fillRect(28, 40, 6, 8);
      g.fillStyle(0xffaa33, 1);
      g.fillRect(16, 44, 2, 4);
      g.fillRect(30, 44, 2, 4);
      g.generateTexture("player_dread", 48, 48);
      g.destroy();
    }

    // Scout (TIE-ish small)
    {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      const px = [
        [0, 2, 0x22222a], [0, 3, 0x33333c], [0, 4, 0x22222a],
        [1, 1, 0x2a2a32], [1, 2, 0x3a3a44], [1, 3, 0x3a3a44], [1, 4, 0x3a3a44], [1, 5, 0x2a2a32],
        [2, 0, 0x1a1a22], [2, 1, 0x2a2a32], [2, 2, 0x44444e], [2, 3, 0xc43c3c], [2, 4, 0x44444e], [2, 5, 0x2a2a32], [2, 6, 0x1a1a22],
        [3, 2, 0x2a2a32], [3, 3, 0x55555e], [3, 4, 0x2a2a32],
        [4, 0, 0x1a1a22], [4, 1, 0x2a2a32], [4, 2, 0x44444e], [4, 3, 0xc43c3c], [4, 4, 0x44444e], [4, 5, 0x2a2a32], [4, 6, 0x1a1a22],
        [5, 1, 0x2a2a32], [5, 2, 0x3a3a44], [5, 3, 0x3a3a44], [5, 4, 0x3a3a44], [5, 5, 0x2a2a32],
        [6, 2, 0x22222a], [6, 3, 0x33333c], [6, 4, 0x22222a],
      ];
      drawPixels(g, px, 0, 0, 3);
      g.generateTexture("enemy_scout", 21, 21);
      g.destroy();
    }

    // Standard fighter
    {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      const px = [
        [4, 0, 0x2a2a32], [5, 0, 0x3a3a44], [6, 0, 0x2a2a32],
        [3, 1, 0x22222a], [4, 1, 0x44444e], [5, 1, 0xc43c3c], [6, 1, 0x44444e], [7, 1, 0x22222a],
        [1, 2, 0x1a1a22], [2, 2, 0x2a2a32], [3, 2, 0x3a3a44], [4, 2, 0x55555e], [5, 2, 0x888], [6, 2, 0x55555e], [7, 2, 0x3a3a44], [8, 2, 0x2a2a32], [9, 2, 0x1a1a22],
        [0, 3, 0x22222a], [1, 3, 0x3a3a44], [2, 3, 0x44444e], [4, 3, 0x3a3a44], [5, 3, 0xc43c3c], [6, 3, 0x3a3a44], [8, 3, 0x44444e], [9, 3, 0x3a3a44], [10, 3, 0x22222a],
        [0, 4, 0x1a1a22], [1, 4, 0x2a2a32], [2, 4, 0x3a3a44], [4, 4, 0x2a2a32], [5, 4, 0x44444e], [6, 4, 0x2a2a32], [8, 4, 0x3a3a44], [9, 4, 0x2a2a32], [10, 4, 0x1a1a22],
        [2, 5, 0x22222a], [5, 5, 0x4ec4ff], [8, 5, 0x22222a],
      ];
      drawPixels(g, px, 0, 0, 3);
      g.generateTexture("enemy_fighter", 33, 18);
      g.destroy();
    }

    // Heavy ship
    {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x1a1a22, 1);
      g.fillRect(0, 8, 48, 20);
      g.fillStyle(0x2a2a32, 1);
      g.fillRect(4, 4, 40, 28);
      g.fillStyle(0x3a3a44, 1);
      g.fillRect(10, 0, 28, 10);
      g.fillStyle(0xc43c3c, 1);
      g.fillRect(20, 6, 8, 8);
      g.fillRect(6, 14, 4, 4);
      g.fillRect(38, 14, 4, 4);
      g.fillStyle(0x55555e, 1);
      g.fillRect(14, 18, 20, 10);
      g.fillStyle(0x4ec4ff, 1);
      g.fillRect(18, 30, 4, 6);
      g.fillRect(26, 30, 4, 6);
      g.generateTexture("enemy_heavy", 48, 36);
      g.destroy();
    }

    // Asteroids
    for (const [key, size, color] of [
      ["asteroid_s", 16, 0x8a7a6a],
      ["asteroid_l", 36, 0x6a5a4a],
    ]) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(color, 1);
      g.fillCircle(size / 2, size / 2, size / 2 - 1);
      g.fillStyle(0x4a4038, 1);
      g.fillCircle(size * 0.35, size * 0.4, size * 0.15);
      g.fillCircle(size * 0.65, size * 0.55, size * 0.12);
      g.fillStyle(0xa89888, 1);
      g.fillCircle(size * 0.55, size * 0.3, size * 0.1);
      g.generateTexture(key, size, size);
      g.destroy();
    }

    // Planets (kept modest so they never fill the playfield)
    for (const [key, size, c1, c2] of [
      ["planet_s", 32, 0x3a6a9a, 0x2a4a7a],
      ["planet_l", 48, 0x6a3a5a, 0x4a2a3a],
      ["planet_indestruct", 56, 0x2a8a6a, 0x1a5a4a],
    ]) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(c1, 1);
      g.fillCircle(size / 2, size / 2, size / 2 - 2);
      g.fillStyle(c2, 1);
      g.fillCircle(size * 0.38, size * 0.4, size * 0.22);
      g.fillStyle(0xffffff, 0.15);
      g.fillCircle(size * 0.62, size * 0.32, size * 0.12);
      g.generateTexture(key, size, size);
      g.destroy();
    }

    // Projectiles
    {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x44ff88, 1);
      g.fillRect(0, 0, 4, 10);
      g.fillStyle(0xccffee, 1);
      g.fillRect(1, 1, 2, 8);
      g.generateTexture("laser", 4, 10);
      g.destroy();
    }
    {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xff3344, 1);
      g.fillRect(0, 0, 4, 10);
      g.fillStyle(0xffaaaa, 1);
      g.fillRect(1, 1, 2, 8);
      g.generateTexture("enemy_laser", 4, 10);
      g.destroy();
    }
    {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffaa00, 1);
      g.fillCircle(6, 6, 6);
      g.fillStyle(0xffee88, 1);
      g.fillCircle(6, 6, 3);
      g.generateTexture("heavy_shot", 12, 12);
      g.destroy();
    }

    // Fuel tank (HP pickup)
    {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x2a2a32, 1);
      g.fillRect(2, 1, 12, 18);
      g.fillStyle(0x44cc66, 1);
      g.fillRect(4, 4, 8, 12);
      g.fillStyle(0x88ffaa, 1);
      g.fillRect(5, 5, 3, 5);
      g.fillStyle(0xc43c3c, 1);
      g.fillRect(6, 0, 4, 3);
      g.fillStyle(0xffee88, 1);
      g.fillCircle(8, 10, 2);
      g.generateTexture("fuel", 16, 20);
      g.destroy();
    }

    // Shield pickup
    {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.lineStyle(2, 0x66ccff, 1);
      g.strokeCircle(10, 10, 8);
      g.lineStyle(2, 0xaaddff, 1);
      g.strokeCircle(10, 10, 5);
      g.fillStyle(0x88ddff, 0.5);
      g.fillCircle(10, 10, 3);
      g.generateTexture("pickup_shield", 20, 20);
      g.destroy();
    }

    // Triple-gun / autocannon pickup
    {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x3a3a44, 1);
      g.fillRect(2, 4, 16, 12);
      g.fillStyle(0xffaa33, 1);
      g.fillRect(4, 2, 3, 16);
      g.fillRect(9, 0, 3, 18);
      g.fillRect(14, 2, 3, 16);
      g.fillStyle(0xffee88, 1);
      g.fillRect(5, 1, 1, 3);
      g.fillRect(10, 0, 1, 3);
      g.fillRect(15, 1, 1, 3);
      g.generateTexture("pickup_triple", 20, 20);
      g.destroy();
    }

    // Tiny ally wingman (pickup + attached drone)
    {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      const px = [
        [3, 0, 0xaae8ff], [4, 0, 0xaae8ff],
        [2, 1, 0x66ccee], [3, 1, 0xe8f8ff], [4, 1, 0xe8f8ff], [5, 1, 0x66ccee],
        [1, 2, 0x44aadd], [2, 2, 0x88ddff], [3, 2, 0x2a88cc], [4, 2, 0x2a88cc], [5, 2, 0x88ddff], [6, 2, 0x44aadd],
        [0, 3, 0x3388bb], [1, 3, 0x66ccee], [2, 3, 0xaae8ff], [3, 3, 0xe8f8ff], [4, 3, 0xe8f8ff], [5, 3, 0xaae8ff], [6, 3, 0x66ccee], [7, 3, 0x3388bb],
        [2, 4, 0x44aadd], [3, 4, 0x66ffaa], [4, 4, 0x66ffaa], [5, 4, 0x44aadd],
        [3, 5, 0xffcc66], [4, 5, 0xffcc66],
      ];
      drawPixels(g, px, 0, 0, 2);
      g.generateTexture("ally_drone", 16, 12);
      g.destroy();
    }

    // Doomstar — late-game boss enemy (bigger than heavy, dual wing cannons)
    {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      // Hull
      g.fillStyle(0x120810, 1);
      g.fillRect(8, 18, 48, 28);
      g.fillStyle(0x2a1018, 1);
      g.fillRect(14, 10, 36, 40);
      g.fillStyle(0x3a1822, 1);
      g.fillRect(20, 4, 24, 14);
      // Command bridge
      g.fillStyle(0x1a0a10, 1);
      g.fillRect(26, 0, 12, 10);
      g.fillStyle(0xff2244, 1);
      g.fillRect(28, 2, 8, 5);
      g.fillStyle(0xff88aa, 1);
      g.fillRect(30, 3, 4, 2);
      // Twin wing pylons
      g.fillStyle(0x441018, 1);
      g.fillRect(0, 16, 16, 10);
      g.fillRect(48, 16, 16, 10);
      g.fillStyle(0x661122, 1);
      g.fillRect(2, 14, 12, 14);
      g.fillRect(50, 14, 12, 14);
      // Dual cannons (glowing)
      g.fillStyle(0xff4466, 1);
      g.fillRect(4, 8, 6, 12);
      g.fillRect(54, 8, 6, 12);
      g.fillStyle(0xffccdd, 1);
      g.fillRect(5, 6, 4, 4);
      g.fillRect(55, 6, 4, 4);
      g.fillStyle(0xffee88, 1);
      g.fillRect(6, 4, 2, 3);
      g.fillRect(56, 4, 2, 3);
      // Armor plates + vents
      g.fillStyle(0x552030, 1);
      g.fillRect(18, 22, 28, 16);
      g.fillStyle(0xc43c3c, 1);
      g.fillRect(22, 26, 6, 6);
      g.fillRect(36, 26, 6, 6);
      g.fillStyle(0x4ec4ff, 1);
      g.fillRect(28, 28, 8, 4);
      // Engines
      g.fillStyle(0xff6622, 1);
      g.fillRect(18, 44, 8, 8);
      g.fillRect(38, 44, 8, 8);
      g.fillStyle(0xffcc44, 1);
      g.fillRect(20, 48, 4, 6);
      g.fillRect(40, 48, 4, 6);
      g.fillStyle(0xffeecc, 1);
      g.fillRect(21, 50, 2, 4);
      g.fillRect(41, 50, 2, 4);
      // Dorsal fin
      g.fillStyle(0x881122, 1);
      g.fillRect(30, 12, 4, 12);
      g.fillRect(28, 16, 8, 6);
      g.generateTexture("enemy_doomstar", 64, 56);
      g.destroy();
    }

    // Doomstar cannon bolt (fatter crimson shot)
    {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xff2244, 1);
      g.fillRect(2, 0, 6, 14);
      g.fillStyle(0xff8899, 1);
      g.fillRect(3, 1, 4, 10);
      g.fillStyle(0xffeef2, 1);
      g.fillRect(4, 2, 2, 6);
      g.generateTexture("doomstar_shot", 10, 14);
      g.destroy();
    }

    // Doomstar twin lasers (cyan beams — alternate weapon)
    {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x2288ff, 1);
      g.fillRect(1, 0, 4, 16);
      g.fillStyle(0x88ddff, 1);
      g.fillRect(2, 1, 2, 14);
      g.fillStyle(0xe8f8ff, 1);
      g.fillRect(2, 2, 2, 6);
      g.generateTexture("doomstar_laser", 6, 16);
      g.destroy();
    }

    // Doomstar missile (orange — alternate weapon)
    {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x888890, 1);
      g.fillRect(3, 2, 6, 14);
      g.fillStyle(0xff6622, 1);
      g.fillRect(4, 0, 4, 6);
      g.fillStyle(0xffcc44, 1);
      g.fillRect(5, 1, 2, 3);
      g.fillStyle(0xff4466, 1);
      g.fillRect(4, 14, 2, 4);
      g.fillRect(6, 14, 2, 4);
      g.fillStyle(0xffaa33, 1);
      g.fillRect(5, 16, 2, 3);
      g.generateTexture("doomstar_missile", 12, 20);
      g.destroy();
    }

    // Crosshair
    {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.lineStyle(2, 0x7ec8ff, 1);
      g.strokeCircle(8, 8, 7);
      g.lineBetween(8, 0, 8, 4);
      g.lineBetween(8, 12, 8, 16);
      g.lineBetween(0, 8, 4, 8);
      g.lineBetween(12, 8, 16, 8);
      g.fillStyle(0xff4466, 1);
      g.fillRect(7, 7, 2, 2);
      g.generateTexture("crosshair", 16, 16);
      g.destroy();
    }

    // Particle
    {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 3, 3);
      g.generateTexture("px", 3, 3);
      g.destroy();
    }
  }

  /* -------------------- Boot -------------------- */
  class BootScene extends Phaser.Scene {
    constructor() {
      super("Boot");
    }
    create() {
      makeTextures(this);
      this.scene.start("Menu");
    }
  }

  /* -------------------- Starfield helper -------------------- */
  function createStarfield(scene) {
    const layers = [
      { count: 80, speed: 20, size: 1, alpha: 0.5 },
      { count: 50, speed: 45, size: 1.5, alpha: 0.75 },
      { count: 25, speed: 90, size: 2, alpha: 1 },
    ];
    const stars = [];
    layers.forEach((layer) => {
      for (let i = 0; i < layer.count; i++) {
        const s = scene.add.rectangle(
          Phaser.Math.Between(0, W),
          Phaser.Math.Between(0, H),
          layer.size,
          layer.size,
          0xdfe8ff,
          layer.alpha
        );
        s.setDepth(-10);
        s._speed = layer.speed;
        stars.push(s);
      }
    });
    return {
      update(dt, scrollY) {
        const sy = scrollY != null ? scrollY : 1;
        stars.forEach((s) => {
          s.y += s._speed * sy * dt;
          if (s.y > H + 2) {
            s.y = -2;
            s.x = Phaser.Math.Between(0, W);
          }
        });
      },
    };
  }

  /* -------------------- Menu -------------------- */
  class MenuScene extends Phaser.Scene {
    constructor() {
      super("Menu");
    }

    create() {
      document.body.classList.add("menu-cursor");
      this.stars = createStarfield(this);
      this.add
        .text(W / 2, 70, "PIXEL SPACE SHOOTER", {
          fontFamily: "Courier New, monospace",
          fontSize: "36px",
          color: "#7ec8ff",
          stroke: "#1a3a6a",
          strokeThickness: 4,
        })
        .setOrigin(0.5);

      this.add
        .text(W / 2, 110, "STAR WARS–INSPIRED PIXEL ARCADE", {
          fontFamily: "Courier New, monospace",
          fontSize: "14px",
          color: "#6a88aa",
        })
        .setOrigin(0.5);

      const selected = getSelectedShip();
      const ship = this.add.image(W / 2, 175, selected.texture).setScale(selected.id === "dreadnought" ? 1.6 : 2.5);
      this.tweens.add({
        targets: ship,
        y: 185,
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      this.add
        .text(W / 2, 220, selected.name, {
          fontFamily: "Courier New, monospace",
          fontSize: "12px",
          color: "#7ec8ff",
        })
        .setOrigin(0.5);

      const flightBest = Storage.getBest("flight");
      const fightBest = Storage.getBest("fight");
      this.add
        .text(W / 2, 248, `BEST FLIGHT ${flightBest}   ·   BEST FIGHT ${fightBest}`, {
          fontFamily: "Courier New, monospace",
          fontSize: "12px",
          color: "#8899aa",
        })
        .setOrigin(0.5);

      const items = [
        { label: "1. FLIGHT MODE", scene: "Flight", y: 290 },
        { label: "2. FIGHT MODE", scene: "Fight", y: 330 },
        { label: "3. CONTROLS", scene: "Controls", y: 370 },
        { label: "4. SETTINGS", scene: "Settings", y: 410 },
        { label: "5. SELECT SHIP", scene: "ShipSelect", y: 450 },
      ];

      items.forEach((item) => {
        const btn = this.add
          .text(W / 2, item.y, item.label, {
            fontFamily: "Courier New, monospace",
            fontSize: "22px",
            color: "#e8eef8",
            backgroundColor: "#122038",
            padding: { x: 18, y: 8 },
          })
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true });

        btn.on("pointerover", () => btn.setStyle({ color: "#7ec8ff" }));
        btn.on("pointerout", () => btn.setStyle({ color: "#e8eef8" }));
        btn.on("pointerdown", () => {
          SFX.ui();
          SFX.ensure();
          if (item.scene === "Flight" || item.scene === "Fight") {
            document.body.classList.remove("menu-cursor");
          }
          this.scene.start(item.scene);
        });
      });

      this.input.keyboard.on("keydown-ONE", () => {
        SFX.ensure();
        document.body.classList.remove("menu-cursor");
        this.scene.start("Flight");
      });
      this.input.keyboard.on("keydown-TWO", () => {
        SFX.ensure();
        document.body.classList.remove("menu-cursor");
        this.scene.start("Fight");
      });
      this.input.keyboard.on("keydown-THREE", () => this.scene.start("Controls"));
      this.input.keyboard.on("keydown-FOUR", () => this.scene.start("Settings"));
      this.input.keyboard.on("keydown-FIVE", () => this.scene.start("ShipSelect"));
    }

    update(_, dtMs) {
      this.stars.update(dtMs / 1000, 0.35);
    }
  }

  class ShipSelectScene extends Phaser.Scene {
    constructor() {
      super("ShipSelect");
    }
    create() {
      document.body.classList.add("menu-cursor");
      this.add.rectangle(0, 0, W, H, 0x05070f, 0.92).setOrigin(0);
      this.add
        .text(W / 2, 48, "SELECT SHIP", {
          fontFamily: "Courier New, monospace",
          fontSize: "32px",
          color: "#7ec8ff",
        })
        .setOrigin(0.5);
      this.add
        .text(W / 2, 88, "Choose your craft — saved under Settings", {
          fontFamily: "Courier New, monospace",
          fontSize: "13px",
          color: "#6a88aa",
        })
        .setOrigin(0.5);

      this.selectedId = Storage.getShipId();
      this.cards = [];
      const list = [SHIPS.interceptor, SHIPS.dreadnought];
      list.forEach((ship, i) => {
        const cx = W / 2 + (i === 0 ? -200 : 200);
        const cy = 280;
        const panel = this.add
          .rectangle(cx, cy, 280, 300, 0x122038, 1)
          .setStrokeStyle(2, 0x2a4a6a)
          .setInteractive({ useHandCursor: true });
        const img = this.add.image(cx, cy - 50, ship.texture).setScale(ship.id === "dreadnought" ? 2.1 : 3.2);
        const title = this.add
          .text(cx, cy + 40, ship.name, {
            fontFamily: "Courier New, monospace",
            fontSize: "18px",
            color: "#e8eef8",
          })
          .setOrigin(0.5);
        const blurb = this.add
          .text(cx, cy + 72, ship.blurb, {
            fontFamily: "Courier New, monospace",
            fontSize: "13px",
            color: "#8899aa",
            align: "center",
          })
          .setOrigin(0.5);
        const mark = this.add
          .text(cx, cy + 110, "", {
            fontFamily: "Courier New, monospace",
            fontSize: "14px",
            color: "#66ffaa",
          })
          .setOrigin(0.5);

        const card = { ship, panel, mark, img, title, blurb };
        this.cards.push(card);
        const pick = () => {
          Storage.setShipId(ship.id);
          this.selectedId = ship.id;
          SFX.ui();
          this.refresh();
        };
        panel.on("pointerdown", pick);
        panel.on("pointerover", () => {
          if (this.selectedId !== ship.id) panel.setStrokeStyle(2, 0x7ec8ff);
        });
        panel.on("pointerout", () => this.refresh());
        img.setInteractive({ useHandCursor: true }).on("pointerdown", pick);
      });

      this.refresh();

      const back = this.add
        .text(W / 2, 500, "[ BACK ]", {
          fontFamily: "Courier New, monospace",
          fontSize: "20px",
          color: "#7ec8ff",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      back.on("pointerdown", () => {
        SFX.ui();
        this.scene.start("Menu");
      });
      this.input.keyboard.on("keydown-ESC", () => this.scene.start("Menu"));
    }

    refresh() {
      this.cards.forEach((card) => {
        const on = card.ship.id === this.selectedId;
        card.panel.setStrokeStyle(3, on ? 0x66ffaa : 0x2a4a6a);
        card.panel.setFillStyle(on ? 0x1a3048 : 0x122038);
        card.mark.setText(on ? "▶ SELECTED" : "TAP TO SELECT");
        card.mark.setColor(on ? "#66ffaa" : "#7ec8ff");
      });
    }
  }

  class ControlsScene extends Phaser.Scene {
    constructor() {
      super("Controls");
    }
    create() {
      document.body.classList.add("menu-cursor");
      this.add.rectangle(0, 0, W, H, 0x05070f, 0.92).setOrigin(0);
      this.add
        .text(W / 2, 60, "CONTROLS", {
          fontFamily: "Courier New, monospace",
          fontSize: "32px",
          color: "#7ec8ff",
        })
        .setOrigin(0.5);

      const lines = [
        "W / A / S / D  —  Move (ship does not rotate)",
        "Mouse          —  Aim weapons",
        "Left Click     —  Fire primary laser (hold)",
        "Space          —  Superlaser (30s cooldown)",
        "Shift          —  Magnetic Blast (2s / 1min cooldown)",
        "Esc            —  Pause / Resume",
        "",
        "TABLET: left stick = move, right stick = aim + fire.",
        "Above left stick: MAG blast + SUPERLASER buttons.",
        "Pickups: fuel (+HP), shield (10s), triple gun (10s).",
        "Helper ships join you (100 HP) — fight, smash planets, grab pickups.",
        "FIGHT: Doomstar is a late boss enemy — dual cannons, tougher than Heavy.",
      ];
      lines.forEach((line, i) => {
        this.add
          .text(W / 2, 120 + i * 28, line, {
            fontFamily: "Courier New, monospace",
            fontSize: "15px",
            color: "#c8d4e8",
          })
          .setOrigin(0.5);
      });

      const back = this.add
        .text(W / 2, 480, "[ BACK ]", {
          fontFamily: "Courier New, monospace",
          fontSize: "20px",
          color: "#7ec8ff",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      back.on("pointerdown", () => {
        SFX.ui();
        this.scene.start("Menu");
      });
      this.input.keyboard.on("keydown-ESC", () => this.scene.start("Menu"));
    }
  }

  class SettingsScene extends Phaser.Scene {
    constructor() {
      super("Settings");
    }
    create() {
      document.body.classList.add("menu-cursor");
      this.settings = Storage.getSettings();
      SFX.settings = this.settings;

      this.add.rectangle(0, 0, W, H, 0x05070f, 0.92).setOrigin(0);
      this.add
        .text(W / 2, 60, "SETTINGS", {
          fontFamily: "Courier New, monospace",
          fontSize: "32px",
          color: "#7ec8ff",
        })
        .setOrigin(0.5);

      this.soundText = this.add
        .text(W / 2, 130, "", {
          fontFamily: "Courier New, monospace",
          fontSize: "20px",
          color: "#e8eef8",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      this.musicText = this.add
        .text(W / 2, 175, "", {
          fontFamily: "Courier New, monospace",
          fontSize: "20px",
          color: "#e8eef8",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      this.volText = this.add
        .text(W / 2, 220, "", {
          fontFamily: "Courier New, monospace",
          fontSize: "20px",
          color: "#e8eef8",
        })
        .setOrigin(0.5);

      const volDown = this.add
        .text(W / 2 - 140, 220, "[ - ]", {
          fontFamily: "Courier New, monospace",
          fontSize: "20px",
          color: "#7ec8ff",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      const volUp = this.add
        .text(W / 2 + 140, 220, "[ + ]", {
          fontFamily: "Courier New, monospace",
          fontSize: "20px",
          color: "#7ec8ff",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      // Ship picker under settings
      this.add
        .text(W / 2, 275, "YOUR SHIP", {
          fontFamily: "Courier New, monospace",
          fontSize: "16px",
          color: "#7ec8ff",
        })
        .setOrigin(0.5);

      this.shipId = Storage.getShipId();
      this.shipCards = [];
      [SHIPS.interceptor, SHIPS.dreadnought].forEach((ship, i) => {
        const cx = W / 2 + (i === 0 ? -160 : 160);
        const cy = 370;
        const panel = this.add
          .rectangle(cx, cy, 240, 160, 0x122038, 1)
          .setStrokeStyle(2, 0x2a4a6a)
          .setInteractive({ useHandCursor: true });
        const img = this.add.image(cx, cy - 28, ship.texture).setScale(ship.id === "dreadnought" ? 1.5 : 2.2);
        const title = this.add
          .text(cx, cy + 28, ship.name, {
            fontFamily: "Courier New, monospace",
            fontSize: "14px",
            color: "#e8eef8",
          })
          .setOrigin(0.5);
        const blurb = this.add
          .text(cx, cy + 50, ship.blurb, {
            fontFamily: "Courier New, monospace",
            fontSize: "11px",
            color: "#8899aa",
          })
          .setOrigin(0.5);
        const card = { ship, panel, title, blurb, img };
        this.shipCards.push(card);
        const pick = () => {
          Storage.setShipId(ship.id);
          this.shipId = ship.id;
          SFX.ui();
          this.refresh();
        };
        panel.on("pointerdown", pick);
        img.setInteractive({ useHandCursor: true }).on("pointerdown", pick);
      });

      this.refresh();
      this.soundText.on("pointerdown", () => {
        this.settings.sound = !this.settings.sound;
        this.persist();
        SFX.ui();
      });
      this.musicText.on("pointerdown", () => {
        this.settings.music = !this.settings.music;
        this.persist();
        SFX.ui();
      });
      volDown.on("pointerdown", () => {
        this.settings.volume = Math.max(0, Math.round((this.settings.volume - 0.1) * 10) / 10);
        this.persist();
        SFX.ui();
      });
      volUp.on("pointerdown", () => {
        this.settings.volume = Math.min(1, Math.round((this.settings.volume + 0.1) * 10) / 10);
        this.persist();
        SFX.ui();
      });

      const back = this.add
        .text(W / 2, 500, "[ BACK ]", {
          fontFamily: "Courier New, monospace",
          fontSize: "20px",
          color: "#7ec8ff",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      back.on("pointerdown", () => this.scene.start("Menu"));
      this.input.keyboard.on("keydown-ESC", () => this.scene.start("Menu"));
    }
    refresh() {
      this.soundText.setText(`SOUND: ${this.settings.sound ? "ON" : "OFF"}`);
      this.musicText.setText(`MUSIC: ${this.settings.music ? "ON" : "OFF"}`);
      this.volText.setText(`VOLUME: ${Math.round(this.settings.volume * 100)}%`);
      if (this.shipCards) {
        this.shipId = Storage.getShipId();
        this.shipCards.forEach((card) => {
          const on = card.ship.id === this.shipId;
          card.panel.setStrokeStyle(3, on ? 0x66ffaa : 0x2a4a6a);
          card.panel.setFillStyle(on ? 0x1a3048 : 0x122038);
          card.title.setColor(on ? "#66ffaa" : "#e8eef8");
        });
      }
    }
    persist() {
      Storage.saveSettings(this.settings);
      SFX.settings = this.settings;
      this.refresh();
    }
  }

  /* -------------------- Shared play scene -------------------- */
  class PlayScene extends Phaser.Scene {
    init(data) {
      this.mode = data?.mode || "flight";
      this.ended = false;
      this.pausedGame = false;
      this.score = 0;
      this.hp = PLAYER_MAX_HP;
      this.invulnUntil = 0;
      this.superReadyAt = 0;
      this.superFiring = false;
      this.magneticReadyAt = 0;
      this.magneticUntil = 0;
      this.magneticActive = false;
      this.magneticRadius = 0;
      this.lastFire = 0;
      this.spaceWasDown = false;
      this.shiftWasDown = false;
      this.survivalMs = 0;
      this.distance = 0;
      this.kills = 0;
      this.wave = 1;
      this.shake = 0;
      this.spawnAcc = 0;
      this.pickupSpawnAcc = 0;
      this._nextPickupIn = Phaser.Math.FloatBetween(4, 8);
      this.shieldUntil = 0;
      this.tripleUntil = 0;
      this.shieldRing = null;
      this.allies = [];
      this.touchMove = { x: 0, y: 0, active: false, id: null };
      this.touchAim = { x: 0, y: 0, active: false, id: null, firing: false };
      this.aimVec = { x: 0, y: -1 };
      this.touchUi = null;
    }

    create() {
      SFX.settings = Storage.getSettings();
      SFX.ensure();
      // Multi-touch for tablet sticks + blast buttons
      this.input.addPointer(3);

      this.physics.world.setBounds(0, 0, W, H);
      this.stars = createStarfield(this);

      this.obstacles = this.physics.add.group();
      this.enemies = this.physics.add.group();
      this.pickups = this.physics.add.group();
      this.playerLasers = this.physics.add.group({
        defaultKey: "laser",
        maxSize: 120,
        classType: Phaser.Physics.Arcade.Image,
      });
      this._lastAimVec = { x: 0, y: -1 };
      this.enemyLasers = this.physics.add.group({
        defaultKey: "enemy_laser",
        maxSize: 60,
      });
      this.particles = this.add.group();

      this.ship = getSelectedShip();
      this.player = this.physics.add.sprite(W / 2, H - 80, this.ship.texture);
      this.player.setCollideWorldBounds(true);
      this.player.body.setSize(this.ship.bodyW, this.ship.bodyH);
      this.player.setDepth(5);
      // Fixed forward orientation — never rotate toward mouse
      this.player.setAngle(0);

      this.crosshair = this.add.image(W / 2, H / 2, "crosshair").setDepth(50);
      this.engineGlow = this.add.particles(0, 0, "px", {
        speed: { min: 20, max: 60 },
        angle: { min: 70, max: 110 },
        scale: { start: 1.2, end: 0 },
        lifespan: 280,
        tint: [0x4ec4ff, 0xffaa33, 0xffffff],
        frequency: 40,
        follow: this.player,
        followOffset: { x: 0, y: 12 },
        emitting: false,
      });
      this.engineGlow.setDepth(4);

      this.keys = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
        space: Phaser.Input.Keyboard.KeyCodes.SPACE,
        shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
        esc: Phaser.Input.Keyboard.KeyCodes.ESC,
      });

      // Prevent page scroll on space / arrows
      this.input.keyboard.addCapture([
        Phaser.Input.Keyboard.KeyCodes.SPACE,
        Phaser.Input.Keyboard.KeyCodes.SHIFT,
        Phaser.Input.Keyboard.KeyCodes.W,
        Phaser.Input.Keyboard.KeyCodes.A,
        Phaser.Input.Keyboard.KeyCodes.S,
        Phaser.Input.Keyboard.KeyCodes.D,
      ]);

      this.physics.add.overlap(this.playerLasers, this.obstacles, this.onLaserHitObstacle, null, this);
      this.physics.add.overlap(this.playerLasers, this.enemies, this.onLaserHitEnemy, null, this);
      this.physics.add.overlap(this.enemyLasers, this.player, this.onEnemyLaserHitPlayer, null, this);
      this.physics.add.overlap(this.player, this.obstacles, this.onPlayerHitObstacle, null, this);
      this.physics.add.overlap(this.player, this.enemies, this.onPlayerHitEnemy, null, this);
      this.physics.add.overlap(this.player, this.pickups, this.onPickupCollect, null, this);

      this.buildHud();
      this.pauseLayer = null;
      this.gameOverLayer = null;
      this._pauseAt = 0;

      this.input.keyboard.on("keydown-ESC", () => this.togglePause());
      if (this.isTouchPlay()) {
        this.setupTouchControls();
      }

      // Test start: one stronger helper already joined
      if (TEST_START_HELPER) {
        this.recruitAlly(this.player.x - 48, this.player.y + 10);
      }
    }

    isTouchPlay() {
      if (typeof window === "undefined") return false;
      const ua = navigator.userAgent || "";
      // iPadOS 13+ reports as MacIntel with touch points
      const iPad =
        /iPad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      if (iPad || /Android|iPhone|iPod|Mobile|Tablet/i.test(ua)) {
        return true;
      }
      // Phones/tablets that don't hover; skip desktop (even with a touchscreen + mouse)
      return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    }

    setupTouchControls() {
      if (!this.isTouchPlay()) return;
      const depth = 120;
      const leftX = 110;
      const rightX = W - 110;
      const stickY = H - 100;
      const baseR = 56;
      const knobR = 24;

      this.touchUi = this.add.container(0, 0).setDepth(depth).setAlpha(0.88);
      this.touchUi.setScrollFactor(0);

      // Left stick — move
      const moveBase = this.add.circle(leftX, stickY, baseR, 0x122038, 0.45).setStrokeStyle(3, 0x7ec8ff, 0.7);
      const moveKnob = this.add.circle(leftX, stickY, knobR, 0x7ec8ff, 0.55).setStrokeStyle(2, 0xffffff, 0.8);
      const moveZone = this.add.circle(leftX, stickY, baseR + 28, 0x000000, 0.001).setInteractive();

      // Right stick — aim + fire
      const aimBase = this.add.circle(rightX, stickY, baseR, 0x201218, 0.45).setStrokeStyle(3, 0xff6688, 0.7);
      const aimKnob = this.add.circle(rightX, stickY, knobR, 0xff6688, 0.55).setStrokeStyle(2, 0xffffff, 0.8);
      const aimZone = this.add.circle(rightX, stickY, baseR + 28, 0x000000, 0.001).setInteractive();
      const aimLabel = this.add
        .text(rightX, stickY + baseR + 16, "AIM / FIRE", {
          fontFamily: "Courier New, monospace",
          fontSize: "10px",
          color: "#ff99aa",
        })
        .setOrigin(0.5);

      // Blast buttons above left stick
      const btnY = stickY - 100;
      const magBtn = this.add
        .circle(leftX - 36, btnY, 28, 0x662288, 0.7)
        .setStrokeStyle(2, 0xeeaaff, 0.95)
        .setInteractive({ useHandCursor: true });
      const magLbl = this.add
        .text(leftX - 36, btnY, "MAG", {
          fontFamily: "Courier New, monospace",
          fontSize: "11px",
          color: "#ffccff",
        })
        .setOrigin(0.5);
      const superBtn = this.add
        .circle(leftX + 36, btnY, 28, 0x224466, 0.7)
        .setStrokeStyle(2, 0x88ddff, 0.95)
        .setInteractive({ useHandCursor: true });
      const superLbl = this.add
        .text(leftX + 36, btnY, "LASER", {
          fontFamily: "Courier New, monospace",
          fontSize: "10px",
          color: "#cceeff",
        })
        .setOrigin(0.5);

      this.touchUi.add([
        moveBase,
        moveKnob,
        moveZone,
        aimBase,
        aimKnob,
        aimZone,
        aimLabel,
        magBtn,
        magLbl,
        superBtn,
        superLbl,
      ]);

      this._touch = {
        leftX,
        rightX,
        stickY,
        baseR,
        moveKnob,
        aimKnob,
        magBtn,
        superBtn,
      };

      const clampKnob = (cx, cy, px, py, maxR) => {
        let dx = px - cx;
        let dy = py - cy;
        const len = Math.hypot(dx, dy) || 1;
        if (len > maxR) {
          dx = (dx / len) * maxR;
          dy = (dy / len) * maxR;
        }
        return { dx, dy, nx: dx / maxR, ny: dy / maxR };
      };

      moveZone.on("pointerdown", (pointer) => {
        if (this.ended || this.pausedGame) return;
        if (this.touchMove.id != null && this.touchMove.id !== pointer.id) return;
        this.touchUi.setAlpha(0.9);
        this.touchMove.active = true;
        this.touchMove.id = pointer.id;
        const k = clampKnob(leftX, stickY, pointer.worldX, pointer.worldY, baseR);
        moveKnob.setPosition(leftX + k.dx, stickY + k.dy);
        this.touchMove.x = k.nx;
        this.touchMove.y = k.ny;
      });

      aimZone.on("pointerdown", (pointer) => {
        if (this.ended || this.pausedGame) return;
        if (this.touchAim.id != null && this.touchAim.id !== pointer.id) return;
        this.touchUi.setAlpha(0.9);
        this.touchAim.active = true;
        this.touchAim.firing = true;
        this.touchAim.id = pointer.id;
        const k = clampKnob(rightX, stickY, pointer.worldX, pointer.worldY, baseR);
        aimKnob.setPosition(rightX + k.dx, stickY + k.dy);
        this.touchAim.x = k.nx;
        this.touchAim.y = k.ny;
        if (Math.hypot(k.nx, k.ny) > 0.15) {
          this.aimVec.x = k.nx;
          this.aimVec.y = k.ny;
        }
      });

      magBtn.on("pointerdown", (pointer) => {
        pointer.event?.stopPropagation?.();
        if (this.ended || this.pausedGame) return;
        SFX.ensure();
        this.tryMagneticBlast();
      });
      superBtn.on("pointerdown", (pointer) => {
        pointer.event?.stopPropagation?.();
        if (this.ended || this.pausedGame) return;
        SFX.ensure();
        this.trySuperlaser();
      });

      this.input.on("pointermove", (pointer) => {
        if (this.ended || this.pausedGame) return;
        if (this.touchMove.active && pointer.id === this.touchMove.id) {
          const k = clampKnob(leftX, stickY, pointer.worldX, pointer.worldY, baseR);
          moveKnob.setPosition(leftX + k.dx, stickY + k.dy);
          this.touchMove.x = k.nx;
          this.touchMove.y = k.ny;
        }
        if (this.touchAim.active && pointer.id === this.touchAim.id) {
          const k = clampKnob(rightX, stickY, pointer.worldX, pointer.worldY, baseR);
          aimKnob.setPosition(rightX + k.dx, stickY + k.dy);
          this.touchAim.x = k.nx;
          this.touchAim.y = k.ny;
          if (Math.hypot(k.nx, k.ny) > 0.12) {
            this.aimVec.x = k.nx;
            this.aimVec.y = k.ny;
          }
        }
      });

      const releasePointer = (pointer) => {
        if (pointer.id === this.touchMove.id) {
          this.touchMove.active = false;
          this.touchMove.id = null;
          this.touchMove.x = 0;
          this.touchMove.y = 0;
          moveKnob.setPosition(leftX, stickY);
        }
        if (pointer.id === this.touchAim.id) {
          this.touchAim.active = false;
          this.touchAim.firing = false;
          this.touchAim.id = null;
          this.touchAim.x = 0;
          this.touchAim.y = 0;
          aimKnob.setPosition(rightX, stickY);
        }
      };
      this.input.on("pointerup", releasePointer);
      this.input.on("pointerupoutside", releasePointer);

    }

    buildHud() {
      // Push HUD down on tablets so HP isn't covered by the site header in landscape
      const top = this.isTouchPlay() ? 58 : 16;
      this.hud = this.add.container(0, 0).setDepth(40);
      this.hpBarBg = this.add.rectangle(16, top, 160, 14, 0x222233).setOrigin(0, 0);
      this.hpBar = this.add.rectangle(16, top, 160, 14, 0x44cc66).setOrigin(0, 0);
      this.hpText = this.add.text(20, top - 2, "HP 100", {
        fontFamily: "Courier New, monospace",
        fontSize: "12px",
        color: "#ffffff",
      });
      this.scoreText = this.add.text(W - 16, top - 2, "SCORE 0", {
        fontFamily: "Courier New, monospace",
        fontSize: "14px",
        color: "#7ec8ff",
      }).setOrigin(1, 0);
      this.infoText = this.add.text(16, top + 20, "", {
        fontFamily: "Courier New, monospace",
        fontSize: "12px",
        color: "#a0b0c8",
      });
      this.buffText = this.add.text(16, top + 38, "", {
        fontFamily: "Courier New, monospace",
        fontSize: "12px",
        color: "#88ddff",
      });
      this.superBg = this.add.rectangle(W / 2 - 120, H - 18, 200, 10, 0x222233).setOrigin(0.5);
      this.superBar = this.add.rectangle(W / 2 - 220, H - 18, 200, 10, 0x44aaff).setOrigin(0, 0.5);
      this.superText = this.add
        .text(W / 2 - 120, H - 32, "SUPERLASER READY", {
          fontFamily: "Courier New, monospace",
          fontSize: "11px",
          color: "#ffcc44",
        })
        .setOrigin(0.5);

      this.magBg = this.add.rectangle(W / 2 + 120, H - 18, 200, 10, 0x222233).setOrigin(0.5);
      this.magBar = this.add.rectangle(W / 2 + 20, H - 18, 200, 10, 0xcc66ff).setOrigin(0, 0.5);
      this.magText = this.add
        .text(W / 2 + 120, H - 32, "MAGNETIC READY", {
          fontFamily: "Courier New, monospace",
          fontSize: "11px",
          color: "#ddaaff",
        })
        .setOrigin(0.5);

      this.hud.add([
        this.hpBarBg,
        this.hpBar,
        this.hpText,
        this.scoreText,
        this.infoText,
        this.buffText,
        this.superBg,
        this.superBar,
        this.superText,
        this.magBg,
        this.magBar,
        this.magText,
      ]);
    }

    updateHud() {
      const pct = Phaser.Math.Clamp(this.hp / PLAYER_MAX_HP, 0, 1);
      this.hpBar.width = 160 * pct;
      this.hpBar.fillColor = pct > 0.5 ? 0x44cc66 : pct > 0.25 ? 0xccaa33 : 0xcc3344;
      this.hpText.setText(`HP ${Math.max(0, Math.round(this.hp))}`);
      this.scoreText.setText(`SCORE ${Math.floor(this.score)}`);

      const now = this.time.now;
      const left = Math.max(0, this.superReadyAt - now);
      if (left <= 0) {
        this.superBar.width = 200;
        this.superBar.fillColor = 0x44ff88;
        this.superText.setText("SUPERLASER [SPACE]");
        this.superText.setColor("#44ff88");
      } else {
        const readyPct = 1 - left / SUPER_COOLDOWN_MS;
        this.superBar.width = 200 * readyPct;
        this.superBar.fillColor = 0x4488cc;
        this.superText.setText(`SUPERLASER ${Math.ceil(left / 1000)}s`);
        this.superText.setColor("#8899aa");
      }

      const magLeft = Math.max(0, this.magneticReadyAt - now);
      if (this.magneticActive) {
        this.magBar.width = 200;
        this.magBar.fillColor = 0xff66ee;
        this.magText.setText("MAGNETIC BLAST!");
        this.magText.setColor("#ff99ff");
      } else if (MAGNETIC_COOLDOWN_MS <= 0 || magLeft <= 0) {
        this.magBar.width = 200;
        this.magBar.fillColor = 0xdd66ff;
        this.magText.setText("MAGNETIC [SHIFT]");
        this.magText.setColor("#eeaaff");
      } else {
        const readyPct = 1 - magLeft / MAGNETIC_COOLDOWN_MS;
        this.magBar.width = 200 * readyPct;
        this.magBar.fillColor = 0x7744aa;
        this.magText.setText(`MAGNETIC ${Math.ceil(magLeft / 1000)}s`);
        this.magText.setColor("#9988aa");
      }

      if (this.mode === "flight") {
        const sec = (this.survivalMs / 1000).toFixed(1);
        this.infoText.setText(`TIME ${sec}s   DIST ${formatDistance(this.distance)}   FLIGHT`);
      } else {
        this.infoText.setText(`KILLS ${this.kills}   WAVE ${this.wave}   FIGHT`);
      }

      const buffs = [];
      const shieldLeft = Math.max(0, this.shieldUntil - now);
      const tripleLeft = Math.max(0, this.tripleUntil - now);
      if (shieldLeft > 0) buffs.push(`SHIELD ${Math.ceil(shieldLeft / 1000)}s`);
      if (tripleLeft > 0) buffs.push(`TRIPLE ${Math.ceil(tripleLeft / 1000)}s`);
      if (this.allies.length > 0) {
        buffs.push(`HELPERS ${this.allies.length}/${MAX_ALLIES}`);
      }
      this.buffText.setText(buffs.join("   "));
      this.buffText.setColor(shieldLeft > 0 ? "#88ddff" : this.allies.length ? "#66ffaa" : "#ffcc66");
    }

    aimPoint() {
      // Right stick aim — remember last solid direction (avoid near-zero dead zone)
      if (this.touchAim && this.touchAim.active) {
        const len = Math.hypot(this.aimVec.x, this.aimVec.y);
        if (len > 0.22) {
          this._lastAimVec = { x: this.aimVec.x / len, y: this.aimVec.y / len };
        }
        const a = this._lastAimVec || { x: 0, y: -1 };
        return {
          x: this.player.x + a.x * 240,
          y: this.player.y + a.y * 240,
        };
      }
      const p = this.input.activePointer;
      if (p.wasTouch && (p.id === this.touchMove.id || p.id === this.touchAim?.id)) {
        const a = this._lastAimVec || { x: 0, y: -1 };
        return {
          x: this.player.x + a.x * 240,
          y: this.player.y + a.y * 240,
        };
      }
      return { x: p.worldX, y: p.worldY };
    }

    updatePlayer(dt) {
      let vx = 0;
      let vy = 0;
      if (this.keys.left.isDown) vx -= 1;
      if (this.keys.right.isDown) vx += 1;
      if (this.keys.up.isDown) vy -= 1;
      if (this.keys.down.isDown) vy += 1;

      // Left virtual stick
      if (this.touchMove.active && (this.touchMove.x !== 0 || this.touchMove.y !== 0)) {
        vx = this.touchMove.x;
        vy = this.touchMove.y;
      }

      const speed = (this.ship && this.ship.speed) || 260;
      if (vx !== 0 || vy !== 0) {
        const len = Math.hypot(vx, vy);
        vx = (vx / len) * speed;
        vy = (vy / len) * speed;
        this.engineGlow.emitting = true;
      } else {
        this.engineGlow.emitting = false;
      }
      this.player.setVelocity(vx, vy);
      // Keep fixed orientation
      this.player.setAngle(0);

      const aim = this.aimPoint();
      this.crosshair.setPosition(aim.x, aim.y);

      const mouseFire =
        this.input.activePointer.isDown &&
        this.input.activePointer.leftButtonDown() &&
        !this.input.activePointer.wasTouch;
      if (mouseFire || this.touchAim.firing) {
        this.tryFirePrimary();
      }

      const spaceDown = this.keys.space.isDown;
      if (spaceDown && !this.spaceWasDown) {
        this.trySuperlaser();
      }
      this.spaceWasDown = spaceDown;

      const shiftDown = this.keys.shift.isDown;
      if (shiftDown && !this.shiftWasDown) {
        this.tryMagneticBlast();
      }
      this.shiftWasDown = shiftDown;

      this.updateMagneticBlast(dt);
      this.updatePowerVisuals();
      this.updateTouchBlastButtons();

      const hasShield = this.time.now < this.shieldUntil;
      if (hasShield) {
        this.player.setAlpha(1);
      } else if (this.time.now < this.invulnUntil) {
        this.player.setAlpha(Math.sin(this.time.now / 40) > 0 ? 1 : 0.35);
      } else {
        this.player.setAlpha(1);
      }
    }

    updateTouchBlastButtons() {
      if (!this._touch) return;
      const now = this.time.now;
      const magReady = now >= this.magneticReadyAt && !this.magneticActive;
      const superReady = now >= this.superReadyAt && !this.superFiring;
      this._touch.magBtn.setAlpha(magReady ? 0.85 : 0.35);
      this._touch.superBtn.setAlpha(superReady ? 0.85 : 0.35);
    }

    updatePowerVisuals() {
      const now = this.time.now;
      if (now < this.shieldUntil) {
        if (!this.shieldRing || !this.shieldRing.active) {
          const r = (this.ship && this.ship.shieldR) || 22;
          this.shieldRing = this.add
            .circle(this.player.x, this.player.y, r, 0x66ccff, 0)
            .setStrokeStyle(2, 0x88ddff, 0.9)
            .setDepth(6);
        }
        this.shieldRing.setPosition(this.player.x, this.player.y);
        this.shieldRing.setAlpha(0.55 + Math.sin(now / 90) * 0.35);
      } else if (this.shieldRing) {
        this.shieldRing.destroy();
        this.shieldRing = null;
      }
    }

    fireLaserShot(x, y, angle, dmg, tint) {
      const laser = this.playerLasers.get();
      if (!laser) {
        // Pool exhausted — spawn one more instead of failing silently
        const extra = this.physics.add.image(x, y, "laser");
        this.playerLasers.add(extra);
        return this._launchLaser(extra, x, y, angle, dmg, tint);
      }
      return this._launchLaser(laser, x, y, angle, dmg, tint);
    }

    _launchLaser(laser, x, y, angle, dmg, tint) {
      // New shot id so an old delayedCall cannot kill a reused laser mid-flight
      laser._shotId = (laser._shotId || 0) + 1;
      const shotId = laser._shotId;

      laser.setActive(true).setVisible(true);
      laser.setDepth(3);
      laser.clearTint();
      if (tint != null) laser.setTint(tint);
      laser.setPosition(x, y);
      laser.setRotation(angle + Math.PI / 2);
      laser._dmg = dmg || 12;
      laser._fromAlly = false;

      if (laser.body) {
        laser.body.enable = true;
        laser.body.reset(x, y);
        const shotSpeed = (this.ship && this.ship.shotSpeed) || 560;
        this.physics.velocityFromRotation(angle, shotSpeed, laser.body.velocity);
      }

      this.time.delayedCall(2000, () => {
        if (laser.active && laser._shotId === shotId) this.recycleLaser(laser);
      });
      return laser;
    }

    tryFirePrimary() {
      if (this.ended || this.pausedGame || this.superFiring) return;
      const ship = this.ship || SHIPS.interceptor;
      const now = this.time.now;
      const tripleOn = now < this.tripleUntil;
      const rate = tripleOn ? ship.tripleRate : ship.fireRate;
      if (now - this.lastFire < rate) return;
      this.lastFire = now;

      const aim = this.aimPoint();
      const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, aim.x, aim.y);
      const px = this.player.x;
      const py = this.player.y - 8;
      const dmg = ship.shotDmg;

      if (tripleOn) {
        // Three shots from ship center in a fan (left / center / right)
        const spread = 0.22;
        this.fireLaserShot(px, py, angle - spread, dmg, 0xffcc66);
        this.fireLaserShot(px, py, angle, dmg + 2, 0x66ffaa);
        this.fireLaserShot(px, py, angle + spread, dmg, 0xffcc66);
      } else if (ship.dualGuns) {
        // Dreadnought: two heavy bolts from wing cannons
        const side = 14;
        const ox = Math.cos(angle + Math.PI / 2) * side;
        const oy = Math.sin(angle + Math.PI / 2) * side;
        this.fireLaserShot(px + ox, py + oy, angle, dmg, 0xffaa33);
        this.fireLaserShot(px - ox, py - oy, angle, dmg, 0xffaa33);
      } else {
        this.fireLaserShot(px, py, angle, dmg);
      }
      SFX.laser();
    }

    recycleLaser(laser) {
      laser.clearTint();
      laser.setActive(false).setVisible(false);
      laser.body.stop();
      laser.body.enable = false;
    }

    trySuperlaser() {
      if (this.ended || this.pausedGame || this.superFiring) return;
      if (this.time.now < this.superReadyAt) return;

      this.superFiring = true;
      SFX.superCharge();
      const aim = this.aimPoint();
      const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, aim.x, aim.y);
      const dist = 900;

      const core = this.add
        .rectangle(this.player.x, this.player.y, dist, 18, 0xaaddff, 0.95)
        .setOrigin(0, 0.5)
        .setRotation(angle)
        .setDepth(6);
      const glow = this.add
        .rectangle(this.player.x, this.player.y, dist, 40, 0x4488ff, 0.35)
        .setOrigin(0, 0.5)
        .setRotation(angle)
        .setDepth(5);

      // Charge flash
      this.cameras.main.flash(80, 100, 180, 255);
      this.shake = 10;
      SFX.superFire();

      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const hitTargets = new Set();

      const damageAlongBeam = () => {
        const step = 16;
        for (let d = 0; d < dist; d += step) {
          const x = this.player.x + cos * d;
          const y = this.player.y + sin * d;
          this.obstacles.getChildren().forEach((obj) => {
            if (!obj.active || hitTargets.has(obj)) return;
            if (Phaser.Math.Distance.Between(x, y, obj.x, obj.y) < (obj._radius || 20) + 14) {
              hitTargets.add(obj);
              if (obj._indestructible) this.vaporizeObstacle(obj);
              else this.damageObstacle(obj, 9999, true);
            }
          });
          this.enemies.getChildren().forEach((obj) => {
            if (!obj.active || hitTargets.has(obj)) return;
            if (Phaser.Math.Distance.Between(x, y, obj.x, obj.y) < (obj._radius || 16) + 14) {
              hitTargets.add(obj);
              this.damageEnemy(obj, 9999, true);
            }
          });
        }
      };

      damageAlongBeam();
      this.time.delayedCall(80, damageAlongBeam);
      this.time.delayedCall(160, damageAlongBeam);

      this.tweens.add({
        targets: [core, glow],
        alpha: 0,
        duration: 280,
        onComplete: () => {
          core.destroy();
          glow.destroy();
          this.superFiring = false;
        },
      });

      this.superReadyAt = this.time.now + SUPER_COOLDOWN_MS;
    }

    tryMagneticBlast() {
      if (this.ended || this.pausedGame || this.magneticActive) return;
      if (this.time.now < this.magneticReadyAt) return;

      this.magneticActive = true;
      this.magneticUntil = this.time.now + MAGNETIC_DURATION_MS;
      this.magneticRadius = 1200;
      this.magneticReadyAt = this.time.now + MAGNETIC_COOLDOWN_MS;
      this._magneticHit = new Set();
      this.shake = 16;
      this.cameras.main.flash(140, 180, 80, 255);
      SFX.magnetic();

      // Expanding rings from ship center (all directions)
      this.magneticRings = [];
      for (let i = 0; i < 3; i++) {
        const ring = this.add
          .circle(this.player.x, this.player.y, 20 + i * 12, 0xcc66ff, 0)
          .setStrokeStyle(3 - i, i === 0 ? 0xff99ff : 0xaa44ee, 0.95 - i * 0.2)
          .setDepth(7);
        this.magneticRings.push(ring);
      }
      this.magneticCore = this.add
        .circle(this.player.x, this.player.y, 18, 0xffaaff, 0.45)
        .setDepth(6);

      // Instant full-screen wipe — planets, asteroids, ships, everything
      this.wipeScreenThreats();
    }

    wipeScreenThreats() {
      const hitTargets = this._magneticHit || (this._magneticHit = new Set());

      [...this.obstacles.getChildren()].forEach((obj) => {
        if (!obj.active || hitTargets.has(obj)) return;
        hitTargets.add(obj);
        this.vaporizeObstacle(obj);
      });

      [...this.enemies.getChildren()].forEach((obj) => {
        if (!obj.active || hitTargets.has(obj)) return;
        hitTargets.add(obj);
        this.damageEnemy(obj, 9999, true);
      });

      [...this.enemyLasers.getChildren()].forEach((bolt) => {
        if (bolt.active) bolt.destroy();
      });

      // Also clear player laser clutter for a clean field
      this.playerLasers.getChildren().forEach((l) => {
        if (l.active) this.recycleLaser(l);
      });
    }

    /** Magnetic Blast: erase any obstacle, including all planet types. */
    vaporizeObstacle(obs) {
      if (!obs || !obs.active) return;
      const x = obs.x;
      const y = obs.y;
      const wasPlanet = !!obs._indestructible || (obs.texture && String(obs.texture.key).startsWith("planet"));
      if (wasPlanet) {
        this.addScore(obs._score || SCORE.planetSmall);
        SFX.explode();
        this.spawnBurst(x, y, 0xaa66ff, 28);
        this.spawnBurst(x, y, 0x66ffcc, 16);
        obs.destroy();
      } else {
        this.damageObstacle(obs, 9999, true);
      }
    }

    pickupTextureKey(kind) {
      if (kind === "shield") return "pickup_shield";
      if (kind === "triple") return "pickup_triple";
      if (kind === "ally") return "ally_drone";
      return "fuel";
    }

    /** Pickups drift in from ahead like planets — fuel / shield / triple / helper. */
    spawnPickupDrift(kind) {
      if (!this.pickups) return;
      if (this.pickups.countActive(true) >= 5) return;
      const key = this.pickupTextureKey(kind);
      const x = Phaser.Math.Between(50, W - 50);
      const item = this.pickups.create(x, -30, key);
      if (!item) return;
      this.stylePickup(item, kind);
      const speed = Phaser.Math.Between(55, 85);
      item.setVelocity(Phaser.Math.Between(-20, 20), speed);
    }

    stylePickup(item, kind) {
      item.setDepth(6);
      item._kind = kind;
      item._heal = 20;
      item.body.setSize(14, 16);
      if (kind === "ally") {
        item.setAngularVelocity(0);
        item.setAngle(0);
      } else {
        item.setAngularVelocity(Phaser.Math.Between(-40, 40));
      }
      this.tweens.add({
        targets: item,
        scale: { from: 0.85, to: 1.15 },
        duration: 500,
        yoyo: true,
        repeat: -1,
      });
    }

    updatePickups() {
      if (!this.pickups) return;
      this.pickups.getChildren().forEach((item) => {
        if (!item.active) return;
        if (item.y > H + 40 || item.x < -40 || item.x > W + 40) {
          item.destroy();
        }
      });
    }

    /** Sometimes spawn drifting pickups (fuel, shield, triple, ally) like planets. */
    tickPickupSpawns(dt) {
      if (this.magneticActive) return;
      this.pickupSpawnAcc += dt;
      if (this.pickupSpawnAcc >= this._nextPickupIn) {
        this.pickupSpawnAcc = 0;
        this._nextPickupIn = Phaser.Math.FloatBetween(5, 10);
        if (Math.random() >= 0.8) return;
        const roll = Math.random();
        let kind = "fuel";
        if (roll < 0.22) kind = "shield";
        else if (roll < 0.42) kind = "triple";
        else if (roll < 0.7) kind = "ally";
        this.spawnPickupDrift(kind);
      }
    }

    onPickupCollect(player, item) {
      if (!item.active || this.ended) return;
      const kind = item._kind || "fuel";
      const heal = item._heal || 20;
      const px = item.x;
      const py = item.y;
      item.destroy();

      if (kind === "shield") {
        this.shieldUntil = this.time.now + SHIELD_DURATION_MS;
        SFX.shield();
        this.spawnBurst(player.x, player.y, 0x66ccff, 14);
        this.cameras.main.flash(60, 100, 200, 255);
      } else if (kind === "triple") {
        this.tripleUntil = this.time.now + TRIPLE_DURATION_MS;
        SFX.triple();
        this.spawnBurst(player.x, player.y, 0xffaa33, 14);
        this.cameras.main.flash(60, 255, 180, 80);
      } else if (kind === "ally") {
        this.recruitAlly(px, py);
      } else {
        const before = this.hp;
        this.hp = Math.min(PLAYER_MAX_HP, this.hp + heal);
        SFX.pickup();
        this.spawnBurst(player.x, player.y, 0x66ff99, 10);
        if (this.hp > before) {
          this.cameras.main.flash(50, 80, 255, 120);
        }
      }
      this.updateHud();
    }

    recruitAlly(fromX, fromY) {
      if (this.allies.length >= MAX_ALLIES) {
        // Wing full — small heal instead
        this.hp = Math.min(PLAYER_MAX_HP, this.hp + 8);
        SFX.pickup();
        this.spawnBurst(this.player.x, this.player.y, 0x66ffaa, 8);
        return;
      }
      const sprite = this.add.image(fromX, fromY, "ally_drone").setDepth(5);
      sprite.setScale(1.25);
      this.allies.push({
        sprite,
        kind: "ally",
        hp: ALLY_MAX_HP,
        maxHp: ALLY_MAX_HP,
        nextFire: this.time.now + 350,
        invulnUntil: 0,
        shieldUntil: 0,
        tripleUntil: 0,
        shieldRing: null,
      });
      SFX.allyJoin();
      this.spawnBurst(fromX, fromY, 0x66ffaa, 12);
      this.cameras.main.flash(50, 80, 220, 160);
    }

    clearAllies() {
      this.allies.forEach((a) => {
        if (a.shieldRing && a.shieldRing.active) a.shieldRing.destroy();
        if (a.sprite && a.sprite.active) a.sprite.destroy();
      });
      this.allies = [];
    }

    damageAlly(ally, amount) {
      if (!ally || !ally.sprite || !ally.sprite.active || this.ended) return;
      if (this.time.now < ally.shieldUntil) {
        this.spawnBurst(ally.sprite.x, ally.sprite.y, 0x88ddff, 3);
        return;
      }
      if (this.time.now < ally.invulnUntil) return;
      ally.hp -= amount;
      ally.invulnUntil = this.time.now + 280;
      ally.sprite.setTint(0xff6688);
      this.time.delayedCall(120, () => {
        if (ally.sprite && ally.sprite.active) {
          if (this.time.now < ally.tripleUntil) ally.sprite.setTint(0xffcc66);
          else ally.sprite.clearTint();
        }
      });
      this.spawnBurst(ally.sprite.x, ally.sprite.y, 0xff8899, 5);
      SFX.hit();
      if (ally.hp <= 0) {
        const x = ally.sprite.x;
        const y = ally.sprite.y;
        if (ally.shieldRing) {
          ally.shieldRing.destroy();
          ally.shieldRing = null;
        }
        ally.sprite.destroy();
        const idx = this.allies.indexOf(ally);
        if (idx >= 0) this.allies.splice(idx, 1);
        SFX.explode();
        this.spawnBurst(x, y, 0x66ffaa, 14);
      }
    }

    /** Wingmen can scoop fuel / shield / triple the same way the player does. */
    checkAllyPickups() {
      if (!this.allies.length || !this.pickups) return;
      const items = this.pickups.getChildren();
      for (let p = 0; p < items.length; p++) {
        const item = items[p];
        if (!item.active) continue;
        for (let i = 0; i < this.allies.length; i++) {
          const ally = this.allies[i];
          if (!ally.sprite || !ally.sprite.active) continue;
          if (
            Phaser.Math.Distance.Between(item.x, item.y, ally.sprite.x, ally.sprite.y) >
            ALLY_PICKUP_RADIUS
          ) {
            continue;
          }
          const kind = item._kind || "fuel";
          const heal = item._heal || 20;
          item.destroy();
          if (kind === "shield") {
            ally.shieldUntil = this.time.now + SHIELD_DURATION_MS;
            SFX.shield();
            this.spawnBurst(ally.sprite.x, ally.sprite.y, 0x66ccff, 10);
          } else if (kind === "triple") {
            ally.tripleUntil = this.time.now + TRIPLE_DURATION_MS;
            ally.sprite.setTint(0xffcc66);
            SFX.triple();
            this.spawnBurst(ally.sprite.x, ally.sprite.y, 0xffaa33, 10);
          } else if (kind === "ally") {
            // Extra helper scooped by a wingman — recruit for the player
            this.recruitAlly(ally.sprite.x, ally.sprite.y);
          } else {
            ally.hp = Math.min(ally.maxHp || ALLY_MAX_HP, ally.hp + heal);
            SFX.pickup();
            this.spawnBurst(ally.sprite.x, ally.sprite.y, 0x66ff99, 8);
          }
          break;
        }
      }
    }

    /** Enemy bolts / bodies can hurt wingmen (several hits to kill). */
    checkAllyDamage() {
      if (!this.allies.length) return;

      if (this.enemyLasers) {
        this.enemyLasers.getChildren().forEach((bolt) => {
          if (!bolt.active) return;
          for (let i = 0; i < this.allies.length; i++) {
            const ally = this.allies[i];
            if (!ally.sprite || !ally.sprite.active) continue;
            if (
              Phaser.Math.Distance.Between(bolt.x, bolt.y, ally.sprite.x, ally.sprite.y) <
              ALLY_HIT_RADIUS
            ) {
              const dmg = bolt._dmg || 8;
              bolt.destroy();
              this.damageAlly(ally, dmg);
              break;
            }
          }
        });
      }

      if (this.mode === "fight" && this.enemies) {
        this.enemies.getChildren().forEach((enemy) => {
          if (!enemy.active) return;
          for (let i = 0; i < this.allies.length; i++) {
            const ally = this.allies[i];
            if (!ally.sprite || !ally.sprite.active) continue;
            if (
              Phaser.Math.Distance.Between(enemy.x, enemy.y, ally.sprite.x, ally.sprite.y) <
              (enemy._radius || 14) + 10
            ) {
              this.damageAlly(ally, 12);
            }
          }
        });
      }

      if (this.mode === "flight" && this.obstacles) {
        this.obstacles.getChildren().forEach((obs) => {
          if (!obs.active) return;
          for (let i = 0; i < this.allies.length; i++) {
            const ally = this.allies[i];
            if (!ally.sprite || !ally.sprite.active) continue;
            if (
              Phaser.Math.Distance.Between(obs.x, obs.y, ally.sprite.x, ally.sprite.y) <
              (obs._radius || 12) + 8
            ) {
              this.damageAlly(ally, obs._touchDmg || 15);
            }
          }
        });
      }
    }

    isPlanetObstacle(obs) {
      if (!obs || !obs.active) return false;
      if (obs._indestructible) return true;
      const key = obs.texture && String(obs.texture.key);
      return !!key && key.startsWith("planet");
    }

    findAllyTarget(ally) {
      let best = null;
      let bestDist = 440;
      const ax = ally.sprite.x;
      const ay = ally.sprite.y;

      if (this.mode === "flight") {
        this.obstacles.getChildren().forEach((obs) => {
          if (!this.isPlanetObstacle(obs)) return;
          const d = Phaser.Math.Distance.Between(ax, ay, obs.x, obs.y);
          if (d < bestDist) {
            bestDist = d;
            best = obs;
          }
        });
      } else {
        this.enemies.getChildren().forEach((enemy) => {
          if (!enemy.active) return;
          const d = Phaser.Math.Distance.Between(ax, ay, enemy.x, enemy.y);
          if (d < bestDist) {
            bestDist = d;
            best = enemy;
          }
        });
      }
      return best;
    }

    updateAllies() {
      if (!this.allies.length || !this.player) return;
      const n = this.allies.length;
      const now = this.time.now;

      for (let i = this.allies.length - 1; i >= 0; i--) {
        const ally = this.allies[i];
        if (!ally.sprite || !ally.sprite.active) {
          this.allies.splice(i, 1);
          continue;
        }

        const ang = (Math.PI * 2 * i) / n + now / 900;
        const radius = 34 + n * 5;
        const tx = this.player.x + Math.cos(ang) * radius;
        const ty = this.player.y + Math.sin(ang) * radius + 4;
        ally.sprite.x += (tx - ally.sprite.x) * 0.22;
        ally.sprite.y += (ty - ally.sprite.y) * 0.22;

        const hasShield = now < ally.shieldUntil;
        if (hasShield) {
          if (!ally.shieldRing || !ally.shieldRing.active) {
            ally.shieldRing = this.add
              .circle(ally.sprite.x, ally.sprite.y, 14, 0x66ccff, 0.2)
              .setStrokeStyle(2, 0x88ddff, 0.85)
              .setDepth(4);
          }
          ally.shieldRing.setPosition(ally.sprite.x, ally.sprite.y);
          ally.shieldRing.setAlpha(0.5 + Math.sin(now / 90) * 0.3);
        } else if (ally.shieldRing) {
          ally.shieldRing.destroy();
          ally.shieldRing = null;
        }

        if (now >= ally.tripleUntil && ally.sprite.tintTopLeft === 0xffcc66) {
          ally.sprite.clearTint();
        }

        const target = this.findAllyTarget(ally);
        if (target) {
          const face = Phaser.Math.Angle.Between(ally.sprite.x, ally.sprite.y, target.x, target.y);
          ally.sprite.setRotation(face + Math.PI / 2);
        } else {
          ally.sprite.setRotation(0);
        }

        if (this.ended || this.pausedGame || this.superFiring) continue;
        const tripleOn = now < ally.tripleUntil;
        const rate = tripleOn ? 110 : ALLY_FIRE_MS;
        if (now < ally.nextFire) continue;
        ally.nextFire = now + rate + i * 30;
        if (!target) continue;

        const angle = Phaser.Math.Angle.Between(ally.sprite.x, ally.sprite.y, target.x, target.y);
        const ax = ally.sprite.x;
        const ay = ally.sprite.y;
        if (tripleOn) {
          const spread = 0.2;
          const mk = (a, dmg, tint) => {
            const laser = this.fireLaserShot(ax, ay, a, dmg, tint);
            if (laser) laser._fromAlly = true;
          };
          if (this.mode === "flight") {
            mk(angle - spread, 9999, 0xffcc66);
            mk(angle, 9999, 0x66ffaa);
            mk(angle + spread, 9999, 0xffcc66);
          } else {
            mk(angle - spread, 11, 0xffcc66);
            mk(angle, 14, 0x66ffaa);
            mk(angle + spread, 11, 0xffcc66);
          }
        } else {
          const dmg = this.mode === "flight" ? 9999 : 12;
          const laser = this.fireLaserShot(ax, ay, angle, dmg, 0x66ffcc);
          if (laser) laser._fromAlly = true;
        }
        if (i === 0) SFX.laser();
      }

      this.checkAllyPickups();
      this.checkAllyDamage();
    }

    updateMagneticBlast(dt) {
      if (!this.magneticActive) return;

      const now = this.time.now;
      const elapsed = MAGNETIC_DURATION_MS - Math.max(0, this.magneticUntil - now);
      const progress = Phaser.Math.Clamp(elapsed / MAGNETIC_DURATION_MS, 0, 1);
      // Visual expand (destroy radius already covers whole screen)
      const visualR = 40 + progress * 700;

      const cx = this.player.x;
      const cy = this.player.y;

      if (this.magneticCore && this.magneticCore.active) {
        this.magneticCore.setPosition(cx, cy);
        this.magneticCore.setRadius(14 + Math.sin(now / 50) * 4);
        this.magneticCore.setAlpha(0.35 + (1 - progress) * 0.25);
      }
      if (this.magneticRings) {
        this.magneticRings.forEach((ring, i) => {
          if (!ring.active) return;
          ring.setPosition(cx, cy);
          ring.setRadius(Math.max(8, visualR - i * 28));
          ring.setAlpha(0.85 - progress * 0.5);
        });
      }

      // Keep wiping everything in space for the full 2 seconds
      this.wipeScreenThreats();

      if (now >= this.magneticUntil) {
        this.magneticActive = false;
        this.magneticRadius = 0;
        this._magneticHit = null;
        if (this.magneticCore) {
          this.magneticCore.destroy();
          this.magneticCore = null;
        }
        if (this.magneticRings) {
          this.magneticRings.forEach((ring) => ring.destroy());
          this.magneticRings = null;
        }
      }
    }

    spawnBurst(x, y, color, count) {
      for (let i = 0; i < count; i++) {
        const p = this.add.image(x, y, "px").setTint(color).setDepth(8);
        const a = Math.random() * Math.PI * 2;
        const sp = 40 + Math.random() * 160;
        this.tweens.add({
          targets: p,
          x: x + Math.cos(a) * sp,
          y: y + Math.sin(a) * sp,
          alpha: 0,
          duration: 300 + Math.random() * 300,
          onComplete: () => p.destroy(),
        });
      }
    }

    damagePlayer(amount) {
      if (this.ended || this.pausedGame) return;
      if (this.time.now < this.shieldUntil) {
        // Shield absorbs the hit — brief flash, no HP loss
        this.spawnBurst(this.player.x, this.player.y, 0x88ddff, 4);
        return;
      }
      if (this.time.now < this.invulnUntil) return;
      this.hp = Math.max(0, this.hp - amount);
      this.invulnUntil = this.time.now + INVULN_MS;
      this.cameras.main.flash(60, 255, 40, 40);
      this.shake = 6;
      SFX.hit();
      this.spawnBurst(this.player.x, this.player.y, 0xff6666, 8);
      this.updateHud();
      if (this.hp <= 0) {
        this.hp = 0;
        this.updateHud();
        this.triggerGameOver();
      }
    }

    addScore(points) {
      this.score += Math.floor(points);
    }

    onLaserHitObstacle(laser, obs) {
      if (!laser.active || !obs.active) return;
      this.recycleLaser(laser);
      // Ally wingmen can vaporize planets in flight mode
      if (laser._fromAlly && this.isPlanetObstacle(obs)) {
        this.vaporizeObstacle(obs);
        return;
      }
      if (obs._indestructible) {
        this.spawnBurst(laser.x, laser.y, 0x88aaff, 4);
        return;
      }
      this.damageObstacle(obs, laser._dmg || 12, false);
    }

    damageObstacle(obs, dmg, fromSuper) {
      if (obs._indestructible && !fromSuper) {
        // Normal lasers bounce off planets — only Magnetic Blast wipes them
        this.spawnBurst(obs.x, obs.y, 0x88aaff, 4);
        return;
      }
      obs._hp = (obs._hp || 1) - dmg;
      this.spawnBurst(obs.x, obs.y, 0xccaa88, fromSuper ? 16 : 6);
      if (obs._hp <= 0) {
        const x = obs.x;
        const y = obs.y;
        this.addScore(obs._score || SCORE.smallAsteroid);
        SFX.explode();
        this.spawnBurst(x, y, 0xffaa66, fromSuper ? 28 : 14);
        obs.destroy();
      }
    }

    onLaserHitEnemy(laser, enemy) {
      if (!laser.active || !enemy.active) return;
      this.recycleLaser(laser);
      this.damageEnemy(enemy, laser._dmg || 12, false);
    }

    damageEnemy(enemy, dmg, fromSuper) {
      enemy._hp = (enemy._hp || 1) - dmg;
      this.spawnBurst(enemy.x, enemy.y, 0xff6688, fromSuper ? 18 : 6);
      if (enemy._hp <= 0) {
        const x = enemy.x;
        const y = enemy.y;
        this.addScore(enemy._score || SCORE.scout);
        this.kills += 1;
        SFX.explode();
        this.spawnBurst(x, y, 0xffaa33, fromSuper ? 30 : 16);
        enemy.destroy();
      }
    }

    onEnemyLaserHitPlayer(player, laser) {
      if (!laser.active) return;
      laser.destroy();
      this.damagePlayer(laser._dmg || 8);
    }

    onPlayerHitObstacle(player, obs) {
      if (!obs.active || this.ended) return;
      // Only damage once per invuln window; skip tiny grazing on huge bodies
      const dist = Phaser.Math.Distance.Between(player.x, player.y, obs.x, obs.y);
      const hitR = (obs._radius || 16) + 10;
      if (dist > hitR) return;
      this.damagePlayer(obs._touchDmg || 15);
      if (!obs._indestructible && obs._hp != null) {
        this.damageObstacle(obs, 40, false);
      }
    }

    onPlayerHitEnemy(player, enemy) {
      if (!enemy.active || this.ended) return;
      this.damagePlayer(12);
      this.damageEnemy(enemy, 20, false);
    }

    fireEnemyProjectile(enemy, speed, key, dmg, offsetX, offsetY, opts) {
      const ox = offsetX || 0;
      const oy = offsetY || 0;
      const options = opts || {};
      const bolt = this.enemyLasers.create(enemy.x + ox, enemy.y + oy, key || "enemy_laser");
      if (!bolt) return null;
      bolt.setDepth(3);
      bolt._dmg = dmg || 8;
      bolt._homing = !!options.homing;
      bolt._homingTurn = options.homingTurn || 0.05;
      bolt._speed = speed;
      const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      // Slight inaccuracy so player can dodge (missiles lock tighter)
      const jitter = options.homing
        ? Phaser.Math.FloatBetween(-0.06, 0.06)
        : Phaser.Math.FloatBetween(-0.18, 0.18);
      this.physics.velocityFromRotation(angle + jitter, speed, bolt.body.velocity);
      bolt.rotation = angle + Math.PI / 2;
      if (!options.silent) SFX.enemyLaser();
      this.time.delayedCall(options.lifeMs || 2500, () => {
        if (bolt.active) bolt.destroy();
      });
      return bolt;
    }

    updateHomingProjectiles() {
      if (!this.enemyLasers || !this.player) return;
      this.enemyLasers.getChildren().forEach((bolt) => {
        if (!bolt.active || !bolt._homing || !bolt.body) return;
        const desired = Phaser.Math.Angle.Between(bolt.x, bolt.y, this.player.x, this.player.y);
        const cur = Math.atan2(bolt.body.velocity.y, bolt.body.velocity.x);
        const next = Phaser.Math.Angle.RotateTo(cur, desired, bolt._homingTurn || 0.05);
        this.physics.velocityFromRotation(next, bolt._speed || 180, bolt.body.velocity);
        bolt.rotation = next + Math.PI / 2;
      });
    }

    togglePause() {
      if (this.ended) return;
      if (this.pausedGame) {
        this.resumePlay();
      } else {
        this.pausePlay();
      }
    }

    pausePlay() {
      this.pausedGame = true;
      this._pauseAt = this.time.now;
      this.physics.pause();
      this.engineGlow.emitting = false;
      document.body.classList.add("menu-cursor");

      this.pauseLayer = this.add.container(0, 0).setDepth(100);
      const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65);
      const title = this.add
        .text(W / 2, 160, "PAUSED", {
          fontFamily: "Courier New, monospace",
          fontSize: "36px",
          color: "#7ec8ff",
        })
        .setOrigin(0.5);

      const mk = (y, label, fn) => {
        const t = this.add
          .text(W / 2, y, label, {
            fontFamily: "Courier New, monospace",
            fontSize: "22px",
            color: "#e8eef8",
            backgroundColor: "#122038",
            padding: { x: 16, y: 8 },
          })
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true });
        t.on("pointerover", () => t.setStyle({ color: "#7ec8ff" }));
        t.on("pointerout", () => t.setStyle({ color: "#e8eef8" }));
        t.on("pointerdown", fn);
        return t;
      };

      this.pauseLayer.add([
        dim,
        title,
        mk(240, "RESUME", () => this.resumePlay()),
        mk(300, "RESTART", () => {
          this.scene.restart({ mode: this.mode });
        }),
        mk(360, "MAIN MENU", () => {
          document.body.classList.add("menu-cursor");
          this.scene.start("Menu");
        }),
      ]);
    }

    resumePlay() {
      if (this.pauseLayer) {
        this.pauseLayer.destroy(true);
        this.pauseLayer = null;
      }
      // Keep ability / invuln / enemy shot timers in gameplay time
      if (this._pauseAt) {
        const pausedFor = this.time.now - this._pauseAt;
        this.superReadyAt += pausedFor;
        this.magneticReadyAt += pausedFor;
        this.magneticUntil += pausedFor;
        this.invulnUntil += pausedFor;
        this.shieldUntil += pausedFor;
        this.tripleUntil += pausedFor;
        this.allies.forEach((a) => {
          if (!a) return;
          a.shieldUntil += pausedFor;
          a.tripleUntil += pausedFor;
          a.invulnUntil += pausedFor;
          a.nextFire += pausedFor;
        });
        this.enemies.getChildren().forEach((e) => {
          if (e && e._nextShot != null) e._nextShot += pausedFor;
        });
        this._pauseAt = 0;
      }
      this.pausedGame = false;
      this.physics.resume();
      document.body.classList.remove("menu-cursor");
    }

    triggerGameOver() {
      if (this.ended) return;
      this.ended = true;
      this.hp = 0;
      this.updateHud();
      this.physics.pause();
      this.engineGlow.emitting = false;
      this.player.setVisible(false);
      this.clearAllies();
      this.spawnBurst(this.player.x, this.player.y, 0xffaa44, 40);
      SFX.gameOver();
      document.body.classList.add("menu-cursor");

      const finalScore = Math.floor(this.score);
      this.score = finalScore;
      const best = Storage.setBest(this.mode, finalScore);
      const sec = (this.survivalMs / 1000).toFixed(1);

      this.gameOverLayer = this.add.container(0, 0).setDepth(110);
      const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.72);
      const title = this.add
        .text(W / 2, 120, "GAME OVER", {
          fontFamily: "Courier New, monospace",
          fontSize: "40px",
          color: "#ff6688",
        })
        .setOrigin(0.5);
      const stats = this.add
        .text(
          W / 2,
          200,
          `SCORE ${finalScore}\nTIME ${sec}s\nBEST ${Math.floor(best)}${
            this.mode === "fight" ? `\nKILLS ${this.kills}` : `\nDIST ${formatDistance(this.distance)}`
          }`,
          {
            fontFamily: "Courier New, monospace",
            fontSize: "18px",
            color: "#c8d4e8",
            align: "center",
          }
        )
        .setOrigin(0.5);

      const mk = (y, label, fn) => {
        const t = this.add
          .text(W / 2, y, label, {
            fontFamily: "Courier New, monospace",
            fontSize: "22px",
            color: "#e8eef8",
            backgroundColor: "#122038",
            padding: { x: 16, y: 8 },
          })
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true });
        t.on("pointerdown", fn);
        return t;
      };

      this.gameOverLayer.add([
        dim,
        title,
        stats,
        mk(340, "RESTART", () => this.scene.restart({ mode: this.mode })),
        mk(400, "MAIN MENU", () => this.scene.start("Menu")),
      ]);
    }

    cleanupOffscreen() {
      const pad = 40;
      this.playerLasers.getChildren().forEach((l) => {
        if (
          l.active &&
          (l.x < -pad || l.x > W + pad || l.y < -pad || l.y > H + pad)
        ) {
          this.recycleLaser(l);
        }
      });
      this.enemyLasers.getChildren().forEach((l) => {
        if (l.active && (l.x < -pad || l.x > W + pad || l.y < -pad || l.y > H + pad)) {
          l.destroy();
        }
      });
      this.obstacles.getChildren().forEach((o) => {
        if (o.active && o.y > H + 80) o.destroy();
      });
    }

    applyShake() {
      if (this.shake > 0) {
        this.cameras.main.setScroll(
          (Math.random() - 0.5) * this.shake,
          (Math.random() - 0.5) * this.shake
        );
        this.shake *= 0.85;
        if (this.shake < 0.4) {
          this.shake = 0;
          this.cameras.main.setScroll(0, 0);
        }
      }
    }

    sharedUpdate(time, delta) {
      if (this.ended || this.pausedGame) return;
      const dt = delta / 1000;
      this.survivalMs += delta;
      this.stars.update(dt, this.mode === "flight" ? 1.2 : 0.5);
      this.updatePlayer(dt);
      this.updateAllies();
      this.updatePickups();
      this.tickPickupSpawns(dt);
      this.cleanupOffscreen();
      this.updateHud();
      this.applyShake();
    }
  }

  /* -------------------- Flight Mode -------------------- */
  class FlightScene extends PlayScene {
    constructor() {
      super("Flight");
    }
    init() {
      super.init({ mode: "flight" });
    }
    create() {
      super.create();
      this.baseSpawn = 1.1;
    }

    spawnObstacle() {
      const t = this.survivalMs / 1000;
      // Difficulty via frequency/patterns — NOT via increasing speed of types
      const roll = Math.random();
      let key;
      let speed;
      let hp;
      let score;
      let touch;
      let radius;
      let indestructible = false;

      if (roll < 0.45) {
        key = "asteroid_s";
        speed = 120;
        hp = 20;
        score = SCORE.smallAsteroid;
        touch = 12;
        radius = 8;
      } else if (roll < 0.7) {
        key = "asteroid_l";
        speed = 90;
        hp = 55;
        score = SCORE.largeAsteroid;
        touch = 20;
        radius = 18;
      } else if (roll < 0.9) {
        key = Math.random() < 0.65 ? "planet_s" : "planet_l";
        speed = key === "planet_s" ? 70 : 55;
        hp = 99999;
        score = key === "planet_s" ? SCORE.planetSmall : SCORE.planetLarge;
        touch = key === "planet_s" ? 25 : 30;
        radius = key === "planet_s" ? 14 : 20;
        indestructible = true;
      } else {
        key = "planet_indestruct";
        speed = 50;
        hp = 99999;
        score = SCORE.planetHuge;
        touch = 32;
        radius = 24;
        indestructible = true;
      }

      // Keep a clear dodge lane — never park a planet in the exact center strip every time
      const margin = Math.max(60, radius + 40);
      const x = Phaser.Math.Between(margin, W - margin);
      const o = this.obstacles.create(x, -40, key);
      o.setVelocity(0, speed);
      o.setDepth(2);
      o._hp = hp;
      o._score = score;
      o._touchDmg = touch;
      o._radius = radius;
      o._indestructible = indestructible;
      o.body.setCircle(radius, o.width / 2 - radius, o.height / 2 - radius);
      if (!indestructible) {
        o.setAngularVelocity(Phaser.Math.Between(-40, 40));
      }

      // Pattern: occasional side-by-side pair with a gap (asteroids only)
      if (!indestructible && t > 25 && Math.random() < 0.25) {
        const x2 = Phaser.Math.Clamp(x + (Math.random() < 0.5 ? -160 : 160), 40, W - 40);
        if (Math.abs(x2 - x) > 120) {
          const o2 = this.obstacles.create(x2, -80, "asteroid_s");
          o2.setVelocity(0, 120);
          o2._hp = 20;
          o2._score = SCORE.smallAsteroid;
          o2._touchDmg = 12;
          o2._radius = 8;
          o2.body.setCircle(8, o2.width / 2 - 8, o2.height / 2 - 8);
        }
      }
    }

    update(time, delta) {
      this.sharedUpdate(time, delta);
      if (this.ended || this.pausedGame) return;
      const dt = delta / 1000;
      // Distance stored in meters (~90 m/s cruise feel)
      this.distance += 90 * dt;

      // Frequency rises with time; speeds stay fixed per type
      const t = this.survivalMs / 1000;
      const interval = Math.max(0.28, this.baseSpawn - t * 0.012);
      this.spawnAcc += dt;
      if (!this.magneticActive && this.spawnAcc >= interval) {
        this.spawnAcc = 0;
        this.spawnObstacle();
        if (t > 40 && Math.random() < 0.35) this.spawnObstacle();
      }

      // Score only for destroying targets — no passive flight points
    }
  }

  /* -------------------- Fight Mode -------------------- */
  class FightScene extends PlayScene {
    constructor() {
      super("Fight");
    }
    init() {
      super.init({ mode: "fight" });
    }
    create() {
      super.create();
      this.enemySpawnAcc = 3; // calm start
      this.asteroidAcc = 0;
      this.wave = 1;
    }

    /** Difficulty ramps with survival time — easy start, harder later. */
    getDifficulty(t) {
      const wave = 1 + Math.floor(t / 30);
      return {
        wave,
        // 1 ship early → up to 7 after a few minutes
        maxOnScreen: Math.min(7, 1 + Math.floor(t / 25)),
        // Spawn every ~4s at start → ~1.2s later
        spawnInterval: Math.max(1.2, 4.0 - t * 0.03),
        // Asteroids appear more often later
        asteroidInterval: Math.max(1.4, 3.2 - t * 0.02),
        // Scout → fighter → heavy first; Doomstar only late (after ~3 min)
        fighterChance: t < 30 ? 0 : t < 60 ? 0.25 : t < 120 ? 0.4 : 0.5,
        heavyChance: t < 60 ? 0 : t < 120 ? 0.12 : t < 180 ? 0.22 : 0.3,
        doomstarChance: t < 180 ? 0 : t < 240 ? 0.08 : 0.14,
        // Mild combat pressure scaling (not laser speed spam)
        fireRateScale: Math.max(0.65, 1 - t * 0.002),
        moveScale: Math.min(1.25, 1 + t * 0.0015),
        doubleSpawn: t > 100 && Math.random() < Math.min(0.35, (t - 100) * 0.004),
      };
    }

    hasActiveDoomstar() {
      return this.enemies.getChildren().some((e) => e.active && e._type === "doomstar");
    }

    pickEnemyType(diff) {
      const r = Math.random();
      if (diff.doomstarChance > 0 && r < diff.doomstarChance && !this.hasActiveDoomstar()) {
        return "doomstar";
      }
      if (r < diff.heavyChance) return "heavy";
      if (r < diff.heavyChance + diff.fighterChance) return "fighter";
      return "scout";
    }

    spawnEnemy() {
      const t = this.survivalMs / 1000;
      const diff = this.getDifficulty(t);
      this.wave = diff.wave;
      this.spawnEnemyOfType(this.pickEnemyType(diff));
    }

    spawnEnemyOfType(type) {
      const t = this.survivalMs / 1000;
      const diff = this.getDifficulty(t);

      const edge = Phaser.Math.Between(0, 3);
      let x;
      let y;
      if (edge === 0) {
        x = Phaser.Math.Between(40, W - 40);
        y = -40;
      } else if (edge === 1) {
        x = Phaser.Math.Between(40, W - 40);
        y = H + 40;
      } else if (edge === 2) {
        x = -40;
        y = Phaser.Math.Between(40, H - 40);
      } else {
        x = W + 40;
        y = Phaser.Math.Between(40, H - 40);
      }

      // Don't spawn on player
      if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 160) {
        y = 50;
        x = this.player.x < W / 2 ? W - 80 : 80;
      }

      const key =
        type === "scout"
          ? "enemy_scout"
          : type === "fighter"
            ? "enemy_fighter"
            : type === "doomstar"
              ? "enemy_doomstar"
              : "enemy_heavy";
      const e = this.enemies.create(x, y, key);
      e.setDepth(3);
      e._type = type;
      e._nextShot = this.time.now + Phaser.Math.Between(500, 1400);

      if (type === "scout") {
        e._hp = 25;
        e._score = SCORE.scout;
        e._speed = 140 * diff.moveScale;
        e._radius = 12;
        e._fireEvery = 1600 * diff.fireRateScale;
        e._shotSpeed = 210;
        e._shotDmg = 7;
        e.body.setSize(18, 18);
      } else if (type === "fighter") {
        e._hp = 55;
        e._score = SCORE.fighter;
        e._speed = 100 * diff.moveScale;
        e._radius = 14;
        e._fireEvery = 1200 * diff.fireRateScale;
        e._shotSpeed = 250;
        e._shotDmg = 10;
        e.body.setSize(24, 16);
      } else if (type === "doomstar") {
        // Stronger than Heavy — dual wing weapons that swap from time to time
        e._hp = 320;
        e._score = SCORE.doomstar;
        e._speed = 48 * diff.moveScale;
        e._radius = 28;
        e._fireEvery = 720 * diff.fireRateScale;
        e._shotSpeed = 230;
        e._shotDmg = 14;
        e._doomstar = true;
        e._weaponMode = "cannons";
        e._weaponShotsLeft = Phaser.Math.Between(3, 5);
        e.body.setSize(56, 48);
        this.cameras.main.flash(100, 180, 40, 60);
        SFX.enemyLaser();
      } else {
        e._hp = 160;
        e._score = SCORE.heavy;
        e._speed = 65 * diff.moveScale;
        e._radius = 22;
        e._fireEvery = 1000 * diff.fireRateScale;
        e._shotSpeed = 190;
        e._shotDmg = 18;
        e._heavy = true;
        e.body.setSize(40, 28);
      }
    }

    /** Pick next Doomstar weapon from time to time (not every shot). */
    cycleDoomstarWeapon(enemy) {
      enemy._weaponShotsLeft -= 1;
      if (enemy._weaponShotsLeft > 0) return;
      const modes = ["cannons", "lasers", "missiles"];
      const others = modes.filter((m) => m !== enemy._weaponMode);
      enemy._weaponMode = others[Phaser.Math.Between(0, others.length - 1)];
      enemy._weaponShotsLeft = Phaser.Math.Between(3, 5);
      // Brief flash so the weapon swap is readable
      if (enemy._weaponMode === "missiles") {
        enemy.setTint(0xffaa66);
        this.spawnBurst(enemy.x, enemy.y, 0xff6622, 8);
      } else if (enemy._weaponMode === "lasers") {
        enemy.setTint(0x66ccff);
        this.spawnBurst(enemy.x, enemy.y, 0x44aaff, 8);
      } else {
        enemy.setTint(0xff6688);
        this.spawnBurst(enemy.x, enemy.y, 0xff2244, 8);
      }
      this.time.delayedCall(220, () => {
        if (enemy.active) enemy.clearTint();
      });
      SFX.superCharge();
    }

    doomstarGunOffsets(enemy) {
      const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      const side = 18;
      const px = Math.cos(angle + Math.PI / 2) * side;
      const py = Math.sin(angle + Math.PI / 2) * side;
      const fwd = 10;
      const fx = Math.cos(angle) * fwd;
      const fy = Math.sin(angle) * fwd;
      return { angle, left: { x: fx + px, y: fy + py }, right: { x: fx - px, y: fy - py } };
    }

    /** Doomstar attack — dual guns, weapon type swaps periodically. */
    fireDoomstarVolley(enemy) {
      if (!enemy.active) return;
      this.cycleDoomstarWeapon(enemy);
      const guns = this.doomstarGunOffsets(enemy);
      const mode = enemy._weaponMode || "cannons";

      if (mode === "missiles") {
        // Twin homing missiles — slower, harder hitting
        this.fireEnemyProjectile(
          enemy,
          155,
          "doomstar_missile",
          20,
          guns.left.x,
          guns.left.y,
          { homing: true, homingTurn: 0.045, lifeMs: 3200, silent: true }
        );
        this.fireEnemyProjectile(
          enemy,
          155,
          "doomstar_missile",
          20,
          guns.right.x,
          guns.right.y,
          { homing: true, homingTurn: 0.045, lifeMs: 3200, silent: true }
        );
        SFX.explode();
        return;
      }

      if (mode === "lasers") {
        // Twin cyan laser streams — faster, lighter hits
        const mk = (ox, oy, silent) =>
          this.fireEnemyProjectile(enemy, 300, "doomstar_laser", 9, ox, oy, {
            silent,
            lifeMs: 1800,
          });
        mk(guns.left.x, guns.left.y, false);
        mk(guns.right.x, guns.right.y, true);
        this.time.delayedCall(90, () => {
          if (!enemy.active) return;
          const g2 = this.doomstarGunOffsets(enemy);
          mk(g2.left.x, g2.left.y, true);
          mk(g2.right.x, g2.right.y, true);
        });
        this.time.delayedCall(180, () => {
          if (!enemy.active) return;
          const g3 = this.doomstarGunOffsets(enemy);
          mk(g3.left.x, g3.left.y, true);
          mk(g3.right.x, g3.right.y, true);
        });
        return;
      }

      // Default: dual crimson cannons (staggered double volley)
      this.fireEnemyProjectile(
        enemy,
        enemy._shotSpeed,
        "doomstar_shot",
        enemy._shotDmg,
        guns.left.x,
        guns.left.y,
        { silent: true }
      );
      this.fireEnemyProjectile(
        enemy,
        enemy._shotSpeed,
        "doomstar_shot",
        enemy._shotDmg,
        guns.right.x,
        guns.right.y,
        { silent: true }
      );
      this.time.delayedCall(110, () => {
        if (!enemy.active) return;
        const g2 = this.doomstarGunOffsets(enemy);
        this.fireEnemyProjectile(
          enemy,
          enemy._shotSpeed,
          "doomstar_shot",
          enemy._shotDmg,
          g2.left.x,
          g2.left.y,
          { silent: true }
        );
        this.fireEnemyProjectile(
          enemy,
          enemy._shotSpeed,
          "doomstar_shot",
          enemy._shotDmg,
          g2.right.x,
          g2.right.y,
          { silent: true }
        );
      });
      SFX.enemyLaser();
    }

    updateEnemies(dt) {
      this.enemies.getChildren().forEach((e) => {
        if (!e.active) return;
        const angle = Phaser.Math.Angle.Between(e.x, e.y, this.player.x, this.player.y);
        let vx = Math.cos(angle) * e._speed;
        let vy = Math.sin(angle) * e._speed;

        if (e._type === "scout") {
          // Flank: add lateral sine
          vx += Math.cos(angle + Math.PI / 2) * Math.sin(this.time.now / 300) * 80;
          vy += Math.sin(angle + Math.PI / 2) * Math.sin(this.time.now / 300) * 80;
        } else if (e._type === "heavy" || e._type === "doomstar") {
          // Slow approach, keep distance (Doomstar hangs back farther)
          const dist = Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y);
          const keep = e._type === "doomstar" ? 220 : 180;
          if (dist < keep) {
            vx *= -0.35;
            vy *= -0.35;
          }
        }

        e.setVelocity(vx, vy);
        // Face player visually for enemies only
        e.setRotation(angle + Math.PI / 2);

        if (this.time.now >= e._nextShot) {
          e._nextShot = this.time.now + e._fireEvery + Phaser.Math.Between(-150, 200);
          if (e._doomstar) {
            this.fireDoomstarVolley(e);
          } else if (e._heavy) {
            this.fireEnemyProjectile(e, e._shotSpeed, "heavy_shot", e._shotDmg);
            this.time.delayedCall(120, () => {
              if (e.active) this.fireEnemyProjectile(e, e._shotSpeed, "heavy_shot", e._shotDmg);
            });
          } else {
            this.fireEnemyProjectile(e, e._shotSpeed, "enemy_laser", e._shotDmg);
          }
        }
      });
    }

    spawnFightAsteroid() {
      const big = Math.random() < 0.3;
      const key = big ? "asteroid_l" : "asteroid_s";
      const o = this.obstacles.create(Phaser.Math.Between(40, W - 40), -30, key);
      const speed = big ? 70 : 100;
      o.setVelocity(Phaser.Math.Between(-30, 30), speed);
      o._hp = big ? 55 : 20;
      o._score = big ? SCORE.largeAsteroid : SCORE.smallAsteroid;
      o._touchDmg = big ? 18 : 12;
      o._radius = big ? 18 : 8;
      o.body.setCircle(o._radius, o.width / 2 - o._radius, o.height / 2 - o._radius);
      o.setAngularVelocity(Phaser.Math.Between(-50, 50));
    }

    update(time, delta) {
      this.sharedUpdate(time, delta);
      if (this.ended || this.pausedGame) return;
      const dt = delta / 1000;
      this.updateEnemies(dt);
      this.updateHomingProjectiles();

      const t = this.survivalMs / 1000;
      const diff = this.getDifficulty(t);
      this.wave = diff.wave;

      this.enemySpawnAcc += dt;
      if (!this.magneticActive && this.enemySpawnAcc >= diff.spawnInterval) {
        this.enemySpawnAcc = 0;
        if (this.enemies.countActive(true) < diff.maxOnScreen) {
          this.spawnEnemy();
          if (diff.doubleSpawn && this.enemies.countActive(true) < diff.maxOnScreen) {
            this.spawnEnemy();
          }
        }
      }

      this.asteroidAcc += dt;
      if (!this.magneticActive && this.asteroidAcc >= diff.asteroidInterval) {
        this.asteroidAcc = 0;
        this.spawnFightAsteroid();
      }

      // Score only for destroying targets — no passive survival points
    }
  }

  /* -------------------- Boot game -------------------- */
  const config = {
    type: Phaser.AUTO,
    parent: "game",
    width: W,
    height: H,
    backgroundColor: "#05070f",
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    physics: {
      default: "arcade",
      arcade: {
        gravity: { y: 0 },
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [
      BootScene,
      MenuScene,
      ControlsScene,
      SettingsScene,
      ShipSelectScene,
      FlightScene,
      FightScene,
    ],
  };

  // eslint-disable-next-line no-new
  new Phaser.Game(config);
})();
