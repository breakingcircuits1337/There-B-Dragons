// ============================================================
// There Be Dragons — static game data
// World constants, factions, islands, goods, party, abilities
// ============================================================
'use strict';

const WORLD = {
  W: 4800,
  H: 3600,
  MIST_Y: 850,          // everything above this line is the Mist
  DAY_LENGTH: 240,      // seconds for a full day/night cycle
};

const FACTIONS = {
  navy:     { name: 'Crown Navy',        color: '#3b6fd4', flag: '#2a4fa0' },
  merchant: { name: 'Merchant Compact',  color: '#d4a53b', flag: '#a87d1f' },
  pirate:   { name: 'Free Pirates',      color: '#c23b3b', flag: '#1a1a1a' },
  islander: { name: 'Islander Nations',  color: '#3bc28a', flag: '#1f8a5e' },
  ashen:    { name: 'Ashen Order',       color: '#b8b8c8', flag: '#6e6e80' },
  hive:     { name: 'Hive-Kin',          color: '#e8b830', flag: '#c99700' },
};

const GOODS = {
  rum:    { name: 'Rum',        base: 20 },
  silk:   { name: 'Silk',       base: 45 },
  powder: { name: 'Powder',     base: 35 },
  amber:  { name: 'Hive-Amber', base: 120 },
};

// Islands. priceMod multiplies base good prices (buy low, sell high).
// hidden islands don't render on the chart until discovered via rumor/quest.
const ISLANDS = [
  {
    id: 'meridian', name: 'Port Meridian', biome: 'temperate', faction: 'navy',
    x: 900, y: 2900, r: 150, port: true,
    color: '#7a9e5f', desc: 'Capital of the Crown Navy. Stone quays, tarred rigging, watchful marines.',
    priceMod: { rum: 1.2, silk: 1.0, powder: 0.8, amber: 1.6 },
  },
  {
    id: 'gulls', name: "Gull's Rest", biome: 'atoll', faction: 'pirate',
    x: 2050, y: 3150, r: 120, port: true,
    color: '#d9c98a', desc: 'A free-pirate haven strung across a turquoise atoll. Everything is for sale.',
    priceMod: { rum: 0.7, silk: 1.3, powder: 1.0, amber: 1.4 },
  },
  {
    id: 'cinderpeak', name: 'Cinderpeak', biome: 'volcanic', faction: 'islander',
    x: 3900, y: 2850, r: 160, port: true,
    color: '#6b4a3a', desc: 'A smoking cone wreathed in black-sand beaches. The forges never cool.',
    priceMod: { rum: 1.3, silk: 1.1, powder: 0.6, amber: 1.5 },
  },
  {
    id: 'verdant', name: 'Verdant Maw', biome: 'jungle', faction: 'islander',
    x: 2950, y: 2300, r: 170, port: true,
    color: '#3f7a3a', desc: 'Jungle so thick the canopy swallows the peaks. Rum flows cheap here.',
    priceMod: { rum: 0.6, silk: 1.2, powder: 1.2, amber: 1.3 },
  },
  {
    id: 'silkwater', name: 'Silkwater', biome: 'atoll', faction: 'merchant',
    x: 1500, y: 2200, r: 130, port: true,
    color: '#c9b98a', desc: 'The Merchant Compact counting-house of the west seas. Silk is cheapest at the source.',
    priceMod: { rum: 1.1, silk: 0.6, powder: 1.1, amber: 1.5 },
  },
  {
    id: 'bonechapel', name: 'Bonechapel Isle', biome: 'ruin', faction: 'ashen',
    x: 620, y: 1650, r: 130, port: true,
    color: '#cfcfda', desc: 'Bone-white ruins of a drowned civilization. The Ashen Order keeps its vigil here.',
    priceMod: { rum: 1.4, silk: 1.2, powder: 0.9, amber: 2.0 },
  },
  {
    id: 'frostholm', name: 'Frostholm', biome: 'frozen', faction: 'islander',
    x: 1050, y: 1060, r: 140, port: true,
    color: '#dfe8f0', desc: 'The frozen north. Whale-oil lamps burn against the long dark.',
    priceMod: { rum: 1.5, silk: 1.4, powder: 1.0, amber: 1.8 },
  },
  {
    id: 'wreckers', name: "Wreckers' Shoal", biome: 'atoll', faction: 'pirate',
    x: 3350, y: 1250, r: 110, port: true,
    color: '#b8a878', desc: 'A graveyard of hulls picked clean by wreckers. Something is buried here.',
    priceMod: { rum: 0.9, silk: 1.4, powder: 0.7, amber: 1.4 },
  },
  {
    id: 'drowned', name: 'The Drowned Court', biome: 'ruin', faction: null,
    x: 2250, y: 1450, r: 120, port: false,
    color: '#8a95a5', desc: 'Half-sunk palace spires. A ghost ship circles these waters.',
    priceMod: {},
  },
  {
    id: 'cannibal', name: 'The Feasting Isle', biome: 'jungle', faction: null,
    x: 2200, y: 2600, r: 130, port: false, hidden: true,
    color: '#1e5420', desc: 'Thick jungle ringed by carved totems and the smoke of too many fires.',
    priceMod: {},
  },
  {
    id: 'amberreach', name: 'Amberreach', biome: 'hive', faction: 'hive',
    x: 4250, y: 1500, r: 120, port: false, hidden: true,
    color: '#e8c860', desc: 'Combs of wax the size of cathedrals. The air hums. Amber-gold shapes swarm the cliffs.',
    priceMod: {},
  },
  {
    id: 'dragonisle', name: 'Dragon Isle', biome: 'mist', faction: null,
    x: 2400, y: 280, r: 160, port: false, hidden: true,
    color: '#4a3a5a', desc: 'The island behind the Mist. Here be dragons.',
    priceMod: {},
  },
  {
    id: 'vael_reef', name: "The Corsair's Reef", biome: 'atoll', faction: null,
    x: 4450, y: 2350, r: 100, port: false, hidden: true,
    color: '#8a7a5a', desc: 'A half-submerged atoll of blackened coral. Iron rings rust in the rock — someone moored here, for a long time.',
    priceMod: {},
  },
  {
    id: 'watcher', name: "The Watcher's Spire", biome: 'ruin', faction: null,
    x: 2750, y: 920, r: 75, port: false, hidden: true,
    color: '#b0a890', desc: 'A sheer sea-stack crowned with a lighthouse that should have gone dark decades ago. The flame still burns.',
    priceMod: {},
  },
];

