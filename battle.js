/* ═══════════════════════════════════════════════════════════════
   VINCI APPRAISER — Action RPG Battle Engine
   Real-time canvas combat: WASD move, click/space attack,
   enemies charge & shoot, card equip system powers you up.
   ═══════════════════════════════════════════════════════════════ */

/* ── Constants ──────────────────────────────────────────────────── */
const TILE   = 48;
const FPS    = 60;

/* ── Sprite System ──────────────────────────────────────────────── */
const SPRITE_BASE = "assets/sprite_main/";
const SPRITE_DEFS = {
  idle:    ["FinalFightStance.png", "FightStance.png"],
  run:     ["Run1.png","Run2.png","Run3.png","Run4.png","Run5.png","Run6.png"],
  attack:  ["Punch1.png","Punch2.png"],
  card:    ["CardRaise.png","CardPunch1.png"],
  victory: ["VictoryTaunt1.png","VictoryTaunt2.png","VictoryTaunt3.png"],
  dead:    ["Death1.png","Death2.png","Death3.png","Death4.png","Death5.png","Death6.png"],
};

// Preload all sprites at boot
const _sprites = {};
let _spritesReady = false;

function preloadSprites() {
  let loaded = 0;
  const total = Object.values(SPRITE_DEFS).flat().length;
  for (const [anim, files] of Object.entries(SPRITE_DEFS)) {
    _sprites[anim] = [];
    files.forEach((file) => {
      const img = new Image();
      img.src = SPRITE_BASE + file;
      img.onload = () => { loaded++; if (loaded >= total) _spritesReady = true; };
      img.onerror = () => { loaded++; if (loaded >= total) _spritesReady = true; console.warn("Sprite failed:", file); };
      _sprites[anim].push(img);
    });
  }
}

// Call immediately so sprites load while page is visible
preloadSprites();

/* ── Enemy Sprite System ────────────────────────────────────────── */
// Each enemy type gets its own sprite set mapped by ID
const ENEMY_SPRITE_DEFS = {
  // id:0 — Counterfeit Dealer
  0: {
    base: "assets/sprite_dealer/",
    idle:   ["Dealer_FightIdleStart.png", "Dealer_FightIdleEnd.png"],
    run:    ["Dealer_Run1.png","Dealer_Run2.png","Dealer_Run3.png","Dealer_Run4.png","Dealer_Run5.png","Dealer_Run6.png"],
    attack: ["Dealer_Fight1.png","Dealer_Fight2.png","Dealer_Fight3.png","Dealer_Fight4.png"],
    dead:   ["Dealer_Dead1.png","Dealer_Dead2.png","Dealer_Dead3.png","Dealer_Dead4.png"],
    hit:    ["Dealer_Shock.png"],
  },
  // id:1 — Vault Rat
  1: {
    base: "assets/sprite_rat/",
    idle:   ["Rat_idle.png"],
    run:    ["Rat_Run1.png","Rat_Run2.png","Rat_Run3.png","Rat_Run4.png","Rat_Run5.png","Rat_Run6.png","Rat_Run7.png","Rat_Run8.png"],
    attack: ["Rat_Fight1.png","Rat_Fight2.png","Rat_Fight3.png","Rat_Fight4.png","Rat_FightEnd.png"],
    dead:   ["Rat_Death1.png","Rat_Death2.png","Rat_Death3.png","Rat_Death4.png"],
    hit:    ["Rat_Shock.png"],
  },
  // id:2 — Oracle Hacker
  2: {
    base: "assets/sprite_hacker/",
    idle:   ["Hacker_idle.png"],
    run:    ["Hacker_Run1.png","Hacker_Run2.png","Hacker_Run3.png","Hacker_Run4.png","Hacker_Run5.png","Hacker_Run6.png","Hacker_Run7.png"],
    attack: ["Hacker_Fight1.png","Hacker_Fight2.png","Hacker_Fight3.png","Hacker_Fight4.png","Hacker_FightEnd.png"],
    dead:   ["Hacker_Death1.png","Hacker_Death2.png","Hacker_Death3.png","Hacker_Death4.png"],
    hit:    ["Hacker_Shock.png"],
  },
  // id:3 — Shadow Broker (boss)
  3: {
    base: "assets/sprite_broker/",
    idle:   ["Broker_idle.png"],
    run:    ["Broker_Run1.png","Broker_Run2.png","Broker_Run3.png","Broker_Run4.png","Broker_Run5.png","Broker_Run6.png","Broker_Run7.png","Broker_Run8.png"],
    attack: ["Broker_Fight1.png","Broker_Fight2.png","Broker_Fight3.png","Broker_Fight4.png","Broker_Fight5.png"],
    dead:   ["Broker_Death1.png","Broker_Death2.png","Broker_Death3.png"],
    hit:    ["Broker_Shock.png"],
  },
  // id:4 — Slab Forger
  4: {
    base: "assets/sprite_forger/",
    idle:   ["Forger_idle.png"],
    run:    ["Forger_Run1.png","Forger_Run2.png","Forger_Run3.png","Forger_Run4.png","Forger_Run5.png","Forger_Run6.png","Forger_Run7.png","Forger_Run8.png"],
    attack: ["Forger_Fight1.png","Forger_Fight2.png","Forger_Fight3.png","Forger_Fight4.png","Forger_FightEnd.png"],
    dead:   ["Forger_Death1.png","Forger_Death2.png","Forger_Death3.png","Forger_Death4.png"],
    hit:    ["Forger_Shock.png"],
  },
};

// Preload all enemy sprites — stored as _enemySpritesByType[enemyId][animState] = [Image, ...]
const _enemySpritesByType = {};

(function preloadAllEnemySprites() {
  for (const [id, defs] of Object.entries(ENEMY_SPRITE_DEFS)) {
    _enemySpritesByType[id] = {};
    for (const [anim, files] of Object.entries(defs)) {
      if (anim === "base") continue;
      _enemySpritesByType[id][anim] = [];
      files.forEach(file => {
        const img = new Image();
        img.src = defs.base + file;
        _enemySpritesByType[id][anim].push(img);
      });
    }
  }
})();

/* ── Arena Background ───────────────────────────────────────────── */
// GIF is displayed via CSS background on .battle-arena-wrap (so it animates)
// Canvas is transparent — drawn on top of the GIF

/* ── Arena Geometry — horizontal strip fighting ─────────────────── */
// Characters fight in the center of the arena — limited to the dirt circle area
const ARENA = {
  floorY: 0.78,   // bottom of the fighting area
  ceilY:  0.58,   // top limit — characters can't go above this (stays in arena center)
  leftX:  0.20,   // left bound — keeps characters in the central dirt area
  rightX: 0.80,   // right bound
};

