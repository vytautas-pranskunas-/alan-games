/**
 * Pixel Space Shooter — Phaser 3 (Arcade Physics)
 * Movement independent of mouse aim; ship orientation stays fixed.
 */
(() => {
  "use strict";

  // Logical size follows the viewport aspect so Scale.FIT fills the screen
  // (no letterbox bars). Height stays ~540 for consistent sprite scale.
  let W = 960;
  let H = 540;
  let _syncingSize = false;

  function readViewportLogicalSize() {
    const wrap = document.getElementById("game-wrap");
    const cw = Math.max(1, (wrap && wrap.clientWidth) || window.innerWidth || 960);
    const ch = Math.max(1, (wrap && wrap.clientHeight) || window.innerHeight || 540);
    const aspect = cw / ch;
    // Match CSS pixel size of the wrap so Scale.FIT barely stretches the canvas
    // (same idea as web: one downscale from HD PNG → screen, not bake-then-upscale)
    let nextH = Math.round(Math.min(1200, Math.max(540, ch)));
    let nextW = Math.max(640, Math.round(nextH * aspect));
    nextW -= nextW % 2;
    nextH -= nextH % 2;
    return { width: nextW, height: nextH };
  }

  function syncViewportSize(game) {
    if (_syncingSize) return;
    const next = readViewportLogicalSize();
    if (next.width === W && next.height === H) {
      // Size unchanged — do not call setGameSize/refresh (they re-emit resize)
      return;
    }
    W = next.width;
    H = next.height;
    if (!game || !game.scale) return;
    _syncingSize = true;
    try {
      game.scale.setGameSize(W, H);
    } finally {
      _syncingSize = false;
    }
  }

  syncViewportSize(null);

  /**
   * Design height speeds/UI were tuned for. On larger canvases we scale up,
   * but SPEED_SCALE_MAX caps gameplay so it doesn't feel frantic.
   * Original 540p feel ≈ scale 1.0; raise/lower SPEED_SCALE_MAX to taste.
   */
  const DESIGN_H = 540;
  const SPEED_SCALE_MAX = 1.2;
  const UI_SCALE_MAX = 1.45;
  /** Extra multiplier for enemy bolts (design shotSpeeds felt slow on large canvas). */
  const ENEMY_SHOT_SPEED_MULT = 1.55;

  function speedScale() {
    return Math.min(SPEED_SCALE_MAX, Math.max(1, H / DESIGN_H));
  }
  function uiScale() {
    return Math.min(UI_SCALE_MAX, Math.max(1, H / DESIGN_H));
  }
  /** Design px/s → current playfield (capped). */
  function spd(v) {
    return v * speedScale();
  }
  /** Design UI px → current canvas (capped separately from speed). */
  function uiPx(v) {
    return Math.round(v * uiScale());
  }

  /** Shared menu button metrics — same size/gap on start, pause, game over. */
  const MENU_BTN_TEX = "ui_menu_button";
  /** Native crop aspect from button.png (do not stretch / nine-slice). */
  const MENU_BTN_ASPECT = 1205 / 345;
  function menuBtnHeight() {
    return uiPx(62);
  }
  function menuBtnGap() {
    return uiPx(14);
  }
  function menuBtnWidthForHeight(h) {
    return Math.round(h * MENU_BTN_ASPECT);
  }

  /**
   * Vertical stack of textured menu buttons with fixed gaps.
   * Pass [{ text, onClick }, ...] — identical spacing on every screen.
   * Scales button.png uniformly (keeps metal frame / cyan glow / honeycomb intact).
   */
  class MenuButtonList {
    /**
     * @param {Phaser.Scene} scene
     * @param {{ text: string, onClick: Function }[]} items
     * @param {{
     *   x?: number,
     *   top?: number,
     *   centerY?: number,
     *   height?: number,
     *   gap?: number,
     *   depth?: number,
     *   scrollFactor?: number,
     *   fontSize?: number,
     * }} [opts]
     */
    constructor(scene, items, opts = {}) {
      this.scene = scene;
      this.items = items || [];
      this.x = opts.x != null ? opts.x : W / 2;
      this.btnH = opts.height != null ? opts.height : menuBtnHeight();
      this.btnW = menuBtnWidthForHeight(this.btnH);
      this.gap = opts.gap != null ? opts.gap : menuBtnGap();
      this.depth = opts.depth != null ? opts.depth : 10;
      this.scrollFactor = opts.scrollFactor;
      this.fontSize = opts.fontSize != null ? opts.fontSize : uiPx(18);
      this.buttons = [];
      this.objs = [];

      const n = this.items.length;
      this.totalHeight = n > 0 ? n * this.btnH + (n - 1) * this.gap : 0;
      if (opts.centerY != null) {
        this.top = opts.centerY - this.totalHeight / 2;
      } else {
        this.top = opts.top != null ? opts.top : uiPx(260);
      }

      this.items.forEach((item, i) => {
        const y = this.top + this.btnH / 2 + i * (this.btnH + this.gap);
        const btn = this._makeButton(item.text, y, item.onClick);
        this.buttons.push(btn);
      });
    }

    _applyMeta(go) {
      go.setDepth(this.depth);
      if (this.scrollFactor != null && go.setScrollFactor) {
        go.setScrollFactor(this.scrollFactor);
      }
      this.objs.push(go);
      return go;
    }

    _makeButton(text, y, onClick) {
      let bg;
      if (this.scene.textures.exists(MENU_BTN_TEX)) {
        bg = this.scene.add.image(this.x, y, MENU_BTN_TEX).setOrigin(0.5);
        // Uniform scale only — never squash or nine-slice this art
        const srcH = Math.max(1, bg.height || bg.frame.height);
        bg.setScale(this.btnH / srcH);
      } else {
        bg = this.scene.add
          .rectangle(this.x, y, this.btnW, this.btnH, 0x122038, 0.95)
          .setStrokeStyle(2, 0x3a6a9a);
      }
      this._applyMeta(bg);
      // Hit box matches visible button bounds (not full texture padding)
      bg.setInteractive(
        new Phaser.Geom.Rectangle(
          -this.btnW / 2,
          -this.btnH / 2,
          this.btnW,
          this.btnH
        ),
        Phaser.Geom.Rectangle.Contains
      );
      bg.input.cursor = "pointer";

      const label = this._applyMeta(
        this.scene.add
          .text(this.x, y, text, {
            fontFamily: "Courier New, monospace",
            fontSize: `${this.fontSize}px`,
            color: "#e8eef8",
            align: "center",
            stroke: "#061018",
            strokeThickness: Math.max(2, Math.round(this.fontSize * 0.12)),
          })
          .setOrigin(0.5, 0.52)
      );
      label.setInteractive({ useHandCursor: true });

      const hoverIn = () => {
        if (bg.setTint) bg.setTint(0xd0ecff);
        label.setColor("#9fd4ff");
      };
      const hoverOut = () => {
        if (bg.clearTint) bg.clearTint();
        label.setColor("#e8eef8");
      };
      const click = () => {
        SFX.ui();
        SFX.ensure();
        if (typeof onClick === "function") onClick();
      };
      bg.on("pointerover", hoverIn);
      bg.on("pointerout", hoverOut);
      bg.on("pointerdown", click);
      label.on("pointerover", hoverIn);
      label.on("pointerout", hoverOut);
      label.on("pointerdown", click);

      return { bg, label, y, text };
    }

    /** Add all button objects into a Phaser container (pause / game over). */
    addTo(container) {
      if (!container) return this;
      this.objs.forEach((o) => container.add(o));
      return this;
    }

    destroy() {
      this.objs.forEach((o) => {
        if (o && o.destroy) o.destroy();
      });
      this.objs = [];
      this.buttons = [];
    }
  }

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
      // Source-px body — wide enough that wing tips scoop pickups (~display 58×64)
      bodyW: 52,
      bodyH: 40,
      shieldR: 40,
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
      // Long capital dread (source px) — cover hull + side turrets
      bodyW: 118,
      bodyH: 170,
      shieldR: 56,
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
  const TEST_START_HELPER_COUNT = 3;
  /** Dev: spawn floating shield + helper pickups at run start for audio/collect tests. */
  const TEST_START_PICKUPS = true;
  /** TEMP: force tablet sticks/buttons in desktop browser for UI preview. */
  const FORCE_TOUCH_UI = false;

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
      const vol = Number(localStorage.getItem(this.volume));
      return {
        sound: localStorage.getItem(this.sound) !== "0",
        music: localStorage.getItem(this.music) !== "0",
        // Quieter default so music isn't loud from the start
        volume: Number.isFinite(vol) ? Phaser.Math.Clamp(vol, 0, 1) : 0.45,
      };
    },
    saveSettings(s) {
      localStorage.setItem(this.sound, s.sound ? "1" : "0");
      localStorage.setItem(this.music, s.music ? "1" : "0");
      localStorage.setItem(this.volume, String(s.volume));
    },
  };

  /** Phaser audio keys loaded from soundfx/ */
  const AUDIO_FILES = {
    plasma1: "soundfx/plasma1.mp3",
    plasma2: "soundfx/plasma2.mp3",
    plasma3: "soundfx/plasma3.mp3",
    plasma4: "soundfx/plasma4.mp3",
    laser: "soundfx/laser.mp3",
    explosion: "soundfx/explosion.mp3",
    magnetic: "soundfx/magnetic.mp3",
    missle: "soundfx/missle.mp3", // filename spelling as shipped
    collected: "soundfx/collected.mp3",
    shield_activated: "soundfx/shield-activated.mp3",
    helper_ship: "soundfx/helper-ship.mp3",
    music: "soundfx/music.mp3",
  };

  /* -------------------- Audio (mp3 + soft beep fallbacks) -------------------- */
  const SFX = {
    game: null,
    ctx: null,
    settings: Storage.getSettings(),
    musicTrack: null,
    musicGapTimer: null,
    musicStarted: false,
    /** Music plays quieter than SFX relative to master volume */
    MUSIC_GAIN: 0.28,
    SFX_GAIN: 0.7,

    bind(game) {
      this.game = game;
    },

    ensure() {
      if (this.game && this.game.sound) {
        try {
          if (this.game.sound.context && this.game.sound.context.state === "suspended") {
            this.game.sound.context.resume();
          }
          this.game.sound.unlock();
        } catch (e) {
          /* ignore */
        }
      }
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      this.tryStartMusic();
      return this.ctx;
    },

    has(key) {
      return !!(this.game && this.game.cache && this.game.cache.audio && this.game.cache.audio.exists(key));
    },

    play(key, vol = 0.55) {
      if (!this.settings.sound) return false;
      this.ensure();
      if (!this.game || !this.game.sound || !this.has(key)) return false;
      try {
        this.game.sound.play(key, {
          volume: Phaser.Math.Clamp(vol * this.SFX_GAIN * this.settings.volume, 0, 1),
        });
        return true;
      } catch (e) {
        return false;
      }
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

    /** Interceptor / light ship primary */
    plasmaLight() {
      if (!this.play("plasma4", 0.5)) this.tone(880, 0.06, "square", 0.05);
    },
    /** Dreadnought / heavy ship primary */
    plasmaHeavy() {
      if (!this.play("plasma1", 0.55)) this.tone(420, 0.08, "sawtooth", 0.06);
    },
    /** Triple / multi-shot */
    plasmaMulti() {
      if (!this.play("plasma3", 0.5)) this.tone(700, 0.08, "square", 0.05);
    },
    /** Opponent ship shots */
    enemyLaser() {
      if (!this.play("plasma2", 0.45)) this.tone(220, 0.08, "sawtooth", 0.04);
    },
    /** Player primary — pick by ship / buff (legacy name kept for allies) */
    laser(ship) {
      if (ship && ship.dualGuns) this.plasmaHeavy();
      else this.plasmaLight();
    },
    hit() {
      if (!this.play("explosion", 0.28)) this.tone(160, 0.12, "square", 0.07);
    },
    explode() {
      if (!this.play("explosion", 0.7)) {
        this.tone(90, 0.25, "sawtooth", 0.1);
        this.tone(60, 0.35, "triangle", 0.06);
      }
    },
    /** Mid boom for magnetic wipe — quieter than stacked full explodes, still clear under magnetic */
    explodeSoft() {
      if (!this.settings.sound) return;
      this.ensure();
      if (this.has("explosion") && this.game?.sound) {
        try {
          // Separate instance so it isn't ducked/replaced by magnetic or other plays
          const boom = this.game.sound.add("explosion", {
            volume: Phaser.Math.Clamp(Math.max(0.78, this.settings.volume), 0, 0.88),
          });
          boom.once("complete", () => {
            try {
              boom.destroy();
            } catch (e) {
              /* ignore */
            }
          });
          boom.play();
          return;
        } catch (e) {
          /* fall through */
        }
      }
      this.tone(90, 0.22, "sawtooth", 0.08);
    },
    superCharge() {
      if (!this.play("laser", 0.35)) {
        this.tone(200, 0.2, "sine", 0.08);
        this.tone(400, 0.25, "sine", 0.08);
      }
    },
    superFire() {
      if (!this.play("laser", 0.75)) {
        this.tone(120, 0.5, "sawtooth", 0.14);
        this.tone(80, 0.6, "triangle", 0.1);
      }
    },
    magnetic() {
      // Louder cue — clip is quiet and used to get buried under stacked explosions
      if (!this.settings.sound) return;
      this.ensure();
      if (this.has("magnetic") && this.game?.sound) {
        try {
          this.game.sound.play("magnetic", {
            volume: Phaser.Math.Clamp(Math.max(0.95, this.settings.volume), 0, 1),
          });
          return;
        } catch (e) {
          /* fall through */
        }
      }
      this.tone(90, 0.35, "sine", 0.12);
      this.tone(180, 0.4, "triangle", 0.08);
    },
    missile() {
      if (!this.play("missle", 0.65)) this.tone(140, 0.2, "sawtooth", 0.08);
    },
    pickup() {
      if (!this.play("collected", 0.65)) {
        this.tone(520, 0.08, "sine", 0.06);
        this.tone(780, 0.1, "triangle", 0.05);
      }
    },
    shield() {
      // Louder than normal SFX — source clip is quiet
      if (!this.settings.sound) return;
      this.ensure();
      if (this.has("shield_activated") && this.game?.sound) {
        try {
          this.game.sound.play("shield_activated", {
            volume: Phaser.Math.Clamp(Math.max(1, this.settings.volume), 0, 1),
          });
          return;
        } catch (e) {
          /* fall through */
        }
      }
      this.tone(400, 0.15, "sine", 0.08);
      this.tone(600, 0.2, "triangle", 0.06);
    },
    triple() {
      this.plasmaMulti();
    },
    allyJoin() {
      // Same loud path as shield — helper-ship clip was too quiet via SFX_GAIN
      if (!this.settings.sound) return;
      this.ensure();
      if (this.has("helper_ship") && this.game?.sound) {
        try {
          this.game.sound.play("helper_ship", {
            volume: Phaser.Math.Clamp(Math.max(1, this.settings.volume), 0, 1),
          });
          return;
        } catch (e) {
          /* fall through */
        }
      }
      this.tone(480, 0.08, "sine", 0.06);
      this.tone(720, 0.12, "triangle", 0.05);
    },
    gameOver() {
      if (!this.play("explosion", 0.55)) {
        this.tone(300, 0.2, "square", 0.08);
        setTimeout(() => this.tone(200, 0.25, "square", 0.08), 180);
        setTimeout(() => this.tone(120, 0.4, "triangle", 0.1), 360);
      }
    },
    ui() {
      this.tone(660, 0.05, "square", 0.04);
    },

    musicVolume() {
      return Phaser.Math.Clamp(this.MUSIC_GAIN * this.settings.volume, 0, 1);
    },

    stopMusic() {
      if (this.musicGapTimer) {
        clearTimeout(this.musicGapTimer);
        this.musicGapTimer = null;
      }
      if (this.musicTrack) {
        try {
          this.musicTrack.stop();
          this.musicTrack.destroy();
        } catch (e) {
          /* ignore */
        }
        this.musicTrack = null;
      }
    },

    tryStartMusic() {
      if (!this.settings.music || !this.game || !this.has("music")) return;
      if (this.musicTrack && this.musicTrack.isPlaying) {
        this.musicTrack.setVolume(this.musicVolume());
        return;
      }
      if (this.musicGapTimer) return;
      this._playMusicTrack();
    },

    _playMusicTrack() {
      if (!this.settings.music || !this.game || !this.has("music")) return;
      // Resume AudioContext if a user gesture already happened
      try {
        if (this.game.sound.context && this.game.sound.context.state === "suspended") {
          this.game.sound.context.resume();
        }
        this.game.sound.unlock();
      } catch (e) {
        /* ignore */
      }
      this.stopMusic();
      try {
        this.musicTrack = this.game.sound.add("music", {
          volume: this.musicVolume(),
          loop: false,
        });
        this.musicTrack.once("complete", () => {
          this.musicTrack = null;
          // 5s pause between track plays
          this.musicGapTimer = setTimeout(() => {
            this.musicGapTimer = null;
            this._playMusicTrack();
          }, 5000);
        });
        this.musicTrack.play();
        this.musicStarted = true;
      } catch (e) {
        this.musicTrack = null;
      }
    },

    applySettings(s) {
      this.settings = s || Storage.getSettings();
      if (!this.settings.music) {
        this.stopMusic();
      } else {
        this.tryStartMusic();
        if (this.musicTrack) this.musicTrack.setVolume(this.musicVolume());
      }
      if (this.game && this.game.sound) {
        this.game.sound.mute = false;
      }
    },
  };

  /**
   * Target on-canvas heights (px). Tuned near native PNG heights so we mostly
   * downscale HD art once — never crush to ~half then let Scale.FIT blow it up.
   * Native refs: player 84, dread 142, doomstar 131, laser 83, scout 60, …
   */
  const SPRITE_H = {
    player: 64,
    player_dread: 110,
    ally_drone: 36,
    enemy_scout: 48,
    enemy_fighter: 54,
    enemy_heavy: 56,
    enemy_heavy_2: 56,
    enemy_heavy_3: 56,
    enemy_heavy_4: 56,
    enemy_doomstar: 110,
    planet_s: 44,
    planet_l: 72,
    planet_indestruct: 78,
    asteroid_s: 32,
    asteroid_l: 40,
    laser: 56,
    player_laser: 20, // slightly larger than enemy bolt thickness
    laser_tip: 32,
    superbeam_tip: 40,
    superbeam_body: 72,
    fx_superbeam: 160,
    dread_shot: 16,
    fx_shield: 86,
    enemy_laser: 52,
    // Match dread main-gun size (was 12 → invisible dark crop)
    heavy_shot: 16,
    doomstar_shot: 48,
    doomstar_laser: 72,
    doomstar_missile: 64,
    fuel: 40,
    pickup_shield: 48,
    pickup_triple: 48,
    pickup_ally: 52,
    pickup_super: 44,
    pickup_magnetic: 48,
    crosshair: 48,
  };

  function fitSprite(sprite, key) {
    const h = SPRITE_H[key];
    if (!sprite || !h || !sprite.height) return sprite;
    // Never upscale past native — only shrink HD → target (web-like)
    sprite.setScale(Math.min(1, h / sprite.height));
    return sprite;
  }

  /**
   * Arcade body size is in source (unscaled) px. After setTexture/setScale,
   * size the hitbox and center it on the sprite's world position.
   * Prefer worldPx for a stable on-screen hit size (needed for tiny scaled bolts).
   */
  function syncArcadeBody(go, bodyW, bodyH, worldPx) {
    if (!go || !go.body) return;
    const sx = Math.max(0.01, Math.abs(go.scaleX || 1));
    const sy = Math.max(0.01, Math.abs(go.scaleY || 1));
    let bw;
    let bh;
    if (worldPx != null) {
      bw = worldPx / sx;
      bh = worldPx / sy;
    } else {
      const fw = Math.max(1, go.frame ? go.frame.width : go.width);
      const fh = Math.max(1, go.frame ? go.frame.height : go.height);
      bw = bodyW != null ? bodyW : fw;
      bh = bodyH != null ? bodyH : fh;
    }
    bw = Math.max(4, bw);
    bh = Math.max(4, bh);
    go.body.setSize(bw, bh, false);
    // displayOrigin is unscaled; body.x = go.x - displayOrigin*scale + offset*scale
    // Want body center on go.x → offset = displayOrigin - (worldSize/2)/scale
    const worldW = bw * sx;
    const worldH = bh * sy;
    const ox = go.displayOriginX - worldW / (2 * sx);
    const oy = go.displayOriginY - worldH / (2 * sy);
    go.body.setOffset(ox, oy);
    if (typeof go.body.updateFromGameObject === "function") {
      go.body.updateFromGameObject();
    }
  }

  /** Circle body sized to the visible sprite (not the tiny design _radius alone). */
  function syncObstacleCircle(o, minRadius) {
    if (!o || !o.body) return;
    const visualR = Math.max(
      minRadius || 8,
      Math.min(o.displayWidth || 0, o.displayHeight || 0) * 0.36
    );
    o._radius = visualR;
    const srcR = visualR / Math.max(0.01, Math.abs(o.scaleX || 1));
    o.body.setCircle(srcR, o.width / 2 - srcR, o.height / 2 - srcR);
  }

  const SPRITE_FILES = [
    "player",
    "player_thrust",
    "player_bank_l",
    "player_bank_r",
    "player_dread",
    "ally_drone",
    "ally_drone_thrust",
    "ally_drone_fire",
    "pickup_ally",
    "enemy_scout",
    "enemy_fighter",
    "enemy_heavy",
    "enemy_heavy_2",
    "enemy_heavy_3",
    "enemy_heavy_4",
    "enemy_doomstar",
    "planet_s",
    "planet_l",
    "planet_indestruct",
    "asteroid_s",
    "asteroid_l",
    "laser",
    "player_laser",
    "dread_shot",
    "enemy_laser",
    "heavy_shot",
    "doomstar_shot",
    "doomstar_laser",
    "doomstar_missile",
    "fuel",
    "pickup_shield",
    "pickup_triple",
    "pickup_super",
    "pickup_magnetic",
    "fx_explode_sm",
    "fx_explode_md",
    "fx_explode_lg",
    "fx_hit",
    "fx_shield",
    "fx_magnetic",
    "fx_superbeam",
    "superbeam_tip",
    "superbeam_body",
    "laser_tip",
    "laser_body",
    "crosshair",
    "px",
  ];

  /* -------------------- Legacy procedural fallbacks (unused if atlas loads) -------------------- */
  function drawPixels(g, pixels, ox, oy, scale) {
    const s = scale || 1;
    for (const [x, y, c] of pixels) {
      g.fillStyle(c, 1);
      g.fillRect(ox + x * s, oy + y * s, s, s);
    }
  }

  function makeTextures(scene) {
    // Tiny particle (crosshair comes from sprites/game/crosshair.png)
    if (!scene.textures.exists("px")) {
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
    preload() {
      this.load.image("space_bg", "space.jpeg");
      this.load.image("space_tile", "space_tile.png");
      // Tablet touch UI art
      this.load.image("ui_stick_base", "ui/controller-circle.png");
      this.load.image("ui_stick_knob", "ui/controller.png");
      this.load.image("ui_btn_laser", "ui/laser.png");
      this.load.image("ui_btn_explosion", "ui/explosion.png");
      // Control-panels HUD (cropped from control-panels.png — native HD)
      this.load.image("hud_hp_frame", "ui/hud_hp_frame.png");
      this.load.image("hud_hp_fill", "ui/hud_hp_fill.png");
      this.load.image("hud_ability_panel", "ui/hud_ability_panel.png");
      this.load.image("hud_mag_fill", "ui/hud_mag_fill.png");
      this.load.image("hud_super_fill", "ui/hud_super_fill.png");
      // Cropped from ui/button.png — shared start / pause / game-over menus
      this.load.image(MENU_BTN_TEX, "ui/menu_button.png?v=3");
      SPRITE_FILES.forEach((key) => {
        this.load.image(key, `sprites/game/${key}.png`);
      });
      Object.keys(AUDIO_FILES).forEach((key) => {
        this.load.audio(key, AUDIO_FILES[key]);
      });
    }
    create() {
      // Soft filtering so sprite-map art keeps smooth edges (not hard pixel blocks)
      SPRITE_FILES.forEach((key) => {
        if (this.textures.exists(key)) {
          this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
        }
      });
      // Space tiles stay 1:1 and crisp (feathered PNG hides seams)
      ["space_bg", "space_tile"].forEach((key) => {
        if (this.textures.exists(key)) {
          this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
      });
      // HD tablet + HUD UI — always bilinear (never nearest / pixel crunch)
      [
        "ui_stick_base",
        "ui_stick_knob",
        "ui_btn_laser",
        "ui_btn_explosion",
        "hud_hp_frame",
        "hud_hp_fill",
        "hud_ability_panel",
        "hud_mag_fill",
        "hud_super_fill",
        MENU_BTN_TEX,
      ].forEach((key) => {
        if (this.textures.exists(key)) {
          const tex = this.textures.get(key);
          tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
          const src = tex.getSourceImage && tex.getSourceImage();
          if (src && src.style) {
            src.style.imageRendering = "auto";
          }
        }
      });
      makeTextures(this);
      if (this.textures.exists("player") && this.textures.exists("player_thrust")) {
        this.anims.create({
          key: "player_fly",
          frames: [{ key: "player" }, { key: "player_thrust" }],
          frameRate: 8,
          repeat: -1,
        });
      }
      if (this.textures.exists("ally_drone") && this.textures.exists("ally_drone_thrust")) {
        this.anims.create({
          key: "ally_fly",
          frames: [{ key: "ally_drone" }, { key: "ally_drone_thrust" }],
          frameRate: 10,
          repeat: -1,
        });
      }
      syncViewportSize(this.game);
      SFX.bind(this.game);
      SFX.applySettings(Storage.getSettings());
      // Unlock WebAudio + start quiet music after first gesture
      const unlock = () => {
        SFX.ensure();
        SFX.tryStartMusic();
      };
      this.input.once("pointerdown", unlock);
      this.input.keyboard?.once("keydown", unlock);
      this.scene.start("Menu");
    }
  }

  /* -------------------- Far space background + near starfield -------------------- */
  /**
   * Far space outside Phaser (avoids Scale.FIT blur).
   * CSS-repeats a mirror-seamless native tile (1168×2312) — edges match exactly.
   */
  function createSpaceBackground(_scene) {
    const el =
      typeof document !== "undefined" ? document.getElementById("space-bg") : null;
    const FAR_SPEED = 4;
    let scroll = 0;
    return {
      update(dt, scrollY) {
        if (!el) return;
        const sy = scrollY != null ? scrollY : 1;
        scroll += FAR_SPEED * sy * dt;
        el.style.backgroundPosition = `0 ${-scroll}px`;
      },
    };
  }

  function createStarfield(scene) {
    // Nearer dust layer on top of the far space plate
    const layers = [
      { count: 40, speed: 18, size: 1, alpha: 0.35 },
      { count: 28, speed: 40, size: 1.5, alpha: 0.55 },
      { count: 14, speed: 75, size: 2, alpha: 0.75 },
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
        s._speed = layer.speed * speedScale();
        stars.push(s);
      }
    });
    const space = createSpaceBackground(scene);
    return {
      update(dt, scrollY) {
        space.update(dt, scrollY);
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
      syncViewportSize(this.game);
      SFX.bind(this.game);
      // First click/key elsewhere will unlock; nudge AudioContext when possible
      this.input.once("pointerdown", () => {
        SFX.ensure();
        SFX.tryStartMusic();
      });
      this.stars = createStarfield(this);

      // Header + ship preview, then buttons — leave clear gaps so nothing overlaps
      this.add
        .text(W / 2, uiPx(44), "PIXEL SPACE SHOOTER", {
          fontFamily: "Courier New, monospace",
          fontSize: `${uiPx(30)}px`,
          color: "#7ec8ff",
          stroke: "#1a3a6a",
          strokeThickness: Math.max(3, uiPx(4)),
        })
        .setOrigin(0.5);

      this.add
        .text(W / 2, uiPx(74), "STAR WARS–INSPIRED PIXEL ARCADE", {
          fontFamily: "Courier New, monospace",
          fontSize: `${uiPx(12)}px`,
          color: "#6a88aa",
        })
        .setOrigin(0.5);

      // Selected ship block: small preview, then name + bests underneath (no overlap)
      const selected = getSelectedShip();
      const previewH = uiPx(58);
      const shipY = uiPx(140);
      const ship = this.add.image(W / 2, shipY, selected.texture);
      ship.setScale(Math.min(1.15, previewH / Math.max(1, ship.height)));
      this.tweens.add({
        targets: ship,
        y: shipY + uiPx(6),
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      const nameY = shipY + previewH * 0.55 + uiPx(14);
      this.add
        .text(W / 2, nameY, selected.name, {
          fontFamily: "Courier New, monospace",
          fontSize: `${uiPx(14)}px`,
          color: "#7ec8ff",
        })
        .setOrigin(0.5);

      const flightBest = Storage.getBest("flight");
      const fightBest = Storage.getBest("fight");
      this.add
        .text(
          W / 2,
          nameY + uiPx(22),
          `BEST FLIGHT ${flightBest}   ·   BEST FIGHT ${fightBest}`,
          {
            fontFamily: "Courier New, monospace",
            fontSize: `${uiPx(12)}px`,
            color: "#8899aa",
          }
        )
        .setOrigin(0.5);

      const go = (sceneKey) => {
        if (sceneKey === "Flight" || sceneKey === "Fight") {
          document.body.classList.remove("menu-cursor");
        }
        this.scene.start(sceneKey);
      };
      const buttonsTop = nameY + uiPx(52);
      this.menuButtons = new MenuButtonList(
        this,
        [
          { text: "FLIGHT MODE", onClick: () => go("Flight") },
          { text: "FIGHT MODE", onClick: () => go("Fight") },
          { text: "CONTROLS", onClick: () => go("Controls") },
          { text: "SETTINGS", onClick: () => go("Settings") },
          { text: "SELECT SHIP", onClick: () => go("ShipSelect") },
        ],
        { top: buttonsTop, fontSize: uiPx(17) }
      );

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
      try {
        this.scene.stop("Menu");
      } catch (e) {
        /* ignore */
      }
      syncViewportSize(this.game);
      this.stars = createStarfield(this);
      this.add.rectangle(0, 0, W, H, 0x05070f, 0.88).setOrigin(0).setDepth(-5);

      this.add
        .text(W / 2, uiPx(48), "SELECT SHIP", {
          fontFamily: "Courier New, monospace",
          fontSize: `${uiPx(32)}px`,
          color: "#7ec8ff",
        })
        .setOrigin(0.5);
      this.add
        .text(W / 2, uiPx(84), "Choose your craft — saved under Settings", {
          fontFamily: "Courier New, monospace",
          fontSize: `${uiPx(13)}px`,
          color: "#6a88aa",
        })
        .setOrigin(0.5);

      this.selectedId = Storage.getShipId();
      this.cards = [];
      const list = [SHIPS.interceptor, SHIPS.dreadnought];
      const panelW = uiPx(260);
      const panelH = uiPx(200);
      const cy = uiPx(250);
      list.forEach((ship, i) => {
        const cx = W / 2 + (i === 0 ? -uiPx(170) : uiPx(170));
        const panel = this.add
          .rectangle(cx, cy, panelW, panelH, 0x122038, 1)
          .setStrokeStyle(2, 0x2a4a6a)
          .setInteractive({ useHandCursor: true });
        // Ship only inside the block — never upscale (fighter is small HD art; 2× looks pixelated)
        const img = this.add.image(cx, cy, ship.texture);
        const fitH = panelH * 0.72;
        img.setScale(Math.min(1, fitH / Math.max(1, img.height)));

        // Name / blurb / status UNDER the block (readable, no overlap)
        const underY = cy + panelH / 2 + uiPx(18);
        const title = this.add
          .text(cx, underY, ship.name, {
            fontFamily: "Courier New, monospace",
            fontSize: `${uiPx(18)}px`,
            color: "#e8eef8",
          })
          .setOrigin(0.5);
        const blurb = this.add
          .text(cx, underY + uiPx(24), ship.blurb, {
            fontFamily: "Courier New, monospace",
            fontSize: `${uiPx(12)}px`,
            color: "#8899aa",
            align: "center",
          })
          .setOrigin(0.5);
        const mark = this.add
          .text(cx, underY + uiPx(48), "", {
            fontFamily: "Courier New, monospace",
            fontSize: `${uiPx(13)}px`,
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

      new MenuButtonList(
        this,
        [{ text: "BACK", onClick: () => this.scene.start("Menu") }],
        { top: Math.min(H - menuBtnHeight() - uiPx(28), uiPx(520)) }
      );
      this.input.keyboard.on("keydown-ESC", () => this.scene.start("Menu"));
    }

    update(_, dtMs) {
      if (this.stars) this.stars.update(dtMs / 1000, 0.35);
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
        "Helper ships join you (100 HP) — shoot enemies & asteroids (not planets).",
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

      new MenuButtonList(
        this,
        [{ text: "BACK", onClick: () => this.scene.start("Menu") }],
        { top: Math.min(H - menuBtnHeight() - uiPx(24), uiPx(500)) }
      );
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
        const img = this.add.image(cx, cy - 28, ship.texture);
        img.setScale(Math.min(1, 110 / Math.max(1, img.height)));
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
        if (this.settings.sound) SFX.ui();
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

      new MenuButtonList(
        this,
        [{ text: "BACK", onClick: () => this.scene.start("Menu") }],
        { top: Math.min(H - menuBtnHeight() - uiPx(24), uiPx(500)) }
      );
      this.input.keyboard.on("keydown-ESC", () => this.scene.start("Menu"));
    }
    refresh() {
      this.soundText.setText(`SOUND FX: ${this.settings.sound ? "ON" : "OFF"}`);
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
      SFX.applySettings(this.settings);
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

      syncViewportSize(this.game);
      this.physics.world.setBounds(0, 0, W, H);
      this.cameras.main.setBounds(0, 0, W, H);
      this.cameras.main.setSize(W, H);
      this.stars = createStarfield(this);

      this.obstacles = this.physics.add.group();
      this.enemies = this.physics.add.group();
      this.pickups = this.physics.add.group();
      this.playerLasers = this.physics.add.group({
        defaultKey: "player_laser",
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
      // Temporary Y; corrected after HUD so ship starts above the bottom panel
      this.player = this.physics.add.sprite(W / 2, H * 0.62, this.ship.texture);
      fitSprite(this.player, this.ship.texture === "player_dread" ? "player_dread" : "player");
      this.player.setCollideWorldBounds(true);
      syncArcadeBody(this.player, this.ship.bodyW, this.ship.bodyH);
      this.player.setDepth(5);
      // Fixed forward orientation — never rotate toward mouse
      this.player.setAngle(0);
      if (this.ship.texture === "player" && this.anims.exists("player_fly")) {
        this.player.play("player_fly");
        this.syncPlayerHullAnchor();
        this.player.on("animationupdate", () => this.syncPlayerHullAnchor());
      } else if (this.ship.texture === "player_dread") {
        // Dread art is tall — keep a hull-centered body after scale
        syncArcadeBody(this.player, this.ship.bodyW, this.ship.bodyH);
      }

      this.crosshair = fitSprite(
        this.add.image(W / 2, H / 2, "crosshair").setDepth(50),
        "crosshair"
      );
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

      this.physics.add.overlap(
        this.playerLasers,
        this.obstacles,
        this.onLaserHitObstacle,
        // Ally lasers pass through planets (helpers only hit asteroids / enemies)
        (laser, obs) => !(laser._fromAlly && this.isPlanetObstacle(obs)),
        this
      );
      this.physics.add.overlap(this.playerLasers, this.enemies, this.onLaserHitEnemy, null, this);
      this.physics.add.overlap(this.enemyLasers, this.player, this.onEnemyLaserHitPlayer, null, this);
      this.physics.add.overlap(this.player, this.obstacles, this.onPlayerHitObstacle, null, this);
      this.physics.add.overlap(this.player, this.enemies, this.onPlayerHitEnemy, null, this);
      this.physics.add.overlap(this.player, this.pickups, this.onPickupCollect, null, this);

      this.buildHud();
      this.updateHud();
      this.applyPlayfieldBounds({ placeShip: true });
      this.pauseLayer = null;
      this.gameOverLayer = null;
      this._pauseAt = 0;

      this.input.keyboard.on("keydown-ESC", () => this.togglePause());
      if (this.isTouchPlay()) {
        this.setupTouchControls();
      }

      // Test start: one stronger helper already joined
      if (TEST_START_HELPER) {
        const n = Math.min(MAX_ALLIES, Math.max(1, TEST_START_HELPER_COUNT));
        for (let i = 0; i < n; i++) {
          const ang = (Math.PI * 2 * i) / n;
          this.recruitAlly(
            this.player.x + Math.cos(ang) * 56,
            this.player.y + Math.sin(ang) * 56
          );
        }
      }

      // Test start: floating shield + helper pickups near the ship
      if (TEST_START_PICKUPS) {
        this.spawnPickupAt("shield", this.player.x - 90, this.player.y - 120);
        this.spawnPickupAt("ally", this.player.x + 90, this.player.y - 120);
      }
    }

    isTouchPlay() {
      if (FORCE_TOUCH_UI) return true;
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
      const root = document.getElementById("touch-ui");
      if (!root) return;

      // HTML/CSS overlay — same idea as <img width="56">: full PNG, CSS display size
      root.innerHTML = `
        <div class="blasts">
          <button type="button" class="blast blast--mag" data-blast="mag" aria-label="Magnetic blast"></button>
          <button type="button" class="blast blast--super" data-blast="super" aria-label="Superlaser"></button>
        </div>
        <div class="stick stick--left" data-stick="move">
          <div class="stick-base"></div>
          <div class="stick-knob" data-knob="move"></div>
        </div>
        <div class="stick stick--right" data-stick="aim">
          <div class="stick-base"></div>
          <div class="stick-knob" data-knob="aim"></div>
          <div class="stick-label">AIM / FIRE</div>
        </div>
      `;
      root.hidden = false;
      root.setAttribute("aria-hidden", "false");
      this.touchUi = root;

      const moveStick = root.querySelector('.stick[data-stick="move"]');
      const aimStick = root.querySelector('.stick[data-stick="aim"]');
      const moveKnob = root.querySelector('[data-knob="move"]');
      const aimKnob = root.querySelector('[data-knob="aim"]');
      const magBtn = root.querySelector('.blast[data-blast="mag"]');
      const superBtn = root.querySelector('.blast[data-blast="super"]');

      this._touch = {
        root,
        moveKnob,
        aimKnob,
        magBtn,
        superBtn,
        baseR: 74,
      };

      const clampKnob = (stickEl, clientX, clientY, maxR) => {
        const rect = stickEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = clientX - cx;
        let dy = clientY - cy;
        const len = Math.hypot(dx, dy) || 1;
        if (len > maxR) {
          dx = (dx / len) * maxR;
          dy = (dy / len) * maxR;
        }
        return { dx, dy, nx: dx / maxR, ny: dy / maxR };
      };

      const setKnobDom = (knobEl, dx, dy) => {
        if (!knobEl) return;
        knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
      };

      const bindStick = (stickEl, knobEl, kind) => {
        if (!stickEl) return;
        const onDown = (e) => {
          if (this.ended || this.pausedGame) return;
          if (e.button != null && e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          const id = e.pointerId;
          const state = kind === "move" ? this.touchMove : this.touchAim;
          if (state.id != null && state.id !== id) return;
          stickEl.setPointerCapture?.(id);
          state.active = true;
          state.id = id;
          if (kind === "aim") state.firing = true;
          const k = clampKnob(stickEl, e.clientX, e.clientY, this._touch.baseR);
          setKnobDom(knobEl, k.dx, k.dy);
          state.x = k.nx;
          state.y = k.ny;
          if (kind === "aim" && Math.hypot(k.nx, k.ny) > 0.15) {
            this.aimVec.x = k.nx;
            this.aimVec.y = k.ny;
          }
        };
        const onMove = (e) => {
          if (this.ended || this.pausedGame) return;
          const state = kind === "move" ? this.touchMove : this.touchAim;
          if (!state.active || state.id !== e.pointerId) return;
          e.preventDefault();
          const k = clampKnob(stickEl, e.clientX, e.clientY, this._touch.baseR);
          setKnobDom(knobEl, k.dx, k.dy);
          state.x = k.nx;
          state.y = k.ny;
          if (kind === "aim" && Math.hypot(k.nx, k.ny) > 0.12) {
            this.aimVec.x = k.nx;
            this.aimVec.y = k.ny;
          }
        };
        const onUp = (e) => {
          const state = kind === "move" ? this.touchMove : this.touchAim;
          if (state.id !== e.pointerId) return;
          state.active = false;
          state.id = null;
          state.x = 0;
          state.y = 0;
          if (kind === "aim") state.firing = false;
          setKnobDom(knobEl, 0, 0);
          try {
            stickEl.releasePointerCapture?.(e.pointerId);
          } catch (_) {
            /* ignore */
          }
        };
        stickEl.addEventListener("pointerdown", onDown);
        stickEl.addEventListener("pointermove", onMove);
        stickEl.addEventListener("pointerup", onUp);
        stickEl.addEventListener("pointercancel", onUp);
      };

      bindStick(moveStick, moveKnob, "move");
      bindStick(aimStick, aimKnob, "aim");

      const bindBlast = (el, fn) => {
        if (!el) return;
        el.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (this.ended || this.pausedGame) return;
          SFX.ensure();
          fn.call(this);
        });
      };
      bindBlast(magBtn, this.tryMagneticBlast);
      bindBlast(superBtn, this.trySuperlaser);

      const hide = () => {
        root.hidden = true;
        root.setAttribute("aria-hidden", "true");
        root.innerHTML = "";
        this.touchUi = null;
        this._touch = null;
      };
      this.events.once("shutdown", hide);
      this.events.once("destroy", hide);
    }

    buildHud() {
      // Push HUD down on tablets so HP isn't covered by the site header in landscape
      const top = this.isTouchPlay() ? uiPx(52) : uiPx(14);
      const pad = uiPx(14);
      this.hud = this.add.container(0, 0).setDepth(40);

      const hasPanels =
        this.textures.exists("hud_hp_frame") &&
        this.textures.exists("hud_hp_fill") &&
        this.textures.exists("hud_ability_panel");

      if (hasPanels) {
        // Exact trough size; progress via mask width (never scale/squash the fill art)
        const fitInSlot = (img, slotX, slotY, slotW, slotH) => {
          img.setOrigin(0, 0);
          if (img.isCropped) img.isCropped = false;
          img.clearMask(true);
          img.setPosition(slotX, slotY);
          img.setDisplaySize(slotW, slotH);
          const maskG = this.make.graphics({ x: 0, y: 0, add: false });
          maskG.fillStyle(0xffffff, 1);
          maskG.fillRect(slotX, slotY, slotW, slotH);
          img.setMask(maskG.createGeometryMask());
          return { w: slotW, h: slotH, slotX, slotY, maskG };
        };

        // Compact HUD panels
        const hpTargetW = uiPx(168);
        this.hudHpFrame = this.add.image(pad, top, "hud_hp_frame").setOrigin(0, 0);
        this.hudHpFrame.setScale(hpTargetW / this.hudHpFrame.width);
        const fw = this.hudHpFrame.displayWidth;
        const fh = this.hudHpFrame.displayHeight;
        // After HP label, clear of tip chrome — stay inside frame
        const hpSlotX = pad + fw * 0.22;
        const hpSlotY = top + fh * 0.40;
        const hpSlotW = fw * 0.70;
        const hpSlotH = fh * 0.26;
        this.hudHpFill = this.add.image(0, 0, "hud_hp_fill");
        this._hudHpFillScale = fitInSlot(this.hudHpFill, hpSlotX, hpSlotY, hpSlotW, hpSlotH);

        // Number sits in the left head of the HP frame (not over the fill track)
        this.hpText = this.add
          .text(pad + fw * 0.11, top + fh * 0.50, "100", {
            fontFamily: "Courier New, monospace",
            fontSize: `${uiPx(11)}px`,
            color: "#ffffff",
            stroke: "#001122",
            strokeThickness: 2,
          })
          .setOrigin(0.5);

        const abTargetW = uiPx(250);
        this.hudAbility = this.add
          .image(W / 2, H - uiPx(10), "hud_ability_panel")
          .setOrigin(0.5, 1);
        this.hudAbility.setScale(abTargetW / this.hudAbility.width);
        const panelLeft = W / 2 - this.hudAbility.displayWidth / 2;
        const panelTop = H - uiPx(10) - this.hudAbility.displayHeight;
        const pw = this.hudAbility.displayWidth;
        const ph = this.hudAbility.displayHeight;

        // Neon troughs with a hard center gap (panel end-caps meet; fills must not)
        const magSlot = {
          x: panelLeft + pw * 0.088,
          y: panelTop + ph * 0.57,
          w: pw * 0.385,
          h: ph * 0.185,
        };
        const superSlot = {
          x: panelLeft + pw * 0.527,
          y: panelTop + ph * 0.57,
          w: pw * 0.385,
          h: ph * 0.185,
        };

        this.hudMagFill = this.add.image(0, 0, "hud_mag_fill");
        this.hudSuperFill = this.add.image(0, 0, "hud_super_fill");
        this._hudMagFillScale = fitInSlot(this.hudMagFill, magSlot.x, magSlot.y, magSlot.w, magSlot.h);
        this._hudSuperFillScale = fitInSlot(
          this.hudSuperFill,
          superSlot.x,
          superSlot.y,
          superSlot.w,
          superSlot.h
        );

        // Status centered on the fill — white
        this.superText = this.add
          .text(superSlot.x + superSlot.w / 2, superSlot.y + superSlot.h / 2, "", {
            fontFamily: "Courier New, monospace",
            fontSize: `${uiPx(10)}px`,
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 3,
          })
          .setOrigin(0.5);
        this.magText = this.add
          .text(magSlot.x + magSlot.w / 2, magSlot.y + magSlot.h / 2, "", {
            fontFamily: "Courier New, monospace",
            fontSize: `${uiPx(10)}px`,
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 3,
          })
          .setOrigin(0.5);

        // Mode label in the center gap above the two ability bars
        this.modeText = this.add
          .text(W / 2, panelTop + ph * 0.24, this.mode === "flight" ? "FLIGHT" : "FIGHT", {
            fontFamily: "Courier New, monospace",
            fontSize: `${uiPx(11)}px`,
            color: "#7ec8ff",
            stroke: "#001018",
            strokeThickness: 3,
          })
          .setOrigin(0.5);

        const infoY = top + fh + uiPx(6);
        this.scoreText = this.add
          .text(W - pad, top + uiPx(6), "SCORE 0", {
            fontFamily: "Courier New, monospace",
            fontSize: `${uiPx(16)}px`,
            color: "#7ec8ff",
          })
          .setOrigin(1, 0);
        this.infoText = this.add.text(pad, infoY, "", {
          fontFamily: "Courier New, monospace",
          fontSize: `${uiPx(13)}px`,
          color: "#a0b0c8",
        });
        this.buffText = this.add.text(pad, infoY + uiPx(18), "", {
          fontFamily: "Courier New, monospace",
          fontSize: `${uiPx(13)}px`,
          color: "#88ddff",
        });

        // Frames, then fills inside troughs, then labels
        this.hud.add([
          this.hudHpFrame,
          this.hudAbility,
          this.hudHpFill,
          this.hudMagFill,
          this.hudSuperFill,
          this.hpText,
          this.magText,
          this.superText,
          this.modeText,
          this.scoreText,
          this.infoText,
          this.buffText,
        ]);
      } else {
        // Fallback rectangles if panel art missing
        const hpW = uiPx(200);
        const barW = uiPx(240);
        this._hudHpW = hpW;
        this._hudBarW = barW;
        this.hpBarBg = this.add.rectangle(pad, top, hpW, uiPx(18), 0x222233).setOrigin(0, 0);
        this.hpBar = this.add.rectangle(pad, top, hpW, uiPx(18), 0x44cc66).setOrigin(0, 0);
        this.hpText = this.add.text(pad + uiPx(6), top - uiPx(2), "HP 100", {
          fontFamily: "Courier New, monospace",
          fontSize: `${uiPx(16)}px`,
          color: "#ffffff",
        });
        this.scoreText = this.add
          .text(W - pad, top - uiPx(2), "SCORE 0", {
            fontFamily: "Courier New, monospace",
            fontSize: `${uiPx(18)}px`,
            color: "#7ec8ff",
          })
          .setOrigin(1, 0);
        this.infoText = this.add.text(pad, top + uiPx(26), "", {
          fontFamily: "Courier New, monospace",
          fontSize: `${uiPx(15)}px`,
          color: "#a0b0c8",
        });
        this.buffText = this.add.text(pad, top + uiPx(48), "", {
          fontFamily: "Courier New, monospace",
          fontSize: `${uiPx(15)}px`,
          color: "#88ddff",
        });
        const botY = H - uiPx(22);
        this.superBg = this.add.rectangle(W / 2 - uiPx(140), botY, barW, uiPx(14), 0x222233).setOrigin(0.5);
        this.superBar = this.add
          .rectangle(W / 2 - uiPx(140) - barW / 2, botY, barW, uiPx(14), 0x44aaff)
          .setOrigin(0, 0.5);
        this.superText = this.add
          .text(W / 2 - uiPx(140), H - uiPx(40), "SUPERLASER READY", {
            fontFamily: "Courier New, monospace",
            fontSize: `${uiPx(14)}px`,
            color: "#ffcc44",
          })
          .setOrigin(0.5);
        this.magBg = this.add.rectangle(W / 2 + uiPx(140), botY, barW, uiPx(14), 0x222233).setOrigin(0.5);
        this.magBar = this.add
          .rectangle(W / 2 + uiPx(140) - barW / 2, botY, barW, uiPx(14), 0xcc66ff)
          .setOrigin(0, 0.5);
        this.magText = this.add
          .text(W / 2 + uiPx(140), H - uiPx(40), "MAGNETIC READY", {
            fontFamily: "Courier New, monospace",
            fontSize: `${uiPx(14)}px`,
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
    }

    /** Keep the ship above the bottom ability panel (spawn + world bounds). */
    applyPlayfieldBounds(opts = {}) {
      const placeShip = !!opts.placeShip;
      // Full screen — no invisible side/bottom walls
      this.physics.world.setBounds(0, 0, W, H);
      this._playBottom = H;
      if (this.player && placeShip) {
        // Spawn above the HUD panel; player can still fly to edges afterward
        let spawnY = H - uiPx(140);
        if (this.hudAbility) {
          const panelTop =
            this.hudAbility.y - this.hudAbility.displayHeight * this.hudAbility.originY;
          spawnY = panelTop - uiPx(56);
        }
        this.player.setPosition(W / 2, spawnY);
      }
    }

    /**
     * player_thrust is taller (engine flame). Keep hull locked by anchoring
     * origin to a fixed pixel from the top of the texture (same in both frames).
     */
    syncPlayerHullAnchor() {
      if (!this.player || !this.ship || this.ship.texture !== "player") return;
      const frameH = this.player.frame.height;
      if (!frameH) return;
      // Visual center of the metal hull in player.png (tops of both frames align)
      const HULL_ANCHOR_Y = 42;
      this.player.setOrigin(0.5, HULL_ANCHOR_Y / frameH);
      // Keep scale based on idle frame so thrust doesn't resize the hull
      const idleH = this.textures.get("player").getSourceImage().height || frameH;
      this.player.setScale(Math.min(1, (SPRITE_H.player || 64) / idleH));
      const bw = this.ship.bodyW;
      const bh = this.ship.bodyH;
      this.player.body.setSize(bw, bh);
      this.player.body.setOffset((this.player.width - bw) / 2, HULL_ANCHOR_Y - bh / 2);
    }

    _setHudFillPct(img, fullSize, pct) {
      if (!img || !fullSize) return;
      const p = Phaser.Math.Clamp(pct, 0, 1);
      // Keep full-size art; reveal by shrinking the mask from the right
      img.setDisplaySize(fullSize.w, fullSize.h);
      img.setPosition(fullSize.slotX, fullSize.slotY);
      if (img.isCropped) img.isCropped = false;
      if (fullSize.maskG) {
        const g = fullSize.maskG;
        g.clear();
        g.fillStyle(0xffffff, 1);
        const mw = fullSize.w * p;
        if (mw > 0.5) g.fillRect(fullSize.slotX, fullSize.slotY, mw, fullSize.h);
      }
      img.setVisible(p > 0.01);
    }

    updateHud() {
      const pct = Phaser.Math.Clamp(this.hp / PLAYER_MAX_HP, 0, 1);
      if (this.hudHpFill) {
        this._setHudFillPct(this.hudHpFill, this._hudHpFillScale, pct);
      } else if (this.hpBar) {
        this.hpBar.width = (this._hudHpW || 200) * pct;
        this.hpBar.fillColor = pct > 0.5 ? 0x44cc66 : pct > 0.25 ? 0xccaa33 : 0xcc3344;
      }
      if (this.hpText) this.hpText.setText(`${Math.max(0, Math.round(this.hp))}`);
      this.scoreText.setText(`SCORE ${Math.floor(this.score)}`);

      const now = this.time.now;
      const barW = this._hudBarW || 240;
      const left = Math.max(0, this.superReadyAt - now);
      let superPct = 1;
      if (left <= 0) {
        this.superText.setText("READY [SPACE]");
      } else {
        superPct = 1 - left / SUPER_COOLDOWN_MS;
        this.superText.setText(`${Math.ceil(left / 1000)}s`);
      }
      this.superText.setColor("#ffffff");
      if (this.hudSuperFill) {
        this._setHudFillPct(this.hudSuperFill, this._hudSuperFillScale, superPct);
      } else if (this.superBar) {
        this.superBar.width = barW * superPct;
        this.superBar.fillColor = left <= 0 ? 0x44ff88 : 0x4488cc;
      }

      // Charge empties the moment cooldown starts (on click), then refills over time
      const magLeft = Math.max(0, this.magneticReadyAt - now);
      let magPct = 1;
      if (MAGNETIC_COOLDOWN_MS > 0 && magLeft > 0) {
        magPct = 1 - magLeft / MAGNETIC_COOLDOWN_MS;
      }
      if (this.magneticActive) {
        this.magText.setText("ACTIVE!");
      } else if (magLeft <= 0) {
        this.magText.setText("READY [SHIFT]");
      } else {
        this.magText.setText(`${Math.ceil(magLeft / 1000)}s`);
      }
      this.magText.setColor("#ffffff");
      if (this.hudMagFill) {
        this._setHudFillPct(this.hudMagFill, this._hudMagFillScale, magPct);
      } else if (this.magBar) {
        this.magBar.width = barW * magPct;
        this.magBar.fillColor = this.magneticActive ? 0xff66ee : magLeft <= 0 ? 0xdd66ff : 0x7744aa;
      }

      if (this.modeText) {
        this.modeText.setText(this.mode === "flight" ? "FLIGHT" : "FIGHT");
      }
      if (this.mode === "flight") {
        const sec = (this.survivalMs / 1000).toFixed(1);
        this.infoText.setText(`TIME ${sec}s   DIST ${formatDistance(this.distance)}`);
      } else {
        this.infoText.setText(`KILLS ${this.kills}   WAVE ${this.wave}`);
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

      const speed = spd((this.ship && this.ship.speed) || 260);
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
        // Gentler invuln flicker (was hard blink to 0.35)
        this.player.setAlpha(Math.sin(this.time.now / 70) > 0 ? 1 : 0.62);
      } else {
        this.player.setAlpha(1);
      }
    }

    updateTouchBlastButtons() {
      if (!this._touch) return;
      const now = this.time.now;
      const magReady = now >= this.magneticReadyAt && !this.magneticActive;
      const superReady = now >= this.superReadyAt && !this.superFiring;
      if (this._touch.magBtn) {
        this._touch.magBtn.classList.toggle("is-dim", !magReady);
      }
      if (this._touch.superBtn) {
        this._touch.superBtn.classList.toggle("is-dim", !superReady);
      }
    }

    updatePowerVisuals() {
      const now = this.time.now;
      if (now < this.shieldUntil) {
        if (!this.shieldRing || !this.shieldRing.active) {
          if (this.textures.exists("fx_shield")) {
            this.shieldRing = this.add.image(this.player.x, this.player.y, "fx_shield").setDepth(6);
            fitSprite(this.shieldRing, "fx_shield");
          } else {
            const r = (this.ship && this.ship.shieldR) || 22;
            this.shieldRing = this.add
              .circle(this.player.x, this.player.y, r, 0x66ccff, 0)
              .setStrokeStyle(2, 0x88ddff, 0.9)
              .setDepth(6);
          }
        }
        this.shieldRing.setPosition(this.player.x, this.player.y);
        this.shieldRing.setAlpha(0.55 + Math.sin(now / 90) * 0.35);
        if (this.shieldRing.setScale && this.textures.exists("fx_shield")) {
          const pulse = 1 + Math.sin(now / 120) * 0.06;
          const base = (SPRITE_H.fx_shield || 52) / Math.max(1, this.textures.get("fx_shield").getSourceImage().height);
          this.shieldRing.setScale(base * pulse);
        }
      } else if (this.shieldRing) {
        this.shieldRing.destroy();
        this.shieldRing = null;
      }
    }

    fireLaserShot(x, y, angle, dmg, tint, texKey) {
      const key = texKey || "player_laser";
      let laser = this.playerLasers.get();
      if (!laser) {
        const extra = this.physics.add.image(x, y, key);
        this.playerLasers.add(extra);
        laser = extra;
      } else if (laser.texture && laser.texture.key !== key && this.textures.exists(key)) {
        laser.setTexture(key);
      }
      return this._launchLaser(laser, x, y, angle, dmg, tint, key);
    }

    _launchLaser(laser, x, y, angle, dmg, tint, texKey) {
      // New shot id so an old delayedCall cannot kill a reused laser mid-flight
      laser._shotId = (laser._shotId || 0) + 1;
      const shotId = laser._shotId;

      laser.setActive(true).setVisible(true);
      laser.setDepth(3);
      laser.clearTint();
      if (tint != null) laser.setTint(tint);
      laser.setPosition(x, y);
      // player_laser / dread_shot face +X; legacy vertical "laser" faces +Y
      const tipRight = !texKey || texKey === "player_laser" || texKey === "dread_shot";
      laser.setRotation(tipRight ? angle : angle + Math.PI / 2);
      laser._dmg = dmg || 12;
      laser._fromAlly = false;
      fitSprite(laser, texKey || "player_laser");

      if (laser.body) {
        laser.body.enable = true;
        // Re-bind hitbox to current texture (pool may reuse player_laser → dread_shot).
        // Use a stable on-screen hit size so small scaled bolts still overlap.
        const hit = Math.max(14, Math.min(28, (laser.displayWidth + laser.displayHeight) * 0.55));
        syncArcadeBody(laser, null, null, hit);
        laser.body.reset(x, y);
        const shotSpeed = spd((this.ship && this.ship.shotSpeed) || 560);
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
        SFX.plasmaMulti();
      } else if (ship.dualGuns) {
        // Dreadnought: two heavy bolts from side turrets
        const side = 22;
        const ox = Math.cos(angle + Math.PI / 2) * side;
        const oy = Math.sin(angle + Math.PI / 2) * side;
        this.fireLaserShot(px + ox, py + oy, angle, dmg, null, "dread_shot");
        this.fireLaserShot(px - ox, py - oy, angle, dmg, null, "dread_shot");
        SFX.plasmaHeavy();
      } else {
        this.fireLaserShot(px, py, angle, dmg);
        SFX.plasmaLight();
      }
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
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const fadeList = [];

      const glow = this.add
        .rectangle(this.player.x, this.player.y, dist, 36, 0x4488ff, 0.28)
        .setOrigin(0, 0.5)
        .setRotation(angle)
        .setDepth(5);
      fadeList.push(glow);

      // Superlaser-Beam from sprite-map: tile body, tip at the front
      const bodyKey = this.textures.exists("superbeam_body") ? "superbeam_body" : "fx_superbeam";
      const tipKey = this.textures.exists("superbeam_tip") ? "superbeam_tip" : "fx_superbeam";
      const bodyImg = this.textures.get(bodyKey).getSourceImage();
      const bodyNativeH = Math.max(24, (bodyImg && bodyImg.height) || 48);
      const bodyDisplayH = 88;
      const bodyScale = Math.min(1, bodyDisplayH / bodyNativeH);
      const bodyStep = bodyDisplayH * 0.78;
      for (let d = 28; d < dist - 40; d += bodyStep) {
        const seg = this.add
          .image(this.player.x + cos * d, this.player.y + sin * d, bodyKey)
          .setRotation(angle + Math.PI / 2)
          .setDepth(6)
          .setAlpha(0.95);
        seg.setScale(bodyScale);
        fadeList.push(seg);
      }
      const tip = this.add
        .image(this.player.x + cos * (dist - 20), this.player.y + sin * (dist - 20), tipKey)
        .setRotation(angle + Math.PI / 2)
        .setDepth(7)
        .setAlpha(1);
      fitSprite(tip, tipKey === "superbeam_tip" ? "superbeam_tip" : "fx_superbeam");
      fadeList.push(tip);

      this.cameras.main.flash(80, 100, 180, 255);
      this.shake = 10;
      SFX.superFire();

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
        targets: fadeList,
        alpha: 0,
        duration: 280,
        onComplete: () => {
          fadeList.forEach((o) => o.destroy());
          this.superFiring = false;
        },
      });

      this.superReadyAt = this.time.now + SUPER_COOLDOWN_MS;
    }

    tryMagneticBlast() {
      if (this.ended || this.pausedGame || this.magneticActive) return;
      if (this.time.now < this.magneticReadyAt) return;

      // Spend charge immediately — bar empties before blast FX
      this.magneticReadyAt = this.time.now + MAGNETIC_COOLDOWN_MS;
      this.magneticActive = true;
      this.magneticUntil = this.time.now + MAGNETIC_DURATION_MS;
      if (this.hudMagFill && this._hudMagFillScale) {
        this._setHudFillPct(this.hudMagFill, this._hudMagFillScale, 0);
      }
      this.updateHud();
      if (this.textures.exists("fx_magnetic")) {
        const burst = this.add.image(this.player.x, this.player.y, "fx_magnetic").setDepth(8);
        burst.setScale(0.9);
        this.tweens.add({
          targets: burst,
          alpha: 0,
          scale: 1.6,
          duration: 500,
          onComplete: () => burst.destroy(),
        });
      }
      this.magneticRadius = 1200;
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
      let wiped = 0;

      [...this.obstacles.getChildren()].forEach((obj) => {
        if (!obj.active || hitTargets.has(obj)) return;
        hitTargets.add(obj);
        wiped += 1;
        this.vaporizeObstacle(obj, true);
      });

      [...this.enemies.getChildren()].forEach((obj) => {
        if (!obj.active || hitTargets.has(obj)) return;
        hitTargets.add(obj);
        wiped += 1;
        // Per-target explode silenced — soft booms play once below
        this.damageEnemy(obj, 9999, true, true);
      });

      [...this.enemyLasers.getChildren()].forEach((bolt) => {
        if (bolt.active) bolt.destroy();
      });

      // Also clear player laser clutter for a clean field
      this.playerLasers.getChildren().forEach((l) => {
        if (l.active) this.recycleLaser(l);
      });

      // Staggered mid-volume explosions under magnetic (not one-per-target stack)
      if (wiped > 0) {
        this.time.delayedCall(60, () => SFX.explodeSoft());
        this.time.delayedCall(140, () => SFX.explodeSoft());
        if (wiped > 3) {
          this.time.delayedCall(240, () => SFX.explodeSoft());
        }
      }
    }

    /** Magnetic Blast: erase any obstacle, including all planet types. */
    vaporizeObstacle(obs, silent) {
      if (!obs || !obs.active) return;
      const x = obs.x;
      const y = obs.y;
      const wasPlanet = !!obs._indestructible || (obs.texture && String(obs.texture.key).startsWith("planet"));
      if (wasPlanet) {
        this.addScore(obs._score || SCORE.planetSmall);
        if (!silent) SFX.explode();
        this.spawnExplosion(x, y, "lg");
        obs.destroy();
      } else {
        this.damageObstacle(obs, 9999, true, silent);
      }
    }

    pickupTextureKey(kind) {
      if (kind === "shield") return "pickup_shield";
      if (kind === "triple") return "pickup_triple";
      if (kind === "ally") return "pickup_ally";
      if (kind === "super") return "pickup_super";
      if (kind === "magnetic") return "pickup_magnetic";
      return "fuel";
    }

    /** Spawn a pickup at an absolute position (slow float). */
    spawnPickupAt(kind, x, y) {
      if (!this.pickups) return null;
      const key = this.pickupTextureKey(kind);
      const item = this.pickups.create(x, y, key);
      if (!item) return null;
      this.stylePickup(item, kind);
      item.setVelocity(spd(Phaser.Math.Between(-12, 12)), spd(Phaser.Math.Between(18, 32)));
      return item;
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
      const speed = spd(Phaser.Math.Between(55, 85));
      item.setVelocity(spd(Phaser.Math.Between(-20, 20)), speed);
    }

    stylePickup(item, kind) {
      item.setDepth(6);
      item._kind = kind;
      item._heal = 20;
      fitSprite(item, this.pickupTextureKey(kind));
      // Generous pickup body so wing contact registers
      const bw = Math.max(18, item.displayWidth * 0.92);
      const bh = Math.max(18, item.displayHeight * 0.92);
      item.body.setSize(bw / item.scaleX, bh / item.scaleY);
      if (kind === "ally") {
        item.setAngularVelocity(0);
        item.setAngle(0);
      } else {
        item.setAngularVelocity(Phaser.Math.Between(-40, 40));
      }
      const base = item.scaleX;
      this.tweens.add({
        targets: item,
        scale: { from: base * 0.9, to: base * 1.12 },
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
        if (roll < 0.16) kind = "shield";
        else if (roll < 0.32) kind = "triple";
        else if (roll < 0.5) kind = "ally";
        else if (roll < 0.62) kind = "super";
        else if (roll < 0.74) kind = "magnetic";
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
      SFX.pickup();

      if (kind === "shield") {
        this.shieldUntil = this.time.now + SHIELD_DURATION_MS;
        SFX.shield();
        this.spawnBurst(player.x, player.y, 0x66ccff, 14);
        this.cameras.main.flash(60, 100, 200, 255);
      } else if (kind === "triple") {
        this.tripleUntil = this.time.now + TRIPLE_DURATION_MS;
        this.spawnBurst(player.x, player.y, 0xffaa33, 14);
        this.cameras.main.flash(60, 255, 180, 80);
      } else if (kind === "ally") {
        this.recruitAlly(px, py);
      } else if (kind === "super") {
        this.superReadyAt = Math.min(this.superReadyAt, this.time.now);
        this.spawnBurst(player.x, player.y, 0x66ccff, 16);
        this.cameras.main.flash(70, 120, 200, 255);
      } else if (kind === "magnetic") {
        this.magneticReadyAt = Math.min(this.magneticReadyAt, this.time.now);
        this.spawnBurst(player.x, player.y, 0xaa66ff, 16);
        this.cameras.main.flash(70, 180, 80, 255);
      } else {
        const before = this.hp;
        this.hp = Math.min(PLAYER_MAX_HP, this.hp + heal);
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
        this.spawnBurst(this.player.x, this.player.y, 0x66ffaa, 8);
        return;
      }
      // Must be a Sprite (not Image) so .play() works for ally_fly
      const sprite = this.add.sprite(fromX, fromY, "ally_drone").setDepth(5);
      fitSprite(sprite, "ally_drone");
      if (this.anims.exists("ally_fly")) {
        sprite.play("ally_fly");
      }
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
          SFX.pickup();
          if (kind === "shield") {
            ally.shieldUntil = this.time.now + SHIELD_DURATION_MS;
            SFX.shield();
            this.spawnBurst(ally.sprite.x, ally.sprite.y, 0x66ccff, 10);
          } else if (kind === "triple") {
            ally.tripleUntil = this.time.now + TRIPLE_DURATION_MS;
            ally.sprite.setTint(0xffcc66);
            this.spawnBurst(ally.sprite.x, ally.sprite.y, 0xffaa33, 10);
          } else if (kind === "ally") {
            // Extra helper scooped by a wingman — recruit for the player
            this.recruitAlly(ally.sprite.x, ally.sprite.y);
          } else if (kind === "super") {
            this.superReadyAt = Math.min(this.superReadyAt, this.time.now);
            this.spawnBurst(ally.sprite.x, ally.sprite.y, 0x66ccff, 10);
          } else if (kind === "magnetic") {
            this.magneticReadyAt = Math.min(this.magneticReadyAt, this.time.now);
            this.spawnBurst(ally.sprite.x, ally.sprite.y, 0xaa66ff, 10);
          } else {
            ally.hp = Math.min(ally.maxHp || ALLY_MAX_HP, ally.hp + heal);
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

      if (this.obstacles) {
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

    isAsteroidObstacle(obs) {
      if (!obs || !obs.active) return false;
      const key = obs.texture && String(obs.texture.key);
      return !!key && key.startsWith("asteroid");
    }

    /** Find an X that doesn't stack a new planet on an existing one near the top. */
    findClearPlanetX(radius, yNear = -40) {
      const margin = Math.max(60, radius + 40);
      const minSep = radius * 2 + 36;
      for (let attempt = 0; attempt < 14; attempt++) {
        const x = Phaser.Math.Between(margin, W - margin);
        let ok = true;
        this.obstacles.getChildren().forEach((obs) => {
          if (!ok || !obs.active || !this.isPlanetObstacle(obs)) return;
          // Only care about planets still near the spawn band / upper half
          if (obs.y > H * 0.55) return;
          const need = minSep + (obs._radius || 16);
          if (Phaser.Math.Distance.Between(x, yNear, obs.x, obs.y) < need) ok = false;
        });
        if (ok) return x;
      }
      // Fallback: park at a side lane
      return Math.random() < 0.5 ? margin + 10 : W - margin - 10;
    }

    findAllyTarget(ally) {
      // Flight: asteroids only. Fight: enemies + asteroids. Never planets.
      let best = null;
      let bestDist = 440;
      const ax = ally.sprite.x;
      const ay = ally.sprite.y;

      this.obstacles.getChildren().forEach((obs) => {
        if (!this.isAsteroidObstacle(obs)) return;
        const d = Phaser.Math.Distance.Between(ax, ay, obs.x, obs.y);
        if (d < bestDist) {
          bestDist = d;
          best = obs;
        }
      });

      if (this.mode === "fight") {
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
        // Keep helpers off the player hull (HD art fills more of the sprite box)
        const radius = spd(48 + n * 6);
        const tx = this.player.x + Math.cos(ang) * radius;
        const ty = this.player.y + Math.sin(ang) * radius + spd(4);
        ally.sprite.x += (tx - ally.sprite.x) * 0.22;
        ally.sprite.y += (ty - ally.sprite.y) * 0.22;

        const hasShield = now < ally.shieldUntil;
        if (hasShield) {
          if (!ally.shieldRing || !ally.shieldRing.active) {
            if (this.textures.exists("fx_shield")) {
              ally.shieldRing = this.add.image(ally.sprite.x, ally.sprite.y, "fx_shield").setDepth(4);
              fitSprite(ally.shieldRing, "fx_shield");
              ally.shieldRing.setScale(ally.shieldRing.scaleX * 0.55);
            } else {
              ally.shieldRing = this.add
                .circle(ally.sprite.x, ally.sprite.y, 14, 0x66ccff, 0.2)
                .setStrokeStyle(2, 0x88ddff, 0.85)
                .setDepth(4);
            }
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
        if (i === 0) {
          if (tripleOn) SFX.plasmaMulti();
          else SFX.plasmaLight();
        }
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
      if (this.textures.exists("fx_hit") && count >= 8) {
        const flash = this.add.image(x, y, "fx_hit").setDepth(9).setAlpha(0.9);
        fitSprite(flash, "fx_hit");
        flash.setScale(flash.scaleX * 0.7);
        this.tweens.add({
          targets: flash,
          alpha: 0,
          scale: flash.scaleX * 1.4,
          duration: 280,
          onComplete: () => flash.destroy(),
        });
      }
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

    spawnExplosion(x, y, size) {
      const key =
        size === "lg" ? "fx_explode_lg" : size === "md" ? "fx_explode_md" : "fx_explode_sm";
      if (!this.textures.exists(key)) {
        this.spawnBurst(x, y, 0xffaa66, size === "lg" ? 28 : 14);
        return;
      }
      const boom = this.add.image(x, y, key).setDepth(9);
      const targetH = size === "lg" ? 96 : size === "md" ? 68 : 48;
      boom.setScale(Math.min(1, targetH / Math.max(1, boom.height)));
      this.tweens.add({
        targets: boom,
        alpha: 0,
        scale: boom.scaleX * 1.25,
        duration: 420,
        onComplete: () => boom.destroy(),
      });
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
      // Soft red vignette — short + muted so it doesn't dominate the screen
      this.cameras.main.flash(28, 200, 70, 70);
      this.shake = 4;
      SFX.hit();
      this.spawnBurst(this.player.x, this.player.y, 0xff6666, 5);
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
      // Ally lasers ignore planets (helpers only shoot asteroids / enemies)
      if (laser._fromAlly && this.isPlanetObstacle(obs)) {
        this.spawnBurst(laser.x, laser.y, 0x88aaff, 4);
        return;
      }
      if (obs._indestructible) {
        this.spawnBurst(laser.x, laser.y, 0x88aaff, 4);
        return;
      }
      this.damageObstacle(obs, laser._dmg || 12, false);
    }

    damageObstacle(obs, dmg, fromSuper, silent) {
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
        if (!silent) SFX.explode();
        this.spawnExplosion(x, y, fromSuper ? "lg" : "sm");
        obs.destroy();
      }
    }

    onLaserHitEnemy(laser, enemy) {
      if (!laser.active || !enemy.active) return;
      this.recycleLaser(laser);
      this.damageEnemy(enemy, laser._dmg || 12, false);
    }

    damageEnemy(enemy, dmg, fromSuper, silent) {
      enemy._hp = (enemy._hp || 1) - dmg;
      this.spawnBurst(enemy.x, enemy.y, 0xff6688, fromSuper ? 18 : 6);
      if (enemy._hp <= 0) {
        const x = enemy.x;
        const y = enemy.y;
        this.addScore(enemy._score || SCORE.scout);
        this.kills += 1;
        if (!silent) SFX.explode();
        const size = enemy._doomstar || enemy._heavy ? "lg" : fromSuper ? "md" : "sm";
        this.spawnExplosion(x, y, size);
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
      // Only damage once per invuln window; use visual size so HD planets still hurt
      const dist = Phaser.Math.Distance.Between(player.x, player.y, obs.x, obs.y);
      const visualR = Math.max(obs.displayWidth || 0, obs.displayHeight || 0) * 0.32;
      const hitR = Math.max(obs._radius || 16, visualR) + 12;
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
      const tex = key || "enemy_laser";
      const bolt = this.enemyLasers.create(enemy.x + ox, enemy.y + oy, tex);
      if (!bolt) return null;
      if (this.textures.exists(tex) && bolt.texture?.key !== tex) {
        bolt.setTexture(tex);
      }
      bolt.setActive(true).setVisible(true);
      bolt.setDepth(3);
      bolt.clearTint();
      if (options.displayH && bolt.frame && bolt.frame.height) {
        // Absolute on-screen height (ignore prior scale / padding)
        const scale = options.displayH / bolt.frame.height;
        bolt.setScale(scale);
      } else {
        fitSprite(bolt, tex);
      }
      if (bolt.body) {
        const hit = Math.max(12, Math.min(26, (bolt.displayWidth + bolt.displayHeight) * 0.55));
        syncArcadeBody(bolt, null, null, hit);
        bolt.body.enable = true;
        bolt.body.reset(enemy.x + ox, enemy.y + oy);
      }
      bolt._dmg = dmg || 8;
      bolt._homing = !!options.homing;
      bolt._homingTurn = options.homingTurn || 0.05;
      bolt._speed = spd(speed * ENEMY_SHOT_SPEED_MULT);
      // heavy_shot / doomstar_shot art faces +X (same as dread_shot); lasers face +Y
      const tipRight = tex === "heavy_shot" || tex === "doomstar_shot";
      bolt._tipRight = tipRight;
      const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      // Slight inaccuracy so player can dodge (missiles lock tighter)
      const jitter = options.homing
        ? Phaser.Math.FloatBetween(-0.06, 0.06)
        : Phaser.Math.FloatBetween(-0.18, 0.18);
      const aim = angle + jitter;
      this.physics.velocityFromRotation(aim, bolt._speed, bolt.body.velocity);
      bolt.rotation = tipRight ? aim : aim + Math.PI / 2;
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
        this.physics.velocityFromRotation(next, bolt._speed || spd(180), bolt.body.velocity);
        bolt.rotation = bolt._tipRight ? next : next + Math.PI / 2;
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

      const gw = this.scale.width;
      const gh = this.scale.height;
      this.pauseLayer = this.add.container(0, 0).setDepth(100).setScrollFactor(0);
      const dim = this.add
        .rectangle(gw / 2, gh / 2, gw + 4, gh + 4, 0x000000, 0.65)
        .setScrollFactor(0);
      const title = this.add
        .text(gw / 2, Math.max(uiPx(100), gh * 0.26), "PAUSED", {
          fontFamily: "Courier New, monospace",
          fontSize: `${uiPx(40)}px`,
          color: "#7ec8ff",
        })
        .setOrigin(0.5)
        .setScrollFactor(0);

      this.pauseLayer.add([dim, title]);
      this.pauseButtons = new MenuButtonList(
        this,
        [
          { text: "RESUME", onClick: () => this.resumePlay() },
          {
            text: "RESTART",
            onClick: () => this.scene.restart({ mode: this.mode }),
          },
          {
            text: "MAIN MENU",
            onClick: () => {
              document.body.classList.add("menu-cursor");
              this.scene.start("Menu");
            },
          },
        ],
        {
          x: gw / 2,
          centerY: Math.min(gh - uiPx(160), gh * 0.55),
          depth: 101,
          scrollFactor: 0,
        }
      ).addTo(this.pauseLayer);
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

      const gw = this.scale.width;
      const gh = this.scale.height;
      this.gameOverLayer = this.add.container(0, 0).setDepth(110).setScrollFactor(0);
      const dim = this.add
        .rectangle(gw / 2, gh / 2, gw + 4, gh + 4, 0x000000, 0.78)
        .setScrollFactor(0);
      const title = this.add
        .text(gw / 2, Math.max(uiPx(80), gh * 0.2), "GAME OVER", {
          fontFamily: "Courier New, monospace",
          fontSize: `${uiPx(44)}px`,
          color: "#ff6688",
        })
        .setOrigin(0.5)
        .setScrollFactor(0);
      const stats = this.add
        .text(
          gw / 2,
          Math.max(uiPx(150), gh * 0.34),
          `SCORE ${finalScore}\nTIME ${sec}s\nBEST ${Math.floor(best)}${
            this.mode === "fight" ? `\nKILLS ${this.kills}` : `\nDIST ${formatDistance(this.distance)}`
          }`,
          {
            fontFamily: "Courier New, monospace",
            fontSize: `${uiPx(20)}px`,
            color: "#c8d4e8",
            align: "center",
          }
        )
        .setOrigin(0.5)
        .setScrollFactor(0);

      this.gameOverLayer.add([dim, title, stats]);
      this.gameOverButtons = new MenuButtonList(
        this,
        [
          {
            text: "RESTART",
            onClick: () => this.scene.restart({ mode: this.mode }),
          },
          { text: "MAIN MENU", onClick: () => this.scene.start("Menu") },
        ],
        {
          x: gw / 2,
          centerY: Math.min(gh - uiPx(120), gh * 0.68),
          depth: 111,
          scrollFactor: 0,
        }
      ).addTo(this.gameOverLayer);
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
        radius = key === "planet_s" ? 12 : 16;
        indestructible = true;
      } else {
        key = "planet_indestruct";
        speed = 50;
        hp = 99999;
        score = SCORE.planetHuge;
        touch = 28;
        radius = 18;
        indestructible = true;
      }

      const x = indestructible
        ? this.findClearPlanetX(radius, -40)
        : Phaser.Math.Between(Math.max(60, radius + 40), W - Math.max(60, radius + 40));
      const o = this.obstacles.create(x, -40, key);
      fitSprite(o, key);
      o.setVelocity(0, spd(speed));
      o.setDepth(2);
      o._hp = hp;
      o._score = score;
      o._touchDmg = touch;
      o._indestructible = indestructible;
      syncObstacleCircle(o, radius);
      if (indestructible) {
        // Slow axial spin, random direction
        const spin = Phaser.Math.Between(6, 18) * (Math.random() < 0.5 ? -1 : 1);
        o.setAngularVelocity(spin);
      } else {
        o.setAngularVelocity(Phaser.Math.Between(-40, 40));
      }

      // Pattern: occasional side-by-side pair with a gap (asteroids only)
      if (!indestructible && t > 25 && Math.random() < 0.25) {
        const x2 = Phaser.Math.Clamp(x + (Math.random() < 0.5 ? -160 : 160) * speedScale(), 40, W - 40);
        if (Math.abs(x2 - x) > 120 * speedScale()) {
          const o2 = this.obstacles.create(x2, -80, "asteroid_s");
          o2.setVelocity(0, spd(120));
          o2._hp = 20;
          o2._score = SCORE.smallAsteroid;
          o2._touchDmg = 12;
          fitSprite(o2, "asteroid_s");
          syncObstacleCircle(o2, 8);
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
      this.planetAcc = 2; // first planet a bit after start
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
        // Planets in fight too, but rarer than asteroids (~every 11–16s)
        planetInterval: Math.max(11.0, 16.0 - t * 0.02),
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

      const heavyKeys = ["enemy_heavy", "enemy_heavy_2", "enemy_heavy_3", "enemy_heavy_4"].filter((k) =>
        this.textures.exists(k)
      );
      const key =
        type === "scout"
          ? "enemy_scout"
          : type === "fighter"
            ? "enemy_fighter"
            : type === "doomstar"
              ? "enemy_doomstar"
              : heavyKeys[Phaser.Math.Between(0, heavyKeys.length - 1)] || "enemy_heavy";
      const e = this.enemies.create(x, y, key);
      fitSprite(e, key);
      e.setDepth(3);
      e._type = type;
      e._nextShot = this.time.now + Phaser.Math.Between(500, 1400);

      if (type === "scout") {
        e._hp = 25;
        e._score = SCORE.scout;
        e._speed = spd(140 * diff.moveScale);
        e._radius = 12;
        e._fireEvery = 1600 * diff.fireRateScale;
        e._shotSpeed = 210;
        e._shotDmg = 7;
        syncArcadeBody(e, null, null, Math.max(22, e.displayWidth * 0.55));
      } else if (type === "fighter") {
        e._hp = 55;
        e._score = SCORE.fighter;
        e._speed = spd(100 * diff.moveScale);
        e._radius = 14;
        e._fireEvery = 1200 * diff.fireRateScale;
        e._shotSpeed = 250;
        e._shotDmg = 10;
        syncArcadeBody(e, null, null, Math.max(26, e.displayWidth * 0.55));
      } else if (type === "doomstar") {
        // Doom Star Boss — largest sprite-map ship, dual forward cannons
        e._hp = 320;
        e._score = SCORE.doomstar;
        e._speed = spd(48 * diff.moveScale);
        e._radius = 42;
        e._fireEvery = 720 * diff.fireRateScale;
        e._shotSpeed = 230;
        e._shotDmg = 30; // serious boss hits (invuln eats multi-hits)
        e._missileDmg = 36;
        e._laserDmg = 16;
        e._doomstar = true;
        e._weaponMode = "cannons";
        e._weaponShotsLeft = Phaser.Math.Between(3, 5);
        syncArcadeBody(e, null, null, Math.max(64, e.displayWidth * 0.55));
        this.cameras.main.flash(100, 180, 40, 60);
        SFX.enemyLaser();
      } else {
        e._hp = 160;
        e._score = SCORE.heavy;
        e._speed = spd(65 * diff.moveScale);
        e._radius = 22;
        e._fireEvery = 1000 * diff.fireRateScale;
        e._shotSpeed = 190;
        e._shotDmg = 16;
        e._heavy = true;
        syncArcadeBody(e, null, null, Math.max(34, e.displayWidth * 0.55));
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
      const side = 28;
      const px = Math.cos(angle + Math.PI / 2) * side;
      const py = Math.sin(angle + Math.PI / 2) * side;
      const fwd = 36;
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
        const mdmg = enemy._missileDmg || 36;
        this.fireEnemyProjectile(
          enemy,
          155,
          "doomstar_missile",
          mdmg,
          guns.left.x,
          guns.left.y,
          { homing: true, homingTurn: 0.045, lifeMs: 3200, silent: true }
        );
        this.fireEnemyProjectile(
          enemy,
          155,
          "doomstar_missile",
          mdmg,
          guns.right.x,
          guns.right.y,
          { homing: true, homingTurn: 0.045, lifeMs: 3200, silent: true }
        );
        SFX.missile();
        return;
      }

      if (mode === "lasers") {
        // Twin cyan laser streams — faster, lighter hits
        const ldmg = enemy._laserDmg || 16;
        const mk = (ox, oy, silent) =>
          this.fireEnemyProjectile(enemy, 300, "doomstar_laser", ldmg, ox, oy, {
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
          vx += Math.cos(angle + Math.PI / 2) * Math.sin(this.time.now / 300) * spd(80);
          vy += Math.sin(angle + Math.PI / 2) * Math.sin(this.time.now / 300) * spd(80);
        } else if (e._type === "heavy" || e._type === "doomstar") {
          // Slow approach, keep distance (Doomstar hangs back farther)
          const dist = Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y);
          const keep = e._type === "doomstar" ? spd(220) : spd(180);
          if (dist < keep) {
            vx *= -0.35;
            vy *= -0.35;
          }
        }

        e.setVelocity(vx, vy);
        // Face player — Doomstar art points right (cannons on +X); others are tip-up
        e.setRotation(e._doomstar ? angle : angle + Math.PI / 2);

        if (this.time.now >= e._nextShot) {
          e._nextShot = this.time.now + e._fireEvery + Phaser.Math.Between(-150, 200);
          if (e._doomstar) {
            this.fireDoomstarVolley(e);
          } else if (e._heavy) {
            // Bright red plasma ball from sprite-map — same on-screen size as dread main gun
            this.fireEnemyProjectile(e, e._shotSpeed, "heavy_shot", e._shotDmg);
            this.time.delayedCall(120, () => {
              if (e.active) {
                this.fireEnemyProjectile(e, e._shotSpeed, "heavy_shot", e._shotDmg);
              }
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
      fitSprite(o, key);
      const speed = big ? 70 : 100;
      o.setVelocity(spd(Phaser.Math.Between(-30, 30)), spd(speed));
      o._hp = big ? 55 : 20;
      o._score = big ? SCORE.largeAsteroid : SCORE.smallAsteroid;
      o._touchDmg = big ? 18 : 12;
      syncObstacleCircle(o, big ? 18 : 8);
      o.setAngularVelocity(Phaser.Math.Between(-50, 50));
    }

    spawnFightPlanet() {
      const roll = Math.random();
      let key;
      let speed;
      let touch;
      let radius;
      let score;
      if (roll < 0.55) {
        key = "planet_s";
        speed = 55;
        touch = 22;
        radius = 12;
        score = SCORE.planetSmall;
      } else if (roll < 0.85) {
        key = "planet_l";
        speed = 45;
        touch = 26;
        radius = 16;
        score = SCORE.planetLarge;
      } else {
        key = "planet_indestruct";
        speed = 40;
        touch = 28;
        radius = 18;
        score = SCORE.planetHuge;
      }
      const x = this.findClearPlanetX(radius, -50);
      const o = this.obstacles.create(x, -50, key);
      fitSprite(o, key);
      o.setVelocity(spd(Phaser.Math.Between(-20, 20)), spd(speed));
      o.setDepth(2);
      o._hp = 99999;
      o._score = score;
      o._touchDmg = touch;
      o._indestructible = true;
      syncObstacleCircle(o, radius);
      const spin = Phaser.Math.Between(6, 18) * (Math.random() < 0.5 ? -1 : 1);
      o.setAngularVelocity(spin);
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

      this.planetAcc += dt;
      if (!this.magneticActive && this.planetAcc >= diff.planetInterval) {
        this.planetAcc = 0;
        this.spawnFightPlanet();
      }

      // Score only for destroying targets — no passive survival points
    }
  }

  /* -------------------- Boot game -------------------- */
  // Retina/HiDPI: render canvas sharper so HD stick/button art stays smooth when FIT-scaled
  const RENDER_DPR = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);

  const config = {
    type: Phaser.AUTO,
    parent: "game",
    width: W,
    height: H,
    backgroundColor: "#00000000",
    transparent: true,
    // Soft sprite-map art (not nearest-neighbor pixel crunch)
    pixelArt: false,
    antialias: true,
    roundPixels: false,
    resolution: RENDER_DPR,
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
      width: W,
      height: H,
      autoRound: false,
    },
    audio: {
      disableWebAudio: false,
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

  // Wait a frame so #game-wrap has real layout size (iframe / fullscreen)
  const bootGame = () => {
    syncViewportSize(null);
    config.width = W;
    config.height = H;
    config.scale.width = W;
    config.scale.height = H;
    const game = new Phaser.Game(config);
    window.__PSS_GAME = game;
    SFX.bind(game);
    const onWinResize = () => {
      syncViewportSize(game);
      if (game.scene.isActive("Flight") || game.scene.isActive("Fight")) {
        const play = game.scene.getScene(game.scene.isActive("Flight") ? "Flight" : "Fight");
        if (play && play.physics && play.physics.world) {
          play.cameras.main.setBounds(0, 0, W, H);
          play.cameras.main.setSize(W, H);
          if (typeof play.applyPlayfieldBounds === "function") {
            play.applyPlayfieldBounds();
          } else {
            play.physics.world.setBounds(0, 0, W, H);
          }
        }
      }
    };
    window.addEventListener("resize", onWinResize);
    window.addEventListener("orientationchange", () => setTimeout(onWinResize, 80));
  };

  if (document.readyState === "complete") {
    requestAnimationFrame(bootGame);
  } else {
    window.addEventListener("load", () => requestAnimationFrame(bootGame));
  }
})();
