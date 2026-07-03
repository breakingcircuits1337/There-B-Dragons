// ============================================================
// There Be Dragons — core engine
// Game state, sailing physics, wind, rendering, input, HUD
// ============================================================
'use strict';

const canvas = document.getElementById('sea');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ---- Utility --------------------------------------------------

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
// smallest signed angle from a to b
function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// ---- Game state -----------------------------------------------

function newGameState() {
  return {
    mode: 'title',          // title | sail | port | boarding | landfall | ending
    time: WORLD.DAY_LENGTH * 0.3,   // set out mid-morning, not midnight
    ship: {
      x: 900, y: 3150,      // start just off Port Meridian
      heading: 0,           // bow east, toward open water
      sail: 0,              // 0..1 canvas raised
      speed: 0,
      hull: 100, maxHull: 100,
      cooldown: 0,
    },
    // first wind is a beam reach for an east heading — nobody starts in irons
    wind: { dir: Math.PI / 2, strength: rand(0.8, 1.0), t: 0 },
    gold: 150,
    cargo: { rum: 0, silk: 0, powder: 0, amber: 0 },
    cargoCap: 20,
    upgrades: {},           // id -> true
    rep: { navy: 10, merchant: 0, pirate: -10, islander: 0, ashen: 0, hive: 0 },
    discovered: { meridian: true },   // island ids known on the chart
    rumorsHeard: {},        // rumor id -> true
    fragments: 0,           // chart fragments toward the Mist voyage (need 3)
    fragmentFrom: {},       // island id -> fragment collected there
    mistTimer: 0,           // seconds spent in the Mist on the true voyage
    mistEvents: { morale: false, sirens: false, singing: false },
    loyalty: { sigrid: false, ashka: false },   // recruit loyalty arcs resolved
    islandEvents: {},        // one-time per-island event flags
    party: PARTY_TEMPLATE.map(p => ({ ...p, hp: p.maxHp, mp: p.maxMp, level: 1 })),
    partyXp: 0, partyLevel: 1,
    kills: 0, plunders: 0,
    journal: ['Fitted out at Port Meridian with 150 gold and a restless crew. The taverns whisper that the dragons did not die out — they went somewhere. Behind the Mist.'],
    dragonMet: false,
    ending: null,
    shotType: 'round',   // 'round' | 'chain' | 'grape'  — cycles with [G]
  };
}

let G = newGameState();

// ---- Journal / toast ------------------------------------------

const toastEl = document.getElementById('toast');
let toastTimer = null;
function toast(msg, ms = 3500) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}
function journal(msg) {
  G.journal.push(msg);
  if (G.journal.length > 60) G.journal.shift();
}

// ---- Wind ------------------------------------------------------

function updateWind(dt) {
  const w = G.wind;
  w.t += dt;
  // slow wander of direction and strength
  w.dir += Math.sin(w.t * 0.05) * 0.0009 + Math.sin(w.t * 0.013) * 0.0016;
  w.strength = clamp(0.75 + Math.sin(w.t * 0.021) * 0.3 + Math.sin(w.t * 0.007) * 0.15, 0.35, 1.25);
}

// Sail efficiency by point of sail: dead upwind is nearly useless,
// beam reach through broad reach is best, dead downwind is decent.
function sailEfficiency(headingToWindAngle) {
  const a = Math.abs(headingToWindAngle); // 0 = sailing straight into the wind
  if (a < 0.5) return 0.08;               // in irons
  if (a < 1.1) return lerp(0.25, 0.8, (a - 0.5) / 0.6);  // close-hauled
  if (a < 2.4) return 1.0;                // beam / broad reach
  return 0.85;                            // running downwind
}

function shipMaxSpeed() {
  let v = 95;
  if (G.upgrades.sails2) v *= 1.2;
  if (G.upgrades.sails3) v *= 1.17;
  const load = totalCargo() / G.cargoCap;
  v *= 1 - load * 0.18;                   // heavy hold slows you
  return v;
}

function totalCargo() {
  return Object.values(G.cargo).reduce((a, b) => a + b, 0);
}

// ---- Ship physics ---------------------------------------------

const keys = {};
window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  handleKey(e);
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