/* ── Enemy templates ────────────────────────────────────────────── */
const ENEMY_TYPES = [
  { id:0, name:"Counterfeit Dealer", emoji:"🕵️", col:"#c96868",
    hp:90,  atk:8,  spd:3.5, reward:120, size:36,
    pattern:"chase", shootRate:0, desc:"Peddles fake slabs." },
  { id:1, name:"Vault Rat",          emoji:"🐀", col:"#a0a020",
    hp:55,  atk:12, spd:5.0, reward:80,  size:28,
    pattern:"zigzag", shootRate:0, desc:"Steals vault signatures." },
  { id:2, name:"Oracle Hacker",      emoji:"💻", col:"#20b8d0",
    hp:120, atk:6,  spd:2.8, reward:160, size:40,
    pattern:"strafe", shootRate:80, desc:"Spoofs FMV oracle feeds." },
  { id:3, name:"Shadow Broker",      emoji:"🦹", col:"#8b008b",
    hp:240, atk:14, spd:3.8, reward:250, size:44,
    pattern:"boss",   shootRate:45,  desc:"Runs laundering rings." },
  { id:4, name:"Slab Forger",        emoji:"🖨️", col:"#b8860b",
    hp:150, atk:10, spd:3.0, reward:180, size:42,
    pattern:"chase",  shootRate:70,  desc:"Prints counterfeit slabs." },
];

/* ── Wave config ────────────────────────────────────────────────── */
// Positions within the arena bounds (leftX:0.20 - rightX:0.80, ceilY:0.58 - floorY:0.78)
const WAVES = [
  [{t:0, fx:0.70, fy:0.68}],
  [{t:1, fx:0.65, fy:0.62},{t:1, fx:0.75, fy:0.72}],
  [{t:2, fx:0.72, fy:0.66}],
  [{t:0, fx:0.60, fy:0.64},{t:1, fx:0.78, fy:0.70}],
  [{t:4, fx:0.70, fy:0.67}],
  [{t:3, fx:0.68, fy:0.66}],
];

/* ── Wave scaling: enemies get stronger each run ─────────────────── */
// scaleFactor grows with each wave beyond the base 6, and also between runs
let waveRunCount = 0;  // incremented by app.js on each new battle start

function getWaveScale(globalWaveIndex) {
  // Every wave past the first applies a cumulative multiplier
  const tier = Math.floor(globalWaveIndex / WAVES.length); // how many full loops
  const waveInLoop = globalWaveIndex % WAVES.length;
  // Base scale + per-loop escalation + per-run escalation
  const scale = 1 + tier * 0.35 + waveRunCount * 0.2 + waveInLoop * 0.08;
  return Math.min(scale, 4.0); // cap at 4x to keep it playable
}

/* ── Equip slots — filled by app.js card purchases ─────────────── */
let equippedCards = [];   // array of card objects (max 3)

/* ── Battle state ───────────────────────────────────────────────── */
let BS = null;   // the live battle state object
let RAF = null;  // requestAnimationFrame handle
let globalWaveIndex = 0; // persists across runs for escalating difficulty

function freshBS(bonuses) {
  return {
    phase: "fighting",   // fighting | wave-clear | won | dead
    wave: 0,
    gold: 0,
    bonuses,
    player: {
      x: 140, y: 0,  // y will be set to arena floor at start
      vx: 0, vy: 0,
      hp: 50 + bonuses.hp, maxHp: 50 + bonuses.hp,
      atk: 8 + bonuses.atk,
      def: 1  + bonuses.def,
      speed: 7.5,
      attackCd: 0, attackCdMax: 22,
      invincible: 0,
      facing: 1,
      anim: 0,
      slashAnim: 0,
      card: equippedCards[0] || null,
      cardCd: 0, cardCdMax: 280,
      // RPG additions
      xp: 0, level: 1, xpToNext: 50,
      critChance: 0.12,
      dodgeCd: 0, dodgeCdMax: 40,
      isDodging: 0,
      comboCount: 0, comboTimer: 0,
      // Kill streak
      killStreak: 0, killStreakTimer: 0,
      // Sprite animation
      spriteAnim: "idle", spriteFrame: 0, spriteTimer: 0,
    },
    enemies: [],
    bullets:  [],
    pSlash:   [],
    sparks:   [],
    dmgNums:  [],
    goldDrops: [],
    floatTexts: [],  // persistent floating UI text (combo/streak)
    keys: {},
    log: [],
    tick: 0,
    waveClearTimer: 0,
    waveIncoming: 0, // countdown before next wave spawns
    onVictory: null,
  };
}

/* ── Logging ────────────────────────────────────────────────────── */
function bLog(msg) {
  if (!BS) return;
  BS.log.unshift(msg);
  if (BS.log.length > 6) BS.log.pop();
}

/* ── Spawn a wave ───────────────────────────────────────────────── */
function spawnWave(wi) {
  BS.wave = wi;
  BS.enemies = [];
  const canvas = $("battle-canvas");
  const W = canvas ? canvas.width  : 800;
  const H = canvas ? canvas.height : 500;

  // Global wave index for persistent difficulty
  const gwi = globalWaveIndex;
  const scale = getWaveScale(gwi);
  const tier  = Math.floor(gwi / WAVES.length);

  let spawnDefs;

  // If we have a floor, use its enemy list for every wave
  if (BS.floor && BS.floor.enemies) {
    spawnDefs = BS.floor.enemies.map((t, i) => ({
      t,
      fx: 0.55 + i * 0.12,
      fy: 0.62 + (i % 2) * 0.1,
    }));
    // Add extra enemy on later waves within the floor
    if (wi >= 2) {
      const extraType = BS.floor.enemies[Math.floor(Math.random() * BS.floor.enemies.length)];
      spawnDefs.push({ t: extraType, fx: 0.80, fy: 0.68 });
    }
    if (wi >= 4) {
      const extraType = BS.floor.enemies[Math.floor(Math.random() * BS.floor.enemies.length)];
      spawnDefs.push({ t: extraType, fx: 0.35, fy: 0.65 });
    }
  } else {
    const defs = WAVES[wi % WAVES.length];
    spawnDefs = [...defs];
    // On tier 2+ add an extra enemy of a random type
    if (tier >= 1) {
      spawnDefs.push({ t: Math.floor(Math.random() * 3), fx: 0.78, fy: 0.35 });
    }
    if (tier >= 2) {
      spawnDefs.push({ t: Math.min(4, Math.floor(Math.random() * 5)), fx: 0.90, fy: 0.55 });
    }
  }

  // Use floor scaleMult if available, otherwise use wave-based scale
  const floorScale = (BS.floor && BS.floor.scaleMult) ? BS.floor.scaleMult : scale;

  spawnDefs.forEach(d => {
    const tmpl = ENEMY_TYPES[d.t];
    const scaledHp  = Math.round(tmpl.hp  * floorScale);
    const scaledAtk = Math.round(tmpl.atk * (1 + (floorScale - 1) * 0.6));
    const scaledSpd = Math.min(tmpl.spd * (1 + (floorScale - 1) * 0.3), tmpl.spd * 2);
    const scaledReward = Math.round(tmpl.reward * floorScale);
    const fasterShoot = tmpl.shootRate > 0
      ? Math.max(30, Math.round(tmpl.shootRate / (1 + (floorScale - 1) * 0.4)))
      : 0;

    BS.enemies.push({
      ...tmpl,
      hp: scaledHp, maxHp: scaledHp,
      atk: scaledAtk,
      spd: scaledSpd,
      reward: scaledReward,
      shootRate: fasterShoot,
      x: d.fx * W,
      y: d.fy * H,
      vx: 0, vy: 0,
      shootTimer: Math.floor(Math.random() * (fasterShoot || 120)),
      anim: 0,
      hitFlash: 0,
      dead: false,
    });
  });

  const tierLabel = tier > 0 ? ` [TIER ${tier + 1}]` : "";
  bLog(`⚡ Wave ${wi+1}${tierLabel}: ${spawnDefs.map(d=>ENEMY_TYPES[d.t].name).join(", ")}!`);
  if (scale > 1) {
    bLog(`⚠️ Enemies are ${Math.round((scale-1)*100)}% stronger!`);
  }
}

