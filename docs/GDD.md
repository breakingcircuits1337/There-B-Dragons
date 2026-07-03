# THERE BE DRAGONS — Game Design Document

*Working alt-title: "Their Bee Dragons" — the pun is canon. A hive-dragon subspecies (amber-gold, swarm-minded, honey-hoarding) exists as a hidden mid-game discovery that foreshadows the truth about the true dragons.*

Single-player, open-world, action-RPG. Piracy × high fantasy × naval exploration.
Tone references: *Divinity: Original Sin 2* party tactics + *Sea of Thieves* sailing feel + *Sunless Sea* dread-of-the-unknown.
Target: 45–90 min session loops, 40–60 hr campaign.

> **Prototype note:** A playable browser prototype of this design ships in this repository (`index.html`). Sections below marked ✅ are implemented in the prototype (usually in reduced form); unmarked systems are full-game targets. The prototype exists to prove the core loop: *sail → discover → fight → plunder → trade → upgrade → follow the rumor north.*

---

## 1. Executive Summary & Design Pillars

You are a pirate captain in a world whose dragons vanished behind an uncharted wall of Mist generations ago. Rumors, tavern gossip, and looted chart fragments slowly assemble the only map that leads through it. The game ends where every chart in the world goes blank.

**Pillars (5):**
1. **The wind is a character** — sailing is never a loading screen; every voyage is a series of decisions.
2. **Rumors, not waypoints** — the world reveals itself through stories you buy, overhear, and steal.
3. **Deliberate violence** — every fight (naval or boarding) is tactical, readable, and committal.
4. **Reputation has teeth** — every flag you sink remembers, and the sea is smaller than it looks.
5. **The Mist is always north** — a single, dreadful, ever-present destination gives all wandering a direction.

## 2. Core Gameplay Loop

**Minute-to-minute** ✅
```
read wind → set sail/heading → spot sail or shore →
  ├─ trade port: dock → repair/trade/upgrade/rumors → depart
  ├─ hostile sail: maneuver for broadside → cripple → sink (salvage) or board (plunder + rep hit)
  └─ point of interest: landfall → scripted encounter
→ richer/wiser/hunted-er → read wind …
```
**Session-to-session** ✅ — a trade circuit or hunt earns gold → gold becomes hull/sail/gun upgrades → upgrades unlock riskier water (the Mist requires nerve, a tough hull, and the completed chart) → each session ends at a safe harbor (autosave on dock).

**Campaign-scale** ✅ (compressed in prototype) — Act I: establish yourself (first ship, first plunder, first fragment rumor). Act II: assemble the chart across three escalating fragment quests while faction pressure mounts. Act III: the Mist Voyage and the Dragon Isle choice.

## 3. RPG Progression & Magic System

**Classes (6):** Corsair Duelist, Tide-Caller, Powder Alchemist, Beast-Charmer, Shanty-Bard, Ward-Smith. Prototype ships a fixed iconic party of 4 ✅: Duelist (burst melee + parry), Tide-Caller (nuke + heal), Powder Alchemist (AoE + evasion smoke), Shanty-Bard (party buff + enemy debuff).

**Magic schools:** tide / storm / blood / song / ward / wild. Spells interact with environment (storm + wet enemies, oil + fire, wind spells fill sails). `[DESIGN CALL]` **Resource model: mana pool with small per-round regen** ✅ — reagents punish experimentation, pure cooldowns flatten decisions; a pool that regenerates 1/round makes "spend now or bank for the boss" a real choice every turn.

**Progression** ✅ (simplified): party-level XP from boarding victories; each level +8 max HP, +1 max MP, +12% damage. Full game: per-class skill trees (3 branches × 10 nodes), gear tiers I–V, and a captain "Legend" meta-track fed by reputation deeds (first kraken, first false-flag heist, etc.).