function updateShip(dt) {
  const s = G.ship;
  const helm = 1.1 * dt * clamp(0.4 + 0.6 * (1 - s.speed / 140), 0.25, 1);
  if (keys['a'] || keys['arrowleft'])  s.heading -= helm;
  if (keys['d'] || keys['arrowright']) s.heading += helm;
  if (keys['w'] || keys['arrowup'])    s.sail = clamp(s.sail + 0.8 * dt, 0, 1);
  if (keys['s'] || keys['arrowdown'])  s.sail = clamp(s.sail - 0.8 * dt, 0, 1);

  // wind.dir is the direction the wind blows TOWARD
  const eff = sailEfficiency(angleDiff(s.heading, G.wind.dir));
  const target = shipMaxSpeed() * s.sail * G.wind.strength * eff;
  s.speed = lerp(s.speed, target, 1 - Math.exp(-dt * 0.7)); // ships have inertia

  let nx = s.x + Math.cos(s.heading) * s.speed * dt;
  let ny = s.y + Math.sin(s.heading) * s.speed * dt;

  // island collision — run aground gently
  for (const isl of ISLANDS) {
    const d = dist(nx, ny, isl.x, isl.y);
    if (d < isl.r + 14) {
      const push = (isl.r + 14 - d);
      const ang = Math.atan2(ny - isl.y, nx - isl.x);
      nx += Math.cos(ang) * push;
      ny += Math.sin(ang) * push;
      s.speed *= 0.5;
    }
  }
  s.x = clamp(nx, 30, WORLD.W - 30);
  s.y = clamp(ny, 30, WORLD.H - 30);
  s.cooldown = Math.max(0, s.cooldown - dt);

  // discover islands on approach
  const sight = G.upgrades.optics ? 620 : 420;
  for (const isl of ISLANDS) {
    if (!G.discovered[isl.id] && !isl.hidden && dist(s.x, s.y, isl.x, isl.y) < isl.r + sight) {
      G.discovered[isl.id] = true;
      toast(`Land ho — ${isl.name} charted.`);
      journal(`Charted ${isl.name}. ${isl.desc}`);
    }
  }
}

function inMist() { return G.ship.y < WORLD.MIST_Y; }

function nearestDockable() {
  for (const isl of ISLANDS) {
    if (!isl.port) continue;
    if (dist(G.ship.x, G.ship.y, isl.x, isl.y) < isl.r + 55) return isl;
  }
  return null;
}

function nearestLandfall() {
  // non-port islands you can land on when their event is live
  for (const isl of ISLANDS) {
    if (isl.port) continue;
    if (isl.hidden && !G.discovered[isl.id]) continue;
    if (dist(G.ship.x, G.ship.y, isl.x, isl.y) < isl.r + 55) return isl;
  }
  return null;
}

// ---- Key actions ----------------------------------------------

function handleKey(e) {
  const k = e.key.toLowerCase();
  SFX.ensure(); // audio needs a user gesture; the first keypress is it
  if (k === 'v') {
    toast(SFX.toggleMute() ? 'Sound muted.' : 'Sound on.');
    return;
  }
  if (G.mode === 'title') {
    if (k === 'enter') startGame(false);
    if (k === 'l') startGame(true);
    return;
  }
  if (G.mode !== 'sail') return;

  if (k === 'e') {
    const p = nearestDockable();
    if (p) { openPort(p); return; }
    const l = nearestLandfall();
    if (l) { landfall(l); return; }
    const enc = Naval.nearestEncounter();
    if (enc) { resolveEncounter(enc); return; }
  }
  if (k === ' ') fireBroadside();
  if (k === 'b') tryBoard();
  if (k === 'g') cycleShotType();
  if (k === 'm') toggleChart();
  if (k === 'j') toggleJournal();
  if (k === 'r') toggleRepPanel();
}

// ---- Landfall events on non-port islands ----------------------