/* ── Input ──────────────────────────────────────────────────────── */
function attachInput(canvas) {
  const down = e => { BS.keys[e.key] = true; };
  const up   = e => { BS.keys[e.key] = false; };
  const atk  = e => {
    // Prevent space/enter from activating focused buttons during battle
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
    }
    if (!BS || BS.phase !== "fighting") {
      // Wave-clear: space/enter advances to next wave
      if (BS && BS.phase === "wave-clear" && (e.key === " " || e.key === "Enter")) {
        BS._nextWaveTriggered = true;
      }
      return;
    }
    if (e.key === " " || e.key === "z" || e.key === "Z") doPlayerAttack();
    if ((e.key === "e" || e.key === "E") && BS.player.cardCd === 0) doCardAbility();
    // Dodge roll on Shift
    if (e.key === "Shift") doDodgeRoll();
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keydown", atk);
  window.addEventListener("keyup",  up);

  canvas.addEventListener("click", e => {
    if (!BS) return;
    // Wave-clear: click advances
    if (BS.phase === "wave-clear") {
      BS._nextWaveTriggered = true;
      return;
    }
    if (BS.phase !== "fighting") return;
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (canvas.width / r.width);
    const my = (e.clientY - r.top)  * (canvas.height / r.height);
    BS.player.facing = mx > BS.player.x ? 1 : -1;
    doPlayerAttack();
  });

  BS._removeInput = () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keydown", atk);
    window.removeEventListener("keyup", up);
  };
}

/* ── Dodge Roll ─────────────────────────────────────────────────── */
function doDodgeRoll() {
  const pl = BS.player;
  if (pl.dodgeCd > 0 || pl.isDodging > 0) return;
  pl.isDodging = 12;
  pl.dodgeCd = pl.dodgeCdMax;
  pl.invincible = Math.max(pl.invincible, 14);
  // Burst in movement direction or facing direction
  let dirX = 0, dirY = 0;
  if (BS.keys["a"]||BS.keys["A"]||BS.keys["ArrowLeft"]) dirX = -1;
  if (BS.keys["d"]||BS.keys["D"]||BS.keys["ArrowRight"]) dirX = 1;
  if (BS.keys["w"]||BS.keys["W"]||BS.keys["ArrowUp"]) dirY = -1;
  if (BS.keys["s"]||BS.keys["S"]||BS.keys["ArrowDown"]) dirY = 1;
  if (dirX === 0 && dirY === 0) dirX = pl.facing;
  const len = Math.sqrt(dirX*dirX + dirY*dirY) || 1;
  pl.vx = (dirX/len) * 14;
  pl.vy = (dirY/len) * 14;
  spawnSparks(pl.x, pl.y + 10, "rgba(176,141,87,0.7)", 6);
  bLog(">> Dodge!");
}

/* ── XP & Level Up ──────────────────────────────────────────────── */
function grantXP(amount) {
  const pl = BS.player;
  pl.xp += amount;
  while (pl.xp >= pl.xpToNext) {
    pl.xp -= pl.xpToNext;
    pl.level++;
    pl.xpToNext = Math.round(pl.xpToNext * 1.5);
    // Level up bonuses
    pl.maxHp += 8;
    pl.hp = Math.min(pl.maxHp, pl.hp + 15);
    pl.atk += 2;
    pl.def += 1;
    pl.critChance = Math.min(0.4, pl.critChance + 0.02);
    BS.dmgNums.push({ x: pl.x, y: pl.y - 40, v: -1.8, val: `LVL ${pl.level}!`, t: 45, col: "#f0b840" });
    spawnSparks(pl.x, pl.y, "#f0b840", 20);
    bLog(`++ LEVEL UP! Now Lv.${pl.level} (ATK +2, DEF +1, HP +8)`);
  }
}

/* ── Player attack ──────────────────────────────────────────────── */
function doPlayerAttack() {
  const pl = BS.player;
  if (pl.attackCd > 0) return;
  pl.attackCd = pl.attackCdMax;
  pl.slashAnim = 10;

  // Dash attack — attacking during a dodge gives bonus damage + range
  const isDashAttack = pl.isDodging > 0;
  const dashBonus = isDashAttack ? 1.5 : 1;

  // Combo system — faster attacks if chaining within window
  if (pl.comboTimer > 0) {
    pl.comboCount = Math.min(pl.comboCount + 1, 5);
  } else {
    pl.comboCount = 1;
  }
  pl.comboTimer = 40;

  const slashW = (70 + pl.comboCount * 4) * (isDashAttack ? 1.3 : 1);
  const slashH = (50 + pl.comboCount * 3) * (isDashAttack ? 1.2 : 1);
  const sx = pl.x + pl.facing * (isDashAttack ? 35 : 20);
  const sy = pl.y;

  let hitCount = 0;
  BS.enemies.forEach(en => {
    if (en.dead) return;
    if (Math.abs(en.x - sx) < slashW && Math.abs(en.y - sy) < slashH) {
      // Crit check — dash attacks have higher crit chance
      const critBoost = isDashAttack ? 0.2 : 0;
      const isCrit = Math.random() < pl.critChance + pl.comboCount * 0.03 + critBoost;
      const critMult = isCrit ? 1.8 : 1;
      const baseDmg = pl.atk + randInt(-2, 3) + pl.comboCount * 2;
      const dmg = Math.max(1, Math.round((baseDmg - Math.floor(en.def||0)) * critMult * dashBonus));
      en.hp -= dmg;
      hitCount++;

      const dmgCol = isCrit ? "#f0b840" : isDashAttack ? "#90d0ff" : "#fff";
      const dmgText = isCrit ? `${dmg}!` : dmg;
      spawnSparks(en.x, en.y, isCrit ? "#f0b840" : en.col, isCrit ? 12 : 8);
      BS.dmgNums.push({ x: en.x + randInt(-6,6), y: en.y-16, v: -1.8, val: dmgText, t: 30, col: dmgCol });
      if (isCrit) bLog(`CRIT! ${en.name} takes ${dmg}!`);
      else if (isDashAttack) bLog(`DASH ATK! ${en.name} -${dmg}`);
      en.hitFlash = isCrit ? 12 : 8;
      if (en.hp <= 0) killEnemy(en);
    }
  });

  // Slash particle
  BS.pSlash.push({ x: sx, y: sy, facing: pl.facing, t: 10 + pl.comboCount * 2, combo: pl.comboCount, dash: isDashAttack });
}

