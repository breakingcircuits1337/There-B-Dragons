// ============================================================
// There Be Dragons — port interface
// Trade, shipyard, tavern rumors, repairs (DOM overlay)
// ============================================================
'use strict';

const Port = (() => {
  let isl = null;
  const el = () => document.getElementById('port');

  function open(island) {
    isl = island;
    const f = isl.faction;
    if (f && G.rep[f] <= -50) {
      toast(`${isl.name} fires a warning shot — you are HUNTED by the ${FACTIONS[f].name}. No harbor here.`, 5000);
      G.mode = 'sail';
      return;
    }
    if (f && G.rep[f] <= -20) {
      toast('They let you dock, but the harbormaster spits at your flag. Expect ugly prices.');
    }
    el().classList.add('show');
    show('harbor');
  }

  function close() {
    el().classList.remove('show');
    closePort();
  }

  function priceMult(buying) {
    const f = isl.faction;
    let m = 1;
    if (f) {
      const r = G.rep[f];
      if (r <= -20) m = buying ? 1.35 : 0.75;
      else if (r >= 50) m = buying ? 0.9 : 1.1;
    }
    return m;
  }

  function goodPrice(id, buying) {
    const mod = (isl.priceMod && isl.priceMod[id]) || 1;
    const spread = buying ? 1.08 : 0.92; // harbor takes a cut both ways
    return Math.max(1, Math.round(GOODS[id].base * mod * spread * priceMult(buying)));
  }

  // ---- Tabs ------------------------------------------------------

  function show(tab) {
    const f = isl.faction ? FACTIONS[isl.faction] : null;
    el().innerHTML = `
      <div class="panel port">
        <h2>⚓ ${isl.name}</h2>
        <p class="portdesc">${isl.desc}${f ? ` <span style="color:${f.color}">[${f.name}]</span>` : ''}</p>
        <div class="tabs">
          ${['harbor', 'trade', 'shipyard', 'tavern'].map(t =>
            `<button class="tab ${t === tab ? 'on' : ''}" data-t="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}
          <button class="tab leave">Set Sail ⛵</button>
        </div>
        <div class="tabbody" id="tabbody"></div>
        <div class="portfoot">💰 ${G.gold} gold · 📦 ${totalCargo()}/${G.cargoCap} cargo · 🛡 hull ${Math.ceil(G.ship.hull)}/${G.ship.maxHull}</div>
      </div>`;
    el().querySelectorAll('.tab[data-t]').forEach(b => b.onclick = () => show(b.dataset.t));
    el().querySelector('.leave').onclick = close;
    const body = el().querySelector('#tabbody');
    if (tab === 'harbor') harbor(body);
    if (tab === 'trade') trade(body);
    if (tab === 'shipyard') shipyard(body);
    if (tab === 'tavern') tavern(body);
  }

  function harbor(body) {
    const dmg = G.ship.maxHull - G.ship.hull;
    const cost = Math.ceil(dmg * 2 * priceMult(true));
    body.innerHTML = `
      <p>The harbor is ${isl.faction ? 'kept in ' + FACTIONS[isl.faction].name + ' order' : 'quiet'}. Gulls argue over fish heads. Your crew eyes the taverns.</p>
      <button id="repair" ${G.ship.hull >= G.ship.maxHull ? 'disabled' : ''}>🔧 Careen & repair hull (${cost} gold)</button>
      <button id="rest">🛏 Rest the crew — heal the party (free)</button>`;
    body.querySelector('#repair').onclick = () => {
      if (G.gold < cost) { toast('Not enough gold for repairs.'); return; }
      G.gold -= cost;
      G.ship.hull = G.ship.maxHull;
      show('harbor');
    };
    body.querySelector('#rest').onclick = () => {
      for (const m of G.party) { m.hp = m.maxHp; m.mp = m.maxMp; }
      toast('The crew rests. Wounds close, songs are sung, someone loses a boot.');
      show('harbor');
    };
  }

  function trade(body) {
    body.innerHTML = `
      <table class="trade">
        <tr><th>Good</th><th>Buy</th><th>Sell</th><th>Hold</th><th></th><th></th></tr>
        ${Object.keys(GOODS).map(id => {
          const buy = goodPrice(id, true), sell = goodPrice(id, false);
          return `<tr>
            <td>${GOODS[id].name}</td>
            <td>${buy}g</td><td>${sell}g</td><td>${G.cargo[id]}</td>
            <td><button data-buy="${id}" ${G.gold < buy || totalCargo() >= G.cargoCap ? 'disabled' : ''}>Buy</button></td>
            <td><button data-sell="${id}" ${G.cargo[id] < 1 ? 'disabled' : ''}>Sell</button></td>
          </tr>`;
        }).join('')}
      </table>
      <p class="tradetip">Prices differ by region — rum is cheap in the jungle, silk at its source, amber worth a fortune to the Ashen Order.</p>`;
    body.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
      const id = b.dataset.buy, cost = goodPrice(id, true);
      if (G.gold < cost || totalCargo() >= G.cargoCap) return;
      G.gold -= cost; G.cargo[id]++;
      show('trade');
    });
    body.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => {
      const id = b.dataset.sell;
      if (G.cargo[id] < 1) return;
      G.gold += goodPrice(id, false); G.cargo[id]--;
      show('trade');
    });
  }

  function shipyard(body) {
    body.innerHTML = UPGRADES.map(u => {
      const owned = G.upgrades[u.id];
      const locked = u.requires && !G.upgrades[u.requires];
      const cost = Math.round(u.cost * priceMult(true));
      return `<div class="upg ${owned ? 'owned' : ''}">
        <div><strong>${u.name}</strong> — ${u.desc}</div>
        ${owned ? '<span class="tag">Installed</span>'
          : locked ? `<span class="tag">Requires ${UPGRADES.find(x => x.id === u.requires).name}</span>`
          : `<button data-u="${u.id}" ${G.gold < cost ? 'disabled' : ''}>Buy (${cost}g)</button>`}
      </div>`;
    }).join('');
    body.querySelectorAll('[data-u]').forEach(b => b.onclick = () => {
      const u = UPGRADES.find(x => x.id === b.dataset.u);
      const cost = Math.round(u.cost * priceMult(true));
      if (G.gold < cost) return;
      G.gold -= cost;
      G.upgrades[u.id] = true;
      if (u.id === 'hull2') { G.ship.maxHull = 150; G.ship.hull += 50; }
      if (u.id === 'hull3') { G.ship.maxHull = 220; G.ship.hull += 70; }
      if (u.id === 'cargo2') G.cargoCap = 40;
      journal(`Fitted ${u.name} at ${isl.name}.`);
      show('shipyard');
    });
  }

  function tavern(body) {
    const localRumors = RUMORS.filter(r => r.port === isl.id && !G.rumorsHeard[r.id]);
    let html = `<p>Lantern smoke, spilled rum, and half the sea's secrets for the price of a round.</p>`;
    html += localRumors.map(r =>
      `<button data-r="${r.id}">🍺 Buy a round, hear a rumor (${r.cost}g)</button>`).join('') ||
      '';
    // quest hook: the buried fragment at Wreckers' Shoal
    if (isl.id === 'wreckers' && G.rumorsHeard.frag1 && !G.fragmentFrom.wreckers) {
      html += `<button id="dig">⛏ Follow the wrecker's tale — dig on the north beach</button>`;
    }
    if (!localRumors.length && !(isl.id === 'wreckers' && G.rumorsHeard.frag1 && !G.fragmentFrom.wreckers)) {
      html += `<p class="tradetip">${tavernFlavor()}</p>`;
    }
    body.innerHTML = html;
    body.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
      const r = RUMORS.find(x => x.id === b.dataset.r);
      if (G.gold < r.cost) { toast('You cannot even afford the round.'); return; }
      G.gold -= r.cost;
      G.rumorsHeard[r.id] = true;
      if (r.reveals && !G.discovered[r.reveals]) {
        G.discovered[r.reveals] = true;
        toast(`New location charted: ${ISLANDS.find(i => i.id === r.reveals).name}. Check your chart [M].`, 5000);
      }
      journal(`Tavern rumor at ${isl.name}: ${r.text}`);
      alertRumor(r.text);
      show('tavern');
    });
    const dig = body.querySelector('#dig');
    if (dig) dig.onclick = () => {
      grantFragment('wreckers', 'Dug from the north beach of Wreckers\' Shoal, wrapped in oilcloth: a scorched corner of a master chart.');
      show('tavern');
    };
  }

  function tavernFlavor() {
    return pick([
      'A drunk bosun insists the Mist "hums like a hive" on still nights. Nobody laughs anymore.',
      'Two merchants argue over powder futures. A zealot of the Ashen Order watches the sea and says nothing.',
      'Someone carved a dragon into the bar top. The barkeep charges double to anyone who mentions it.',
      'An old chart-seller swears every map of the northern sea goes blank in the same spot. "Not unexplored," she says. "Erased."',
    ]);
  }

  function alertRumor(text) {
    const ev = document.getElementById('event');
    ev.innerHTML = `<div class="panel"><h2>🍺 Tavern Rumor</h2><p>${text}</p>
      <div class="choices"><button id="evok">Noted in the journal</button></div></div>`;
    ev.classList.add('show');
    ev.querySelector('#evok').onclick = () => ev.classList.remove('show');
  }

  return { open };
})();