function landfall(isl) {
  if (isl.id === 'wreckers') return; // is a port, handled elsewhere
  if (isl.id === 'drowned') {
    toast('The Drowned Court is silent. The ghost ship that guards it sails these waters — sink it to claim its log.');
    return;
  }
  if (isl.id === 'amberreach') {
    const ashka = G.party.find(m => m.id === 'ashka');
    // Ashka's loyalty arc: she can walk into the hive that sang in her dreams
    if (ashka && !G.loyalty.ashka) {
      G.mode = 'landfall';
      const already = G.fragmentFrom.amberreach;
      const el = document.getElementById('event');
      el.innerHTML = `
        <div class="panel">
          <h2>The Humming Isle</h2>
          <p>Ashka is over the rail before the anchor bites. The swarm descends — and stops. She raises both hands and hums back, the same three notes she has been humming in her sleep since Verdant Maw. ${already
            ? 'The drones circle the scorch-marks your last visit left, and her shoulders drop. She kneels a long while among the broken comb, and when she rises the swarm settles on her arms like falconry birds.'
            : 'One drone lands on her wrist, weightless as a lantern moth. Then, deliberately, the swarm parts — opening a path straight to the great comb, and the amber-sealed thing inside it.'}</p>
          <div class="choices"><button id="ashkaok">${already ? 'Stand vigil with her' : 'Walk the open path'}</button></div>
        </div>`;
      el.classList.add('show');
      el.querySelector('#ashkaok').onclick = () => {
        el.classList.remove('show');
        G.loyalty.ashka = true;
        if (already) {
          G.rep.hive = clamp(G.rep.hive + 25, -100, 100);
          journal('Ashka made what peace can be made at Amberreach. The hive named her friend anyway. Her gullstorms fly with borrowed wings now.');
          toast('Ashka is named Hivefriend. Her Gullstorm strikes harder.', 5000);
        } else {
          G.rep.hive = clamp(G.rep.hive + 15, -100, 100);
          G.cargo.amber = Math.min(G.cargoCap - totalCargo() + G.cargo.amber, G.cargo.amber + 4);
          grantFragment('amberreach', 'Lifted from the great comb with the hive\'s blessing, not a drop of blood spilled: a chart fragment sealed in amber. Ashka wept. The swarm sang.');
          journal('The hive named Ashka friend and let the chart go freely. Not every treasure needs a fight.');
        }
        SFX.play('levelup');
        G.mode = 'sail';
        SaveGame.save();
      };
      return;
    }
    if (G.fragmentFrom.amberreach) { toast('The hive watches you leave in peace.'); return; }
    G.mode = 'landfall';
    Boarding.start('hive', {
      title: 'The Hive Isle',
      intro: 'You wade ashore under cathedral-combs of wax. Amber-gold shapes descend — dragons in miniature, swarm-minded, wings like stained glass. They are not attacking. They are escorting you away from something. Your crew panics and blades come out.',
      onWin: () => {
        grantFragment('amberreach', 'Beneath the largest comb you find a chart fragment sealed in amber — and the amber itself is worth a fortune. The surviving drones watch you go. You could swear they look… disappointed.');
        G.cargo.amber = Math.min(G.cargoCap - totalCargo() + G.cargo.amber, G.cargo.amber + 4);
        G.rep.hive -= 20;
      },
    });
    return;
  }
  if (isl.id === 'cannibal') {
    G.islandEvents = G.islandEvents || {};
    // Return-visit messages after the event resolves
    if (G.islandEvents.cannibals === 'fight') {
      toast('The Feasting Isle is quiet. The jungle has reclaimed the cooking fires.');
      return;
    }
    if (G.islandEvents.cannibals === 'parley') {
      toast('The elder of the Feasting Isle watches from the treeline. The totems still stand.');
      return;
    }
    G.mode = 'landfall';
    const ev = document.getElementById('event');
    ev.innerHTML = `
      <div class="panel">
        <h2>The Feasting Isle</h2>
        <p>The smoke is wrong — too many fires, too carefully placed. Carved totems line the beach: figureheads, compass roses, and one very ornate Merchant Compact seal, all rearranged into something that means something else entirely. Three warriors in warpaint watch from the treeline. One of them waves.</p>
        <div class="choices">
          <button data-c="fight">⚔ Land with weapons drawn</button>
          <button data-c="rum" ${G.cargo.rum < 2 ? 'disabled' : ''}>🍺 Row ashore with two barrels of rum${G.cargo.rum < 2 ? ' (need 2 rum in hold)' : ''}</button>
          <button data-c="leave">⛵ This is a very bad idea — back to sea</button>
        </div>
      </div>`;
    ev.classList.add('show');
    ev.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
      const c = b.dataset.c;
      ev.classList.remove('show');
      if (c === 'leave') { G.mode = 'sail'; return; }

      if (c === 'fight') {
        // Stage 2A: full boarding encounter
        Boarding.start('cannibal', {
          title: 'The Feasting Isle',
          intro: 'The waving stops the moment your boots touch sand. The treeline erupts with painted bodies and something that sounds like drumming but isn\'t.',
          onWin: () => {
            G.islandEvents.cannibals = 'fight';
            const gold = randInt(90, 190);
            G.gold += gold;
            journal(`Fought our way through the Feasting Isle. The village held iron pots, a ledger of missing ships going back twelve years, ship\'s lanterns from six different vessels, and — under the chief\'s longhouse — a Merchant Compact strongbox with ${gold} gold. The survivors scattered into the jungle. The cook refuses to serve supper tonight.`);
            toast(`The Feasting Isle is yours. ${gold} gold from the chief\'s cache. Nobody is eating tonight.`, 5000);
          },
          onLose: () => {
            journal('Driven off the Feasting Isle. The warriors did not pursue past the waterline. Small mercies.');
            toast('The crew retreats to the boats. The warriors watch them go without following.', 5000);
          },
        });
      } else if (c === 'rum') {
        // Stage 2B: rum parley — multi-step reveal
        G.cargo.rum -= 2;
        G.islandEvents.cannibals = 'parley';
        const gold = randInt(180, 290);
        const discoveredAmber = !G.discovered.amberreach;
        if (discoveredAmber) G.discovered.amberreach = true;
        const ev2 = document.getElementById('event');
        ev2.innerHTML = `
          <div class="panel">
            <h2>The Elder's Offer</h2>
            <p>The rum works. The elder — a lean man who speaks three trade languages and one the linguists haven't catalogued yet — accepts the barrels with ceremony. What follows can only be called hospitality if you squint. Before dusk he walks you to a sea cave at the island's back and shows you what his people have been guarding since it washed ashore: a merchant's strongbox, still locked, sea-slick but intact.</p>
            <p><em>"Bad luck to keep,"</em> he gestures. <em>"Good luck to give."</em></p>
            <p>He also tells you — with very deliberate pointing, north-then-east — of a night long ago when something vast fell from the northern lights: amber-gold, trailing fire, singing a note so deep the jungle floor rippled. It swam east. It was not afraid. It did not look back.</p>
            ${discoveredAmber ? `<p class="intro"><em>East of Cinderpeak. Amber-gold. Something is out there that your charts don't show yet.</em></p>` : ''}
            <div class="choices"><button id="candone">Take the chest and go</button></div>
          </div>`;
        ev2.classList.add('show');
        ev2.querySelector('#candone').onclick = () => {
          ev2.classList.remove('show');
          G.gold += gold;
          journal(`Parleyed at the Feasting Isle. The elder traded a wrecked merchant\'s strongbox (${gold} gold) for two barrels of rum and an afternoon of careful goodwill. He described an amber-gold creature — vast, falling from the north, swimming east, singing. The hive hum. The Mist hum. The same note.${discoveredAmber ? ' His account matches the eastern rumours: Amberreach, now charted.' : ''}`);
          if (discoveredAmber) {
            toast(`Elder\'s cache — ${gold} gold, and a lead: something amber-gold swam east. Amberreach charted.`, 6500);
            SFX.play('fragment');
          } else {
            toast(`Elder\'s cache: ${gold} gold. His story and your charts tell the same tale.`, 5000);
            SFX.play('coin');
          }
          G.mode = 'sail';
          SaveGame.save();
        };
      }
    });
    return;
  }

  if (isl.id === 'dragonisle') {
    // the singing is the price of landfall — face it before the shore
    if (!G.mistEvents.singing) { MistVoyage.forceSinging(); return; }
    startFinale();
    return;
  }
}

