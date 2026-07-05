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
    SFX.play('dock');
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

  const HARBOR_FLAVOR = {
    meridian:  'Crown Navy warships line the quay in perfect order. A midshipman scribbles in a ledger. The smell of pitch and authority is everywhere.',
    gulls:     'Three men are arguing over a lobster the size of a boot. Driftwood lanterns swing in the salt wind. Whoever owns this place has never met a regulation they liked.',
    cinderpeak:'Forge-smoke hangs in a permanent haze over the dock. Black-sand beaches stretch on either side. The harbor chain here is heavy enough to anchor a warship — and someone did, once.',
    verdant:   'The jungle presses the dock from three sides. Parrots argue in the canopy. The ropes on the bollards are green with moss, and something is watching from the treetops.',
    silkwater: 'The Compact counting-house dominates the harbor front. Silk bolt samples flutter from every window. Everything here is for sale, including the harbormaster\'s opinion of your flag.',
    bonechapel:'The Ashen Order\'s white-stone quay is immaculate. No gulls land here. The monks who tie up your lines do so in complete silence, and their eyes never quite focus on you.',
    frostholm: 'Ice-melt runs from the dock planking. Whale-oil smoke drifts from the longhouses above. The harbormaster wears a coat made of something that still has its claws.',
    wreckers:  'Half the dock is built from ship\'s timbers that didn\'t choose to be here. The locals watch you unload with the professional interest of people who plan to pick through your cargo eventually.',
  };

  function harbor(body) {
    const dmg = G.ship.maxHull - G.ship.hull;
    const cost = Math.ceil(dmg * 2 * priceMult(true));
    const flavor = HARBOR_FLAVOR[isl.id] ||
      `The harbor is ${isl.faction ? 'kept in ' + FACTIONS[isl.faction].name + ' order' : 'quiet'}. Gulls argue over fish heads.`;

    // Pirate Admiral ceremony — first visit with high pirate rep
    const admiralEvent = isl.id === 'gulls' && G.rep.pirate >= 50 && !G.islandEvents.pirateAdmiral;

    body.innerHTML = `
      <p>${flavor}</p>
      ${admiralEvent ? `
        <div class="upg">
          <em>The captains of Gull's Rest are assembled on the quay. Someone has found a flag — your flag — and nailed it to the lighthouse. The eldest of them steps forward. "We've watched your career with professional admiration," he says. "There is a vacancy. The last Admiral fell off a cliff in unclear circumstances. The position is yours, if you want it."</em>
        </div>
        <button id="admiral">⚓ Accept — become Admiral of the Free Pirates</button>` : ''}
      <button id="repair" ${G.ship.hull >= G.ship.maxHull ? 'disabled' : ''}>🔧 Careen & repair hull (${cost} gold)</button>
      <button id="rest">🛏 Rest the crew — heal the party (free)</button>`;
    if (admiralEvent) {
      body.querySelector('#admiral').onclick = () => {
        G.islandEvents.pirateAdmiral = true;
        G.rep.pirate = 100;
        journal('Named Admiral of the Free Pirates at Gull\'s Rest. The captains cheered, fired off two broadsides in salute, and accidentally sank a dinghy. The flag looks good on the lighthouse.');
        toast('⚓ Admiral of the Free Pirates — the free seas know your name.', 6000);
        SFX.play('levelup');
        SaveGame.save();
        show('harbor');
      };
    }
    body.querySelector('#repair').onclick = () => {
      if (G.gold < cost) { toast('Not enough gold for repairs.'); return; }
      G.gold -= cost;
      G.ship.hull = G.ship.maxHull;
      SFX.play('coin');
      show('harbor');
    };
    body.querySelector('#rest').onclick = () => {
      for (const m of G.party) { m.hp = m.maxHp; m.mp = m.maxMp; }
      SFX.play('heal');
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
      SFX.play('coin');
      show('trade');
    });
    body.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => {
      const id = b.dataset.sell;
      if (G.cargo[id] < 1) return;
      G.gold += goodPrice(id, false); G.cargo[id]--;
      SFX.play('coin');
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
      SFX.play('coin');
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
    // recruitable crew drink here
    const recruit = RECRUITS.find(r => r.port === isl.id && !G.party.some(m => m.id === r.id));
    if (recruit && G.party.length < 6) {
      html += `<div class="upg"><em>${recruit.pitch}</em></div>
        <button data-hire="${recruit.id}">🤝 Hire ${recruit.name}, ${recruit.cls} (${recruit.cost}g)</button>`;
    }
    // Sigrid's loyalty arc: reforge the harpoon at the Cinderpeak forges
    if (isl.id === 'cinderpeak' && G.party.some(m => m.id === 'sigrid') && !G.loyalty.sigrid) {
      html += `<div class="upg"><em>Sigrid turns her grandmother's harpoon over in the forge-light. The star-iron head is cracked through. "They could mend it here," she says, not quite asking.</em></div>
        <button id="reforge">🔥 Reforge the star-iron harpoon (150g)</button>`;
    }
    // quest hook: the buried fragment at Wreckers' Shoal
    if (isl.id === 'wreckers' && G.rumorsHeard.frag1 && !G.fragmentFrom.wreckers) {
      html += `<button id="dig">⛏ Follow the wrecker's tale — dig on the north beach</button>`;
    }
    // Bonechapel: Ashen Order amber premium and hidden charts
    const bonechapelAmber = isl.id === 'bonechapel' && G.cargo.amber > 0;
    const bonechapelCharts = isl.id === 'bonechapel' && !G.rumorsHeard.frag2;
    if (bonechapelAmber) {
      const amberPremium = Math.round(GOODS.amber.base * 3.0);
      html += `<div class="upg"><em>An Ashen elder approaches without preamble. "The amber speaks to those with ears for it. We would take every crate — triple the common rate, no accounting required."</em></div>
        <button id="amberSell">⚗ Sell ${G.cargo.amber} hive-amber to the Order (${amberPremium * G.cargo.amber}g total)</button>`;
    }
    if (bonechapelCharts) {
      html += `<button id="ashenCharts">📜 Purchase the Order's sea charts (150g)</button>`;
    }
    // Silkwater: Compact Factor one-time bulk buyout
    const compactBuyout = isl.id === 'silkwater' && totalCargo() > 0 && !G.islandEvents.compactBuyout;
    if (compactBuyout) {
      const buyoutVal = Object.keys(GOODS).reduce((sum, id) => sum + Math.round(GOODS[id].base * 1.5) * G.cargo[id], 0);
      html += `<div class="upg"><em>A factor in a Compact coat materialises at your elbow. "I don't often see a full hold in this harbor. My employers are short on everything — rum, silk, the lot. I'm authorised to offer half-again the post price for the lot of it, no questions, cash now." He places a ledger on the table, open to a blank page.</em></div>
        <button id="compactSell" ${buyoutVal === 0 ? 'disabled' : ''}>📋 Sell entire hold to the Compact (${buyoutVal}g — 1.5× rate)</button>`;
    }
    // Bonechapel: Ashen rite of passage — Mist blessing
    const ashenRite = isl.id === 'bonechapel' && G.rep.ashen >= 10 && !G.ashenBlessed;
    if (ashenRite) {
      html += `<div class="upg"><em>The elder who handled your amber approaches after the others have gone. She sets a small bone disc on the table. "You have traded fairly with the Order," she says. "In return — a rite of passage. The Mist does not frighten those who know its name. When your crew falters, you will remember what we teach you." She waits.</em></div>
        <button id="ashenRite" ${G.gold < 300 ? 'disabled' : ''}>🕯 Accept the rite of passage (300g)</button>`;
    }
    // Old Hatch at Wreckers' Shoal — sells Vael's chart after vael_hook rumor is heard
    const oldHatch = isl.id === 'wreckers' && G.rumorsHeard.vael_hook && !G.vaelMap;
    if (oldHatch) {
      const mapCost = G.rep.pirate >= 40 ? 400 : G.rep.pirate >= 20 ? 600 : 800;
      html += `<div class="upg"><em>In the corner booth sits a man who looks like a cancelled debt — face like a rope-scar, three empty mugs in front of him. He introduces himself as Hatch. "Heard you been asking about Ida Vael," he says. "I knew her. Had her cartographer\'s coat thirty years. Never had the nerve to follow the chart inside it. You look like you might." He slides a water-stained folded paper across the table.</em></div>
        <button id="buyMap" ${G.gold < mapCost ? 'disabled' : ''}>🗺 Buy Vael\'s chart from Old Hatch (${mapCost}g)</button>`;
    }
    if (!localRumors.length &&
        !(isl.id === 'wreckers' && G.rumorsHeard.frag1 && !G.fragmentFrom.wreckers) &&
        !bonechapelAmber && !bonechapelCharts && !oldHatch && !compactBuyout && !ashenRite) {
      html += `<p class="tradetip">${tavernFlavor()}</p>`;
    }
    body.innerHTML = html;
    body.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
      const r = RUMORS.find(x => x.id === b.dataset.r);
      if (G.gold < r.cost) { toast('You cannot even afford the round.'); return; }
      G.gold -= r.cost;
      G.rumorsHeard[r.id] = true;
      SFX.play('rumor');
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
    body.querySelectorAll('[data-hire]').forEach(b => b.onclick = () => {
      const r = RECRUITS.find(x => x.id === b.dataset.hire);
      if (!r || G.gold < r.cost || G.party.length >= 6) {
        if (G.gold < r.cost) toast('You cannot cover the signing bounty.');
        return;
      }
      G.gold -= r.cost;
      const levelDiff = G.partyLevel - 1;
      const maxHp = r.maxHp + levelDiff * 8;
      const maxMp = r.maxMp + levelDiff * 1;
      G.party.push({ ...r, maxHp, hp: maxHp, maxMp, mp: maxMp });
      SFX.play('levelup');
      journal(`${r.name} signed aboard at ${isl.name}. ${r.loyaltyHint}`);
      toast(`${r.name} joins the crew!`, 4500);
      SaveGame.save();
      show('tavern');
    });
    const amberSell = body.querySelector('#amberSell');
    if (amberSell) amberSell.onclick = () => {
      const val = Math.round(GOODS.amber.base * 3.0) * G.cargo.amber;
      G.gold += val;
      journal(`Sold ${G.cargo.amber} hive-amber to the Ashen Order for ${val}g — triple market rate. They carried the crates off without a word.`);
      toast(`${val}g from the Order. Their eyes never left the amber.`, 4500);
      G.cargo.amber = 0;
      G.rep.ashen = clamp(G.rep.ashen + 12, -100, 100);
      SFX.play('coin');
      show('tavern');
    };
    const ashenCharts = body.querySelector('#ashenCharts');
    if (ashenCharts) ashenCharts.onclick = () => {
      if (G.gold < 150) { toast('The Order does not barter on price.'); return; }
      G.gold -= 150;
      G.rumorsHeard.frag2 = true;
      if (!G.discovered.drowned) {
        G.discovered.drowned = true;
        journal('Bought the Order\'s sea charts. The Drowned Court is marked — ghost sightings noted in the margin. "Do not avoid it," the elder added quietly, "if you need what it carries."');
        toast('Drowned Court charted. A ghost ship circles those waters.', 5500);
      } else {
        journal('The Order\'s charts confirm the Drowned Court log. The ghost ship\'s captain carried something from inside the Mist itself.');
        toast('The Order confirms: the ghost ship carries a chart from the Mist.', 4500);
      }
      SFX.play('rumor');
      show('tavern');
    };
    const compactSell = body.querySelector('#compactSell');
    if (compactSell) compactSell.onclick = () => {
      const val = Object.keys(GOODS).reduce((sum, id) => sum + Math.round(GOODS[id].base * 1.5) * G.cargo[id], 0);
      if (val === 0) return;
      G.gold += val;
      for (const k of Object.keys(G.cargo)) G.cargo[k] = 0;
      G.islandEvents.compactBuyout = true;
      G.rep.merchant = clamp(G.rep.merchant + 8, -100, 100);
      journal(`Sold the entire hold to the Compact Factor at Silkwater for ${val}g — one and a half times the going rate. He wrote something in his ledger and closed it before we could read.`);
      toast(`${val}g from the Factor. Hold empty. A good deal, probably.`, 5000);
      SFX.play('coin');
      show('tavern');
    };
    const ashenRiteBtn = body.querySelector('#ashenRite');
    if (ashenRiteBtn) ashenRiteBtn.onclick = () => {
      if (G.gold < 300) { toast('The Order does not lower the price.'); return; }
      G.gold -= 300;
      G.ashenBlessed = true;
      G.rep.ashen = clamp(G.rep.ashen + 15, -100, 100);
      journal('Accepted the Ashen Order\'s rite of passage at Bonechapel. The elder spent an hour in silence, drawing a symbol on a disc of whale-bone. She pressed it into our captain\'s hand. "Name the Mist when it presses close," she said, "and it will step back."');
      toast('The rite is given. In the Mist, the Ashen words will steady the crew.', 5500);
      SFX.play('buff');
      SaveGame.save();
      show('tavern');
    };
    const buyMap = body.querySelector('#buyMap');
    if (buyMap) buyMap.onclick = () => {
      const mapCost = G.rep.pirate >= 40 ? 400 : G.rep.pirate >= 20 ? 600 : 800;
      if (G.gold < mapCost) { toast('You cannot cover the price.'); return; }
      G.gold -= mapCost;
      G.vaelMap = true;
      G.discovered.vael_reef = true;
      SFX.play('rumor');
      journal(`Bought Vael's chart from Old Hatch at Wreckers' Shoal for ${mapCost}g. The Corsair's Reef is charted — east of Cinderpeak. Hatch ordered another drink and said nothing more.`);
      toast("Vael's chart in hand. The Corsair's Reef is now charted.", 5000);
      show('tavern');
    };
    const reforge = body.querySelector('#reforge');
    if (reforge) reforge.onclick = () => {
      if (G.gold < 150) { toast('The smiths do not work on credit.'); return; }
      G.gold -= 150;
      G.loyalty.sigrid = true;
      const sigrid = G.party.find(m => m.id === 'sigrid');
      if (sigrid) { sigrid.maxHp += 10; sigrid.hp = sigrid.maxHp; }
      SFX.play('levelup');
      journal('Cinderpeak\'s smiths reforged the star-iron harpoon. Sigrid held it up to the forge-glow and, for the first time anyone aboard has seen, smiled.');
      toast('The star-iron harpoon is whole. Sigrid will not miss.', 5000);
      SaveGame.save();
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