// ---- Party & boarding combat ---------------------------------

const PARTY_TEMPLATE = [
  {
    id: 'captain', name: 'Captain Reyes', cls: 'Corsair Duelist',
    maxHp: 70, maxMp: 10, atk: [12, 18],
    abilities: [
      { id: 'flurry', name: 'Flurry', cost: 4, desc: 'Three quick cuts (3× 6–9 dmg).' },
      { id: 'parry', name: 'Parry Stance', cost: 3, desc: 'Halve damage taken until your next turn.' },
    ],
  },
  {
    id: 'mara', name: 'Mara the Tide-Caller', cls: 'Tide-Caller',
    maxHp: 52, maxMp: 14, atk: [6, 10],
    abilities: [
      { id: 'tidal', name: 'Tidal Lash', cost: 4, desc: 'A whip of seawater (16–24 dmg).' },
      { id: 'springs', name: 'Healing Springs', cost: 4, desc: 'Restore 18–26 HP to the most wounded ally.' },
    ],
  },
  {
    id: 'brix', name: 'Brix Halffuse', cls: 'Powder Alchemist',
    maxHp: 58, maxMp: 12, atk: [8, 13],
    abilities: [
      { id: 'bomb', name: 'Bomb Toss', cost: 5, desc: 'Blast every enemy for 10–15 dmg.' },
      { id: 'smoke', name: 'Smoke Veil', cost: 3, desc: 'Party gains 40% evasion for one round.' },
    ],
  },
  {
    id: 'quill', name: 'Quill of the Long Song', cls: 'Shanty-Bard',
    maxHp: 48, maxMp: 14, atk: [5, 9],
    abilities: [
      { id: 'shanty', name: 'Battle Shanty', cost: 4, desc: 'Party deals +40% damage for two rounds.' },
      { id: 'dirge', name: 'Dirge of the Deep', cost: 4, desc: 'All enemies deal -30% damage for two rounds.' },
    ],
  },
];

