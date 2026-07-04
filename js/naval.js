// ============================================================
// There Be Dragons — naval layer
// Enemy ships, AI, broadside combat, hunters, ghost ship,
// shot types (round / chain / grape), open-sea encounters
// ============================================================
'use strict';

const Naval = (() => {
  let ships = [];
  let balls = [];
  let smoke = [];
  let encounters = [];
  let spawnTimer = 0;
  let hunterTimer = 0;
  let encounterTimer = 0;
  let leviathanTimer = 0;
  let leviathanDone = false;
  let storms = [];
  let stormTimer = 0;
  let krakenTimer = 0;
  let krakenFought = false;

  const ROLES = {
    merchant: { hull: 60,  speed: 55, color: '#8a6f4a', flag: FACTIONS.merchant.flag, range: 0,   dmg: [0, 0],  gold: [60, 140],  cargoLoot: 6 },
    navy:     { hull: 110, speed: 70, color: '#4a5a7a', flag: FACTIONS.navy.flag,     range: 240, dmg: [6, 11], gold: [40, 100],  cargoLoot: 2 },
    pirate:   { hull: 85,  speed: 75, color: '#5a4a3a', flag: FACTIONS.pirate.flag,   range: 230, dmg: [5, 10], gold: [80, 180],  cargoLoot: 3 },
    hunter:   { hull: 140, speed: 92, color: '#2a2a35', flag: '#801515',              range: 270, dmg: [9, 14], gold: [150, 300], cargoLoot: 2 },
    ghost:    { hull: 160, speed: 60, color: '#7a95a5', flag: '#b0e8e0',              range: 260, dmg: [8, 13], gold: [0, 0],     cargoLoot: 0 },
  };

  const HUNTER_NAMES = ['Blackwood', 'Crane', 'Solano', 'Thatch', 'Moreau', 'Sable', 'Wren', 'Falk'];

  function reset() {
    ships = []; balls = []; smoke = []; encounters = [];
    spawnTimer = 0; hunterTimer = 0;
    encounterTimer = rand(30, 55);
    leviathanTimer = rand(240, 420);
    leviathanDone = false;
    storms = []; stormTimer = rand(90, 160);
    krakenTimer = rand(480, 720); krakenFought = false;
    spawnGhost();
  }

  function spawnGhost() {
    const isl = ISLANDS.find(i => i.id === 'drowned');
    ships.push(makeShip('ghost', isl.x + 260, isl.y, { anchor: isl, label: 'ghost ship' }));
  }

  function makeShip(role, x, y, extra = {}) {
    const R = ROLES[role];
    return {
      role, x, y,
      heading: rand(0, TAU),
      speed: 0,
      hull: R.hull, maxHull: R.hull,
      cooldown: rand(1, 3),
      state: 'patrol',
      wanderT: 0, wanderDir: rand(0, TAU),
      label: extra.label || role + ' ship',
      anchor: extra.anchor || null,
      boarded: false,
      chainedUntil: 0,
      grapeSoft: false,
      ...extra,
    };
  }

  // ---- Spawning -------------------------------------------------

  function hostileToPlayer(ship) {
    if (ship.role === 'ghost' || ship.role === 'hunter') return true;
    if (ship.role === 'pirate') return G.rep.pirate < 20;
    if (ship.role === 'navy') return G.rep.navy <= -20;
    return false;
  }

  function update(dt) {
    // ambient traffic
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = rand(12, 22);
      const nearby = ships.filter(s => dist(s.x, s.y, G.ship.x, G.ship.y) < 1600).length;
      if (nearby < 4 && !inMist()) spawnAmbient();
    }

    // hunter escalation: any faction at HUNTED sends fast pursuit ships
    const hunted = Object.values(G.rep).some(r => r <= -50);
    if (hunted) {
      hunterTimer -= dt;
      if (hunterTimer <= 0 && ships.filter(s => s.role === 'hunter').length < 2) {
        hunterTimer = 75;
        const a = rand(0, TAU);
        const taken = ships.filter(s => s.captainName).map(s => s.captainName);
        const available = HUNTER_NAMES.filter(n => !taken.includes(n));
        const cname = pick(available.length ? available : HUNTER_NAMES);
        ships.push(makeShip('hunter', G.ship.x + Math.cos(a) * 1100, G.ship.y + Math.sin(a) * 1100,
          { label: `Captain ${cname}`, captainName: cname }));
        toast(`⚠ Captain ${cname} flies the red pennant — they have your scent.`, 5000);
      }
    } else {
      hunterTimer = 20;
    }

    // open-sea encounters: wrecks and drifting markets
    if (!inMist()) {
      encounterTimer -= dt;
      if (encounterTimer <= 0 && encounters.filter(e => e.active).length < 3) {
        encounterTimer = rand(45, 85);
        spawnEncounter();
      }
      encounters = encounters.filter(e => e.active && dist(e.x, e.y, G.ship.x, G.ship.y) < 2200);
    }

    // leviathan sighting — once per session, outside the Mist
    if (!leviathanDone && !inMist()) {
      leviathanTimer -= dt;
      if (leviathanTimer <= 0) {
        leviathanDone = true;
        const msgs = [
          'The sea goes black beneath the hull. Something vast passes under the keel — close enough to feel the pressure change. Then it is gone.',
          'A shadow longer than the ship slides past to port, silent as oil. No ripple. No wake. Just a cold that comes and goes in five seconds.',
          'Every fish in sight vanishes at once. The water darkens. Something breathes out from very far below — a sound you feel in your teeth, not your ears.',
        ];
        const m = pick(msgs);
        toast('🐉 ' + m, 7000);
        journal('At sea: ' + m);
        SFX.play('buff');
      }
    }

    // moving squalls — damage hull when sails are raised above 30%
    if (!inMist()) {
      stormTimer -= dt;
      if (stormTimer <= 0 && storms.length < 2) {
        stormTimer = rand(80, 130);
        spawnStorm();
      }
      for (const s of storms) {
        s.x += s.vx * dt; s.y += s.vy * dt;
        s.age += dt;
        s.lightning = Math.max(0, s.lightning - dt * 3);
        if (Math.random() < 0.006 * dt * 60) {
          s.lightning = rand(0.4, 1);
          s.boltX = rand(-s.r * 0.5, s.r * 0.5);
          s.boltMid = rand(-20, 20);
          s.boltMid2 = rand(-10, 10);
        }
      }
      storms = storms.filter(s => s.age < s.maxAge && dist(s.x, s.y, G.ship.x, G.ship.y) < 2800);
    }

    // Kraken: once per session, in open deep water
    if (!krakenFought && !inMist() && G.mode === 'sail') {
      krakenTimer -= dt;
      if (krakenTimer <= 0) {
        krakenTimer = rand(600, 900);
        if (ISLANDS.every(isl => dist(G.ship.x, G.ship.y, isl.x, isl.y) > 600)) summonKraken();
      }
    }

    for (const s of ships) updateShipAI(s, dt);
    updateBalls(dt);
    updateSmoke(dt);
    // cull far-away ambient ships (never the ghost)
    ships = ships.filter(s => s.hull > 0 &&
      (s.role === 'ghost' || s.role === 'hunter' || dist(s.x, s.y, G.ship.x, G.ship.y) < 2600));
    if (!ships.some(s => s.role === 'ghost') && !G.fragmentFrom.drowned) {
      spawnGhost();
    }
  }

  function spawnAmbient() {
    const a = rand(0, TAU);
    const x = clamp(G.ship.x + Math.cos(a) * rand(800, 1300), 60, WORLD.W - 60);
    const y = clamp(G.ship.y + Math.sin(a) * rand(800, 1300), WORLD.MIST_Y + 100, WORLD.H - 60);
    const roll = Math.random();
    const role = roll < 0.45 ? 'merchant' : roll < 0.75 ? 'navy' : 'pirate';
    ships.push(makeShip(role, x, y, {
      label: role === 'merchant' ? 'merchantman' : role === 'navy' ? 'navy frigate' : 'pirate sloop',
    }));
  }

  function spawnEncounter() {
    const a = rand(0, TAU);
    const d = rand(650, 1050);
    const x = clamp(G.ship.x + Math.cos(a) * d, 100, WORLD.W - 100);
    const y = clamp(G.ship.y + Math.sin(a) * d, WORLD.MIST_Y + 150, WORLD.H - 100);
    const roll = Math.random();
    const type = roll < 0.40 ? 'wreck' : roll < 0.62 ? 'market' : roll < 0.82 ? 'survivor' : 'flotsam';
    const enc = { type, x, y, r: 55, active: true, goodId: null, role: null };
    if (type === 'market') enc.goodId = pick(Object.keys(GOODS));
    if (type === 'survivor') enc.role = pick(['merchant', 'navy', 'pirate', 'islander']);
    encounters.push(enc);
  }

  function spawnStorm() {
    const a = G.wind.dir + Math.PI + rand(-0.4, 0.4); // approach from upwind
    const d = rand(700, 1100);
    const x = clamp(G.ship.x + Math.cos(a) * d, 200, WORLD.W - 200);
    const y = clamp(G.ship.y + Math.sin(a) * d, WORLD.MIST_Y + 120, WORLD.H - 200);
    const spd = rand(38, 62);
    storms.push({
      x, y, r: rand(260, 420),
      vx: Math.cos(G.wind.dir) * spd, vy: Math.sin(G.wind.dir) * spd,
      age: 0, maxAge: rand(80, 140),
      lightning: 0, boltX: 0, boltMid: 0, boltMid2: 0,
    });
  }

  function stormEffect(px, py) {
    let total = 0;
    for (const s of storms) {
      const d = dist(px, py, s.x, s.y);
      if (d < s.r) {
        const age = s.age / s.maxAge;
        const envelope = 1 - Math.abs(age - 0.5) * 2;
        total += (1 - d / s.r) * envelope;
      }
    }
    return clamp(total, 0, 1);
  }

  function summonKraken() {
    krakenFought = true;
    G.mode = 'landfall';
    G.ship.sail = 0; G.ship.speed = 0;
    const el = document.getElementById('event');
    el.innerHTML = `
      <div class="panel">
        <h2>🐙 The Kraken Rises</h2>
        <p>The water goes black and cold. The ship lurches sideways — something vast is surfacing beneath the keel. Beak the size of a barn door. Eyes like amber lanterns burning forty feet down. Tentacles that blot the horizon in three directions. A sound like a ship-bell rung too slowly. It is deciding what to do with you.</p>
        <div class="choices">
          <button data-k="fight">⚔ Stand and fight</button>
          <button data-k="flee" ${totalCargo() < 3 ? 'disabled' : ''}>🚤 Jettison 3 cargo and run${totalCargo() < 3 ? ' (need 3 cargo)' : ''}</button>
        </div>
      </div>`;
    el.classList.add('show');
    el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      const c = b.dataset.k;
      el.classList.remove('show');
      if (c === 'flee') {
        let left = 3;
        for (const k of Object.keys(G.cargo)) {
          const take = Math.min(G.cargo[k], left);
          G.cargo[k] -= take; left -= take;
          if (left <= 0) break;
        }
        journal('The Kraken surfaced beneath the keel. We threw three crates overboard and ran hard. The beast took the offering and sank. Those amber eyes — patient as a tide — watched us go.');
        toast('The Kraken accepts the offering and slides below.', 5000);
        SFX.play('sink');
        G.mode = 'sail';
        SaveGame.save();
      } else {
        Boarding.start('kraken', {
          title: 'The Kraken',
          intro: 'Tentacles thick as mainmasts arc over the rail. The crew has nowhere to run — there is only the deep on every side. Blades out.',
          onWin: () => {
            const gold = randInt(260, 430);
            G.gold += gold;
            G.rep.pirate = clamp(G.rep.pirate + 15, -100, 100);
            G.rep.navy = clamp(G.rep.navy + 5, -100, 100);
            journal(`Slew the Kraken. The sea ran black for an hour. Salvaged ${gold} gold in merchant coin from its gullet — entire ships reduced to their most durable parts. This will be told in dockside taverns until the end of the age.`);
            toast(`The Kraken is dead. ${gold} gold from its gullet. The sea is quieter now.`, 6000);
            SFX.play('levelup');
          },
          onLose: () => {
            G.ship.hull = Math.ceil(G.ship.maxHull * 0.25);
            journal('The Kraken broke us and then let us go. Some mercies cannot be understood. Hull splintered. Drifted to open water on nerve alone.');
            toast('The Kraken lets you go — barely. Hull at 25%.', 5500);
          },
        });
      }
    });
  }

  function nearestEncounter() {
    for (const e of encounters) {
      if (e.active && dist(e.x, e.y, G.ship.x, G.ship.y) < e.r + 70) return e;
    }
    return null;
  }

  // ---- AI --------------------------------------------------------

  function updateShipAI(s, dt) {
    const R = ROLES[s.role];
    const dToPlayer = dist(s.x, s.y, G.ship.x, G.ship.y);
    const hostile = hostileToPlayer(s);

    // state transitions
    if (s.role === 'merchant') {
      s.state = (dToPlayer < 300 && ballThreat()) ? 'flee' : 'patrol';
    } else if (hostile) {
      const aggro = s.role === 'hunter' ? 3000 : s.role === 'ghost' ? 500 : 480;
      s.state = dToPlayer < aggro ? 'chase' : 'patrol';
    } else {
      s.state = 'patrol';
    }
    if (s.hull < s.maxHull * 0.25 && s.role !== 'ghost' && s.role !== 'hunter') s.state = 'flee';

    // anchored guardians (the ghost ship) never stray far from their post
    if (s.anchor && s.state === 'chase' &&
        dist(s.x, s.y, s.anchor.x, s.anchor.y) > 650) {
      s.state = 'patrol';
    }

    // nothing sails the Mist willingly
    if (s.role !== 'ghost' && s.y < WORLD.MIST_Y + 60 && s.state !== 'flee') {
      s.state = 'patrol';
      s.wanderDir = Math.PI / 2;
      s.wanderT = Math.max(s.wanderT, 3);
    }

    let targetHeading = s.heading;
    let throttle = 0.6;

    if (s.state === 'patrol') {
      s.wanderT -= dt;
      if (s.wanderT <= 0) { s.wanderT = rand(3, 7); s.wanderDir = rand(0, TAU); }
      targetHeading = s.wanderDir;
      if (s.anchor) {
        const d = dist(s.x, s.y, s.anchor.x, s.anchor.y);
        const toC = Math.atan2(s.anchor.y - s.y, s.anchor.x - s.x);
        targetHeading = d > 380 ? toC : toC + Math.PI / 2;
        throttle = 0.7;
      }
    } else if (s.state === 'chase') {
      const toP = Math.atan2(G.ship.y - s.y, G.ship.x - s.x);
      targetHeading = dToPlayer > R.range * 0.8 ? toP : toP + Math.PI / 2;
      throttle = 1;
      s.cooldown -= dt;
      if (dToPlayer < R.range && s.cooldown <= 0) {
        s.cooldown = s.role === 'hunter' ? 2.2 : 3;
        fire(s, toP, false);
      }
    } else if (s.state === 'flee') {
      targetHeading = Math.atan2(s.y - G.ship.y, s.x - G.ship.x);
      throttle = 1;
    }

    const dd = angleDiff(s.heading, targetHeading);
    s.heading += clamp(dd, -1.2 * dt, 1.2 * dt);
    const eff = 0.55 + 0.45 * sailEfficiency(angleDiff(s.heading, G.wind.dir));
    // chain shot halves the ship's effective top speed for 8 seconds
    const maxSpd = (s.chainedUntil && G.time < s.chainedUntil) ? R.speed * 0.38 : R.speed;
    s.speed = lerp(s.speed, maxSpd * throttle * eff, 1 - Math.exp(-dt));
    s.x += Math.cos(s.heading) * s.speed * dt;
    s.y += Math.sin(s.heading) * s.speed * dt;
    for (const isl of ISLANDS) {
      const d = dist(s.x, s.y, isl.x, isl.y);
      if (d < isl.r + 20) {
        const ang = Math.atan2(s.y - isl.y, s.x - isl.x);
        s.x = isl.x + Math.cos(ang) * (isl.r + 20);
        s.y = isl.y + Math.sin(ang) * (isl.r + 20);
      }
    }
    s.x = clamp(s.x, 30, WORLD.W - 30);
    s.y = clamp(s.y, 30, WORLD.H - 30);
  }

  function ballThreat() {
    return balls.some(b => b.fromPlayer);
  }

  // ---- Cannon fire -----------------------------------------------
  // Shot types (player-only): round (default), chain (slows enemy),
  // grape (short-range cone; softens crew before boarding)

  function playerFire() {
    const s = G.ship;
    if (s.cooldown > 0) return;
    const nearest = pool => pool.reduce((best, e) => {
      const d = dist(s.x, s.y, e.x, e.y);
      return !best || d < best.d ? { e, d } : best;
    }, null);
    const found = nearest(ships.filter(hostileToPlayer)) || nearest(ships);
    const target = found && found.e;
    const bd = found ? found.d : 1e9;
    const shotType = G.shotType || 'round';
    const range = shotType === 'grape' ? 160 : 280;
    const dir = (target && bd < range + 60)
      ? Math.atan2(target.y - s.y, target.x - s.x)
      : s.heading + Math.PI / 2;
    s.cooldown = G.upgrades.guns3 ? 1.4 : 2.2;
    SFX.play('cannon');
    fire({ x: s.x, y: s.y }, dir, true, shotType);
  }

  function fire(from, dir, fromPlayer, shotType = 'round') {
    if (!fromPlayer && dist(from.x, from.y, G.ship.x, G.ship.y) < 700) SFX.play('cannonFar');

    if (fromPlayer && shotType === 'chain') {
      // one slow projectile — what it lacks in damage it makes up for in rigging ruin
      balls.push({
        x: from.x, y: from.y,
        vx: Math.cos(dir) * 290, vy: Math.sin(dir) * 290,
        life: 1.05, fromPlayer, src: null, shotType: 'chain',
      });
    } else if (fromPlayer && shotType === 'grape') {
      // fan of pellets — brutal at pistol range, useless past 150u
      const pellets = G.upgrades.guns2 ? 9 : 7;
      for (let i = 0; i < pellets; i++) {
        const ang = dir + rand(-0.32, 0.32);
        balls.push({
          x: from.x, y: from.y,
          vx: Math.cos(ang) * 215, vy: Math.sin(ang) * 215,
          life: 0.75, fromPlayer, src: null, shotType: 'grape',
        });
      }
    } else {
      // round shot: standard broadsides
      const count = fromPlayer && G.upgrades.guns2 ? 3 : fromPlayer ? 2 : 2;
      for (let i = 0; i < count; i++) {
        const spread = (i - (count - 1) / 2) * 0.09;
        balls.push({
          x: from.x, y: from.y,
          vx: Math.cos(dir + spread) * 340, vy: Math.sin(dir + spread) * 340,
          life: 0.85, fromPlayer, src: fromPlayer ? null : from, shotType: 'round',
        });
      }
    }

    for (let i = 0; i < 6; i++) {
      smoke.push({
        x: from.x + Math.cos(dir) * 14, y: from.y + Math.sin(dir) * 14,
        vx: Math.cos(dir) * rand(10, 40) + rand(-15, 15),
        vy: Math.sin(dir) * rand(10, 40) + rand(-15, 15),
        life: rand(0.5, 1.1), r: rand(3, 7),
      });
    }
  }

  function updateBalls(dt) {
    for (const b of balls) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0) continue;
      if (b.fromPlayer) {
        for (const s of ships) {
          if (dist(b.x, b.y, s.x, s.y) < 22) {
            let dmg;
            if (b.shotType === 'chain') {
              dmg = Math.round(rand(5, 9) * (G.upgrades.guns3 ? 1.5 : 1));
              s.chainedUntil = G.time + 8;
              toast(`Chain shot — ${s.label} is fouled and slowed!`, 3500);
            } else if (b.shotType === 'grape') {
              dmg = Math.round(rand(3, 7) * (G.upgrades.guns3 ? 1.5 : 1));
              s.grapeSoft = true;
            } else {
              dmg = Math.round(rand(9, 15) * (G.upgrades.guns3 ? 1.5 : 1));
            }
            s.hull -= dmg;
            b.life = 0;
            splash(b.x, b.y);
            SFX.play('splash');
            if (s.hull <= 0) onSink(s);
            break;
          }
        }
      } else if (dist(b.x, b.y, G.ship.x, G.ship.y) < 22) {
        const src = b.src ? ROLES[b.src.role] : ROLES.navy;
        G.ship.hull -= rand(src.dmg[0], src.dmg[1]);
        b.life = 0;
        splash(b.x, b.y);
        SFX.play('damage');
        if (G.ship.hull <= 0) { G.ship.hull = 0; onPlayerDefeat(); return; }
      }
    }
    balls = balls.filter(b => b.life > 0);
  }

  function splash(x, y) {
    for (let i = 0; i < 4; i++) {
      smoke.push({ x, y, vx: rand(-30, 30), vy: rand(-30, 30), life: rand(0.3, 0.6), r: rand(2, 5), white: true });
    }
  }

  function updateSmoke(dt) {
    for (const p of smoke) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    smoke = smoke.filter(p => p.life > 0);
  }

  // ---- Sinking, plunder, reputation -------------------------------

  function repHit(role, amount) {
    const map = { merchant: 'merchant', navy: 'navy', pirate: 'pirate' };
    const f = map[role];
    if (!f) return;
    G.rep[f] = clamp(G.rep[f] + amount, -100, 100);
    if (f === 'navy' || f === 'merchant') G.rep.pirate = clamp(G.rep.pirate + 3, -100, 100);
    if (f === 'pirate') { G.rep.navy = clamp(G.rep.navy + 3, -100, 100); G.rep.merchant = clamp(G.rep.merchant + 2, -100, 100); }
    if (G.rep[f] <= -50) toast(`${FACTIONS[f].name} has marked you: HUNTED. Expect pursuit.`, 5000);
  }

  function onSink(s) {
    G.kills++;
    SFX.play('sink');
    const R = ROLES[s.role];
    const gold = randInt(R.gold[0], R.gold[1]);
    G.gold += gold;
    repHit(s.role, -14);
    if (s.role === 'ghost') {
      journal('The wraith-hull broke apart into cold light. Floating in the wreckage: a captain\'s log, its final pages a chart of the Mist.');
      grantFragment('drowned', 'The ghost ship\'s log charts a course into the Mist.');
    } else if (s.role === 'hunter' && s.captainName) {
      journal(`Captain ${s.captainName}'s frigate went down fighting. Salvaged ${gold} gold from the wreck. One less name on the bounty list.`);
      toast(`Captain ${s.captainName} sunk — ${gold} gold salvaged.`);
    } else {
      journal(`Sank a ${s.label}. Salvaged ${gold} gold from the wreck.`);
      toast(`${s.label} sunk — salvaged ${gold} gold.`);
    }
  }

  function boardable() {
    for (const s of ships) {
      if (s.hull > 0 && s.hull <= s.maxHull * 0.35 &&
          dist(s.x, s.y, G.ship.x, G.ship.y) < 90) return s;
    }
    return null;
  }

  function beginBoarding(s) {
    G.mode = 'boarding';
    const crewKey = s.role === 'ghost' ? 'ghost'
      : s.role === 'hunter' ? 'hunter'
      : s.role === 'navy' ? 'navy'
      : s.role === 'pirate' ? 'pirate' : 'merchant';
    const intro = s.role === 'ghost'
      ? 'The hulls meet with a sound like a bell swallowed by fog. Things in tattered oilskin haul themselves over the rail — they have no breath, no blood, and nothing left to lose. Somewhere in that wraith-fog, the captain\'s log waits.'
      : s.role === 'hunter'
        ? (s.captainName
          ? `Captain ${s.captainName}'s frigate cuts your wake dead. The boarding party is already on the rail — battle-hardened hunters who know exactly how this ends.`
          : 'The hunter frigate cuts your wake dead. The boarding party is already on the rail — they\'ve done this before.')
        : s.grapeSoft
          ? 'Grape shot swept the deck before your crew boarded — the defenders are already bloodied and scattered.'
          : 'Grapnels bite, hulls grind together, and your crew pours over the rail with steel drawn.';
    const title = s.role === 'ghost' ? 'The Drowned Court — Ghost Ship'
      : s.role === 'hunter' && s.captainName ? `Captain ${s.captainName}'s Pursuit`
      : `Boarding the ${s.label}`;
    Boarding.start(crewKey, {
      title,
      intro,
      grapeDebuff: s.grapeSoft,
      onWin: () => {
        G.plunders++;
        const R = ROLES[s.role];
        const gold = randInt(R.gold[0] * 1.6, R.gold[1] * 1.6);
        G.gold += gold;
        let looted = 0;
        const goodsKeys = Object.keys(GOODS);
        for (let i = 0; i < R.cargoLoot; i++) {
          if (totalCargo() >= G.cargoCap) break;
          G.cargo[pick(goodsKeys)]++;
          looted++;
        }
        repHit(s.role, -18);
        s.hull = 0;
        ships = ships.filter(x => x !== s);
        if (s.role === 'ghost') {
          journal('The last wraith dissolved into salt-foam. In the captain\'s cabin, undisturbed for decades: the log. The final pages chart the Mist in a hand that was still steady at the end.');
          toast('The ghost crew is gone. The captain\'s log is yours.', 5000);
          grantFragment('drowned', 'Taken by force from the ghost captain\'s cabin at the Drowned Court.');
        } else if (s.role === 'hunter' && s.captainName) {
          journal(`Bested Captain ${s.captainName} in a boarding action. Took ${gold} gold from the hunter frigate. They won't be coming for us again.`);
          toast(`Captain ${s.captainName} is down! ${gold} gold.`, 4500);
        } else {
          journal(`Took the ${s.label} by the sword: ${gold} gold, ${looted} crates of cargo.`);
          toast(`Deck taken! ${gold} gold, ${looted} cargo.`, 4500);
        }
      },
    });
  }

  // ---- Render ------------------------------------------------------

  function renderStorms(ctx, cam) {
    for (const s of storms) {
      const sx = s.x - cam.x, sy = s.y - cam.y;
      if (sx < -s.r - 50 || sx > canvas.width + s.r + 50 ||
          sy < -s.r - 50 || sy > canvas.height + s.r + 50) continue;
      const age = s.age / s.maxAge;
      const envelope = 1 - Math.abs(age - 0.5) * 2;
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, s.r);
      grad.addColorStop(0, `rgba(10,10,20,${(0.72 * envelope).toFixed(2)})`);
      grad.addColorStop(0.55, `rgba(20,15,30,${(0.42 * envelope).toFixed(2)})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(sx - s.r, sy - s.r, s.r * 2, s.r * 2);
      if (s.lightning > 0.1) {
        ctx.save();
        ctx.strokeStyle = `rgba(220,230,255,${(s.lightning * 0.9).toFixed(2)})`;
        ctx.lineWidth = s.lightning > 0.7 ? 2 : 1;
        ctx.shadowColor = 'rgba(180,200,255,0.85)';
        ctx.shadowBlur = 10;
        const lx = sx + s.boltX;
        const ly = sy - s.r * 0.25;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + s.boltMid, ly + s.r * 0.32);
        ctx.lineTo(lx + s.boltMid2, ly + s.r * 0.6);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function renderEncounters(ctx, cam) {
    for (const enc of encounters) {
      if (!enc.active) continue;
      const x = enc.x - cam.x, y = enc.y - cam.y;
      if (x < -120 || x > canvas.width + 120 || y < -120 || y > canvas.height + 120) continue;

      if (enc.type === 'wreck') {
        ctx.save();
        ctx.translate(x, y);
        ctx.globalAlpha = 0.7;
        drawShipShape(0, 0, 0.55, 12, '#4a3a2a', 0, '#666');
        ctx.globalAlpha = 1;
        ctx.restore();
        ctx.strokeStyle = 'rgba(100,80,60,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 30, 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.font = '11px Georgia'; ctx.textAlign = 'center';
        ctx.fillText('wreck', x, y + 36);
        ctx.textAlign = 'left';

      } else if (enc.type === 'market') {
        ctx.save();
        ctx.translate(x, y);
        // raft platform
        ctx.fillStyle = '#7a5a2a';
        ctx.fillRect(-20, -12, 40, 24);
        ctx.strokeStyle = '#4a2a0a'; ctx.lineWidth = 1.5;
        ctx.strokeRect(-20, -12, 40, 24);
        // canopy
        ctx.fillStyle = '#c89820';
        ctx.beginPath();
        ctx.moveTo(-16, -12); ctx.lineTo(16, -12);
        ctx.lineTo(12, -26); ctx.lineTo(-12, -26);
        ctx.closePath(); ctx.fill();
        // mast & pennant
        ctx.strokeStyle = '#4a2a0a'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, -34); ctx.stroke();
        ctx.fillStyle = '#e8b830';
        ctx.fillRect(0, -34, 11, 8);
        ctx.globalAlpha = 1;
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.font = '11px Georgia'; ctx.textAlign = 'center';
        ctx.fillText('drifting market', x, y + 28);
        ctx.textAlign = 'left';

      } else if (enc.type === 'survivor') {
        ctx.save();
        ctx.translate(x, y);
        // lifeboat hull
        ctx.fillStyle = '#7a5a35';
        ctx.beginPath();
        ctx.ellipse(0, 2, 18, 8, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#4a2a0a'; ctx.lineWidth = 1.2;
        ctx.stroke();
        // oar
        ctx.strokeStyle = '#8a6a45'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(14, 0); ctx.stroke();
        // mast + distress flag
        ctx.strokeStyle = '#4a2a0a'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(2, 2); ctx.lineTo(2, -14); ctx.stroke();
        ctx.fillStyle = '#e82020';
        ctx.fillRect(2, -14, 9, 6);
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.font = '11px Georgia'; ctx.textAlign = 'center';
        ctx.fillText('survivor', x, y + 28);
        ctx.textAlign = 'left';

      } else if (enc.type === 'flotsam') {
        ctx.save();
        ctx.translate(x, y);
        ctx.globalAlpha = 0.78;
        ctx.fillStyle = '#6a4a20';
        ctx.fillRect(-15, -8, 12, 10);
        ctx.fillRect(6, -4, 14, 8);
        ctx.strokeStyle = '#3a1a00'; ctx.lineWidth = 1;
        ctx.strokeRect(-15, -8, 12, 10);
        ctx.strokeRect(6, -4, 14, 8);
        ctx.fillStyle = '#4a3010';
        ctx.fillRect(-4, 6, 20, 4);
        ctx.strokeRect(-4, 6, 20, 4);
        ctx.globalAlpha = 1;
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.font = '11px Georgia'; ctx.textAlign = 'center';
        ctx.fillText('flotsam', x, y + 32);
        ctx.textAlign = 'left';
      }
    }
  }

  function render(ctx, cam) {
    renderStorms(ctx, cam);
    renderEncounters(ctx, cam);

    for (const s of ships) {
      const x = s.x - cam.x, y = s.y - cam.y;
      if (x < -80 || x > canvas.width + 80 || y < -80 || y > canvas.height + 80) continue;
      const R = ROLES[s.role];
      if (s.role === 'ghost') ctx.globalAlpha = 0.65 + 0.2 * Math.sin(G.time * 2);
      drawShipShape(x, y, s.heading, 17, R.color, 0.8, R.flag);
      ctx.globalAlpha = 1;
      // dashed ring when chain-slowed
      if (s.chainedUntil && G.time < s.chainedUntil) {
        ctx.strokeStyle = 'rgba(100,200,255,0.7)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(x, y, 24, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
      if (s.hull < s.maxHull) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x - 18, y - 30, 36, 5);
        ctx.fillStyle = s.hull < s.maxHull * 0.35 ? '#e05050' : '#50c050';
        ctx.fillRect(x - 18, y - 30, 36 * (s.hull / s.maxHull), 5);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '11px Georgia'; ctx.textAlign = 'center';
      ctx.fillText(s.label, x, y + 32);
      ctx.textAlign = 'left';
    }

    // cannonballs — visually distinct by shot type
    for (const b of balls) {
      const bx = b.x - cam.x, by = b.y - cam.y;
      if (b.shotType === 'grape') {
        ctx.fillStyle = '#2a1a0a';
        ctx.beginPath(); ctx.arc(bx, by, 2, 0, TAU); ctx.fill();
      } else if (b.shotType === 'chain') {
        const ang = Math.atan2(b.vy, b.vx);
        const len = 7;
        ctx.strokeStyle = '#1a1a2a'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx - Math.cos(ang) * len, by - Math.sin(ang) * len);
        ctx.lineTo(bx + Math.cos(ang) * len, by + Math.sin(ang) * len);
        ctx.stroke();
        ctx.fillStyle = '#1a1a2a';
        for (const sign of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(bx + Math.cos(ang) * len * sign, by + Math.sin(ang) * len * sign, 2.5, 0, TAU);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath(); ctx.arc(bx, by, 3, 0, TAU); ctx.fill();
      }
    }

    // smoke / splashes
    for (const p of smoke) {
      ctx.globalAlpha = clamp(p.life, 0, 0.6);
      ctx.fillStyle = p.white ? '#cfe8f0' : '#555';
      ctx.beginPath(); ctx.arc(p.x - cam.x, p.y - cam.y, p.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return { reset, update, render, playerFire, boardable, beginBoarding, nearestEncounter,
           stormEffect, get ships() { return ships; }, set ships(v) { ships = v; } };
})();
