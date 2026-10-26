/**
 * Pixel Fist Fighter — Phaser 3 (Arcade Physics)
 * Retro 1v1 pixel fighting game: player vs AI.
 */
(() => {
  "use strict";

  const W = 960;
  const H = 540;
  const GROUND_Y = 420;
  const ARENA_LEFT = 48;
  const ARENA_RIGHT = W - 48;
  const MAX_HP = 100;
  const ROUND_TIME = 99;
  const GRAVITY = 1400;
  const MOVE_SPEED = 220;
  const JUMP_V = -520;
  const COMBAT_JUMP_V = -620;
  const COMBAT_JUMP_X = 280;
  const INVULN_MS = 280;
  const ATTACK_COOLDOWN = 180;
  const HIT_STUN_MS = 200;
  const ATTACK_POSES = new Set(["punch", "punch2", "kick", "heavy", "jumpKick", "crouchKick"]);

  const ATTACKS = {
    punch: { dmg: 8, range: 220, hitFrom: 80, rangeX: 52, hitY: -28, hitW: 36, hitH: 28, knock: 140, high: true, low: false },
    punch2: { dmg: 10, time: 240, hitFrom: 90, rangeX: 56, hitY: -30, hitW: 40, hitH: 28, knock: 160, high: true, low: false },
    kick: { dmg: 14, time: 320, hitFrom: 120, rangeX: 62, hitY: -8, hitW: 44, hitH: 26, knock: 220, high: false, low: true },
    heavy: { dmg: 18, time: 420, hitFrom: 160, rangeX: 66, hitY: -24, hitW: 48, hitH: 36, knock: 300, high: true, low: false },
    jumpKick: { dmg: 12, time: 360, hitFrom: 100, rangeX: 58, hitY: -10, hitW: 44, hitH: 30, knock: 200, high: false, low: true },
    crouchKick: { dmg: 11, time: 300, hitFrom: 100, rangeX: 54, hitY: 10, hitW: 46, hitH: 24, knock: 180, high: false, low: true },
  };

  /* -------------------- Audio -------------------- */
  const SFX = {
    ctx: null,
    enabled: true,
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    },
    tone(freq, dur, type, gain) {
      if (!this.enabled) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || "square";
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime((gain ?? 0.08), t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    },
    ui() { this.tone(660, 0.05, "square", 0.04); },
    whoosh() { this.tone(180, 0.08, "triangle", 0.05); },
    hit() { this.tone(140, 0.1, "square", 0.09); this.tone(90, 0.14, "sawtooth", 0.05); },
    block() { this.tone(300, 0.07, "triangle", 0.06); },
    jump() { this.tone(320, 0.08, "square", 0.04); },
    land() { this.tone(120, 0.05, "triangle", 0.03); },
    win() {
      this.tone(440, 0.12, "square", 0.07);
      setTimeout(() => this.tone(554, 0.12, "square", 0.07), 120);
      setTimeout(() => this.tone(660, 0.2, "square", 0.08), 240);
    },
    lose() {
      this.tone(300, 0.15, "sawtooth", 0.06);
      setTimeout(() => this.tone(180, 0.25, "triangle", 0.07), 160);
    },
  };

  /* -------------------- Keys -------------------- */
  const Keys = {
    down: Object.create(null),
    pressed: Object.create(null),
    reset() {
      for (const k of Object.keys(this.down)) this.down[k] = false;
      for (const k of Object.keys(this.pressed)) this.pressed[k] = false;
    },
    is(code) {
      return !!this.down[code];
    },
    just(code) {
      return !!this.pressed[code];
    },
    endFrame() {
      for (const k of Object.keys(this.pressed)) this.pressed[k] = false;
    },
  };

  function bindGlobalInput() {
    window.addEventListener("keydown", (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!Keys.down[k]) Keys.pressed[k] = true;
      Keys.down[k] = true;
      if (e.code) {
        if (!Keys.down[e.code]) Keys.pressed[e.code] = true;
        Keys.down[e.code] = true;
      }
      if (e.key === " " || e.code === "Space") e.preventDefault();
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
    });
    window.addEventListener("keyup", (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      Keys.down[k] = false;
      if (e.code) Keys.down[e.code] = false;
    });
    window.addEventListener("blur", () => Keys.reset());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) Keys.reset();
    });
    window.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /* -------------------- Pixel fighter drawing -------------------- */
  const PAL = {
    p1: { skin: 0xffd7a8, hair: 0x2a1a10, shirt: 0x3ad0e8, pants: 0x1a4a8a, accent: 0xffee66, outline: 0x0a0a12 },
    p2: { skin: 0xffd0b0, hair: 0x1a0a08, shirt: 0xe84898, pants: 0x6a1848, accent: 0xff88cc, outline: 0x0a0a12 },
  };

  function drawFighterPose(g, palette, pose, facing, animT) {
    // Quantize idle/walk bob so we don't clear+redraw every frame
    const bobKey = pose === "idle" || pose === "walk" ? (animT * (pose === "walk" ? 12 : 6) | 0) : 0;
    const cacheKey = `${pose}|${facing}|${bobKey}`;
    if (g.__drawKey === cacheKey) return;
    g.__drawKey = cacheKey;

    g.clear();
    const s = 3;
    const ox = 24;
    const oy = 48;
    const flip = facing < 0 ? -1 : 1;
    const bob = pose === "idle" ? Math.sin(animT * 6) * 0.5 : 0;
    const walkSwing = pose === "walk" ? Math.sin(animT * 12) : 0;

    const px = (x, y, c, w = 1, h = 1) => {
      g.fillStyle(c, 1);
      const rx = ox + flip * x * s - (flip < 0 ? w * s : 0);
      g.fillRect(rx, oy + y * s + bob * s, w * s, h * s);
    };

    // shadow handled separately
    const crouch = pose === "crouch" || pose === "crouchKick" || pose === "blockCrouch";
    const yOff = crouch ? 4 : 0;

    // legs
    if (pose === "defeat") {
      px(-3, 10 + yOff, palette.pants, 3, 2);
      px(1, 11 + yOff, palette.pants, 3, 2);
    } else if (pose === "jump" || pose === "combatJump" || pose === "jumpKick") {
      px(-2, 6 + yOff, palette.pants, 2, 3);
      px(1, 5 + yOff, palette.pants, 2, 4);
    } else if (pose === "kick" || pose === "jumpKick") {
      px(-2, 8 + yOff, palette.pants, 2, 4);
      px(2, 7 + yOff, palette.pants, 5, 2);
      px(6, 6 + yOff, palette.accent, 2, 2);
    } else if (pose === "crouchKick") {
      px(-2, 10 + yOff, palette.pants, 2, 2);
      px(2, 10 + yOff, palette.pants, 5, 2);
      px(6, 9 + yOff, palette.accent, 2, 2);
    } else if (walkSwing) {
      px(-2 + walkSwing, 8 + yOff, palette.pants, 2, 4);
      px(1 - walkSwing, 8 + yOff, palette.pants, 2, 4);
    } else {
      px(-2, 8 + yOff, palette.pants, 2, crouch ? 2 : 4);
      px(1, 8 + yOff, palette.pants, 2, crouch ? 2 : 4);
    }

    // torso
    const torsoY = (crouch ? 4 : 2) + yOff;
    if (pose === "block" || pose === "blockCrouch") {
      px(-3, torsoY, palette.shirt, 6, 5);
      px(2, torsoY - 1, palette.skin, 2, 3);
      px(3, torsoY - 2, palette.accent, 2, 2);
    } else if (pose === "punch" || pose === "punch2") {
      px(-3, torsoY, palette.shirt, 5, 5);
      px(2, torsoY, palette.skin, 5, 2);
      px(6, torsoY, palette.accent, 2, 2);
    } else if (pose === "heavy") {
      px(-3, torsoY, palette.shirt, 5, 5);
      px(2, torsoY - 1, palette.skin, 6, 2);
      px(7, torsoY - 1, palette.accent, 2, 2);
    } else if (pose === "hit") {
      px(-4, torsoY, palette.shirt, 6, 5);
    } else if (pose === "victory") {
      px(-3, torsoY, palette.shirt, 6, 5);
      px(-1, torsoY - 6, palette.skin, 2, 5);
      px(-1, torsoY - 8, palette.accent, 2, 2);
    } else {
      px(-3, torsoY, palette.shirt, 6, 5);
    }

    // head
    const headY = (crouch ? 1 : -3) + yOff;
    px(-2, headY, palette.skin, 5, 4);
    px(-2, headY - 1, palette.hair, 5, 2);
    px(flip > 0 ? 2 : -2, headY + 1, 0x1a1020, 1, 1); // eye

    // outline hint belt
    px(-3, torsoY + 4, palette.accent, 6, 1);

    // hurt flash
    if (pose === "hit") {
      g.fillStyle(0xffffff, 0.25);
      g.fillRect(ox - 16, oy - 16, 40, 56);
    }
  }

  /* -------------------- Fighter controller -------------------- */
  function createFighter(scene, x, isPlayer) {
    const palette = isPlayer ? PAL.p1 : PAL.p2;
    const body = scene.add.graphics();
    body.setDepth(10);

    const shadow = scene.add.ellipse(x, GROUND_Y + 6, 36, 10, 0x000000, 0.35);
    shadow.setDepth(5);

    const phys = scene.physics.add.image(x, GROUND_Y - 28, "hitbox");
    phys.setVisible(false);
    phys.setCollideWorldBounds(true);
    phys.body.setSize(28, 56);
    phys.body.setOffset(2, 0);
    phys.setBounce(0);
    phys.setDragX(1200);
    phys.body.setMaxVelocity(400, 900);
    phys.body.setAllowGravity(true);

    return {
      isPlayer,
      name: isPlayer ? "PLAYER 1" : "PLAYER 2",
      palette,
      body,
      shadow,
      phys,
      hp: MAX_HP,
      facing: isPlayer ? 1 : -1,
      pose: "idle",
      poseTime: 0,
      animT: 0,
      onGround: true,
      crouching: false,
      blocking: false,
      attackId: null,
      attackHit: false,
      attackTimer: 0,
      attackCooldown: 0,
      comboStep: 0,
      comboTimer: 0,
      invulnUntil: 0,
      knockUntil: 0,
      wasCrouching: false,
      dead: false,
      won: false,
      ai: {
        thinkAt: 0,
        intent: "idle",
        intentUntil: 0,
        aggressiveness: 0.55,
      },
    };
  }

  function isAttacking(f) {
    return !!f.attackId;
  }

  function fighterBounds(f) {
    const crouch = f.crouching || f.pose === "crouch" || f.pose === "crouchKick" || f.pose === "blockCrouch";
    const h = crouch ? 36 : 56;
    const w = 28;
    const x = f.phys.x;
    const y = f.phys.y + (56 - h) / 2;
    return { x: x - w / 2, y: y - h / 2, w, h, cx: x, cy: y };
  }

  function attackHitbox(f) {
    const atk = ATTACKS[f.attackId];
    if (!atk || !f.attackId) return null;
    const elapsed = atk.time - f.attackTimer;
    if (elapsed < atk.hitFrom || elapsed > atk.time) return null;
    if (f.attackHit) return null;
    const dir = f.facing;
    const bx = f.phys.x + dir * atk.rangeX;
    const by = f.phys.y + atk.hitY;
    return { x: bx - atk.hitW / 2, y: by - atk.hitH / 2, w: atk.hitW, h: atk.hitH, atk };
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function setPose(f, pose) {
    if (f.pose === pose) return;
    f.pose = pose;
    f.poseTime = 0;
  }

  function canControl(f, phase) {
    return phase === "fight" && !f.dead && !f.won && f.pose !== "defeat" && f.pose !== "victory";
  }

  function startAttack(f, id) {
    if (f.attackCooldown > 0) return false;
    if (f.pose === "hit" || isAttacking(f)) return false;
    const atk = ATTACKS[id];
    if (!atk) return false;
    f.attackId = id;
    f.attackHit = false;
    f.attackTimer = atk.time;
    f.attackCooldown = ATTACK_COOLDOWN;
    setPose(f, id === "punch2" ? "punch2" : id);
    SFX.whoosh();
    return true;
  }

  function isBlockingNow(f) {
    return !!(
      f.blocking ||
      f.pose === "block" ||
      f.pose === "blockCrouch"
    );
  }

  function applyHit(scene, attacker, defender, atk) {
    const now = scene.time.now;
    if (defender.invulnUntil > now) return;
    if (defender.dead) return;

    // crouch dodges high attacks
    if (atk.high && !atk.low && defender.crouching && !isBlockingNow(defender)) {
      return;
    }
    // jump dodges low attacks
    if (atk.low && !atk.high && !defender.onGround) {
      return;
    }

    // Re-read block at hit time (RMB can be sticky via pointer events)
    if (defender.isPlayer && scene.mouseRight) {
      defender.blocking = true;
    }

    const blocked = isBlockingNow(defender);
    attacker.attackHit = true;
    defender.invulnUntil = now + INVULN_MS;

    if (blocked) {
      // Full block: zero damage
      SFX.block();
      defender.phys.setVelocityX(Phaser.Math.Clamp(attacker.facing * atk.knock * 0.15, -100, 100));
      spawnBlockSpark(scene, defender.phys.x - attacker.facing * 8, defender.phys.y - 8);
      if (defender.pose !== "block" && defender.pose !== "blockCrouch") {
        setPose(defender, defender.crouching ? "blockCrouch" : "block");
      }
      return;
    }

    SFX.hit();
    const dmg = atk.dmg;
    defender.hp = Math.max(0, defender.hp - dmg);
    defender.phys.setVelocityX(Phaser.Math.Clamp(attacker.facing * atk.knock, -280, 280));
    if (defender.onGround) defender.phys.setVelocityY(-60);
    defender.knockUntil = now + HIT_STUN_MS;
    setPose(defender, "hit");
    defender.attackId = null;
    defender.attackTimer = 0;
    defender.crouching = false;
    defender.blocking = false;
    spawnHitSpark(scene, defender.phys.x - attacker.facing * 10, defender.phys.y - 10);
    if (!scene._shakeAt || now - scene._shakeAt > 120) {
      scene._shakeAt = now;
      scene.cameras.main.shake(60, 0.003);
    }

    if (defender.hp <= 0) {
      defender.dead = true;
      setPose(defender, "defeat");
      defender.phys.setVelocity(0, 0);
    }
  }

  function spawnHitSpark(scene, x, y) {
    // Keep FX cheap — many tweens were freezing the fight after combos
    if ((scene._fx || 0) > 12) return;
    scene._fx = (scene._fx || 0) + 3;
    for (let i = 0; i < 3; i++) {
      const p = scene.add.rectangle(x, y, 3, 3, Phaser.Math.RND.pick([0xffee66, 0xff8844, 0xffffff]));
      p.setDepth(20);
      scene.tweens.add({
        targets: p,
        x: x + Phaser.Math.Between(-28, 28),
        y: y + Phaser.Math.Between(-28, 12),
        alpha: 0,
        duration: 160,
        onComplete: () => {
          p.destroy();
          scene._fx = Math.max(0, (scene._fx || 1) - 1);
        },
      });
    }
  }

  function spawnBlockSpark(scene, x, y) {
    if ((scene._fx || 0) > 12) return;
    scene._fx = (scene._fx || 0) + 2;
    for (let i = 0; i < 2; i++) {
      const p = scene.add.rectangle(x, y, 3, 3, 0x88ddff);
      p.setDepth(20);
      scene.tweens.add({
        targets: p,
        x: x + Phaser.Math.Between(-18, 18),
        y: y + Phaser.Math.Between(-18, 6),
        alpha: 0,
        duration: 140,
        onComplete: () => {
          p.destroy();
          scene._fx = Math.max(0, (scene._fx || 1) - 1);
        },
      });
    }
  }

  function updateFighterVisual(f, dt) {
    f.animT += dt;
    f.poseTime += dt * 1000;
    drawFighterPose(f.body, f.palette, f.pose, f.facing, f.animT);
    f.body.setPosition(f.phys.x - 24, f.phys.y - 48);
    f.shadow.setPosition(f.phys.x, GROUND_Y + 6);
    f.shadow.setScale(f.onGround ? 1 : 0.7, 1);
    f.shadow.setAlpha(f.onGround ? 0.35 : 0.2);
  }

  function faceOpponent(f, other) {
    if (f.dead || f.won) return;
    if (isAttacking(f) || f.pose === "hit") return;
    f.facing = other.phys.x >= f.phys.x ? 1 : -1;
  }

  function endAttack(f) {
    f.attackId = null;
    f.attackTimer = 0;
    if (f.dead) setPose(f, "defeat");
    else if (f.won) setPose(f, "victory");
    else if (!f.onGround) setPose(f, "jump");
    else if (f.crouching) setPose(f, "crouch");
    else if (f.blocking) setPose(f, "block");
    else setPose(f, "idle");
  }

  function tickAttack(f, dtMs) {
    if (f.attackId) {
      const step = Number.isFinite(dtMs) ? dtMs : 16;
      if (!Number.isFinite(f.attackTimer)) f.attackTimer = ATTACKS[f.attackId]?.time || 0;
      f.attackTimer -= step;
      if (f.attackTimer <= 0 || !ATTACKS[f.attackId]) {
        endAttack(f);
      }
      return;
    }
    // Safety: never stay locked in an attack pose without an active attack
    if (ATTACK_POSES.has(f.pose) && f.poseTime > 500) {
      setPose(f, f.onGround ? "idle" : "jump");
    }
  }

  function tickHitStun(f) {
    if (f.pose === "hit" && f.poseTime > HIT_STUN_MS) {
      if (f.dead) setPose(f, "defeat");
      else if (!f.onGround) setPose(f, "jump");
      else setPose(f, "idle");
    }
  }

  /* -------------------- Scenes -------------------- */
  class BootScene extends Phaser.Scene {
    constructor() {
      super("boot");
    }
    preload() {}
    create() {
      // invisible 1px texture for physics bodies
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 32, 56);
      g.generateTexture("hitbox", 32, 56);
      g.destroy();
      this.scene.start("menu");
    }
  }

  class MenuScene extends Phaser.Scene {
    constructor() {
      super("menu");
    }
    create() {
      SFX.ensure();
      this.cameras.main.setBackgroundColor("#0a0614");
      drawArenaBackdrop(this, true);

      const title = this.add.text(W / 2, 200, "PIXEL FIST FIGHTER", {
        fontFamily: "Courier New, monospace",
        fontSize: "42px",
        color: "#ff6ab0",
        stroke: "#1a0820",
        strokeThickness: 6,
      }).setOrigin(0.5).setDepth(50);

      this.add.text(W / 2, 248, "Phaser 3 · Retro Arcade Brawl", {
        fontFamily: "Courier New, monospace",
        fontSize: "16px",
        color: "#c8a0d8",
      }).setOrigin(0.5).setDepth(50);

      this.add.text(W / 2, 300, "W jump · B combat jump · A/D move · S crouch\nLMB attack (A+LMB heavy) · RMB / Shift block", {
        fontFamily: "Courier New, monospace",
        fontSize: "14px",
        color: "#e8d0f0",
        align: "center",
      }).setOrigin(0.5).setDepth(50);

      const btn = this.add.text(W / 2, 360, "▶  START GAME", {
        fontFamily: "Courier New, monospace",
        fontSize: "28px",
        color: "#0a0614",
        backgroundColor: "#3ad0e8",
        padding: { x: 24, y: 12 },
      }).setOrigin(0.5).setDepth(50).setInteractive({ useHandCursor: true });

      btn.on("pointerover", () => btn.setStyle({ backgroundColor: "#ff6ab0" }));
      btn.on("pointerout", () => btn.setStyle({ backgroundColor: "#3ad0e8" }));
      btn.on("pointerdown", () => {
        SFX.ui();
        this.scene.start("fight");
      });

      this.tweens.add({ targets: title, y: 208, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  }

  function drawArenaBackdrop(scene, menuOnly) {
    const bg = scene.add.graphics().setDepth(0);
    // sky
    bg.fillStyle(0x1a1040, 1);
    bg.fillRect(0, 0, W, H * 0.45);
    bg.fillStyle(0x2a1850, 1);
    bg.fillRect(0, H * 0.45, W, H * 0.55);

    // buildings
    const buildings = [
      [0, 220, 90, 200], [70, 180, 70, 240], [130, 250, 100, 170],
      [220, 200, 80, 220], [700, 190, 90, 230], [780, 230, 100, 190],
      [860, 170, 100, 250],
    ];
    for (const [x, y, w, h] of buildings) {
      bg.fillStyle(0x120820, 1);
      bg.fillRect(x, y, w, h);
      for (let wy = y + 12; wy < y + h - 20; wy += 18) {
        for (let wx = x + 8; wx < x + w - 10; wx += 14) {
          if (Math.random() > 0.45) {
            bg.fillStyle(Phaser.Math.RND.pick([0xffaa44, 0xff66aa, 0x66ccff]), 0.7);
            bg.fillRect(wx, wy, 6, 8);
          }
        }
      }
    }

    // neon signs
    bg.fillStyle(0xff3388, 1);
    bg.fillRect(100, 200, 48, 8);
    bg.fillStyle(0x33e0ff, 1);
    bg.fillRect(760, 210, 56, 8);

    // moon
    bg.fillStyle(0xf0e0c0, 1);
    bg.fillCircle(820, 80, 28);
    bg.fillStyle(0x1a1040, 1);
    bg.fillCircle(830, 74, 20);

    // ground platform
    bg.fillStyle(0x2a1848, 1);
    bg.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    bg.fillStyle(0xff4499, 1);
    bg.fillRect(0, GROUND_Y, W, 4);
    bg.fillStyle(0x3ad0e8, 1);
    bg.fillRect(0, GROUND_Y + 4, W, 2);

    // floor tiles
    bg.fillStyle(0x221038, 1);
    for (let x = 0; x < W; x += 32) {
      bg.fillRect(x, GROUND_Y + 16, 30, 4);
    }

    if (!menuOnly) {
      // animated neon flicker handled in fight update via sprites
      const neon = scene.add.rectangle(480, 160, 120, 10, 0xff66cc).setDepth(1);
      scene.tweens.add({
        targets: neon,
        alpha: 0.4,
        duration: 400,
        yoyo: true,
        repeat: -1,
      });
      scene.add.text(480, 148, "ALANAS ARCADE", {
        fontFamily: "Courier New, monospace",
        fontSize: "12px",
        color: "#1a0820",
      }).setOrigin(0.5).setDepth(2);
    }
  }

  class FightScene extends Phaser.Scene {
    constructor() {
      super("fight");
    }

    init() {
      this.phase = "countdown"; // countdown | fight | result
      this.timer = ROUND_TIME;
      this.timerAcc = 0;
      this.countdown = 2.2;
      this.overlayText = null;
      this.resultUi = [];
      this.mouseLeft = false;
      this.mouseRight = false;
      this.mouseLeftPressed = false;
      this._prevLeft = false;
      this._fx = 0;
      this._shakeAt = 0;
    }

    create() {
      SFX.ensure();
      Keys.reset();
      this.cameras.main.setBackgroundColor("#0a0614");
      drawArenaBackdrop(this, false);

      this.physics.world.gravity.y = GRAVITY;
      this.physics.world.setBounds(ARENA_LEFT - 16, 0, ARENA_RIGHT - ARENA_LEFT + 32, H);

      this.ground = this.add.rectangle(W / 2, GROUND_Y + 40, W, 80, 0x000000, 0);
      this.physics.add.existing(this.ground, true);

      this.p1 = createFighter(this, 220, true);
      this.p2 = createFighter(this, 740, false);
      this.physics.add.collider(this.p1.phys, this.ground);
      this.physics.add.collider(this.p2.phys, this.ground);

      this.createHud();
      this.bindPointer();

      this.banner = this.add.text(W / 2, H / 2 - 20, "READY?", {
        fontFamily: "Courier New, monospace",
        fontSize: "48px",
        color: "#ffee66",
        stroke: "#1a0820",
        strokeThickness: 8,
      }).setOrigin(0.5).setDepth(100).setScrollFactor(0);

      this.input.keyboard?.addCapture([]);
    }

    bindPointer() {
      // LMB attack = click edge; RMB block = sticky hold (Phaser rightButtonDown is unreliable)
      this.input.on("pointerdown", (p) => {
        if (p.button === 0) this.mouseLeftPressed = true;
        if (p.button === 2 || p.rightButtonDown()) this.mouseRight = true;
      });
      this.input.on("pointerup", (p) => {
        if (p.button === 2) this.mouseRight = false;
        if (!p.buttons || p.buttons === 0) this.mouseRight = false;
      });
      this.input.on("pointerupoutside", () => {
        this.mouseRight = false;
        this.mouseLeft = false;
      });
      this.game.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
      this.game.canvas.addEventListener("mousedown", (e) => {
        if (e.button === 2) this.mouseRight = true;
      });
      this.game.canvas.addEventListener("mouseup", (e) => {
        if (e.button === 2) this.mouseRight = false;
      });
      window.addEventListener("mouseup", (e) => {
        if (e.button === 2) this.mouseRight = false;
      });
    }

    syncPointer() {
      const p = this.input.activePointer;
      this.mouseLeft = !!(p && p.leftButtonDown());
      // Keep sticky RMB; also accept live bitmask if browser reports it
      if (p && ((p.buttons & 2) === 2 || p.rightButtonDown())) {
        this.mouseRight = true;
      }
    }

    createHud() {
      const style = { fontFamily: "Courier New, monospace", fontSize: "14px", color: "#f0e8ff" };
      const fix = (o) => o.setScrollFactor(0).setDepth(90);
      this.hud = {
        p1Name: fix(this.add.text(40, 16, "PLAYER 1", style)),
        p2Name: fix(this.add.text(W - 40, 16, "PLAYER 2", style).setOrigin(1, 0)),
        p1BarBg: fix(this.add.rectangle(40, 40, 300, 18, 0x2a1838).setOrigin(0, 0.5).setStrokeStyle(2, 0xff6ab0)),
        p2BarBg: fix(this.add.rectangle(W - 40, 40, 300, 18, 0x2a1838).setOrigin(1, 0.5).setStrokeStyle(2, 0x3ad0e8)),
        p1Bar: fix(this.add.rectangle(42, 40, 296, 14, 0x3ad0e8).setOrigin(0, 0.5)).setDepth(91),
        p2Bar: fix(this.add.rectangle(W - 42, 40, 296, 14, 0xff6ab0).setOrigin(1, 0.5)).setDepth(91),
        timer: fix(this.add.text(W / 2, 28, "99", {
          fontFamily: "Courier New, monospace",
          fontSize: "36px",
          color: "#ffee66",
          stroke: "#1a0820",
          strokeThickness: 4,
        }).setOrigin(0.5)).setDepth(92),
      };
    }

    updateHud() {
      const p1w = 296 * (this.p1.hp / MAX_HP);
      const p2w = 296 * (this.p2.hp / MAX_HP);
      this.hud.p1Bar.width = Math.max(0, p1w);
      this.hud.p2Bar.width = Math.max(0, p2w);
      this.hud.timer.setText(String(Math.max(0, Math.ceil(this.timer))));
    }

    rematch() {
      SFX.ui();
      // full reset without stacking game loops — restart scene once
      this.scene.restart();
    }

    endFight(winnerName) {
      if (this.phase === "result") return;
      this.phase = "result";
      Keys.reset();
      this.mouseLeft = false;
      this.mouseRight = false;

      const p1Win = winnerName === this.p1.name;
      if (p1Win) {
        this.p1.won = true;
        setPose(this.p1, "victory");
        setPose(this.p2, "defeat");
        this.p2.dead = true;
        SFX.win();
      } else {
        this.p2.won = true;
        setPose(this.p2, "victory");
        setPose(this.p1, "defeat");
        this.p1.dead = true;
        SFX.lose();
      }
      this.p1.phys.setVelocity(0, 0);
      this.p2.phys.setVelocity(0, 0);

      const msg = this.add.text(W / 2, H / 2 - 40, `${winnerName} WINS!`, {
        fontFamily: "Courier New, monospace",
        fontSize: "40px",
        color: "#ffee66",
        stroke: "#1a0820",
        strokeThickness: 8,
      }).setOrigin(0.5).setDepth(100).setScrollFactor(0);

      const btn = this.add.text(W / 2, H / 2 + 40, "REMATCH", {
        fontFamily: "Courier New, monospace",
        fontSize: "24px",
        color: "#0a0614",
        backgroundColor: "#3ad0e8",
        padding: { x: 20, y: 10 },
      }).setOrigin(0.5).setDepth(100).setScrollFactor(0).setInteractive({ useHandCursor: true });

      btn.on("pointerover", () => btn.setStyle({ backgroundColor: "#ff6ab0" }));
      btn.on("pointerout", () => btn.setStyle({ backgroundColor: "#3ad0e8" }));
      btn.on("pointerdown", () => this.rematch());

      this.resultUi = [msg, btn];
    }

    update(time, delta) {
      const dtMs = Math.min(delta, 50);
      const dt = dtMs / 1000;
      this.syncPointer();

      if (this.phase === "countdown") {
        this.countdown -= dt;
        if (this.countdown > 0.9) this.banner.setText("READY? FIGHT!");
        else if (this.countdown > 0) this.banner.setText("FIGHT!");
        else {
          this.banner.setText("");
          this.banner.setVisible(false);
          this.phase = "fight";
        }
        this.updateFightersPhysics(dt, false);
        this.updateHud();
        Keys.endFrame();
        return;
      }

      if (this.phase === "result") {
        this.updateFightersPhysics(dt, false);
        this.updateHud();
        Keys.endFrame();
        return;
      }

      // fight phase
      this.timerAcc += dt;
      if (this.timerAcc >= 1) {
        this.timerAcc -= 1;
        this.timer = Math.max(0, this.timer - 1);
      }

      this.handlePlayerInput(dtMs);
      this.mouseLeftPressed = false;
      this.updateAI(dt, time);
      this.updateFightersPhysics(dt, true);
      this.resolveCombat();
      this.updateCamera();
      this.updateHud();

      Keys.endFrame();

      if (this.p1.hp <= 0) this.endFight(this.p2.name);
      else if (this.p2.hp <= 0) this.endFight(this.p1.name);
      else if (this.timer <= 0) {
        if (this.p1.hp >= this.p2.hp) this.endFight(this.p1.name);
        else this.endFight(this.p2.name);
      }
    }

    handlePlayerInput(dtMs) {
      const f = this.p1;
      const other = this.p2;
      tickAttack(f, dtMs);
      tickHitStun(f);

      if (!canControl(f, this.phase)) return;

      const stunned = f.pose === "hit" || f.knockUntil > this.time.now;
      faceOpponent(f, other);
      const toward = f.facing;
      const away = -f.facing;

      // Block while holding RMB (or Shift). Allowed on ground; not during your own attack.
      const wantBlock = this.mouseRight || Keys.is("Shift") || Keys.is("ShiftLeft") || Keys.is("ShiftRight");
      f.blocking = wantBlock && f.onGround && !isAttacking(f) && !stunned;
      f.crouching = Keys.is("s") && f.onGround && !isAttacking(f) && !f.blocking && !stunned;

      if (stunned) return;

      // movement A/D relative to opponent
      let vx = 0;
      if (!isAttacking(f) && !f.blocking) {
        if (Keys.is("d")) vx += toward * MOVE_SPEED;
        if (Keys.is("a")) vx += away * MOVE_SPEED;
        if (f.crouching) vx *= 0.35;
      }
      if (!isAttacking(f)) {
        f.phys.setVelocityX(vx);
      }

      // jumps — W normal, B combat jump (independent; Space never jumps)
      if (f.onGround && !isAttacking(f) && !f.blocking && !f.crouching && f.phys.body.blocked.down) {
        if (Keys.just("w")) {
          f.phys.setVelocityY(JUMP_V);
          f.onGround = false;
          setPose(f, "jump");
          SFX.jump();
        } else if (Keys.just("b")) {
          f.phys.setVelocityY(COMBAT_JUMP_V);
          f.phys.setVelocityX(toward * COMBAT_JUMP_X);
          f.onGround = false;
          setPose(f, "combatJump");
          SFX.jump();
        }
      }

      // attacks: combo punch → punch2 → kick; heavy = LMB while holding A
      if (this.mouseLeftPressed && !f.blocking) {
        if (!f.onGround) {
          startAttack(f, "jumpKick");
        } else if (f.crouching) {
          startAttack(f, "crouchKick");
        } else if (Keys.is("a") && !Keys.is("d")) {
          if (startAttack(f, "heavy")) {
            f.comboStep = 0;
            f.comboTimer = 0;
          }
        } else {
          if (f.comboTimer <= 0) f.comboStep = 0;
          if (f.comboStep === 0) {
            if (startAttack(f, "punch")) {
              f.comboStep = 1;
              f.comboTimer = 520;
            }
          } else if (f.comboStep === 1) {
            if (startAttack(f, "punch2")) {
              f.comboStep = 2;
              f.comboTimer = 520;
            }
          } else if (startAttack(f, "kick")) {
            f.comboStep = 0;
            f.comboTimer = 0;
          }
        }
      }

      // pose from state — always re-check isAttacking() (stale flag was wiping punch → idle)
      if (!isAttacking(f) && f.pose !== "hit") {
        if (!f.onGround) {
          if (f.pose !== "combatJump" && f.pose !== "jump") setPose(f, "jump");
        } else if (f.blocking) setPose(f, f.crouching ? "blockCrouch" : "block");
        else if (f.crouching) setPose(f, "crouch");
        else if (Math.abs(vx) > 10) setPose(f, "walk");
        else setPose(f, "idle");
      }

      if (f.comboTimer > 0) f.comboTimer -= dtMs;
      if (f.attackCooldown > 0) f.attackCooldown = Math.max(0, f.attackCooldown - dtMs);
    }

    updateAI(dt, time) {
      const f = this.p2;
      const other = this.p1;
      const dtMs = dt * 1000;
      tickAttack(f, dtMs);
      tickHitStun(f);
      if (f.attackCooldown > 0) f.attackCooldown -= dtMs;

      if (!canControl(f, this.phase)) return;
      if (f.pose === "hit" || f.knockUntil > time) return;

      faceOpponent(f, other);

      const dist = other.phys.x - f.phys.x;
      const ad = Math.abs(dist);
      const toward = f.facing;
      const lowHp = f.hp < 30;
      if (time >= f.ai.thinkAt) {
        f.ai.thinkAt = time + Phaser.Math.Between(220, 480);
        const roll = Math.random();
        if (lowHp && roll < 0.35) f.ai.intent = "retreat";
        else if (ad > 140) f.ai.intent = "approach";
        else if (ad < 70 && roll < 0.25) f.ai.intent = "retreat";
        else if (other.attackId && roll < 0.45) f.ai.intent = "block";
        else if (other.attackId && roll < 0.65) f.ai.intent = "crouch";
        else if (roll < 0.12) f.ai.intent = "jump";
        else if (ad < 90) f.ai.intent = "attack";
        else f.ai.intent = "approach";

        if (Math.random() < 0.12) f.ai.intent = "idle";
      }

      f.blocking = f.ai.intent === "block" && f.onGround && !isAttacking(f);
      f.crouching = (f.ai.intent === "crouch") && f.onGround && !isAttacking(f);

      let vx = 0;
      if (!isAttacking(f) && !f.blocking) {
        if (f.ai.intent === "approach") vx = toward * MOVE_SPEED * 0.85;
        if (f.ai.intent === "retreat") vx = -toward * MOVE_SPEED * 0.8;
        if (f.crouching) vx *= 0.3;
        f.phys.setVelocityX(vx);
      }

      if (f.onGround && !isAttacking(f) && !f.blocking && f.ai.intent === "jump" && f.phys.body.blocked.down) {
        if (Math.random() < 0.5) {
          f.phys.setVelocityY(JUMP_V);
          setPose(f, "jump");
        } else {
          f.phys.setVelocityY(COMBAT_JUMP_V);
          f.phys.setVelocityX(toward * COMBAT_JUMP_X * 0.8);
          setPose(f, "combatJump");
        }
        f.onGround = false;
        f.ai.intent = "idle";
        SFX.jump();
      }

      if (f.ai.intent === "attack" && ad < 100 && !isAttacking(f) && f.attackCooldown <= 0) {
        const r = Math.random();
        if (!f.onGround) startAttack(f, "jumpKick");
        else if (f.crouching) startAttack(f, "crouchKick");
        else if (r < 0.35) startAttack(f, "punch");
        else if (r < 0.55) startAttack(f, "punch2");
        else if (r < 0.8) startAttack(f, "kick");
        else startAttack(f, "heavy");
        f.ai.intent = "idle";
      }

      if (!isAttacking(f) && f.pose !== "hit") {
        if (!f.onGround) {
          if (f.pose !== "combatJump" && f.pose !== "jump") setPose(f, "jump");
        } else if (f.blocking) setPose(f, "block");
        else if (f.crouching) setPose(f, "crouch");
        else if (Math.abs(vx) > 10) setPose(f, "walk");
        else setPose(f, "idle");
      }
    }

    updateFightersPhysics(dt, live) {
      for (const f of [this.p1, this.p2]) {
        const wasGround = f.onGround;
        f.onGround = !!f.phys.body.blocked.down || f.phys.body.touching.down;
        if (f.onGround && f.phys.body.velocity.y > 0) {
          f.phys.setVelocityY(0);
        }
        if (f.onGround && !wasGround && live) SFX.land();

        f.phys.x = Phaser.Math.Clamp(f.phys.x, ARENA_LEFT, ARENA_RIGHT);

        // Resize crouch body only when state changes (avoids getting stuck in floor)
        if (f.crouching !== f.wasCrouching) {
          f.wasCrouching = f.crouching;
          if (f.crouching) {
            f.phys.body.setSize(28, 36);
            f.phys.body.setOffset(2, 20);
          } else {
            f.phys.body.setSize(28, 56);
            f.phys.body.setOffset(2, 0);
            if (f.onGround) f.phys.y = GROUND_Y - 28;
          }
        }

        updateFighterVisual(f, dt);
      }

      const dx = this.p2.phys.x - this.p1.phys.x;
      if (Math.abs(dx) < 34 && this.p1.onGround && this.p2.onGround) {
        const push = (34 - Math.abs(dx)) / 2;
        const s = Math.sign(dx || 1);
        this.p1.phys.x -= s * push;
        this.p2.phys.x += s * push;
      }
    }

    resolveCombat() {
      if (this.phase !== "fight") return;
      for (const [attacker, defender] of [[this.p1, this.p2], [this.p2, this.p1]]) {
        const hb = attackHitbox(attacker);
        if (!hb) continue;
        const db = fighterBounds(defender);
        if (rectsOverlap(hb, db)) {
          applyHit(this, attacker, defender, hb.atk);
        }
      }
    }

    updateCamera() {
      const midX = (this.p1.phys.x + this.p2.phys.x) / 2;
      const dist = Math.abs(this.p2.phys.x - this.p1.phys.x);
      const zoom = Phaser.Math.Clamp(1.05 - dist / 2200, 0.92, 1.05);
      const cam = this.cameras.main;
      const targetX = Phaser.Math.Clamp(midX - W / 2, -40, 40);
      cam.setScroll(Phaser.Math.Linear(cam.scrollX, targetX, 0.08), 0);
      cam.setZoom(Phaser.Math.Linear(cam.zoom, zoom, 0.05));
    }
  }

  /* -------------------- Boot -------------------- */
  bindGlobalInput();

  const config = {
    type: Phaser.AUTO,
    parent: "game",
    width: W,
    height: H,
    backgroundColor: "#0a0614",
    pixelArt: true,
    antialias: false,
    physics: {
      default: "arcade",
      arcade: {
        gravity: { y: GRAVITY },
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, MenuScene, FightScene],
  };

  // Replace any previous instance (hot reload / remount must not keep a frozen game)
  if (window.__pixelFistFighter) {
    try {
      window.__pixelFistFighter.destroy(true);
    } catch (_) {
      /* ignore */
    }
    window.__pixelFistFighter = null;
  }
  window.__pixelFistFighter = new Phaser.Game(config);
})();