function cycleShotType() {
  const types = ['round', 'chain', 'grape'];
  const labels = { round: '⚫ Round shot', chain: '⛓ Chain shot', grape: '💥 Grape shot' };
  const descs  = { round: 'standard broadside', chain: 'slows enemy ships for 8s', grape: 'short range — softens crew before boarding' };
  G.shotType = types[(types.indexOf(G.shotType) + 1) % types.length];
  toast(`${labels[G.shotType]} — ${descs[G.shotType]}`, 2800);
}

function resolveEncounter(enc) {
  enc.active = false;
  if (enc.type === 'wreck') {
    const gold = randInt(40, 120);
    G.gold += gold;
    let bonus = '';
    if (totalCargo() < G.cargoCap && Math.random() < 0.6) {
      const k = pick(Object.keys(GOODS));
      G.cargo[k]++;
      bonus = ` and a crate of ${GOODS[k].name.toLowerCase()}`;
    }
    journal(`Salvaged a wreck drifting on the open sea: ${gold} gold${bonus}.`);
    toast(`Wreck salvaged — ${gold} gold${bonus}.`);
    SFX.play('coin');
  } else if (enc.type === 'market') {
    const good = GOODS[enc.goodId];
    const price = Math.max(1, Math.round(good.base * 0.6));
    const evEl = document.getElementById('event');
    evEl.innerHTML = `<div class="panel">
      <h2>🛖 Drifting Market</h2>
      <p>A weathered raft-market rides low in the water, its canopy patched with old sailcloth. The merchant leans over the rail: "Fresh stock, captain. ${good.name} — call it half what you'd pay ashore, but I won't be in these waters long."</p>
      <div class="choices">
        <button id="mktbuy" ${G.gold < price || totalCargo() >= G.cargoCap ? 'disabled' : ''}>Buy ${good.name} for ${price}g</button>
        <button id="mktno">Pass</button>
      </div>
    </div>`;
    evEl.classList.add('show');
    evEl.querySelector('#mktbuy').onclick = () => {
      if (G.gold < price || totalCargo() >= G.cargoCap) return;
      G.gold -= price; G.cargo[enc.goodId]++;
      SFX.play('coin');
      journal(`Bought ${good.name} from a drifting market for ${price}g — well below market rate.`);
      evEl.classList.remove('show');
    };
    evEl.querySelector('#mktno').onclick = () => {
      enc.active = true; // put it back if they decline — they might change their mind
      evEl.classList.remove('show');
    };
  }
}

function grantFragment(islandId, text) {
  if (G.fragmentFrom[islandId]) return;
  G.fragmentFrom[islandId] = true;
  G.fragments++;
  SFX.play('fragment');
  journal(`Chart fragment ${G.fragments}/3 recovered. ${text}`);
  toast(`Chart fragment recovered (${G.fragments}/3)!`, 5000);
  if (G.fragments >= 3) {
    journal('The three fragments align into one chart: an island dead north, deep inside the Mist. Instruments will fail there. Sail by the sun and the singing.');
    toast('The chart is complete. The Mist awaits, dead north.', 6000);
    G.discovered.dragonisle = true;
  }
}