/* ── Card special ability ───────────────────────────────────────── */
function doCardAbility() {
  const pl = BS.player;
  const card = pl.card;
  if (!card || pl.cardCd > 0) return;
  pl.cardCd = pl.cardCdMax;

  // Area slam: hits all enemies for big damage
  const dmgBase = Math.round(pl.atk * 2.5);
  BS.enemies.forEach(en => {
    if (en.dead) return;
    const dmg = Math.max(1, dmgBase - Math.floor(en.def||0));
    en.hp -= dmg;
    spawnSparks(en.x, en.y, "#f0b840");
    BS.dmgNums.push({ x: en.x, y: en.y-20, v: -1.8, val: dmg, t: 30, col:"#f0b840" });
    en.hitFlash = 12;
    if (en.hp <= 0) killEnemy(en);
  });
  // Heal player
  const heal = Math.round(card.grade * 4);
  pl.hp = Math.min(pl.maxHp, pl.hp + heal);
  BS.dmgNums.push({ x: pl.x, y: pl.y-26, v: -1.8, val: `+${heal}`, t: 30, col:"#78c69a" });
  bLog(`✨ Card ability: ${card.name}! Slam + heal ${heal}HP`);
}

/* ── Enemy death ────────────────────────────────────────────────── */
function killEnemy(en) {
  en.dead = true;
  en.hp = 0;
  en.deathTimer = 60; // show death animation for 60 frames before removing
  en.spriteState = "dead";
  en.spriteFrame = 0;
  en.spriteTimer = 0;

  const pl = BS.player;

  // Kill streak
  if (pl.killStreakTimer > 0) {
    pl.killStreak++;
  } else {
    pl.killStreak = 1;
  }
  pl.killStreakTimer = 180;

  // Gold with streak multiplier
  const streakMult = 1 + (pl.killStreak - 1) * 0.25;
  const goldAmt = Math.round(en.reward * streakMult);
  BS.goldDrops.push({ x: en.x, y: en.y, gold: goldAmt, t: 300, bobT: 0 });

  // Streak notification (just log it, don't clutter the screen)
  if (pl.killStreak >= 3) {
    bLog(`${pl.killStreak}x streak! Gold x${streakMult.toFixed(1)}`);
  }

  // Potion drop
  const potionChance = 0.12 + pl.killStreak * 0.03;
  if (Math.random() < potionChance) {
    BS.goldDrops.push({ x: en.x + randInt(-20,20), y: en.y, gold: 0, t: 400, bobT: Math.random()*6, isPotion: true, healAmt: 15 + pl.level * 3 });
  }

  // XP
  const xpGain = Math.round(5 + en.maxHp * 0.1 + pl.killStreak);
  grantXP(xpGain);

  bLog(`-- ${en.name} defeated! (+${xpGain} XP)`);
  spawnSparks(en.x, en.y, en.col, 16);
  _screenShake = 4;
}

/* ── Sparks ─────────────────────────────────────────────────────── */
function spawnSparks(x, y, col, n=8) {
  for (let i=0; i<n; i++) {
    BS.sparks.push({
      x, y,
      vx: randInt(-4,4)*0.7,
      vy: randInt(-5,1)*0.7,
      t: randInt(15,30),
      col,
    });
  }
}

