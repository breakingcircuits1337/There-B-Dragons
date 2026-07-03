// ============================================================
// There Be Dragons — save system (localStorage autosave)
// ============================================================
'use strict';

const SaveGame = (() => {
  const KEY = 'thereBeDragons.save.v1';

  function save() {
    try {
      // party ability objects are static; persist only dynamic fields
      const snapshot = { ...G, mode: 'sail', party: G.party.map(m => ({
        id: m.id, hp: m.hp, mp: m.mp, maxHp: m.maxHp, maxMp: m.maxMp,
      })) };
      localStorage.setItem(KEY, JSON.stringify(snapshot));
    } catch (e) { /* private browsing / quota — play on without saves */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      const party = PARTY_TEMPLATE.map(t => {
        const saved = (data.party || []).find(p => p.id === t.id) || {};
        return { ...t, hp: saved.hp ?? t.maxHp, mp: saved.mp ?? t.maxMp,
                 maxHp: saved.maxHp ?? t.maxHp, maxMp: saved.maxMp ?? t.maxMp };
      });
      G = { ...newGameState(), ...data, party, mode: 'sail' };
      Naval.reset();
      return true;
    } catch (e) {
      return false;
    }
  }

  function exists() {
    try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }

  return { save, load, exists, clear };
})();
