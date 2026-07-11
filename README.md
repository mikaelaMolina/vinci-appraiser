# Vinci Appraiser

> A pixel-art action RPG where you explore a town, fight enemies in an arena to earn gold, buy and inspect real collectible cards from the Renaiss marketplace, and equip them to level up your combat power.

> Built for **Renaiss Tech Hackathon S1** as a Web3 UX proposal for the **Vinci World** ecosystem.

---

## What This Is

Physical collectibles — graded Pokemon cards, rare prints, vintage memorabilia — represent billions in value that lives off-chain. Tokenizing them as Real-World Assets (RWAs) requires trust: someone must verify authenticity, fair market value, and secure custody before minting on-chain.

**Vinci Appraiser** gamifies that verification process. You explore a pixel-art town, fight enemies in an arena to earn gold, then spend it in a live card market. Before buying, you inspect each card's on-chain credentials — learning about FMV, SBT provenance, and vault custody along the way. Equip cards to level up your Power and take on harder arena floors.

The core insight: **verification isn't a chore when the verified asset makes you stronger.**

---

## How It Relates to Renaiss

This prototype demonstrates how the Renaiss platform's real data can power engaging consumer experiences:

| Renaiss Data Used | How the Game Uses It |
|---|---|
| Marketplace listings (live API) | Populates the in-game card shop with real cards |
| `frontImageUrl` / Pokemon TCG images | Card artwork displayed in shop and appraisal desk |
| `fmvPriceInUSD` (Fair Market Value) | FMV Oracle check — is the ask price reasonable? |
| `ownerAddress` + `vaultLocation` | SBT provenance check — is chain-of-custody intact? |
| `grade` + `gradingCompany` | Multi-sig vault threshold + card pricing + stat bonuses |
| `askPriceInUSDT` | Informs grade-based shop pricing |

The game pulls **live data from the Renaiss marketplace API** — real Pokemon cards currently listed, with real FMV prices, real on-chain addresses, and real graded photos.

---

## The Game Loop

```
┌──────────┐     ┌──────────────┐     ┌───────────────────┐     ┌──────────────┐
│   TOWN   │────▶│    ARENA     │────▶│   SHOP + INSPECT  │────▶│  HOME/EQUIP  │──┐
│ (explore)│     │ (pick floor) │     │ (buy/pass cards)  │     │ (power up)   │  │
└──────────┘     └──────────────┘     └───────────────────┘     └──────────────┘  │
     ▲                                                                             │
     └────────────── Power Level rises → unlock harder floors ────────────────────┘
```