// Recruitable crew — found in taverns, join the boarding party (max 6).
// Each has a unique ability the core four can't get, and a loyalty arc.
const RECRUITS = [
  {
    id: 'sigrid', name: 'Sigrid Whalebone', cls: 'Harpooneer',
    maxHp: 64, maxMp: 12, atk: [10, 16],
    port: 'frostholm', cost: 300,
    pitch: 'A Frostholm whaler with a harpoon taller than she is and a grudge against everything bigger than her boat. "I don\'t miss," she says. The scars on the tavern wall agree.',
    loyaltyHint: 'Her grandmother\'s harpoon has a cracked head. The forges of Cinderpeak could reforge it — for a price.',
    abilities: [
      { id: 'harpoon', name: 'Harpoon Throw', cost: 4, desc: 'A thrown harpoon (18–26 dmg; 26–36 once reforged).' },
      { id: 'lure', name: 'Leviathan Lure', cost: 4, desc: 'Rattle the deck like surfacing prey — one enemy loses its next turn.' },
    ],
  },
  {
    id: 'ashka', name: 'Ashka of the Green Maw', cls: 'Beast-Charmer',
    maxHp: 50, maxMp: 14, atk: [6, 10],
    port: 'verdant', cost: 300,
    pitch: 'A Verdant Maw charmer who speaks to gulls, sharks, and things with too many rows of teeth. She wants passage east — she says something amber-gold has been singing in her dreams.',
    loyaltyHint: 'She asks, every day, whether the ship will ever call at the humming isle east of Cinderpeak.',
    abilities: [
      { id: 'gullstorm', name: 'Gullstorm', cost: 5, desc: 'A shrieking wheel of seabirds rakes every enemy (8–12; 12–17 as Hivefriend).' },
      { id: 'calm', name: 'Calm the Beast', cost: 4, desc: 'Soothe one enemy into stillness — it loses its next turn. Dragons are not beasts.' },
    ],
  },
];

const ENEMY_TYPES = {
  deckhand: { name: 'Deckhand',       maxHp: 30,  atk: [5, 9] },
  marine:   { name: 'Marine',         maxHp: 45,  atk: [8, 13] },
  corsair:  { name: 'Corsair',        maxHp: 38,  atk: [7, 12] },
  zealot:   { name: 'Ashen Zealot',   maxHp: 40,  atk: [10, 15] },
  drone:    { name: 'Hive Drone',     maxHp: 26,  atk: [6, 10] },
  wraith:   { name: 'Drowned Wraith', maxHp: 55,  atk: [9, 14] },
  siren:    { name: 'Mist Siren',     maxHp: 36,  atk: [8, 13] },
  tribal:   { name: 'Tribal Warrior', maxHp: 38,  atk: [9, 14] },
  chief:    { name: 'Cannibal Chief', maxHp: 98,  atk: [15, 22] },
  tentacle:  { name: 'Kraken Tentacle', maxHp: 45,  atk: [10, 16] },
  krakenmaw: { name: 'The Kraken',      maxHp: 280, atk: [18, 28], boss: true },
  dragon:   { name: 'The Last Dragon',  maxHp: 420, atk: [16, 26], boss: true },
  skeleton:  { name: "Vael's Deckhand", maxHp: 28,  atk: [6, 10] },
  vaelghost: { name: 'Ida Vael',        maxHp: 160, atk: [14, 22], boss: true },
};

// Crew composition when boarding a ship of a given role
const BOARDING_CREWS = {
  merchant: ['deckhand', 'deckhand', 'marine'],
  navy:     ['marine', 'marine', 'deckhand', 'marine'],
  pirate:   ['corsair', 'corsair', 'deckhand'],
  hunter:   ['marine', 'marine', 'marine', 'zealot'],
  ghost:    ['wraith', 'wraith', 'wraith'],
  siren:    ['siren', 'siren', 'siren', 'siren'],
  hive:     ['drone', 'drone', 'drone', 'drone'],
  cannibal: ['tribal', 'tribal', 'tribal', 'chief'],
  kraken:   ['tentacle', 'tentacle', 'tentacle', 'krakenmaw'],
  dragon:   ['dragon'],
  vael:     ['skeleton', 'skeleton', 'skeleton', 'skeleton', 'vaelghost'],
};

// ---- Shipyard upgrades ---------------------------------------