/* ── Physics update ─────────────────────────────────────────────── */
function update(canvas) {
  if (!BS || BS.phase !== "fighting") {
    if (BS && BS.phase === "wave-clear") {
      if (BS._nextWaveTriggered) {
        BS._nextWaveTriggered = false;
        const next = BS.wave + 1;
        globalWaveIndex++;
        if (next >= WAVES.length) {
          BS.phase = "won";
          bLog(`All waves cleared! ${BS.gold}G earned.`);
          setTimeout(() => BS.onVictory && BS.onVictory(BS.gold), 800);
        } else {
          spawnWave(next);
          BS.phase = "fighting";
        }
      }
      return;
    }
    // Dead phase — let it fall through so death anim timer runs below
    if (BS && BS.phase === "dead") {
      // Run death anim timer
      const pl = BS.player;
      if (BS._deathAnimTimer > 0) {
        BS._deathAnimTimer--;
        pl.spriteTimer++;
        if (pl.spriteTimer >= 12) {
          pl.spriteTimer = 0;
          const frames = _sprites.dead || [];
          if (frames.length > 0) pl.spriteFrame = Math.min(pl.spriteFrame + 1, frames.length - 1);
        }
        if (BS._deathAnimTimer === 0) {
          showBattleResult(false, BS.gold);
        }
      }
    }
    return;
  }

  BS.tick++;
  const pl = BS.player;
  const W = canvas.width, H = canvas.height;
  const groundY = H * ARENA.floorY;
  const ceilY   = H * ARENA.ceilY;
  const leftX   = W * ARENA.leftX;
  const rightX  = W * ARENA.rightX;

  // Set player Y to floor on first tick
  if (BS.tick === 1) { pl.y = groundY - 10; }

  // ── Player movement — primarily horizontal, slight vertical ──
  let dx = 0, dy = 0;
  if (BS.keys["ArrowLeft"]  || BS.keys["a"] || BS.keys["A"]) { dx -= 1; pl.facing = -1; }
  if (BS.keys["ArrowRight"] || BS.keys["d"] || BS.keys["D"]) { dx += 1; pl.facing =  1; }
  if (BS.keys["ArrowUp"]    || BS.keys["w"] || BS.keys["W"]) dy -= 1;
  if (BS.keys["ArrowDown"]  || BS.keys["s"] || BS.keys["S"]) dy += 1;
  // Vertical movement is dampened — mostly horizontal fighting
  if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }
  dy *= 0.4; // restrict vertical movement heavily

  // Apply dodge burst velocity
  if (pl.isDodging > 0) {
    pl.x += pl.vx;
    pl.y += pl.vy * 0.3; // dodge is mostly horizontal
    pl.vx *= 0.85;
    pl.vy *= 0.85;
    pl.isDodging--;
  } else {
    pl.x += dx * pl.speed;
    pl.y += dy * pl.speed;
  }

  pl.x = Math.max(leftX, Math.min(rightX, pl.x));
  pl.y = Math.max(ceilY, Math.min(groundY, pl.y));

  pl.anim = (pl.anim + (dx||dy ? 0.18 : 0)) % (Math.PI*2);
  if (pl.attackCd > 0)  pl.attackCd--;
  if (pl.slashAnim > 0) pl.slashAnim--;
  if (pl.invincible > 0) pl.invincible--;
  if (pl.cardCd > 0)    pl.cardCd--;
  if (pl.dodgeCd > 0)   pl.dodgeCd--;
  if (pl.comboTimer > 0) { pl.comboTimer--; } else { pl.comboCount = 0; }
  if (pl.killStreakTimer > 0) { pl.killStreakTimer--; } else { pl.killStreak = 0; }

  // ── Gold pickups & potions — walk over to collect ──
  BS.goldDrops = BS.goldDrops.filter(g => {
    g.t--;
    g.bobT += 0.1;
    if (g.t <= 0) return false; // despawn
    const gdx = pl.x - g.x, gdy = pl.y - g.y;
    if (gdx*gdx + gdy*gdy < 36*36) {
      if (g.isPotion) {
        const heal = g.healAmt || 20;
        pl.hp = Math.min(pl.maxHp, pl.hp + heal);
        BS.dmgNums.push({ x: g.x, y: g.y - 10, v: -2.0, val: `+${heal}`, t: 25, col: "#78c69a" });
        spawnSparks(g.x, g.y, "#78c69a", 4);
      } else {
        BS.gold += g.gold;
        BS.dmgNums.push({ x: g.x, y: g.y - 10, v: -2.0, val: `+${g.gold}G`, t: 25, col: "#f0b840" });
        spawnSparks(g.x, g.y, "#f0b840", 3);
      }
      return false;
    }
    // Magnetic pull when close
    if (gdx*gdx + gdy*gdy < 80*80) {
      g.x += gdx * 0.06;
      g.y += gdy * 0.06;
    }
    return true;
  });

  // ── Enemy AI ──
  BS.enemies.forEach(en => {
    if (en.dead) return;
    if (en.hitFlash > 0) en.hitFlash--;
    en.anim += 0.12;

    const edx = pl.x - en.x, edy = pl.y - en.y;
    const dist = Math.sqrt(edx*edx + edy*edy) || 1;

    if (en.pattern === "chase" || en.pattern === "boss") {
      en.vx += (edx/dist) * en.spd * 0.12;
      en.vy += (edy/dist) * en.spd * 0.12;
    } else if (en.pattern === "strafe") {
      // Strafe sideways while maintaining distance
      const perp = { x: -edy/dist, y: edx/dist };
      const dir  = Math.sin(BS.tick * 0.03) > 0 ? 1 : -1;
      en.vx += perp.x * dir * en.spd * 0.1 + (edx/dist) * 0.02;
      en.vy += perp.y * dir * en.spd * 0.1 + (edy/dist) * 0.02;
    } else if (en.pattern === "zigzag") {
      en.vx += (edx/dist) * en.spd * 0.15;
      en.vy += Math.sin(BS.tick * 0.15 + en.y) * en.spd * 0.2;
    }

    // Drag
    en.vx *= 0.88; en.vy *= 0.88;
    const maxSpd = en.spd * 1.6;
    const spd2 = Math.sqrt(en.vx*en.vx + en.vy*en.vy);
    if (spd2 > maxSpd) { en.vx *= maxSpd/spd2; en.vy *= maxSpd/spd2; }

    en.x = Math.max(W * ARENA.leftX + en.size, Math.min(W * ARENA.rightX - en.size, en.x + en.vx));
    en.y = Math.max(H * ARENA.ceilY + en.size*0.3, Math.min(H * ARENA.floorY, en.y + en.vy));

    // Melee contact — dodge makes you immune
    if (pl.invincible === 0 && pl.isDodging === 0 && dist < en.size + 20) {
      const dmg = Math.max(1, en.atk - pl.def + randInt(-2,2));
      pl.hp -= dmg;
      pl.invincible = 50;
      _screenShake = Math.min(8, dmg * 0.6);
      spawnSparks(pl.x, pl.y, "#c96868", 6);
      BS.dmgNums.push({ x: pl.x, y: pl.y-24, v: -1.8, val: `-${dmg}`, t: 30, col:"#f06060" });
      bLog(`-- ${en.name} hits for ${dmg}!`);
    }

    // Ranged shoot with warning
    if (en.shootRate > 0) {
      en.shootTimer++;
      // Warning flash 20 frames before firing
      if (en.shootTimer >= en.shootRate - 20 && en.shootTimer < en.shootRate) {
        en.isCharging = true;
      }
      if (en.shootTimer >= en.shootRate) {
        en.shootTimer = 0;
        en.isCharging = false;
        const spd = en.pattern==="boss" ? 3.5 : 2.5;
        BS.bullets.push({ x:en.x, y:en.y, vx:(edx/dist)*spd, vy:(edy/dist)*spd, col:en.col, t:120 });
      }
    }
  });

  // ── Bullets ──
  BS.bullets = BS.bullets.filter(b => {
    b.x += b.vx; b.y += b.vy; b.t--;
    if (b.t <= 0) return false;
    if (pl.invincible === 0) {
      const dx2 = pl.x-b.x, dy2 = pl.y-b.y;
      if (dx2*dx2+dy2*dy2 < 22*22) {
        const dmg = Math.max(1, 6 - pl.def + randInt(-1,2));
        pl.hp -= dmg;
        pl.invincible = 40;
        _screenShake = Math.min(5, dmg * 0.5);
        spawnSparks(pl.x, pl.y, "#c96868", 5);
        BS.dmgNums.push({ x: pl.x, y: pl.y-24, v: -1.8, val: `-${dmg}`, t: 25, col:"#f06060" });
        return false;
      }
    }
    return true;
  });

  // ── Sparks ──
  BS.sparks = BS.sparks.filter(s => { s.x+=s.vx; s.y+=s.vy; s.vy+=0.15; s.t--; return s.t>0; });

  // ── Damage numbers ──
  BS.dmgNums = BS.dmgNums.filter(d => { d.y+=d.v; d.t--; return d.t>0; });

  // ── Slash anim particles ──
  BS.pSlash = BS.pSlash.filter(p => { p.t--; return p.t>0; });

  // ── Death check ──
  if (pl.hp <= 0) {
    pl.hp = 0;
    BS.phase = "dead";
    pl.spriteAnim = "dead";
    pl.spriteFrame = 0;
    pl.spriteTimer = 0;
    BS._deathAnimTimer = 90;
    _screenShake = 8;
    bLog("You were defeated...");
    return;
  }

  // ── Update death timers on dead enemies ──
  BS.enemies.forEach(en => {
    if (en.dead && en.deathTimer > 0) {
      en.deathTimer--;
      en.spriteTimer++;
      if (en.spriteTimer >= 12) {
        en.spriteTimer = 0;
        const typeSprites = _enemySpritesByType[en.id] || _enemySpritesByType[0];
        const frames = typeSprites.dead || [];
        if (frames.length > 0) en.spriteFrame = Math.min(en.spriteFrame + 1, frames.length - 1);
      }
    }
  });

  // ── Wave clear check — all enemies dead AND death animations finished ──
  const allDead = BS.enemies.every(e => e.dead);
  const allAnimsDone = BS.enemies.every(e => !e.dead || e.deathTimer <= 0);
  if (allDead && allAnimsDone && BS.phase === "fighting") {
    BS.phase = "wave-clear";
    BS.waveClearTimer = -1; // -1 means waiting for player input
    bLog(`-- Wave ${BS.wave+1} cleared!`);
    pl.hp = Math.min(pl.maxHp, pl.hp + Math.round(pl.maxHp * 0.25));
    pl.killStreak = 0;
    pl.killStreakTimer = 0;
  }
}

/* ── Render ─────────────────────────────────────────────────────── */
let _screenShake = 0;

