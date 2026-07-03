// ============================================================
// There Be Dragons — naval layer
// Enemy ships, AI, broadside combat, hunters, ghost ship
// ============================================================
'use strict';

const Naval = (() => {
  let ships = [];        // AI ships
  let balls = [];        // cannonballs in flight
  let smoke = [];        // particles
  let spawnTimer = 0;
  let hunterTimer = 0;

  const ROLES = {
    merchant: { hull: 60,  speed: 55, color: '#8a6f4a', flag: FACTIONS.merchant.flag, range: 0,   dmg: [0, 0],  gold: [60, 140],  cargoLoot: 6 },
    navy:     { hull: 110, speed: 70, color: '#4a5a7a', flag: FACTIONS.navy.flag,     range: 240, dmg: [6, 11], gold: [40, 100],  cargoLoot: 2 },
    pirate:   { hull: 85,  speed: 75, color: '#5a4a3a', flag: FACTIONS.pirate.flag,   range: 230, dmg: [5, 10], gold: [80, 180],  cargoLoot: 3 },
    hunter:   { hull: 140, speed: 92, color: '#2a2a35', flag: '#801515',              range: 270, dmg: [9, 14], gold: [150, 300], cargoLoot: 2 },
    ghost:    { hull: 160, speed: 60, color: '#7a95a5', flag: '#b0e8e0',              range: 260, dmg: [8, 13], gold: [0, 0],     cargoLoot: 0 },
  };

  function reset() {
    ships = []; balls = []; smoke = [];
    spawnTimer = 0; hunterTimer = 0;
    // the ghost ship always circles the Drowned Court
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
      state: 'patrol',       // patrol | chase | flee
      wanderT: 0, wanderDir: rand(0, TAU),
      label: extra.label || role + ' ship',
      anchor: extra.anchor || null,
      boarded: false,
      ...extra,
    };
  }

  // ---- Spawning -------------------------------------------------

  function hostileToPlayer(ship) {
    if (ship.role === 'ghost' || ship.role === 'hunter') return true;
    if (ship.role === 'pirate') return G.rep.pirate < 20;
    if (ship.role === 'navy') return G.rep.navy <= -20;
    return false; // merchants never attack
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
        ships.push(makeShip('hunter', G.ship.x + Math.cos(a) * 1100, G.ship.y + Math.sin(a) * 1100, { label: 'hunter' }));
        toast('⚠ A hunter flies the red pennant — they have your scent.', 5000);
      }
    } else {
      hunterTimer = 20;
    }

    for (const s of ships) updateShipAI(s, dt);
    updateBalls(dt);
    updateSmoke(dt);
    // cull far-away ambient ships (never the ghost)
    ships = ships.filter(s => s.hull > 0 &&
      (s.role === 'ghost' || s.role === 'hunter' || dist(s.x, s.y, G.ship.x, G.ship.y) < 2600));
    if (!ships.some(s => s.role === 'ghost') && !G.fragmentFrom.drowned) {
      // ghost respawns if it drifted into a cull edge-case
      spawnGhost();
    }
  }

  function spawnAmbient() {
    const a = rand(0, TAU);
    const x = clamp(G.ship.x + Math.cos(a) * rand(800, 1300), 60, WORLD.W - 60);
    const y = clamp(G.ship.y + Math.sin(a) * rand(800, 1300), WORLD.MIST_Y + 100, WORLD.H - 60);
    const roll = Math.random();
    const role = roll < 0.45 ? 'merchant' : roll < 0.75 ? 'navy' : 'pirate';
    ships.push(makeShip(role, x, y, { label: role === 'merchant' ? 'merchantman' : role === 'navy' ? 'navy frigate' : 'pirate sloop' }));
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

    // nothing sails the Mist willingly — even hunters break off at its edge,
    // which makes the Mist a last refuge for the hunted (and keeps the
    // scripted voyage undisturbed)
    if (s.role !== 'ghost' && s.y < WORLD.MIST_Y + 60 && s.state !== 'flee') {
      s.state = 'patrol';
      s.wanderDir = Math.PI / 2; // due south, back to charted water
      s.wanderT = Math.max(s.wanderT, 3);
    }

    let targetHeading = s.heading;
    let throttle = 0.6;

    if (s.state === 'patrol') {
      s.wanderT -= dt;
      if (s.wanderT <= 0) { s.wanderT = rand(3, 7); s.wanderDir = rand(0, TAU); }
      targetHeading = s.wanderDir;
      if (s.anchor) {
        // orbit the anchor island
        const d = dist(s.x, s.y, s.anchor.x, s.anchor.y);
        const toC = Math.atan2(s.anchor.y - s.y, s.anchor.x - s.x);
        targetHeading = d > 380 ? toC : toC + Math.PI / 2;
        throttle = 0.7;
      }
    } else if (s.state === 'chase') {
      const toP = Math.atan2(G.ship.y - s.y, G.ship.x - s.x);
      // try to hold broadside range: approach until in range, then circle
      targetHeading = dToPlayer > R.range * 0.8 ? toP : toP + Math.PI / 2;
      throttle = 1;
      // fire when player is roughly abeam and in range
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
    s.speed = lerp(s.speed, R.speed * throttle * eff, 1 - Math.exp(-dt));
    s.x += Math.cos(s.heading) * s.speed * dt;
    s.y += Math.sin(s.heading) * s.speed * dt;
    // keep off islands
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

  // ---- Cannon fire ------------------------------------------------

  function playerFire() {
    const s = G.ship;
    if (s.cooldown > 0) return;
    // aim at the nearest hostile first so a passing merchantman doesn't
    // soak a broadside meant for a hunter; fall back to nearest ship
    // (deliberate piracy stays possible), else fire to starboard
    const nearest = pool => pool.reduce((best, e) => {
      const d = dist(s.x, s.y, e.x, e.y);
      return !best || d < best.d ? { e, d } : best;
    }, null);
    const found = nearest(ships.filter(hostileToPlayer)) || nearest(ships);
    const target = found && found.e;
    const bd = found ? found.d : 1e9;
    const range = 280;
    const dir = (target && bd < range + 60)
      ? Math.atan2(target.y - s.y, target.x - s.x)
      : s.heading + Math.PI / 2;
    s.cooldown = G.upgrades.guns3 ? 1.4 : 2.2;
    SFX.play('cannon');
    fire({ x: s.x, y: s.y }, dir, true);
  }

  function fire(from, dir, fromPlayer) {
    if (!fromPlayer && dist(from.x, from.y, G.ship.x, G.ship.y) < 700) SFX.play('cannonFar');
    const count = fromPlayer && G.upgrades.guns2 ? 3 : fromPlayer ? 2 : 2;
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 0.09;
      balls.push({
        x: from.x, y: from.y,
        vx: Math.cos(dir + spread) * 340,
        vy: Math.sin(dir + spread) * 340,
        life: 0.85,
        fromPlayer,
        src: fromPlayer ? null : from,
      });
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
            let dmg = rand(9, 15);
            if (G.upgrades.guns3) dmg *= 1.5;
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
    // sinking lawful ships pleases pirates a little, and vice versa
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
    } else {
      journal(`Sank a ${s.label}. Salvaged ${gold} gold from the wreck.`);
      toast(`${s.label} sunk — salvaged ${gold} gold.`);
    }
  }

  // a crippled hostile ship close aboard can be boarded instead of sunk
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
    Boarding.start(crewKey, {
      title: `Boarding the ${s.label}`,
      intro: 'Grapnels bite, hulls grind together, and your crew pours over the rail with steel drawn.',
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
          grantFragment('drowned', 'You pried the log from the wraith-captain\'s grip yourself.');
        } else {
          journal(`Took the ${s.label} by the sword: ${gold} gold, ${looted} crates of cargo.`);
          toast(`Deck taken! ${gold} gold, ${looted} cargo.`, 4500);
        }
      },
    });
  }

  // ---- Render ------------------------------------------------------

  function render(ctx, cam) {
    for (const s of ships) {
      const x = s.x - cam.x, y = s.y - cam.y;
      if (x < -80 || x > canvas.width + 80 || y < -80 || y > canvas.height + 80) continue;
      const R = ROLES[s.role];
      if (s.role === 'ghost') {
        ctx.globalAlpha = 0.65 + 0.2 * Math.sin(G.time * 2);
      }
      drawShipShape(x, y, s.heading, 17, R.color, 0.8, R.flag);
      ctx.globalAlpha = 1;
      // hull bar when damaged
      if (s.hull < s.maxHull) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x - 18, y - 30, 36, 5);
        ctx.fillStyle = s.hull < s.maxHull * 0.35 ? '#e05050' : '#50c050';
        ctx.fillRect(x - 18, y - 30, 36 * (s.hull / s.maxHull), 5);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '11px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText(s.label, x, y + 32);
      ctx.textAlign = 'left';
    }
    // cannonballs
    ctx.fillStyle = '#1a1a1a';
    for (const b of balls) {
      ctx.beginPath();
      ctx.arc(b.x - cam.x, b.y - cam.y, 3, 0, TAU);
      ctx.fill();
    }
    // smoke / splashes
    for (const p of smoke) {
      ctx.globalAlpha = clamp(p.life, 0, 0.6);
      ctx.fillStyle = p.white ? '#cfe8f0' : '#555';
      ctx.beginPath();
      ctx.arc(p.x - cam.x, p.y - cam.y, p.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return { reset, update, render, playerFire, boardable, beginBoarding,
           get ships() { return ships; }, set ships(v) { ships = v; } };
})();