**Recruitment:** 6–8 recruitable crew across islands, 2 active slots, each with a loyalty questline and a unique ability (e.g., the Frostholm harpooneer's *Leviathan Lure*). *(Full game only.)*

## 4. Ship Systems

**Sailing model** ✅ — wind direction/strength wander continuously; speed = sail% × wind × point-of-sail efficiency (in irons 8%, close-hauled 25–80%, beam/broad reach 100%, running 85%) × hull/sail tier × cargo weight penalty (up to −18%). Tacking genuinely matters. Full game adds currents, sea states 0–9, and weather-driven encounter tables.

**Naval combat** ✅ — positioning-based broadsides (auto-aim toward nearest target within arc), reload 2.2 s (1.4 s upgraded), enemy AI holds broadside range and circles. Full game adds aimed subsystem damage (mast/rudder/crew), shot types (chain/grape/round/enchanted), and surrender/press-gang resolutions.

**Boarding transition** ✅ — crippling a ship (≤35% hull) at grapnel range (<90 u) offers boarding; combat resolves as turn-based party tactics on deck; victory yields ~1.6× gold plus cargo but a larger reputation hit than sinking.

**Upgrade tree** ✅ (8 of the 15+ planned): 3 hull tiers (100/150/220 HP), 2 sail tiers (+20%/+40% speed), 2 gun tiers (3-ball broadside; +50% damage & faster reload), deep hold (20→40 cargo), crow's-nest optics (spot range +48%). Every purchase trades gold that could have been cargo capital — speed vs. armor vs. hold is the intended triangle.

## 5. Faction & Reputation System

Six factions ✅: **Crown Navy** (law, escort contracts), **Merchant Compact** (trade, prices), **Free Pirates** (havens, fences), **Islander Nations** (native ports, lore), **Ashen Order** (zealots who hunt sea-magic; pay triple for hive-amber), **Hive-Kin** (hidden until Amberreach is found).

**Reputation bands** ✅: Allied ≥ +50 (10% discounts) · Friendly +20…49 · Neutral · Hostile ≤ −20 (35% markup, cold welcome) · **HUNTED ≤ −50** (harbor closed; dedicated hunter ships — faster than anything you can buy — spawn in pursuit, max 2 concurrent, ~75 s cadence). Sinking costs −14 rep, taking a deck −18; hurting the lawful pleases pirates (+3) and vice versa. Full game adds false flags, disguises, bribes, faction-vs-faction wars and territory shifts.

## 6. World Design

One ocean, 4800×3600 world units in prototype (30–40 islands / 5–6 biome regions at full scale). Prototype islands (11) ✅:

| Island | Biome | Faction | Role |
|---|---|---|---|
| Port Meridian | temperate | Navy | starting capital |
| Gull's Rest | atoll | Pirates | haven; fragment-1 rumor |
| Silkwater | atoll | Merchants | cheap silk; hunter lore |
| Verdant Maw | jungle | Islanders | cheap rum |
| Cinderpeak | volcanic | Islanders | cheap powder; fragment-3 rumor |
| Bonechapel Isle | ruin | Ashen Order | amber premium; fragment-2 rumor |
| Frostholm | frozen | Islanders | Mist navigation lore |
| Wreckers' Shoal | atoll | Pirates | buried fragment 1 |
| The Drowned Court | ruin | — | ghost ship guards fragment 2 |
| **Amberreach** | hive | Hive-Kin | *hidden*; fragment 3 + the bee-dragons |
| **Dragon Isle** | mist | — | *hidden*; finale |

**Discovery/rumor system** ✅ — no icon-vomit: islands chart themselves only on visual approach; hidden islands and all three fragments come from purchasable tavern rumors, each written as diegetic gossip. The chart (M) renders only what you know.

**The Mist** ✅ — the northern band of the map. Inside: visibility collapses radially with depth, the compass spins uselessly, water desaturates, and no ambient ships spawn. Navigation is by nerve and dead reckoning, exactly as Frostholm's whalers describe.

## 7. Narrative Arc

**Act I — Salt** ✅: establish a captaincy; first tavern rumor ("a wrecker dug up a scorched chart corner…") teaches the rumor economy and points to Wreckers' Shoal.
**Act II — Song** ✅: fragment 2 requires sinking/boarding the Drowned Court's ghost ship (naval + boarding skill gate). Fragment 3 leads to Amberreach: the **bee-dragon reveal** — amber-gold swarm dragons that don't attack but *escort you away from something*, seeding the twist that dragons are custodians, not predators. Their hum is the same hum whalers report from the Mist.
**Act III — The Mist Voyage** ✅: assembled chart marks Dragon Isle dead north. Phases: (1) entry — instruments fail, visibility collapses; (2) blind passage — hold a heading with no landmarks; (3) landfall — the last dragon is waiting, and she has been *standing watch*. Three endings ✅: **Slay** (boss fight; the Mist lifts, the hive goes silent — victory that reads as loss), **Ally** (offer hive-amber; the Dragon Pact), **Awaken** (push past her; learn what she was guarding — the worst ending, delivered as a quiet apocalypse). Full game inserts crew-morale events and siren ambushes into phase 2.

## 8. Art Bible Summary

**Style:** painterly stylized realism — hand-painted texture over realistic proportion (*Sea of Thieves* water fidelity × *Arcane* character rendering). Justification: tactical combat demands silhouette readability at spyglass range; photorealism buries faction identity in noise, full cartoon breaks dread. Prototype approximates with flat-painterly canvas rendering ✅.

**The ocean is the protagonist** ✅ (prototype form): biome-tinted water (turquoise atolls, ink trenches, jungle green-glass), procedural wave streaks, night bioluminescent plankton, full day/night cycle, radial-fog Mist rendering with desaturation veil. Full spec: Gerstner/FFT tiers by hardware, SSS shallows, sea states 0–9 with per-state gameplay.

**UI is diegetic where possible** ✅: the map is a parchment chart, the quest log a captain's journal, rumors are rounds bought in taverns. HUD minimalism rule: nothing on screen the captain couldn't know.

**Money-shot briefs (3 of 10):** (1) first sight of Amberreach — cathedral honeycombs at golden hour, swarm in formation; (2) the Mist wall from one league out, a white cliff of weather on a flat sea; (3) landfall on black sand, the dragon's eye opening — she was never asleep.

## 9. Technical Architecture Sketch

**Prototype** ✅: zero-dependency vanilla JS + Canvas 2D, five modules loaded as plain scripts — `data` (content tables) → `save` (localStorage autosave) → `boarding` (turn-based combat) → `naval` (ship AI/projectiles) → `port` (economy UI) → `game` (state, physics, render loop). Deterministic per-tile hashing for waves/plankton (no allocation churn); DOM overlays for all menus; autosaves every 20 s at sea and on every dock.

**Full game** `[DESIGN CALL]`: Unreal 5 for water/Nanite coastlines; ocean as the streaming ground-truth (islands stream in cells, ships are the only persistent actors); single save-slot journal-structured saves to reinforce voyage permanence; 60 fps at sea / 30 fps floor in 4-ship engagements on console baseline.

## 10. Risks & Scope Cuts (first five to go)

1. **Faction-vs-faction live wars** — highest sim cost, lowest guaranteed player visibility; replace with scripted territory events.
2. **Recruitable crew #7–8 + loyalty arcs** — cut to 4 recruitables; keep every arc that survives fully voiced.
3. **Sea states 7–9** — storm tech is expensive; cap at 6 and reserve 9 for the scripted Mist entry only.
4. **False-flag/disguise systems** — charming but exploitable; ship bribes only, patch disguises in later.
5. **Mermaid trust/deception encounters** — self-contained, so cleanly cuttable; the ghost ship already covers "the sea lies to you."

*What is never cut: wind that matters, rumors instead of waypoints, and the Mist.*