// ---- Finale ----------------------------------------------------

function startFinale() {
  if (G.ending) return;
  G.mode = 'landfall';
  const el = document.getElementById('event');
  el.innerHTML = `
    <div class="panel">
      <h2>Dragon Isle</h2>
      <p>The Mist parts at the shoreline like a held breath released. She is waiting for you on the black sand — the last dragon, vast and patient, scales dulled by long vigil. Behind her, a cave mouth breathes cold air that smells of the deep sea and old honey.</p>
      <p>She speaks without sound: <em>«You followed my children's hum across the world. Choose, captain.»</em></p>
      <div class="choices">
        <button data-c="slay">⚔ Slay her — end the Mist forever</button>
        <button data-c="ally" ${G.cargo.amber < 1 ? 'disabled' : ''}>🤝 Offer the hive-amber — make the Dragon Pact${G.cargo.amber < 1 ? ' (requires hive-amber in the hold)' : ''}</button>
        <button data-c="awaken">🕳 Push past her — see what sleeps below</button>
        <button data-c="leave">⛵ Not yet — back to the ship</button>
      </div>
    </div>`;
  el.classList.add('show');
  el.querySelectorAll('button').forEach(b => b.onclick = () => {
    const c = b.dataset.c;
    el.classList.remove('show');
    if (c === 'leave') {
      G.mode = 'sail';
      toast('She watches you row back to the ship. The Mist waits. So will she.');
      return;
    }
    if (c === 'slay') {
      Boarding.start('dragon', {
        title: 'The Last Dragon',
        intro: 'She rises. The sky goes amber. This will be sung about, if anyone survives to sing it.',
        onWin: () => showEnding('slay'),
        onLose: () => { /* defeat handled by boarding: respawn */ },
      });
      G.mode = 'boarding';
    } else if (c === 'ally') {
      G.cargo.amber--; // the comb is given, not kept
      showEnding('ally');
    } else {
      showEnding('awaken');
    }
  });
}

function showEnding(key) {
  G.ending = key;
  G.mode = 'ending';
  SFX.play('ending');
  const e = ENDINGS[key];
  const el = document.getElementById('event');
  el.innerHTML = `
    <div class="panel ending">
      <h2>${e.title}</h2>
      <p>${e.text}</p>
      <p class="stats">Voyage: ${Math.floor(G.time / 60)} min at sea · ${G.kills} ships sunk · ${G.plunders} decks taken · ${G.gold} gold amassed</p>
      <div class="choices"><button id="newvoyage">⚓ New Voyage</button></div>
    </div>`;
  el.classList.add('show');
  document.getElementById('newvoyage').onclick = () => {
    el.classList.remove('show');
    SaveGame.clear();
    G = newGameState();
    Naval.reset();
    G.mode = 'sail';
  };
  journal(`ENDING — ${e.title}`);
  SaveGame.save();
}

// ---- Overlays: chart, journal, reputation ----------------------

function toggleChart() {
  const el = document.getElementById('chart');
  if (el.classList.contains('show')) { el.classList.remove('show'); return; }
  const c = document.getElementById('chartCanvas');
  c.width = Math.min(window.innerWidth * 0.8, 900);
  c.height = c.width * (WORLD.H / WORLD.W);
  const cc = c.getContext('2d');
  const sx = c.width / WORLD.W, sy = c.height / WORLD.H;
  cc.fillStyle = '#e8dcc0';
  cc.fillRect(0, 0, c.width, c.height);
  // the Mist band
  cc.fillStyle = 'rgba(160,160,175,0.55)';
  cc.fillRect(0, 0, c.width, WORLD.MIST_Y * sy);
  cc.fillStyle = '#7a6a50';
  cc.font = `${Math.round(c.width / 45)}px Georgia`;
  cc.fillText('T H E   M I S T', c.width * 0.40, WORLD.MIST_Y * sy * 0.5);
  for (const isl of ISLANDS) {
    if (!G.discovered[isl.id]) continue;
    cc.beginPath();
    cc.arc(isl.x * sx, isl.y * sy, Math.max(5, isl.r * sx * 0.8), 0, TAU);
    cc.fillStyle = isl.color;
    cc.fill();
    cc.strokeStyle = '#5a4a30';
    cc.stroke();
    cc.fillStyle = '#3a2f1e';
    cc.font = `${Math.round(c.width / 60)}px Georgia`;
    cc.fillText(isl.name, isl.x * sx + 10, isl.y * sy - 8);
  }
  // player
  cc.fillStyle = '#c23b3b';
  cc.beginPath();
  cc.arc(G.ship.x * sx, G.ship.y * sy, 5, 0, TAU);
  cc.fill();
  cc.font = `${Math.round(c.width / 60)}px Georgia`;
  cc.fillText('You', G.ship.x * sx + 8, G.ship.y * sy + 4);
  el.classList.add('show');
}