function render(ctx, canvas) {
  const W = canvas.width, H = canvas.height;

  if (!BS) return;
  const pl = BS.player;

  // Apply screen shake
  ctx.save();
  if (_screenShake > 0) {
    const shakeX = randInt(-_screenShake, _screenShake);
    const shakeY = randInt(-_screenShake, _screenShake);
    ctx.translate(shakeX, shakeY);
    _screenShake = Math.max(0, _screenShake - 0.8);
  }

  // ── Clear canvas (transparent — GIF shows through from CSS background) ──
  ctx.clearRect(0, 0, W, H);

  // ── Bullets — pixel squares instead of circles ──
  BS.bullets.forEach(b => {
    ctx.save();
    ctx.shadowColor = b.col; ctx.shadowBlur = 8;
    ctx.fillStyle = b.col;
    ctx.fillRect(b.x - 4, b.y - 4, 8, 8);
    // trail pixels
    ctx.globalAlpha = 0.4;
    ctx.fillRect(b.x - b.vx*2 - 3, b.y - b.vy*2 - 3, 6, 6);
    ctx.globalAlpha = 0.2;
    ctx.fillRect(b.x - b.vx*4 - 2, b.y - b.vy*4 - 2, 4, 4);
    ctx.restore();
  });

  // ── Slash particles — pixel arc slashes ──
  BS.pSlash.forEach(p => {
    const progress = 1 - p.t / (10 + (p.combo||1) * 2);
    const radius = 20 + progress * (30 + (p.combo||1) * 6);
    const alpha = p.t / (10 + (p.combo||1) * 2);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = (p.combo||0) >= 3 ? "#f0b840" : "#f0e080";
    ctx.lineWidth = 2 + (p.combo||0);
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 10 + (p.combo||0) * 4;
    // Draw pixel slash marks
    const cx = p.x, cy = p.y;
    for (let i = 0; i < 3 + (p.combo||0); i++) {
      const angle = (p.facing > 0 ? -0.6 : 2.5) + i * 0.3 + progress * 0.5;
      const r1 = radius - 8, r2 = radius + 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle)*r1, cy + Math.sin(angle)*r1);
      ctx.lineTo(cx + Math.cos(angle)*r2, cy + Math.sin(angle)*r2);
      ctx.stroke();
    }
    ctx.restore();
  });

  // ── Enemies — sprite rendering ──
  BS.enemies.forEach(en => {
    // Skip fully removed enemies (death anim done)
    if (en.dead && en.deathTimer <= 0) return;
    ctx.save();
    const spriteH = Math.round(en.size * 2.2 * (W / 800));
    const bob = en.dead ? 0 : Math.sin(en.anim) * 2;
    const ex = Math.round(en.x), ey = Math.round(en.y + bob);

    // Death fade out
    if (en.dead) {
      ctx.globalAlpha = Math.max(0, en.deathTimer / 60);
    }

    // Determine enemy sprite state
    if (!en.spriteFrame) en.spriteFrame = 0;
    if (!en.spriteTimer) en.spriteTimer = 0;
    if (!en.spriteState) en.spriteState = "idle";

    // Dead enemies stay on death frame
    if (!en.dead) {
      let targetState = "idle";
      const moving = Math.abs(en.vx) > 0.3 || Math.abs(en.vy) > 0.3;
      if (en.hitFlash > 0) targetState = "hit";
      else if (en.isCharging) targetState = "attack";
      else if (moving) targetState = "run";

      if (targetState !== en.spriteState) {
        en.spriteState = targetState;
        en.spriteFrame = 0;
        en.spriteTimer = 0;
      }
      en.spriteTimer++;
      const spd = targetState === "run" ? 6 : targetState === "attack" ? 5 : 20;
      if (en.spriteTimer >= spd) {
        en.spriteTimer = 0;
        const typeSprites = _enemySpritesByType[en.id] || _enemySpritesByType[0];
        const frames = typeSprites[targetState] || typeSprites.idle;
        if (frames) en.spriteFrame = (en.spriteFrame + 1) % frames.length;
      }
    }

    // Get sprite image for this enemy type
    const typeSprites = _enemySpritesByType[en.id] || _enemySpritesByType[0];
    const frames = typeSprites[en.spriteState] || typeSprites.idle || [];
    const sprImg = frames[en.spriteFrame % (frames.length || 1)];
    const sprW = sprImg && sprImg.naturalWidth
      ? Math.round(spriteH * (sprImg.naturalWidth / sprImg.naturalHeight))
      : spriteH;

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(ex - sprW*0.3, ey + spriteH*0.15, sprW*0.6, 4);

    // Glow effects
    if (en.hitFlash > 0) { ctx.shadowColor = "#fff"; ctx.shadowBlur = 16; }
    else if (en.isCharging) { ctx.shadowColor = "#ff4040"; ctx.shadowBlur = 10 + Math.sin(BS.tick*0.5)*4; }
    else { ctx.shadowColor = en.col; ctx.shadowBlur = 4; }

    // Face the player
    const faceDir = pl.x < en.x ? -1 : 1;
    ctx.translate(ex, ey - spriteH * 0.3);
    ctx.scale(faceDir, 1);

    // Draw sprite or fallback
    if (sprImg && sprImg.complete && sprImg.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprImg, -sprW/2, -spriteH/2, sprW, spriteH);
    } else {
      // Pixel fallback
      ctx.fillStyle = en.col;
      ctx.fillRect(-spriteH*0.2, -spriteH*0.3, spriteH*0.4, spriteH*0.6);
    }
    ctx.restore();

    // HP bar above enemy (skip for dead)
    if (!en.dead) {
      const bw = sprW * 0.9;
      const bh = Math.max(4, Math.round(W/200));
      const bx = ex - bw/2;
      const by = ey - spriteH*0.6;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(bx-1, by-1, bw+2, bh+2);
      const hpPct = Math.max(0, en.hp/en.maxHp);
      const hpCol = hpPct > 0.5 ? "#78c69a" : hpPct > 0.25 ? "#f0b840" : "#c96868";
      ctx.fillStyle = hpCol;
      ctx.fillRect(bx, by, bw * hpPct, bh);
    }

    // Enemy name (skip for dead)
    if (!en.dead) {
      ctx.save();
      ctx.font = `${Math.max(7, Math.round(W*0.009))}px "Press Start 2P", monospace`;
      ctx.fillStyle = "rgba(239,230,216,0.35)";
      ctx.textAlign = "center";
      ctx.fillText(en.name.split(" ")[0], ex, ey - spriteH*0.65);
      ctx.restore();
    }
  });

  // ── Player — sprite-based rendering ──
  ctx.save();
  const bob = Math.sin(pl.anim * 2) * 2;
  const px = Math.round(pl.x), py = Math.round(pl.y + bob);
  const ps = Math.round(20 * (W / 700)); // pixel sprite half-size

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(px - ps*0.8, py + ps*0.9, ps*1.6, ps*0.3);

  // Invincibility flash
  if (pl.invincible > 0 && Math.floor(pl.invincible/4)%2) ctx.globalAlpha = 0.35;

  // Dodge roll stretch
  const dodgeStretch = pl.isDodging > 0 ? 1.3 : 1;
  const dodgeSqueeze = pl.isDodging > 0 ? 0.7 : 1;

  // Determine animation state
  const isMoving = BS.keys["ArrowLeft"]||BS.keys["ArrowRight"]||BS.keys["ArrowUp"]||BS.keys["ArrowDown"]
                 ||BS.keys["a"]||BS.keys["d"]||BS.keys["w"]||BS.keys["s"]
                 ||BS.keys["A"]||BS.keys["D"]||BS.keys["W"]||BS.keys["S"];

  let targetAnim = "idle";
  if (BS.phase === "dead") targetAnim = "dead";
  else if (BS.phase === "wave-clear") targetAnim = "victory";
  else if (pl.slashAnim > 0) targetAnim = "attack";
  else if (pl.cardCd > 0 && pl.cardCd > pl.cardCdMax - 30) targetAnim = "card";
  else if (isMoving || pl.isDodging > 0) targetAnim = "run";
  else targetAnim = "idle";

  // Advance frame timer (skip if dead — death anim is driven by update loop)
  if (targetAnim !== "dead") {
    if (targetAnim !== pl.spriteAnim) {
      pl.spriteAnim = targetAnim;
      pl.spriteFrame = 0;
      pl.spriteTimer = 0;
    }
    pl.spriteTimer++;
    const frameSpeed = targetAnim === "run" ? 5 : targetAnim === "attack" ? 4 : targetAnim === "victory" ? 12 : 18;
    if (pl.spriteTimer >= frameSpeed) {
      pl.spriteTimer = 0;
      const frames = _sprites[targetAnim] || _sprites["idle"];
      pl.spriteFrame = (pl.spriteFrame + 1) % frames.length;
    }
  }

  // Draw sprite
  const frames = _sprites[pl.spriteAnim] || _sprites["idle"];
  const spriteImg = frames[pl.spriteFrame % frames.length];
  const spriteH = Math.round(ps * 4.2);
  const spriteW = spriteImg && spriteImg.naturalWidth
    ? Math.round(spriteH * (spriteImg.naturalWidth / spriteImg.naturalHeight))
    : Math.round(spriteH * 0.75);

  ctx.translate(px, py - spriteH * 0.3);
  ctx.scale(pl.facing * dodgeStretch, dodgeSqueeze);

  // Card equipped glow
  if (pl.card) { ctx.shadowColor = "#f0b840"; ctx.shadowBlur = 14; }

  if (spriteImg && spriteImg.complete && spriteImg.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false; // keep pixelated
    ctx.drawImage(spriteImg, -spriteW/2, -spriteH/2, spriteW, spriteH);
  } else {
    // Fallback pixel body if sprite not loaded yet
    ctx.fillStyle = "#2a3a5a";
    ctx.fillRect(-ps*0.4, -ps*0.3, ps*0.8, ps*0.9);
    ctx.fillStyle = "#c49a6c";
    ctx.fillRect(-ps*0.3, -ps*0.7, ps*0.6, ps*0.4);
  }

  // Slash effect overlay
  if (pl.slashAnim > 0) {
    const slashAlpha = pl.slashAnim / 12;
    ctx.globalAlpha = slashAlpha;
    ctx.strokeStyle = "#f0e080";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#f0e080"; ctx.shadowBlur = 18;
    const slashR = 20 + (12 - pl.slashAnim) * 3;
    ctx.beginPath();
    ctx.arc(ps*0.8, 0, slashR, -0.8, 0.8);
    ctx.stroke();
  }
  ctx.restore();

  // ── Sparks ──
  BS.sparks.forEach(s => {
    ctx.save();
    ctx.globalAlpha = s.t / 30 * 0.9;
    ctx.fillStyle = s.col;
    ctx.shadowColor = s.col; ctx.shadowBlur = 6;
    ctx.fillRect(s.x-2, s.y-2, 4, 4);
    ctx.restore();
  });

  // ── Damage numbers (small + fast) ──
  BS.dmgNums.forEach(d => {
    ctx.save();
    ctx.globalAlpha = Math.min(1, d.t/15);
    ctx.fillStyle = d.col;
    ctx.shadowColor = d.col; ctx.shadowBlur = 4;
    ctx.font = `bold ${Math.round(W * 0.013)}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    ctx.fillText(d.val, d.x, d.y);
    ctx.restore();
  });

  // ── Gold drops & potions ──
  if (BS.goldDrops) {
    BS.goldDrops.forEach(g => {
      const bob = Math.sin(g.bobT) * 3;
      const alpha = g.t < 60 ? g.t / 60 : 1;
      ctx.save();
      ctx.globalAlpha = alpha;

      if (g.isPotion) {
        // Draw pixel potion (green cross)
        ctx.fillStyle = "#78c69a";
        ctx.shadowColor = "#78c69a";
        ctx.shadowBlur = 6;
        ctx.fillRect(g.x - 2, g.y + bob - 6, 4, 12);
        ctx.fillRect(g.x - 6, g.y + bob - 2, 12, 4);
      } else {
        // Draw pixel coin (gold square)
        const coinSize = 8;
        ctx.fillStyle = "#f0b840";
        ctx.shadowColor = "#f0b840";
        ctx.shadowBlur = 6;
        ctx.fillRect(g.x - coinSize/2, g.y + bob - coinSize/2, coinSize, coinSize);
        ctx.fillStyle = "#c89030";
        ctx.fillRect(g.x - coinSize/2 + 2, g.y + bob - coinSize/2 + 2, coinSize - 4, coinSize - 4);
      }
      ctx.restore();
    });
  }

  // ── XP bar (below arena strip) ──
  if (BS.player) {
    const xpW = W * 0.35;
    const xpH = 5;
    const xpX = (W - xpW) / 2;
    const xpY = H * ARENA.floorY + 14;
    const xpPct = BS.player.xp / BS.player.xpToNext;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(xpX - 1, xpY - 1, xpW + 2, xpH + 2);
    ctx.fillStyle = "rgba(102,153,255,0.7)";
    ctx.fillRect(xpX, xpY, xpW * xpPct, xpH);
    ctx.strokeStyle = "rgba(102,153,255,0.3)";
    ctx.strokeRect(xpX, xpY, xpW, xpH);
    ctx.font = `${Math.round(W * 0.011)}px "Press Start 2P", monospace`;
    ctx.fillStyle = "rgba(239,230,216,0.4)";
    ctx.textAlign = "center";
    ctx.fillText(`Lv.${BS.player.level}  XP ${BS.player.xp}/${BS.player.xpToNext}`, W/2, xpY + xpH + 14);
    ctx.restore();
  }

  // ── On-canvas combat indicators ──
  if (BS.phase === "fighting") {
    const pl2 = BS.player;
    ctx.save();

    // Dodge cooldown indicator near player
    if (pl2.dodgeCd > 0) {
      const dodgePct = 1 - pl2.dodgeCd / pl2.dodgeCdMax;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(pl2.x - 12, pl2.y + 28, 24, 3);
      ctx.fillStyle = "rgba(176,141,87,0.7)";
      ctx.fillRect(pl2.x - 12, pl2.y + 28, 24 * dodgePct, 3);
    } else {
      // Ready indicator
      ctx.fillStyle = "rgba(176,141,87,0.4)";
      ctx.fillRect(pl2.x - 12, pl2.y + 28, 24, 3);
    }

    // Kill streak display (top right — subtle)
    if (pl2.killStreak >= 3) {
      ctx.font = `bold ${Math.round(W*0.012)}px "Press Start 2P", monospace`;
      ctx.fillStyle = "rgba(255,144,64,0.6)";
      ctx.shadowColor = "#ff9040";
      ctx.shadowBlur = 4;
      ctx.textAlign = "right";
      ctx.fillText(`${pl2.killStreak}x STREAK`, W - 16, H * 0.15);
      ctx.shadowBlur = 0;
    }

    // Combo display (top left — subtle)
    if (pl2.comboCount >= 3) {
      ctx.font = `bold ${Math.round(W*0.011)}px "Press Start 2P", monospace`;
      ctx.fillStyle = "rgba(240,224,128,0.5)";
      ctx.shadowColor = "#f0e080";
      ctx.shadowBlur = 4;
      ctx.textAlign = "left";
      ctx.fillText(`${pl2.comboCount}x COMBO`, 16, H * 0.15);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  // Close screen shake transform
  ctx.restore();

  // ── Wave clear message ──
  if (BS.phase === "wave-clear") {
    const tier = Math.floor(globalWaveIndex / WAVES.length);
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#f0b840";
    ctx.shadowColor = "#f0b840"; ctx.shadowBlur = 30;
    ctx.font = `bold ${Math.round(W*0.03)}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    ctx.fillText("WAVE CLEAR!", W/2, H/2 - 30);

    ctx.font = `${Math.round(W*0.012)}px "Press Start 2P", monospace`;
    ctx.fillStyle = "#fff";
    ctx.shadowBlur = 0;

    const nextScale = getWaveScale(globalWaveIndex + 1);
    if (nextScale > 1) {
      ctx.fillStyle = "rgba(201,104,104,0.7)";
      ctx.fillText(`Next wave: enemies ${Math.round((nextScale-1)*100)}% stronger`, W/2, H/2 + 5);
    }
    if (tier > 0) {
      ctx.fillStyle = "#c96868";
      ctx.font = `bold ${Math.round(W*0.014)}px "Press Start 2P", monospace`;
      ctx.fillText(`TIER ${tier + 1}`, W/2, H/2 + 30);
    }

    // Blinking "continue" prompt
    const blink = Math.floor(BS.tick / 30) % 2 === 0;
    if (blink) {
      ctx.fillStyle = "rgba(239,230,216,0.6)";
      ctx.font = `${Math.round(W*0.011)}px "Press Start 2P", monospace`;
      ctx.fillText("[ Click or press Space to continue ]", W/2, H/2 + 60);
    }
    ctx.restore();

    if (BS.player) BS.player.spriteAnim = "victory";
  }
}

