# 🎮 Vinci Appraiser

**A pixel-art action RPG that gamifies Web3 onboarding through real collectible card verification.**

[▶️ Play Live](https://vinciappraiser.creates.works) — No wallet, no login, just open and play.

---

## What It Does

Vinci Appraiser turns RWA (Real-World Asset) due diligence from a compliance chore into a core gameplay mechanic. Instead of reading whitepapers to understand how on-chain verification works, players:

1. **Fight** enemies in an arena to earn gold
2. **Browse** real collectible cards pulled live from the Renaiss marketplace API
3. **Inspect** each card through three on-chain checks — learning what they mean in plain language
4. **Buy or Pass** based on the results — verified cards boost stats, fakes weaken you
5. **Equip** cards to power up and tackle harder arena floors

The core insight: verification isn't boring when the verified asset makes you stronger.

---

## How It Connects to Renaiss Protocol

Vinci Appraiser is built directly on the **Renaiss Index API**, pulling live marketplace listings so the in-game card shop is stocked with real collectible cards — not placeholders.

Each card carries real data from Renaiss:

| Renaiss Data | How the Game Uses It |
|---|---|
| Fair Market Value (`fmvPriceInUSD`) | FMV Oracle check — is the ask price reasonable? |
| Owner Address (`ownerAddress`) | SBT Provenance check — is ownership traceable? |
| Vault Location (`vaultLocation`) | Vault Multi-Sig check — is custody verified? |
| PSA Grade + Grading Company | Sets shop pricing tiers and stat bonuses |
| Card Images (`frontImageUrl`) | Displayed in shop and appraisal desk |
| Ask Price (`askPriceInUSDT`) | Informs the in-game gold economy |

### The Three Checks Model Real Renaiss Infrastructure

**1. FMV Oracle** — Compares a card's price to its fair market value from the Renaiss Index, teaching players how decentralized price oracles prevent overpaying and market manipulation.

**2. SBT Provenance** — Checks the owner address to show how Soulbound Tokens prove chain-of-custody. Renaiss already uses SBTs for their Community Leader identity program; this models the same concept for asset provenance.

**3. Vault Multi-Sig** — Ties custody requirements to card grade, showing how RenaissOS turns independent vaults and card shops into on-chain verification nodes through cryptographic multi-signature co-signing.

### Data Sources & Limitations

- Card listings, images, grades, and prices come from the **live Renaiss marketplace API**
- Pokemon TCG API is used as a **backup** when card images aren't available from Renaiss
- The pass/fail logic for checks uses **simulated red flags** (~40% of cards) for gameplay purposes — clearly labeled as simulated data for UX demonstration
- In a production version, checks would query actual on-chain state (SBT registry, Gnosis Safe thresholds)

---

## 🕹️ How to Play

**No setup needed.** Open [vinciappraiser.creates.works](https://vinciappraiser.creates.works) and play.

### Quick Walkthrough

1. **Town** — Use WASD to move. Walk to a building and press Space/E to enter.
2. **Arena** — Pick a floor based on your Power Level. Fight with WASD + Click/Space (attack) + Shift (dodge).
3. **Shop** — Browse cards. Click "Inspect" to run verification checks. Buy verified cards, pass on fakes.
4. **Home** — Equip up to 5 cards. Watch your Power Level rise. Return to the Arena for harder floors.

### Controls

| Key | Action |
|---|---|
| WASD | Move (town & battle) |
| Click / Space | Attack |
| Shift | Dodge Roll (i-frames) |
| E | Card Ability / Enter Building |

---

## ⚔️ Game Systems

### Arena Tower (5 Floors)

| Floor | Enemies | Recommended PWR | Gold Multiplier |
|---|---|---|---|
| 1 — Rats | 🐀🐀 | 70 | x1.0 |
| 2 — Dealers | 🕵️🐀 | 100 | x1.3 |
| 3 — Hackers | 🕵️💻🐀 | 150 | x1.6 |
| 4 — Forgers | 🖨️🕵️💻 | 220 | x2.0 |
| 5 — Shadow Broker | 🦹🖨️💻 | 320 | x3.0 |

### Power Level

```
Power = Total HP + (Total ATK × 3) + (Total DEF × 2)
```

Base stats (no cards): 50 HP, 8 ATK, 1 DEF = **76 PWR**. Each equipped card raises this.

### Card Economy

| Grade | Shop Price | If Legit | If Fake |
|---|---|---|---|
| PSA 10 | 500–800G | +60 HP, +30 ATK, +10 DEF | -20 HP, -15 ATK, -5 DEF |
| PSA 9 | 250–450G | +54 HP, +27 ATK, +9 DEF | -18 HP, -13 ATK, -4 DEF |
| PSA 8 | 120–220G | +48 HP, +24 ATK, +8 DEF | -16 HP, -12 ATK, -4 DEF |
| PSA 7 | 60–120G | +42 HP, +21 ATK, +7 DEF | -14 HP, -10 ATK, -3 DEF |

### Death & Recovery

Die in the arena → return to town → 10-second health recovery → try again. No permadeath, just a cooldown.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS — no framework, zero dependencies |
| Rendering | HTML5 Canvas at 60fps (battle + town overworld) |
| Sprites | Custom pixel-art PNGs (player, 5 enemy types, shopkeeper) |
| API | Renaiss Marketplace REST API via Node.js proxy |
| Fallback | Pokemon TCG API for card images |
| Deploy | Vercel (static + serverless) |

---

## 🚀 Run Locally

```bash
cd vinci-appraiser
node server.js        # API proxy on port 3000
```

Open `http://localhost:3000`. If the Renaiss API is unreachable, mock data with pre-configured red flags kicks in automatically.

---

## 📁 Project Structure

```
├── index.html       # Single-page app (landing, town, battle, shop, appraisal, inventory)
├── style.css        # Full design system (pixel aesthetic)
├── app.js           # Game controller (town, shop, appraisal, inventory, economy)
├── battle.js        # Combat engine (canvas, sprites, physics, XP)
├── server.js        # Node.js proxy wrapping Renaiss CLI
├── vercel.json      # Deployment config
├── api/proxy.js     # Serverless function for Vercel
└── assets/          # Sprites, backgrounds, title art, favicon
```

---

## 🗺️ Roadmap

| Phase | Description |
|---|---|
| ✅ Done | Live API integration, town overworld, arena floors, educational appraisal, power system |
| 🔜 Next | Real SBT registry lookups, Gnosis Safe multi-sig queries |
| 🔮 Future | In-game purchase triggers actual RWA mint on Vinci World smart contract |

---

## Why This Design

The old approach to teaching Web3 verification — docs, diagrams, test transactions — doesn't stick. People learn by doing, especially when there are consequences.

In Vinci Appraiser:
- **Buying a fake card hurts you** (stat debuffs) — so you're motivated to check
- **Each check explains itself** — educational popups teach the concept in plain language
- **Real data makes it feel real** — actual marketplace cards, not Lorem Ipsum placeholders
- **Progressive difficulty** — you need better cards to reach higher floors, which means better verification skills

The game is designed as an entry point into the Renaiss ecosystem for people who aren't already crypto-native.

---

Built by Mikaela · [Live Demo](https://vinciappraiser.creates.works) · [GitHub](https://github.com/mikaelaMolina/vinci-appraiser)