function toggleJournal() {
  const el = document.getElementById('journal');
  if (el.classList.contains('show')) { el.classList.remove('show'); return; }
  document.getElementById('journalBody').innerHTML =
    G.journal.slice().reverse().map(j => `<p>· ${j}</p>`).join('');
  el.classList.add('show');
}

function toggleRepPanel() {
  const el = document.getElementById('reputation');
  if (el.classList.contains('show')) { el.classList.remove('show'); return; }
  document.getElementById('repBody').innerHTML = Object.entries(FACTIONS)
    .filter(([id]) => id !== 'hive' || G.discovered.amberreach)
    .map(([id, f]) => {
      const r = G.rep[id];
      const label = r <= -50 ? 'HUNTED' : r <= -20 ? 'Hostile' : r < 20 ? 'Neutral' : r < 50 ? 'Friendly' : 'Allied';
      return `<div class="repRow"><span style="color:${f.color}">■</span> ${f.name}
        <span class="repVal ${r <= -50 ? 'hunted' : ''}">${label} (${r})</span></div>`;
    }).join('');
  el.classList.add('show');
}

document.querySelectorAll('.overlay .close').forEach(b => {
  b.onclick = () => b.closest('.overlay').classList.remove('show');
});

// ---- Rendering -------------------------------------------------

let cam = { x: 0, y: 0 };

function dayFactor() {
  // 1 = noon, 0 = midnight
  const t = (G.time % WORLD.DAY_LENGTH) / WORLD.DAY_LENGTH;
  return 0.5 - 0.5 * Math.cos(t * TAU);
}

function biomeTint() {
  // tint water toward nearest island's biome
  let best = null, bd = 1e9;
  for (const isl of ISLANDS) {
    const d = dist(G.ship.x, G.ship.y, isl.x, isl.y);
    if (d < bd) { bd = d; best = isl; }
  }
  const tints = {
    volcanic: [30, 40, 60], jungle: [10, 80, 80], atoll: [20, 110, 120],
    ruin: [40, 55, 75], frozen: [50, 80, 110], temperate: [18, 60, 95],
    hive: [70, 80, 50], mist: [60, 60, 80],
  };
  const base = [10, 40, 75];
  if (!best || bd > 900) return base;
  const t = 1 - bd / 900;
  const bt = tints[best.biome] || base;
  return base.map((v, i) => Math.round(lerp(v, bt[i], t * 0.7)));
}

function render() {
  const w = canvas.width, h = canvas.height;
  cam.x = clamp(G.ship.x - w / 2, 0, WORLD.W - w);
  cam.y = clamp(G.ship.y - h / 2, 0, WORLD.H - h);

  const day = dayFactor();
  const [r0, g0, b0] = biomeTint();
  const dayMul = lerp(0.25, 1, day);
  ctx.fillStyle = `rgb(${Math.round(r0 * dayMul)},${Math.round(g0 * dayMul)},${Math.round(b0 * dayMul)})`;
  ctx.fillRect(0, 0, w, h);

  drawWaves(w, h, day);
  if (day < 0.35) drawPlankton(w, h, day);
  for (const isl of ISLANDS) drawIsland(isl);
  Naval.render(ctx, cam);
  drawPlayerShip();
  if (inMist()) drawMist(w, h);
  drawHud();
}

// animated wave streaks, seeded per world tile so they don't pop
function drawWaves(w, h, day) {
  ctx.strokeStyle = `rgba(255,255,255,${lerp(0.04, 0.10, day)})`;
  ctx.lineWidth = 1.5;
  const tile = 140;
  const x0 = Math.floor(cam.x / tile), y0 = Math.floor(cam.y / tile);
  for (let ty = y0; ty <= y0 + Math.ceil(h / tile) + 1; ty++) {
    for (let tx = x0; tx <= x0 + Math.ceil(w / tile) + 1; tx++) {
      const seed = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
      const ox = (seed % 100) / 100 * tile;
      const oy = ((seed >> 7) % 100) / 100 * tile;
      const ph = (seed % 628) / 100;
      const wx = tx * tile + ox - cam.x;
      const wy = ty * tile + oy - cam.y + Math.sin(G.time * 1.2 + ph) * 6;
      ctx.beginPath();
      ctx.moveTo(wx - 18, wy);
      ctx.quadraticCurveTo(wx, wy - 5, wx + 18, wy);
      ctx.stroke();
    }
  }
}