/* ── HUD overlay (DOM) ──────────────────────────────────────────── */
function renderHUD() {
  if (!BS) return;
  const pl = BS.player;

  setText("player-hp-val",  `${pl.hp}/${pl.maxHp}`);
  setText("player-mp-val",  pl.cardCd > 0 ? `CD ${Math.ceil(pl.cardCd/60)}s` : "READY");
  setText("battle-gold",    `${BS.gold} G`);
  const tier = Math.floor(globalWaveIndex / WAVES.length);
  const tierStr = tier > 0 ? ` [T${tier+1}]` : "";
  if (BS.floor) {
    setText("wave-label", `${BS.floor.name} · Wave ${BS.wave+1}`);
  } else {
    setText("wave-label", `Wave ${BS.wave+1} / ${WAVES.length}${tierStr}`);
  }

  setBar("player-hp-bar", pl.hp, pl.maxHp, pl.hp < pl.maxHp*0.3 ? "#c96868" : "#78C69A");
  setBar("player-mp-bar", pl.cardCd > 0 ? pl.cardCdMax - pl.cardCd : pl.cardCdMax,
         pl.cardCdMax, "#f0b840");
  setBar("player-xp-bar", pl.xp, pl.xpToNext, "#6699ff");
  setText("player-xp-val", `Lv.${pl.level}`);

  // Battle log DOM
  const logEl = $("battle-log");
  if (logEl) logEl.innerHTML = BS.log
    .map((l,i) => `<div class="log-line${i===0?" log-new":""}">${l}</div>`)
    .join("");

  // Card ability button state
  const cardBtn = $("btn-card-ability");
  if (cardBtn) {
    if (!pl.card) {
      cardBtn.textContent = "No Card";
      cardBtn.disabled = true;
    } else if (pl.cardCd > 0) {
      cardBtn.textContent = `[E] ${pl.card.name} — ${Math.ceil(pl.cardCd/60)}s`;
      cardBtn.disabled = true;
    } else {
      cardBtn.textContent = `[E] ${pl.card.name} — READY`;
      cardBtn.disabled = false;
    }
  }

  // Equipped cards strip
  const strip = $("equipped-strip");
  if (strip) {
    strip.innerHTML = equippedCards.map((c,i) => `
      <div class="eq-card ${i===0&&pl.card===c?"eq-active":""}">
        <div class="eq-card-name">${c.name}</div>
        <div class="eq-card-grade">PSA ${c.grade}</div>
      </div>
    `).join("") || `<span class="eq-empty">No cards equipped</span>`;
  }
}