### 1. Town (Overworld Hub)
- Pixel-art scrolling overworld with WASD movement
- Three buildings: Arena, Card Shop, Home (Inventory)
- Walk to a building and press E/Space to enter
- Camera follows the player, stops at map edges
- Gold and Power Level displayed in the HUD
- 10-second recovery timer after dying (can't re-enter arena during cooldown)

### 2. Arena (Floor-Based Combat)
- **5 Arena Floors** — each with a recommended Power Level:
  - Floor 1 — Rats (Rec: 70 PWR, x1 gold)
  - Floor 2 — Dealers (Rec: 100 PWR, x1.3 gold)
  - Floor 3 — Hackers (Rec: 150 PWR, x1.6 gold)
  - Floor 4 — Forgers (Rec: 220 PWR, x2 gold)
  - Floor 5 — Shadow Broker (Rec: 320 PWR, x3 gold)
- Each floor shows green if you meet the power requirement, red if underpowered
- Floor selection shows your current stats: HP, ATK, DEF, equipped cards
- Real-time canvas combat at 60fps — WASD move, click/space attack, Shift dodge
- Enemies use the floor's `scaleMult` for HP/ATK/speed scaling
- Death sends you back to town with a 10-second health recovery timer
- Victory gives gold (multiplied by floor reward rate) and returns you to town

### 3. Card Shop (Live Market)
- Pulls 12 real cards from the Renaiss marketplace API
- **Grade-based pricing:**
  - PSA 7 and below: 60–120G (affordable)
  - PSA 8: 120–220G (mid-range)
  - PSA 9: 250–450G (expensive)
  - PSA 10: 500–800G (premium, massive stat boost)
- ~40% of cards carry red flags (inflated FMV, missing SBT, weak vault sigs)
- Full card images shown (no cropping) in a 5-per-row scrollable grid
- Cards you've passed on are marked with a "Passed" badge
- Cards you own are marked "Owned"
- Click **Inspect** to take a card to the appraisal desk

### 4. Appraisal (Inspect Before Buying)
- Three verification checks run against the card's on-chain data:
  - **FMV Oracle** — is the ask price within 2.5x of fair market value?
  - **SBT Provenance** — does the card have a valid owner address on-platform?
  - **Vault Multi-Sig** — does the custody threshold meet the grade requirement?
- **Educational explanations** appear after each check, teaching the player what the result means and why it matters
- Player can dismiss explanations with a "Got it" button
- After all 3 checks, the player decides: **Buy Card** or **Pass**
- Passing marks the card in the shop so you remember you already reviewed it

### 5. Home / Inventory (Equip & Power Up)
- View all purchased cards with their stat bonuses
- **Equip up to 5 cards** — each one boosts HP, ATK, and DEF
- Legit cards (all checks passed): full positive bonuses
- Fake cards (flagged): negative stat debuffs when equipped
- Sell cards back for partial gold
- Power Level updates in real-time as you equip/unequip
- Custom house.gif background for immersion

---

## Power Level System

Power Level is a single number representing your total combat strength:

```
Power = totalHP + (totalATK × 3) + (totalDEF × 2)
```

- **Base stats** (no cards): 50 HP, 8 ATK, 1 DEF → Power 76
- Each equipped card adds bonuses scaled by PSA grade
- Higher Power unlocks access to harder arena floors with better rewards
- The floor selection screen shows whether you're ready (green) or underpowered (red)

---

## Web3 Concepts Modeled

| Game Element | Real-World Web3 Concept |
|---|---|
| FMV Oracle check | Decentralized price oracle (Renaiss Index / Chainlink) |
| SBT provenance check | Soulbound Token — non-transferable proof of ownership history |
| Multi-sig vault check | Multi-signature custody (Gnosis Safe threshold signing) |
| Buy card → inventory | RWA tokenization — on-chain token backed by physical asset |
| Pass on risky card | Compliance gate — asset fails due diligence, not minted |
| Educational explanations | On-chain literacy — learn verification concepts through gameplay |
| Inspector role | Trusted verifier node in the RWA pipeline |
| Card stat bonuses | Utility NFTs — verified assets grant in-ecosystem benefits |
| Fake card debuffs | Penalty for holding unverified/fraudulent assets |
| Power Level | On-chain reputation/credit score equivalent |
| Arena floors | Tiered access based on verified holdings |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS — no framework, single-page app |
| Rendering | HTML5 Canvas (battle + town overworld, 60fps) + DOM (UI panels) |
| Sprites | Custom PNG sprite sheets — player, 5 enemy types, shopkeeper |
| Icons | Font Awesome 6.5 (Free) |
| Fonts | Press Start 2P (pixel), Playfair Display, IBM Plex Mono, Inter |
| API | Renaiss Marketplace REST API via local Node.js proxy |
| Fallback | Pokemon TCG API for card images when marketplace images unavailable |
| Design | Pixel-art aesthetic — hard borders, scanline overlays, stepped animations |

---

## Running Locally

```bash
# Prerequisites: Node.js 18+

cd vinci-appraiser

# 1. Start the Renaiss API proxy (port 3000)
node server.js

# 2. Serve the game (any static server works)
npx serve .
# or
python3 -m http.server 8080

# 3. Open http://localhost:8080
```

If the Renaiss API is unreachable, the game falls back to mock data with pre-configured red flags for demonstration.

---

## Project Structure

```
vinci-appraiser/
├── index.html          # Full app — landing, town, battle, shop, appraisal, inventory
├── style.css           # Design system — pixel aesthetic, responsive, all views
├── app.js              # Game controller — town, shop, appraisal, inventory, economy
├── battle.js           # Action RPG engine — canvas combat, sprites, XP, physics
├── server.js           # Node.js proxy wrapping Renaiss marketplace API
└── assets/
    ├── background.gif         # Animated pixel environment (landing/battle)
    ├── arena.gif              # Arena battle background
    ├── house.gif              # Home/inventory background
    ├── town.png               # Town overworld tilemap
    ├── title.png              # Game logo/title art
    ├── sprite_main/           # Player character (21 frames)
    ├── sprite_dealer/         # Counterfeit Dealer enemy
    ├── sprite_rat/            # Vault Rat enemy
    ├── sprite_hacker/         # Oracle Hacker enemy
    ├── sprite_forger/         # Slab Forger enemy
    ├── sprite_broker/         # Shadow Broker boss
    └── sprite_shopkeeper/     # Shopkeeper NPC (6-frame talk)
```

---

## RPG Mechanics

| System | Details |
|---|---|
| Base Stats | 50 HP, 8 ATK, 1 DEF (intentionally weak — cards are essential) |
| Attack Cooldown | 22 frames between attacks (requires timing) |
| XP & Leveling | Enemies grant XP on death. Each level: +8 HP, +2 ATK, +1 DEF, +2% crit |
| Combo System | Chain attacks within 40 frames. Higher combo = more damage + range |
| Critical Hits | 12% base chance, scales with level and combo count. 1.8x damage |
| Dodge Roll | Shift key — omnidirectional burst with i-frames. 40-frame cooldown |
| Dash Attack | Attack during dodge = 1.5x damage, +30% range, +20% crit |
| Kill Streak | Fast consecutive kills = +25% gold per stack |
| Gold Pickups | Enemies drop coins that must be walked over. Magnetic pull when close |
| Health Potions | 12-15% drop chance. Green pixel cross pickup |
| Death Recovery | Return to town, 10-second health recovery timer, arena blocked |

---

## Card Economy

| Card Grade | Shop Price | If Legit (equipped) | If Fake (equipped) |
|---|---|---|---|
| PSA 10 | 500–800G | +60 HP, +30 ATK, +10 DEF | -20 HP, -15 ATK, -5 DEF |
| PSA 9 | 250–450G | +54 HP, +27 ATK, +9 DEF | -18 HP, -13 ATK, -4 DEF |
| PSA 8 | 120–220G | +48 HP, +24 ATK, +8 DEF | -16 HP, -12 ATK, -4 DEF |
| PSA 7 | 60–120G | +42 HP, +21 ATK, +7 DEF | -14 HP, -10 ATK, -3 DEF |

- **5 equip slots** maximum
- Legit cards boost stats, fake cards debuff stats
- Sell value: legit = 70% of price, fake = 10% of price
- Higher grades cost more but give exponentially better bonuses

---

## Arena Floor Scaling

| Floor | Enemies | Scale Mult | Reward | Recommended PWR |
|---|---|---|---|---|
| 1 — Rats | 2 Vault Rats | 0.5x | x1.0 gold | 70 |
| 2 — Dealers | Dealer + Rat | 1.0x | x1.3 gold | 100 |
| 3 — Hackers | Dealer + Hacker + Rat | 1.8x | x1.6 gold | 150 |
| 4 — Forgers | Forger + Dealer + Hacker | 2.5x | x2.0 gold | 220 |
| 5 — Shadow Broker | Broker + Forger + Hacker | 3.5x | x3.0 gold | 320 |

Scale multiplier affects enemy HP, ATK, speed, and shoot rate.

---

## Vision: Future Phases

| Phase | Feature |
|---|---|
| Current | Live marketplace data, town overworld, floor system, power level, educational appraisal |
| Phase 2 | Actual SBT registry lookup — verify real on-chain provenance tokens |
| Phase 3 | Gnosis Safe integration — query real multi-sig vault thresholds |
| Phase 4 | Buy triggers RWA mint transaction on Vinci World smart contract |
| Phase 5 | Inspector reputation — on-chain scoring via Soulbound reputation token |
| Phase 6 | PvP — inspectors compete on verification accuracy leaderboards |
| Phase 7 | Mobile-responsive touch controls + PWA installation |

---

## Design Philosophy

- **Verification as gameplay** — not a compliance chore, but a risk/reward decision
- **Real data, game context** — actual marketplace cards make the experience feel meaningful
- **Power through knowledge** — understanding on-chain signals makes you stronger
- **Progressive difficulty** — floor system gives clear goals and power milestones
- **Educational by design** — each check explains the Web3 concept it represents
- **Consequence for fakes** — buying unverified cards actively hurts your stats
- **Pixel aesthetic** — establishes identity, reduces asset requirements, runs everywhere

---

Built by Mikaela for Renaiss Tech Hackathon S1