function drawPlankton(w, h, day) {
  const glow = 1 - day / 0.35;
  ctx.fillStyle = `rgba(120,240,220,${0.5 * glow})`;
  const tile = 90;
  const x0 = Math.floor(cam.x / tile), y0 = Math.floor(cam.y / tile);
  for (let ty = y0; ty <= y0 + Math.ceil(h / tile) + 1; ty++) {
    for (let tx = x0; tx <= x0 + Math.ceil(w / tile) + 1; tx++) {
      const seed = ((tx * 83492791) ^ (ty * 2654435761)) >>> 0;
      if (seed % 5 !== 0) continue;
      const px = tx * tile + (seed % tile) - cam.x;
      const py = ty * tile + ((seed >> 5) % tile) - cam.y;
      const tw = 0.5 + 0.5 * Math.sin(G.time * 2 + seed % 10);
      ctx.globalAlpha = 0.35 * glow * tw;
      ctx.beginPath();
      ctx.arc(px, py, 1.6, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawIsland(isl) {
  if (isl.hidden && !G.discovered[isl.id]) return;
  const x = isl.x - cam.x, y = isl.y - cam.y;
  if (x < -isl.r - 100 || x > canvas.width + isl.r + 100 ||
      y < -isl.r - 100 || y > canvas.height + isl.r + 100) return;
  // shallows ring
  ctx.beginPath();
  ctx.arc(x, y, isl.r + 26, 0, TAU);
  ctx.fillStyle = 'rgba(90,200,210,0.25)';
  ctx.fill();
  // landmass (irregular blob)
  ctx.beginPath();
  for (let i = 0; i <= 14; i++) {
    const a = (i / 14) * TAU;
    const seed = Math.sin(a * 3 + isl.x) * 0.5 + Math.sin(a * 5 + isl.y) * 0.5;
    const rr = isl.r * (0.85 + 0.15 * seed);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = isl.color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.stroke();
  // name + port marker
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '14px Georgia';
  ctx.textAlign = 'center';
  ctx.fillText(isl.name, x, y - isl.r - 14);
  if (isl.port) {
    ctx.fillText('⚓', x, y + 5);
    if (isl.faction) {
      ctx.fillStyle = FACTIONS[isl.faction].color;
      ctx.fillRect(x - 4, y - isl.r - 36, 8, 12);
    }
  }
  ctx.textAlign = 'left';
}

function drawShipShape(x, y, heading, size, hullColor, sailAmount, flagColor) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  // hull
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.quadraticCurveTo(size * 0.3, size * 0.55, -size * 0.8, size * 0.4);
  ctx.lineTo(-size * 0.8, -size * 0.4);
  ctx.quadraticCurveTo(size * 0.3, -size * 0.55, size, 0);
  ctx.fillStyle = hullColor;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.stroke();
  // sail
  if (sailAmount > 0.05) {
    ctx.beginPath();
    ctx.moveTo(-size * 0.1, 0);
    ctx.quadraticCurveTo(-size * 0.5, -size * 0.9 * sailAmount, -size * 0.15, -size * 1.1 * sailAmount);
    ctx.lineTo(-size * 0.15, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(240,235,220,0.95)';
    ctx.fill();
  }
  // flag
  ctx.fillStyle = flagColor;
  ctx.fillRect(-size * 0.2, -size * 1.15, size * 0.35, size * 0.22);
  ctx.restore();
}

function drawPlayerShip() {
  const s = G.ship;
  const x = s.x - cam.x, y = s.y - cam.y;
  // wake
  if (s.speed > 15) {
    ctx.strokeStyle = `rgba(255,255,255,${clamp(s.speed / 200, 0, 0.35)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(s.heading) * 20, y - Math.sin(s.heading) * 20);
    ctx.lineTo(x - Math.cos(s.heading) * 55, y - Math.sin(s.heading) * 55);
    ctx.stroke();
  }
  drawShipShape(x, y, s.heading, 20, '#6b4a2f', s.sail, '#c23b3b');
}

function drawMist(w, h) {
  const depth = clamp((WORLD.MIST_Y - G.ship.y) / WORLD.MIST_Y, 0, 1);
  const grad = ctx.createRadialGradient(w / 2, h / 2, lerp(320, 130, depth), w / 2, h / 2, lerp(700, 320, depth));
  grad.addColorStop(0, 'rgba(200,200,210,0)');
  grad.addColorStop(1, `rgba(200,200,210,${lerp(0.55, 0.92, depth)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // desaturating veil
  ctx.fillStyle = `rgba(185,185,195,${lerp(0.12, 0.3, depth)})`;
  ctx.fillRect(0, 0, w, h);
}

// ---- HUD -------------------------------------------------------

function drawHud() {
  const hud = document.getElementById('hudLeft');
  const s = G.ship;
  const knots = (s.speed / 9).toFixed(1);
  const shotLabels = { round: '⚫ Round', chain: '⛓ Chain', grape: '💥 Grape' };
  hud.innerHTML =
    `<div>⛵ Sail ${(s.sail * 100) | 0}% · ${knots} kn</div>` +
    `<div>🛡 Hull <span class="${s.hull < s.maxHull * 0.3 ? 'danger' : ''}">${Math.ceil(s.hull)}/${s.maxHull}</span></div>` +
    `<div>💰 ${G.gold} gold · 📦 ${totalCargo()}/${G.cargoCap}</div>` +
    `<div>🗺 Fragments ${G.fragments}/3</div>` +
    `<div class="shottype">[G] ${shotLabels[G.shotType || 'round']}</div>`;
  const stormPct = Math.round(Naval.stormEffect(G.ship.x, G.ship.y) * 100);
  if (stormPct > 20) hud.innerHTML += `<div class="${stormPct > 50 ? 'danger' : ''}">⛈ Storm (${stormPct}%)</div>`;

  // compass with wind needle — spins uselessly in the Mist
  const compass = document.getElementById('compass');
  const windTo = inMist() ? G.time * 3.1 : G.wind.dir;
  compass.querySelector('.needle').style.transform =
    `translate(-50%,-100%) rotate(${(windTo + Math.PI / 2) * 180 / Math.PI}deg)`;
  compass.querySelector('.wlabel').textContent =
    inMist() ? '???' : `wind ${(G.wind.strength * 10).toFixed(0)} kn`;

  const hint = document.getElementById('hint');
  const p = nearestDockable(), l = nearestLandfall();
  const target = Naval.boardable();
  const enc = Naval.nearestEncounter();
  if (p) hint.textContent = `[E] Dock at ${p.name}`;
  else if (l) hint.textContent = `[E] Make landfall — ${l.name}`;
  else if (target) hint.textContent = `[B] Board the crippled ${target.label}!`;
  else if (enc && enc.type === 'wreck') hint.textContent = '[E] Salvage the wreck';
  else if (enc && enc.type === 'market') hint.textContent = '[E] Approach the drifting market';
  else if (inMist()) hint.textContent = 'The Mist. Instruments fail. Hold your nerve and sail north.';
  else hint.textContent = '';
}

// ---- Combat glue (delegated to naval.js / boarding.js) ---------

function fireBroadside() { Naval.playerFire(); }
function tryBoard() {
  const t = Naval.boardable();
  if (!t) return;
  Naval.beginBoarding(t);
}

// ---- Port / boarding hooks ------------------------------------

function openPort(isl) {
  G.mode = 'port';
  G.ship.sail = 0;
  G.ship.speed = 0;
  Port.open(isl);
  SaveGame.save();
}
function closePort() { G.mode = 'sail'; }

function onPlayerDefeat() {
  // wash ashore at the nearest friendly port; lose some gold and cargo
  SFX.play('sink');
  toast('Your ship goes down… you wash ashore days later, poorer but alive.', 6000);
  journal('Sunk. The crew clung to wreckage and drifted to safe harbor. Half the gold went to the deep.');
  G.gold = Math.floor(G.gold / 2);
  for (const k of Object.keys(G.cargo)) G.cargo[k] = 0;
  const home = ISLANDS.find(i => i.id === 'meridian');
  G.ship.x = home.x; G.ship.y = home.y + home.r + 80;
  G.ship.hull = G.ship.maxHull;
  G.ship.speed = 0; G.ship.sail = 0;
  for (const m of G.party) { m.hp = m.maxHp; m.mp = m.maxMp; }
  Naval.reset();
  G.mode = 'sail';
  SaveGame.save(); // the sea keeps what it takes — no reload scumming
}

// ---- Title / start --------------------------------------------

function startGame(load) {
  if (load && SaveGame.load()) {
    toast('Voyage resumed.');
  } else {
    G = newGameState();
    Naval.reset();
  }
  document.getElementById('title').classList.remove('show');
  G.mode = 'sail';
}

function showTitle() {
  const t = document.getElementById('title');
  document.getElementById('loadHint').style.display = SaveGame.exists() ? 'block' : 'none';
  t.classList.add('show');
}

// ---- Main loop -------------------------------------------------

let last = performance.now();
let saveTimer = 0;
let stormWarnCooldown = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (G.mode === 'sail') {
    G.time += dt;
    updateWind(dt);
    updateShip(dt);
    Naval.update(dt);
    // Storm hull damage when sails are raised into the squall
    if (stormWarnCooldown > 0) stormWarnCooldown -= dt;
    const se = Naval.stormEffect(G.ship.x, G.ship.y);
    if (se > 0.25 && G.ship.sail > 0.3) {
      G.ship.hull = Math.max(0, G.ship.hull - se * 1.8 * dt);
      if (G.ship.hull <= 0) { G.ship.hull = 0; onPlayerDefeat(); }
      else if (se > 0.5 && stormWarnCooldown <= 0) {
        stormWarnCooldown = 8;
        toast('⛈ Storm! Lower your sails or the hull won\'t hold!', 4000);
      }
    }
    MistVoyage.update(dt);
    saveTimer += dt;
    if (saveTimer > 20) { saveTimer = 0; SaveGame.save(); }
  }
  SFX.ambient();
  if (G.mode === 'sail' || G.mode === 'port') render();
  requestAnimationFrame(frame);
}

showTitle();
requestAnimationFrame(frame);
