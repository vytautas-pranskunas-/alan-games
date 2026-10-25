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
  const PLAYER_SPEED = 260;
  const FIRE_RATE_MS = 140;
  const INVULN_MS = 900;

  const SCORE = {
    smallAsteroid: 10,
    largeAsteroid: 25,
    planetSmall: 50,
    planetLarge: 100,
    planetHuge: 150,
    scout: 50,
    fighter: 100,
    heavy: 250,
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

      const ship = this.add.image(W / 2, 190, "player").setScale(2.5);
      this.tweens.add({
        targets: ship,
        y: 200,
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      const flightBest = Storage.getBest("flight");
      const fightBest = Storage.getBest("fight");
      this.add
        .text(W / 2, 250, `BEST FLIGHT ${flightBest}   ·   BEST FIGHT ${fightBest}`, {
          fontFamily: "Courier New, monospace",
          fontSize: "12px",
          color: "#8899aa",
        })
        .setOrigin(0.5);

      const items = [
        { label: "1. FLIGHT MODE", scene: "Flight", y: 300 },
        { label: "2. FIGHT MODE", scene: "Fight", y: 340 },
        { label: "3. CONTROLS", scene: "Controls", y: 380 },
        { label: "4. SETTINGS", scene: "Settings", y: 420 },
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
    }

    update(_, dtMs) {
      this.stars.update(dtMs / 1000, 0.35);
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
        "Shift Magnetic Blast wipes EVERYTHING for 2s (all planets too).",
        "Pickups drift in like planets: fuel (+HP), shield (10s), triple gun (10s).",
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
        .text(W / 2, 180, "", {
          fontFamily: "Courier New, monospace",
          fontSize: "22px",
          color: "#e8eef8",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      this.musicText = this.add
        .text(W / 2, 240, "", {
          fontFamily: "Courier New, monospace",
          fontSize: "22px",
          color: "#e8eef8",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      this.volText = this.add
        .text(W / 2, 300, "", {
          fontFamily: "Courier New, monospace",
          fontSize: "22px",
          color: "#e8eef8",
        })
        .setOrigin(0.5);

      const volDown = this.add
        .text(W / 2 - 140, 300, "[ - ]", {
          fontFamily: "Courier New, monospace",
          fontSize: "22px",
          color: "#7ec8ff",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      const volUp = this.add
        .text(W / 2 + 140, 300, "[ + ]", {
          fontFamily: "Courier New, monospace",
          fontSize: "22px",
          color: "#7ec8ff",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

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
        .text(W / 2, 480, "[ BACK ]", {
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
    }

    create() {
      SFX.settings = Storage.getSettings();
      SFX.ensure();

      this.physics.world.setBounds(0, 0, W, H);
      this.stars = createStarfield(this);

      this.obstacles = this.physics.add.group();
      this.enemies = this.physics.add.group();
      this.pickups = this.physics.add.group();
      this.playerLasers = this.physics.add.group({
        defaultKey: "laser",
        maxSize: 90,
      });
      this.enemyLasers = this.physics.add.group({
        defaultKey: "enemy_laser",
        maxSize: 60,
      });
      this.particles = this.add.group();

      this.player = this.physics.add.sprite(W / 2, H - 80, "player");
      this.player.setCollideWorldBounds(true);
      this.player.body.setSize(20, 16);
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
    }

    buildHud() {
      this.hud = this.add.container(0, 0).setDepth(40);
      this.hpBarBg = this.add.rectangle(16, 16, 160, 14, 0x222233).setOrigin(0, 0);
      this.hpBar = this.add.rectangle(16, 16, 160, 14, 0x44cc66).setOrigin(0, 0);
      this.hpText = this.add.text(20, 14, "HP 100", {
        fontFamily: "Courier New, monospace",
        fontSize: "12px",
        color: "#ffffff",
      });
      this.scoreText = this.add.text(W - 16, 14, "SCORE 0", {
        fontFamily: "Courier New, monospace",
        fontSize: "14px",
        color: "#7ec8ff",
      }).setOrigin(1, 0);
      this.infoText = this.add.text(16, 36, "", {
        fontFamily: "Courier New, monospace",
        fontSize: "12px",
        color: "#a0b0c8",
      });
      this.buffText = this.add.text(16, 54, "", {
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
      this.buffText.setText(buffs.join("   "));
      this.buffText.setColor(shieldLeft > 0 ? "#88ddff" : "#ffcc66");
    }

    aimPoint() {
      const p = this.input.activePointer;
      return { x: p.worldX, y: p.worldY };
    }

    updatePlayer(dt) {
      let vx = 0;
      let vy = 0;
      if (this.keys.left.isDown) vx -= 1;
      if (this.keys.right.isDown) vx += 1;
      if (this.keys.up.isDown) vy -= 1;
      if (this.keys.down.isDown) vy += 1;
      if (vx !== 0 || vy !== 0) {
        const len = Math.hypot(vx, vy);
        vx = (vx / len) * PLAYER_SPEED;
        vy = (vy / len) * PLAYER_SPEED;
        this.engineGlow.emitting = true;
      } else {
        this.engineGlow.emitting = false;
      }
      this.player.setVelocity(vx, vy);
      // Keep fixed orientation
      this.player.setAngle(0);

      const aim = this.aimPoint();
      this.crosshair.setPosition(aim.x, aim.y);

      if (this.input.activePointer.isDown && this.input.activePointer.leftButtonDown()) {
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

      const hasShield = this.time.now < this.shieldUntil;
      if (hasShield) {
        this.player.setAlpha(1);
      } else if (this.time.now < this.invulnUntil) {
        this.player.setAlpha(Math.sin(this.time.now / 40) > 0 ? 1 : 0.35);
      } else {
        this.player.setAlpha(1);
      }
    }

    updatePowerVisuals() {
      const now = this.time.now;
      if (now < this.shieldUntil) {
        if (!this.shieldRing || !this.shieldRing.active) {
          this.shieldRing = this.add
            .circle(this.player.x, this.player.y, 22, 0x66ccff, 0)
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
      const laser = this.playerLasers.get(x, y, "laser");
      if (!laser) return null;
      laser.setActive(true).setVisible(true);
      laser.body.enable = true;
      laser.setDepth(3);
      laser.clearTint();
      if (tint != null) laser.setTint(tint);
      this.physics.velocityFromRotation(angle, 560, laser.body.velocity);
      laser.rotation = angle + Math.PI / 2;
      laser._dmg = dmg || 12;
      this.time.delayedCall(1800, () => {
        if (laser.active) this.recycleLaser(laser);
      });
      return laser;
    }

    tryFirePrimary() {
      if (this.ended || this.pausedGame || this.superFiring) return;
      const now = this.time.now;
      const tripleOn = now < this.tripleUntil;
      const rate = tripleOn ? 90 : FIRE_RATE_MS;
      if (now - this.lastFire < rate) return;
      this.lastFire = now;

      const aim = this.aimPoint();
      const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, aim.x, aim.y);
      const px = this.player.x;
      const py = this.player.y - 8;

      if (tripleOn) {
        // Three shots from ship center in a fan (left / center / right)
        const spread = 0.22;
        this.fireLaserShot(px, py, angle - spread, 12, 0xffcc66);
        this.fireLaserShot(px, py, angle, 14, 0x66ffaa);
        this.fireLaserShot(px, py, angle + spread, 12, 0xffcc66);
      } else {
        this.fireLaserShot(px, py, angle, 12);
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

    /** Pickups drift in from ahead like planets — fuel / shield / triple gun. */
    spawnPickupDrift(kind) {
      if (!this.pickups) return;
      if (this.pickups.countActive(true) >= 5) return;
      const key = kind === "shield" ? "pickup_shield" : kind === "triple" ? "pickup_triple" : "fuel";
      const x = Phaser.Math.Between(50, W - 50);
      const item = this.pickups.create(x, -30, key);
      if (!item) return;
      item.setDepth(6);
      item._kind = kind;
      item._heal = 20;
      const speed = Phaser.Math.Between(55, 85);
      item.setVelocity(Phaser.Math.Between(-20, 20), speed);
      item.body.setSize(14, 16);
      item.setAngularVelocity(Phaser.Math.Between(-40, 40));
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

    /** Sometimes spawn drifting pickups (fuel, shield, triple) like planets. */
    tickPickupSpawns(dt) {
      if (this.magneticActive) return;
      this.pickupSpawnAcc += dt;
      if (this.pickupSpawnAcc >= this._nextPickupIn) {
        this.pickupSpawnAcc = 0;
        this._nextPickupIn = Phaser.Math.FloatBetween(5, 10);
        if (Math.random() >= 0.8) return;
        const roll = Math.random();
        let kind = "fuel";
        if (roll < 0.25) kind = "shield";
        else if (roll < 0.5) kind = "triple";
        this.spawnPickupDrift(kind);
      }
    }

    onPickupCollect(player, item) {
      if (!item.active || this.ended) return;
      const kind = item._kind || "fuel";
      const heal = item._heal || 20;
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

    fireEnemyProjectile(enemy, speed, key, dmg) {
      const bolt = this.enemyLasers.create(enemy.x, enemy.y, key || "enemy_laser");
      if (!bolt) return;
      bolt.setDepth(3);
      bolt._dmg = dmg || 8;
      const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      // Slight inaccuracy so player can dodge
      const jitter = Phaser.Math.FloatBetween(-0.18, 0.18);
      this.physics.velocityFromRotation(angle + jitter, speed, bolt.body.velocity);
      bolt.rotation = angle + Math.PI / 2;
      SFX.enemyLaser();
      this.time.delayedCall(2500, () => {
        if (bolt.active) bolt.destroy();
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
        // Chance of stronger ship types
        fighterChance: t < 30 ? 0 : t < 60 ? 0.25 : t < 120 ? 0.4 : 0.5,
        heavyChance: t < 60 ? 0 : t < 120 ? 0.12 : t < 180 ? 0.22 : 0.3,
        // Mild combat pressure scaling (not laser speed spam)
        fireRateScale: Math.max(0.65, 1 - t * 0.002),
        moveScale: Math.min(1.25, 1 + t * 0.0015),
        doubleSpawn: t > 100 && Math.random() < Math.min(0.35, (t - 100) * 0.004),
      };
    }

    pickEnemyType(diff) {
      const r = Math.random();
      if (r < diff.heavyChance) return "heavy";
      if (r < diff.heavyChance + diff.fighterChance) return "fighter";
      return "scout";
    }

    spawnEnemy() {
      const t = this.survivalMs / 1000;
      const diff = this.getDifficulty(t);
      this.wave = diff.wave;
      const type = this.pickEnemyType(diff);

      const edge = Phaser.Math.Between(0, 3);
      let x;
      let y;
      if (edge === 0) {
        x = Phaser.Math.Between(40, W - 40);
        y = -30;
      } else if (edge === 1) {
        x = Phaser.Math.Between(40, W - 40);
        y = H + 30;
      } else if (edge === 2) {
        x = -30;
        y = Phaser.Math.Between(40, H - 40);
      } else {
        x = W + 30;
        y = Phaser.Math.Between(40, H - 40);
      }

      // Don't spawn on player
      if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 140) {
        y = 40;
        x = this.player.x < W / 2 ? W - 60 : 60;
      }

      const key =
        type === "scout" ? "enemy_scout" : type === "fighter" ? "enemy_fighter" : "enemy_heavy";
      const e = this.enemies.create(x, y, key);
      e.setDepth(3);
      e._type = type;
      e._nextShot = this.time.now + Phaser.Math.Between(600, 1600);

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
        } else if (e._type === "heavy") {
          // Slow approach, keep distance
          const dist = Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y);
          if (dist < 180) {
            vx *= -0.3;
            vy *= -0.3;
          }
        }

        e.setVelocity(vx, vy);
        // Face player visually for enemies only
        e.setRotation(angle + Math.PI / 2);

        if (this.time.now >= e._nextShot) {
          e._nextShot = this.time.now + e._fireEvery + Phaser.Math.Between(-150, 200);
          if (e._heavy) {
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
    scene: [BootScene, MenuScene, ControlsScene, SettingsScene, FlightScene, FightScene],
  };

  // eslint-disable-next-line no-new
  new Phaser.Game(config);
})();