const UPGRADES = [
  { id: 'hull2',   name: 'Oaken Hull (Tier 2)',   cost: 800,  requires: null,    desc: 'Max hull 100 → 150.' },
  { id: 'hull3',   name: 'Ironwood Hull (Tier 3)',cost: 2200, requires: 'hull2', desc: 'Max hull 150 → 220.' },
  { id: 'sails2',  name: 'Silk Sails',            cost: 600,  requires: null,    desc: '+20% top speed.' },
  { id: 'sails3',  name: 'Stormweave Sails',      cost: 1800, requires: 'sails2',desc: '+40% top speed, better into the wind, 70% storm damage resistance.' },
  { id: 'guns2',   name: 'Double Battery',        cost: 900,  requires: null,    desc: 'Broadsides fire 3 balls per side.' },
  { id: 'guns3',   name: 'Enchanted Shot',        cost: 2400, requires: 'guns2', desc: '+50% cannon damage, faster reload.' },
  { id: 'cargo2',  name: 'Deep Hold',             cost: 500,  requires: null,    desc: 'Cargo capacity 20 → 40.' },
  { id: 'optics',  name: "Crow's Nest Optics",    cost: 700,  requires: null,    desc: 'Spot ships and islands from further away.' },
];

// ---- Rumors & quest chain ------------------------------------
// Rumors are bought/heard in taverns; each reveals something.
const RUMORS = [
  {
    id: 'frag1', port: 'gulls', cost: 50,
    text: '“A wrecker at the Shoal dug up a scorched chart corner — dragons inked in the margin. He buried it again, superstitious fool. Wreckers\' Shoal, north-east of here.”',
    reveals: 'wreckers', fragment: 1,
  },
  {
    id: 'frag2', port: 'bonechapel', cost: 80,
    text: '“The Drowned Court\'s ghost ship carries a captain\'s log from the Mist itself. Sink the wraith-hull and the sea may give it up.”',
    reveals: 'drowned', fragment: 2,
  },
  {
    id: 'frag3', port: 'cinderpeak', cost: 80,
    text: '“Far east of the peak the air hums like a struck bell, and amber shapes swarm above an uncharted isle. Traders who got close swear the swarm flew in formation. Like it was… guarding something.”',
    reveals: 'amberreach', fragment: 3,
  },
  {
    id: 'mist_warning', port: 'frostholm', cost: 30,
    text: '“Compasses spin in the Mist. The old whalers navigated it by sound — the dragon isle sings, they said, dead north of the world\'s middle.”',
    reveals: null, fragment: null,
  },
  {
    id: 'cannibal_isle', port: 'verdant', cost: 35,
    text: '"There is another island south of here — no chart, no name, smoke from a dozen fires burning together. Our fishermen know the heading. None of them will take you. The last ship that went had thirty crew. Two came back, and they will not eat meat now and they will not say why."',
    reveals: 'cannibal', fragment: null,
  },
  {
    id: 'hunters', port: 'silkwater', cost: 20,
    text: '”Cross a flag too many times and they don\'t forget. The Navy and the Compact both commission hunter captains. They chase you across the whole chart.”',
    reveals: null, fragment: null,
  },
  {
    id: 'vael_hook', port: 'gulls', cost: 30,
    text: '”Corsair Queen Ida Vael buried forty thousand gold before they took her to the gallows. Her complete chart was stitched into her cartographer\'s coat. Old Hatch still has the coat — been nursing his regrets at Wreckers\' Shoal for thirty years. Too scared to go himself. Maybe you\'re not.”',
    reveals: null, fragment: null,
  },
  {
    id: 'watcher_rumor', port: 'frostholm', cost: 20,
    text: '”Two days\' sail east of here there\'s a sea-stack with a lighthouse that should have gone dark thirty years ago. We stopped asking who tends it. Someone is always home, and they always seem to know what the Mist is doing before it does.”',
    reveals: 'watcher', fragment: null,
  },
];

const ENDINGS = {
  slay: {
    title: 'The Dragonslayer',
    text: 'The last dragon falls, and the Mist falls with her — burning off the sea like morning fog. Every chart in the world is suddenly complete. The bee-dragons of Amberreach go silent that same hour, their hum stopped mid-note. You are the most famous captain alive, and the ocean has never felt smaller.',
  },
  ally: {
    title: 'The Dragon Pact',
    text: 'You lower your blade and offer the amber comb instead. She tastes it, and remembers the hive-kin — her children, hidden in plain sight all these years. The Mist stays, but it parts for your sail alone. Some nights, fishermen swear they see a ship running before the wind with a vast shadow flying escort.',
  },
  awaken: {
    title: 'Something Worse',
    text: 'The dragon was not hiding from the world. She was standing watch over what sleeps beneath the isle. You wake it. The Mist begins to spread, one league a day, and the last thing the old world hears is a hum — like a hive, like a hymn — rising from every horizon at once.',
  },
};
