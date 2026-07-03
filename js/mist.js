// ============================================================
// There Be Dragons — the Mist voyage
// The blind passage: crew morale, siren ambush, the singing.
// Events run only on the true voyage (all 3 fragments held).
// ============================================================
'use strict';

const MistVoyage = (() => {
  let announced = false;

  function update(dt) {
    if (!inMist()) {
      announced = false;
      if (G.mistTimer) G.mistTimer = 0;
      return;
    }
    if (!announced) {
      announced = true;
      if (G.fragments >= 3 && !G.ending) {
        toast('The Mist swallows the horizon. The crew goes quiet. Somewhere ahead, something hums.', 6000);
      } else if (!G.ending) {
        toast('The Mist. Charts end here — without the full chart there is nothing to find but cold.', 5000);
      }
    }
    if (G.fragments < 3 || G.ending || G.mode !== 'sail') return;

    // timer resets after each event (and on leaving the Mist), so the
    // gauntlet advances at a steady pace no matter how the ship wanders
    G.mistTimer += dt;
    if (!G.mistEvents.morale && G.mistTimer > 4) {
      G.mistTimer = 0;
      return moraleEvent();
    }
    if (G.mistEvents.morale && !G.mistEvents.sirens && G.mistTimer > 7) {
      G.mistTimer = 0;
      return sirenAmbush();
    }
    if (G.mistEvents.sirens && !G.mistEvents.singing && G.mistTimer > 7) {
      G.mistTimer = 0;
      return singingEvent();
    }
  }

  function pauseForEvent() {
    G.mode = 'landfall';
    G.ship.sail = 0;
    G.ship.speed = 0;
  }

  function eventPanel(html, wire) {
    const el = document.getElementById('event');
    el.innerHTML = html;
    el.classList.add('show');
    wire(el);
  }

  // ---- 1. Crew morale --------------------------------------------

  function moraleEvent() {
    pauseForEvent();
    const hasRum = G.cargo.rum > 0;
    eventPanel(`
      <div class="panel">
        <h2>The Crew Falters</h2>
        <p>An hour in, the helmsman is whispering to himself and two hands refuse to go aloft. The fog eats the masthead. Every sound comes from everywhere at once — except the hum, which comes from <em>ahead</em>.</p>
        <div class="choices">
          <button data-c="rum">🍶 Break out the rum — steady them the old way ${hasRum ? '(1 rum)' : '(40 gold, bought from ship stores)'}</button>
          <button data-c="iron">⚓ Iron discipline — fear cuts deeper than the lash</button>
          <button data-c="turn">↩ Turn south — try again when nerves are fresher</button>
        </div>
      </div>`, el => {
      el.querySelectorAll('button').forEach(b => b.onclick = () => {
        const c = b.dataset.c;
        el.classList.remove('show');
        if (c === 'rum') {
          if (hasRum) G.cargo.rum--;
          else if (G.gold >= 40) G.gold -= 40;
          G.mistEvents.morale = true;
          for (const m of G.party) { m.hp = m.maxHp; m.mp = m.maxMp; }
          journal('Rum and a steady voice held the crew together in the Mist. Wounds bound, nerves numbed.');
          toast('The crew steadies. The party is rested and ready.');
          SFX.play('heal');
        } else if (c === 'iron') {
          G.mistEvents.morale = true;
          for (const m of G.party) m.hp = Math.max(1, m.hp - 8);
          journal('Held the crew to the line by will alone. It cost them — everyone bleeds a little in the Mist.');
          toast('Discipline holds, barely. The party is shaken (-8 HP each).');
        } else {
          G.ship.heading = Math.PI / 2; // due south, out of the Mist
          G.mistTimer = -8;             // grace before the fear returns
          journal('Turned south out of the Mist. No shame in it. The isle will still be there.');
          toast('You come about and run south for clear air.');
        }
        G.mode = 'sail';
        SaveGame.save();
      });
    });
  }

  // ---- 2. Siren ambush -------------------------------------------

  function sirenAmbush() {
    G.mistEvents.sirens = true;
    SFX.play('siren');
    Boarding.start('siren', {
      title: 'Siren Ambush',
      intro: 'The hum splits into voices. Beautiful ones. They are already on the deck — pale things wearing the faces of drowned friends, singing your crew toward the rail.',
      onWin: () => {
        journal('Fought off the sirens of the Mist. Their song was almost the dragon\'s hum. Almost.');
        toast('The sirens slip back into the fog. The true hum is louder now.', 5000);
      },
      onLose: () => {
        G.mistEvents.sirens = false; // they will be waiting next attempt
        onPlayerDefeat();
      },
    });
  }

  // ---- 3. The singing --------------------------------------------

  function singingEvent() {
    pauseForEvent();
    eventPanel(`
      <div class="panel">
        <h2>The Singing</h2>
        <p>The compass has given up. The sun is a rumor. But the hum has become a <em>song</em> now — vast, patient, and unmistakably aware of you. The old whalers said the dragon isle sings. They never said it sings <em>to someone</em>.</p>
        <div class="choices">
          <button data-c="follow">🎵 Follow the song — let it steer</button>
          <button data-c="wax">🕯 Wax the crew's ears and hold your course by guesswork</button>
        </div>
      </div>`, el => {
      el.querySelectorAll('button').forEach(b => b.onclick = () => {
        const c = b.dataset.c;
        el.classList.remove('show');
        G.mistEvents.singing = true;
        const isle = ISLANDS.find(i => i.id === 'dragonisle');
        if (c === 'follow') {
          G.ship.heading = Math.atan2(isle.y - G.ship.y, isle.x - G.ship.x);
          for (const m of G.party) m.mp = m.maxMp;
          journal('Followed the singing. The bow swung true without a hand on the wheel. The crew\'s fear turned to awe.');
          toast('The song takes the helm. Dead ahead: landfall. The party\'s resolve is restored.', 6000);
          SFX.play('fragment');
        } else {
          G.ship.hull = Math.max(1, G.ship.hull - 12);
          journal('Waxed every ear and blundered on deaf. Scraped a reef no chart will ever hold. But the isle found us anyway.');
          toast('You grind over an unseen reef (-12 hull). Ahead, impossibly, land.', 6000);
          SFX.play('damage');
        }
        G.mode = 'sail';
        SaveGame.save();
      });
    });
  }

  return { update, forceSinging: singingEvent };
})();
