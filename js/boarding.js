// ============================================================
// There Be Dragons — boarding actions
// Turn-based tactical party combat (DOM overlay)
// ============================================================
'use strict';

const Boarding = (() => {
  const el = () => document.getElementById('boarding');

  let enemies = [];
  let opts = null;
  let turnIdx = 0;          // which party member is acting
  let pendingAbility = null; // 'attack' | ability id awaiting a target
  let effects = null;        // active buffs/debuffs
  let busy = false;          // animation/enemy-turn lock
  let round = 0;

  function levelMul() { return 1 + (G.partyLevel - 1) * 0.12; }

  function start(crewKey, options) {
    opts = options || {};
    round = 0;
    effects = { shanty: 0, dirge: 0, smoke: 0, parry: false };
    enemies = BOARDING_CREWS[crewKey].map((t, i) => {
      const E = ENEMY_TYPES[t];
      return { ...E, hp: E.maxHp, idx: i, type: t };
    });
    for (const m of G.party) m.mp = m.maxMp; // fresh powder for every action
    turnIdx = firstAlive();
    pendingAbility = null;
    busy = false;
    G.mode = 'boarding';
    G.ship.sail = 0; G.ship.speed = 0;
    el().classList.add('show');
    log(`— ${opts.title || 'Boarding Action'} —`, 'title');
    if (opts.intro) log(opts.intro, 'intro');
    draw();
  }

  function firstAlive(from = 0) {
    for (let i = from; i < G.party.length; i++) if (G.party[i].hp > 0) return i;
    return -1;
  }

  // ---- Rendering -----------------------------------------------

  function draw() {
    const box = el();
    const active = G.party[turnIdx];
    box.querySelector('.title').textContent = opts.title || 'Boarding Action';

    box.querySelector('.party').innerHTML = G.party.map((m, i) => `
      <div class="unit ${m.hp <= 0 ? 'dead' : ''} ${i === turnIdx && !busy ? 'active' : ''}">
        <div class="uname">${m.name}</div>
        <div class="ucls">${m.cls} · Lv ${G.partyLevel}</div>
        <div class="bar hp"><i style="width:${clamp(m.hp / m.maxHp, 0, 1) * 100}%"></i><span>${Math.max(0, m.hp)}/${m.maxHp}</span></div>
        <div class="bar mp"><i style="width:${clamp(m.mp / m.maxMp, 0, 1) * 100}%"></i><span>${m.mp} MP</span></div>
      </div>`).join('');

    box.querySelector('.enemies').innerHTML = enemies.map((e, i) => `
      <div class="unit enemy ${e.hp <= 0 ? 'dead' : ''} ${pendingAbility && e.hp > 0 ? 'targetable' : ''}" data-i="${i}">
        <div class="uname">${e.name}${e.boss ? ' 🐉' : ''}</div>
        <div class="bar hp"><i style="width:${clamp(e.hp / e.maxHp, 0, 1) * 100}%"></i><span>${Math.max(0, e.hp)}/${e.maxHp}</span></div>
      </div>`).join('');

    const menu = box.querySelector('.actions');
    if (busy || !active || active.hp <= 0) {
      menu.innerHTML = '';
    } else if (pendingAbility) {
      menu.innerHTML = `<div class="prompt">Choose a target…</div>
        <button class="cancel">✖ Cancel</button>`;
      menu.querySelector('.cancel').onclick = () => { pendingAbility = null; draw(); };
    } else {
      menu.innerHTML = `
        <div class="prompt">${active.name} — your move:</div>
        <button data-a="attack">⚔ Attack (${active.atk[0]}–${active.atk[1]})</button>
        ${active.abilities.map(a => `
          <button data-a="${a.id}" ${active.mp < a.cost ? 'disabled' : ''} title="${a.desc}">
            ✦ ${a.name} <small>(${a.cost} MP)</small></button>`).join('')}
      `;
      menu.querySelectorAll('button').forEach(b => b.onclick = () => choose(b.dataset.a));
    }

    box.querySelectorAll('.enemies .unit.targetable').forEach(u => {
      u.onclick = () => resolveTargeted(parseInt(u.dataset.i, 10));
    });

    const badges = [];
    if (effects.shanty > 0) badges.push(`♪ Battle Shanty (${effects.shanty})`);
    if (effects.dirge > 0) badges.push(`♫ Dirge (${effects.dirge})`);
    if (effects.smoke > 0) badges.push('☁ Smoke Veil');
    if (effects.parry) badges.push('🛡 Parry Stance');
    box.querySelector('.effects').textContent = badges.join('  ·  ');
  }

  function log(msg, cls = '') {
    const lg = el().querySelector('.blog');
    const p = document.createElement('p');
    p.textContent = msg;
    if (cls) p.className = cls;
    lg.appendChild(p);
    lg.scrollTop = lg.scrollHeight;
    while (lg.children.length > 40) lg.removeChild(lg.firstChild);
  }

  // ---- Player actions ------------------------------------------

  function choose(actionId) {
    const active = G.party[turnIdx];
    if (actionId === 'attack') { pendingAbility = 'attack'; draw(); return; }
    const ab = active.abilities.find(a => a.id === actionId);
    if (!ab || active.mp < ab.cost) return;
    // untargeted abilities resolve immediately
    if (['parry', 'smoke', 'shanty', 'dirge', 'springs', 'bomb'].includes(actionId)) {
      active.mp -= ab.cost;
      resolveUntargeted(actionId, active);
      endMemberTurn();
      return;
    }
    pendingAbility = actionId; // flurry, tidal need a target
    draw();
  }

  function dmgRoll(range, mult = 1) {
    return Math.round(rand(range[0], range[1]) * mult * levelMul() * (effects.shanty > 0 ? 1.4 : 1));
  }

  function hitEnemy(e, dmg, label) {
    e.hp -= dmg;
    SFX.play('sword');
    log(`${label} — ${dmg} damage to ${e.name}.`);
    if (e.hp <= 0) log(`${e.name} is down!`, 'kill');
  }

  function resolveTargeted(i) {
    const e = enemies[i];
    if (!e || e.hp <= 0) return;
    const active = G.party[turnIdx];
    if (pendingAbility === 'attack') {
      hitEnemy(e, dmgRoll(active.atk), `${active.name} strikes`);
    } else {
      const ab = active.abilities.find(a => a.id === pendingAbility);
      if (ab) active.mp -= ab.cost;
      if (pendingAbility === 'flurry') {
        for (let n = 0; n < 3 && e.hp > 0; n++) hitEnemy(e, dmgRoll([6, 9]), `Flurry cut ${n + 1}`);
      } else if (pendingAbility === 'tidal') {
        hitEnemy(e, dmgRoll([16, 24]), 'Tidal Lash crashes down');
      }
    }
    pendingAbility = null;
    endMemberTurn();
  }

  function resolveUntargeted(id, active) {
    if (id === 'parry') { effects.parry = true; SFX.play('buff'); log(`${active.name} takes a parry stance.`); }
    if (id === 'smoke') { effects.smoke = 1; SFX.play('buff'); log('Brix fills the deck with blinding smoke — the party is hard to hit.'); }
    if (id === 'shanty') { effects.shanty = 2; SFX.play('buff'); log('Quill strikes up a battle shanty — blades move faster! (+40% dmg, 2 rounds)'); }
    if (id === 'dirge') { effects.dirge = 2; SFX.play('buff'); log('Quill sings the Dirge of the Deep — the foe falters. (-30% enemy dmg, 2 rounds)'); }
    if (id === 'springs') {
      SFX.play('heal');
      const target = G.party.filter(m => m.hp > 0).sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
      const heal = Math.round(rand(18, 26) * levelMul());
      target.hp = Math.min(target.maxHp, target.hp + heal);
      log(`Healing Springs restores ${heal} HP to ${target.name}.`);
    }
    if (id === 'bomb') {
      SFX.play('bomb');
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        hitEnemy(e, dmgRoll([10, 15]), 'The bomb blast hits');
      }
    }
  }

  function endMemberTurn() {
    if (checkEnd()) return;
    // effects.parry belongs to the captain; keep until enemy phase resolves
    const next = firstAlive(turnIdx + 1);
    if (next === -1) {
      enemyPhase();
    } else {
      turnIdx = next;
      draw();
    }
  }

  // ---- Enemy phase ----------------------------------------------

  function enemyPhase() {
    busy = true;
    draw();
    const actors = enemies.filter(e => e.hp > 0);
    let i = 0;
    const step = () => {
      if (i >= actors.length) { endRound(); return; }
      const e = actors[i++];
      if (e.hp > 0) enemyAct(e);
      draw();
      if (checkEnd()) return;
      setTimeout(step, 650);
    };
    setTimeout(step, 650);
  }

  function enemyAct(e) {
    const living = G.party.filter(m => m.hp > 0);
    if (!living.length) return;
    const mult = (effects.dirge > 0 ? 0.7 : 1);
    if (e.boss && round % 3 === 2) {
      log('The dragon draws breath — FIRE SWEEPS THE BLACK SAND!', 'boss');
      for (const m of living) applyHit(e, m, 0.7 * mult, 'dragonfire');
      return;
    }
    const target = pick(living);
    applyHit(e, target, mult, null);
  }

  function applyHit(e, m, mult, tag) {
    if (effects.smoke > 0 && Math.random() < 0.4) {
      log(`${e.name} swings at ${m.name} — lost in the smoke!`);
      return;
    }
    let dmg = Math.round(rand(e.atk[0], e.atk[1]) * mult);
    if (m.id === 'captain' && effects.parry) dmg = Math.ceil(dmg / 2);
    m.hp -= dmg;
    SFX.play('sword');
    log(`${e.name} ${tag === 'dragonfire' ? 'burns' : 'hits'} ${m.name} for ${dmg}.`, tag ? 'boss' : '');
    if (m.hp <= 0) { m.hp = 0; log(`${m.name} falls!`, 'kill'); }
  }

  function endRound() {
    round++;
    effects.parry = false;
    if (effects.smoke > 0) effects.smoke--;
    if (effects.shanty > 0) effects.shanty--;
    if (effects.dirge > 0) effects.dirge--;
    // small MP recovery each round
    for (const m of G.party) if (m.hp > 0) m.mp = Math.min(m.maxMp, m.mp + 1);
    busy = false;
    turnIdx = firstAlive();
    if (checkEnd()) return;
    draw();
  }

  // ---- Win / lose -----------------------------------------------

  function checkEnd() {
    if (enemies.every(e => e.hp <= 0)) { finish(true); return true; }
    if (G.party.every(m => m.hp <= 0)) { finish(false); return true; }
    return false;
  }

  function finish(won) {
    busy = true;
    draw();
    setTimeout(() => {
      el().classList.remove('show');
      // wounded survivors patch up to at least 30%
      for (const m of G.party) {
        if (m.hp > 0) m.hp = Math.max(m.hp, Math.round(m.maxHp * 0.3));
        else m.hp = Math.round(m.maxHp * 0.25); // the fallen are dragged back aboard
      }
      if (won) {
        const xp = enemies.reduce((a, e) => a + e.maxHp, 0);
        G.partyXp += xp;
        while (G.partyXp >= G.partyLevel * 150) {
          G.partyXp -= G.partyLevel * 150;
          G.partyLevel++;
          for (const m of G.party) { m.maxHp += 8; m.hp = m.maxHp; m.maxMp += 1; m.mp = m.maxMp; }
          SFX.play('levelup');
          toast(`The crew grows saltier — party level ${G.partyLevel}!`, 4500);
          journal(`The crew reached level ${G.partyLevel}. Harder to kill, meaner in a scrap.`);
        }
        G.mode = 'sail';
        if (opts.onWin) opts.onWin();
      } else {
        G.mode = 'sail';
        if (opts.onLose) opts.onLose();
        else onPlayerDefeat();
      }
      SaveGame.save();
    }, 1200);
  }

  return { start };
})();