/* ── Game loop ──────────────────────────────────────────────────── */
function gameLoop(ctx, canvas) {
  update(canvas);
  render(ctx, canvas);
  renderHUD();
  RAF = requestAnimationFrame(() => gameLoop(ctx, canvas));
}

/* ── Public: startBattle ────────────────────────────────────────── */
function startBattle(onVictory, bonuses, floor) {
  bonuses = bonuses || { hp:0, atk:0, def:0 };

  // Increment run counter for progressive difficulty
  waveRunCount++;

  // Stop any existing loop
  if (RAF) { cancelAnimationFrame(RAF); RAF = null; }
  if (BS && BS._removeInput) BS._removeInput();

  const canvas = $("battle-canvas");
  if (!canvas) { console.error("battle-canvas not found"); return; }
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false; // pixel-perfect rendering

  // Size canvas to container
  function resize() {
    const container = canvas.parentElement;
    canvas.width  = container.clientWidth  || 800;
    canvas.height = container.clientHeight || 480;
  }
  resize();
  window.addEventListener("resize", resize);

  BS = freshBS(bonuses);
  BS.onVictory = onVictory;
  BS.floor = floor || null;

  spawnWave(0);
  attachInput(canvas);
  bLog("⚔ Defend the vault!");

  gameLoop(ctx, canvas);
}

/* ── Show result overlay ────────────────────────────────────────── */
function showBattleResult(won, gold) {
  const overlay = $("battle-result-overlay");
  if (!overlay) return;

  if (RAF) { cancelAnimationFrame(RAF); RAF = null; }

  if (won) {
    // Victory is handled by app.js showBattleVictory
    $("result-icon").textContent  = "🏆";
    $("result-title").textContent = "Victory!";
    $("result-gold").textContent  = `${gold} G earned`;
    $("result-sub").textContent   = "Head to the shop — spend your gold on cards!";
    const shopBtn  = $("btn-to-shop");
    const retryBtn = $("btn-retry");
    if (shopBtn)  shopBtn.style.display  = "";
    if (retryBtn) retryBtn.style.display = "none";
    overlay.classList.remove("hidden");
  } else {
    // Death — send back to town with recuperation timer
    if (typeof goToTownWithRecovery === "function") {
      goToTownWithRecovery();
    } else {
      // Fallback
      overlay.classList.remove("hidden");
      $("result-icon").textContent  = "💀";
      $("result-title").textContent = "Defeated";
      $("result-gold").textContent  = `${gold} G earned`;
      $("result-sub").textContent   = "Returning to town...";
    }
  }
}

/* ── Helpers (shared with app.js) ───────────────────────────────── */
function setBar(id, val, max, color) {
  const el = $(id); if (!el) return;
  el.style.width = Math.max(0, Math.min(100, (val/max)*100)) + "%";
  el.style.background = color;
}
function setText(id, txt) { const el=$(id); if(el) el.textContent = txt; }
function randInt(a, b)     { return Math.floor(Math.random()*(b-a+1))+a; }

// battleState alias for app.js compatibility
Object.defineProperty(window, "battleState", { get: () => BS });
