# ⚓ There Be Dragons

An open-sea action-RPG of piracy, tall tales, and the Mist that ate the north — playable in your browser, zero dependencies, no build step.

The dragons did not die out. They *left* — behind a wall of Mist no chart survives. Three fragments of one master chart remain, scattered across the sea. Find them. Sail north. Learn why.

## Play

Open `index.html` in any modern browser. That's it. (Or serve the folder: `python3 -m http.server` → http://localhost:8000)

## Controls

| Key | Action |
|---|---|
| `W` / `S` | Raise / lower sails |
| `A` / `D` | Helm (turn) |
| `Space` | Fire broadside |
| `B` | Board a crippled ship (≤35% hull, close aboard) |
| `E` | Dock at a port / make landfall |
| `M` | Captain's chart |
| `J` | Captain's journal |
| `R` | Faction standing |
| `V` | Toggle sound |

## How it plays

- **The wind matters.** Your speed depends on your point of sail — you can't sail into the wind; tack across it. Cargo weight slows you down.
- **Rumors, not waypoints.** Buy rounds in taverns to hear rumors; they chart hidden islands and lead to the three chart fragments you need to enter the Mist.
- **Reputation has teeth.** Sink or board a faction's ships and they remember. Drop below −50 and they close their harbors and send hunter ships after you.
- **Boarding is tactical.** Cripple a ship, grapple on, and fight a turn-based deck battle with your party of four — Corsair Duelist, Tide-Caller, Powder Alchemist, and Shanty-Bard.
- **Trade pays for the war.** Rum is cheap in the jungle, silk at its source, powder at the volcano forges — and the Ashen Order pays a fortune for hive-amber.
- **The Mist is always north.** With all three fragments, sail into it: your compass spins, visibility collapses, and the blind passage becomes a gauntlet — the crew's nerve breaks, sirens board in the fog, and something starts singing your ship toward shore. At the end an island waits with three ways to end the story.
- **It has a voice.** All audio is synthesized live with Web Audio — wind that swells with your speed, cannon thunder, tavern stings, and the Mist's hum. No sound files, no downloads. `V` mutes.

Progress autosaves (every 20 s at sea and on every dock). Press `L` on the title screen to resume.

## Repository layout

```
index.html        game shell + DOM overlays
css/style.css     UI (parchment panels, HUD, combat screens)
js/data.js        content: islands, factions, goods, party, rumors, endings
js/game.js        engine: state, sailing physics, wind, rendering, HUD
js/naval.js       enemy ships, AI, broadsides, hunters, the ghost ship
js/boarding.js    turn-based party combat
js/port.js        trade / shipyard / tavern interface
js/mist.js        the Mist voyage gauntlet: morale, sirens, the singing
js/sfx.js         synthesized Web Audio: ambience + one-shot effects
js/save.js        localStorage autosave
docs/GDD.md       the full game design document this prototype is built from
```

## Design document

The complete GDD — design pillars, full-game systems beyond the prototype, art bible, narrative arc, and scope-cut plan — lives in [`docs/GDD.md`](docs/GDD.md).
