# 🎮 Vinci Appraiser

**A pixel-art RPG where you fight enemies, earn gold, and inspect real collectible cards on-chain to power up.**

Built for [Renaiss Tech Hackathon S1](https://renaiss.com) · [Play Live →](https://vinci.creates.works)

---

## 🕹️ What is this?

You're an adventurer in a pixel-art town. Fight in the arena to earn gold, spend it on real Pokémon TCG cards from the Renaiss marketplace, then inspect each card's on-chain credentials before buying. Equip verified cards to raise your Power Level and tackle harder arena floors.

**The twist:** ~40% of cards are fake. Buying fakes debuffs your stats. You learn to spot them through three real Web3 verification checks.

---

## 🔄 Game Loop

```
🏘️ Town  →  ⚔️ Arena  →  🛒 Shop  →  🏠 Home
 explore      fight &       inspect &     equip &
 the map      earn gold     buy cards     power up
                                            ↓
                              ← stronger each cycle ←
```

---

## ✨ Features

| | Feature | Description |
|---|---|---|
| ⚔️ | **Arena Tower** | 5 floors with increasing difficulty. Pick your challenge based on Power Level |
| 🛒 | **Live Card Market** | Real cards from the Renaiss API with grade-based pricing |
| 🔍 | **On-Chain Inspection** | 3 verification checks (FMV, SBT, Vault) with educational explanations |
| ⚡ | **Power Level** | Single number showing your strength. Rises with equipped cards |
| 🃏 | **5 Equip Slots** | Legit cards boost stats, fake cards debuff. Choose wisely |
| 🏘️ | **Town Overworld** | Pixel-art scrolling map with camera, collisions, and zone entry |
| 💀 | **Death & Recovery** | Die → return to town → 10s health recovery → try again |
| 📚 | **Learn Web3** | Each check explains what FMV oracles, SBTs, and multi-sig vaults are |

---

## 🏟️ Arena Floors

| Floor | Enemies | Rec. Power | Gold Multiplier |
|---|---|---|---|
| 1 — Rats | 🐀🐀 | 70 | x1.0 |
| 2 — Dealers | 🕵️🐀 | 100 | x1.3 |
| 3 — Hackers | 🕵️💻🐀 | 150 | x1.6 |
| 4 — Forgers | 🖨️🕵️💻 | 220 | x2.0 |
| 5 — Shadow Broker | 🦹🖨️💻 | 320 | x3.0 |

---

## 💰 Card Pricing

| Grade | Price | Legit Bonus | Fake Penalty |
|---|---|---|---|
| PSA 10 | 500–800G | +60 HP, +30 ATK, +10 DEF | -20 HP, -15 ATK, -5 DEF |
| PSA 9 | 250–450G | +54 HP, +27 ATK, +9 DEF | -18 HP, -13 ATK, -4 DEF |
| PSA 8 | 120–220G | +48 HP, +24 ATK, +8 DEF | -16 HP, -12 ATK, -4 DEF |
| PSA 7 | 60–120G | +42 HP, +21 ATK, +7 DEF | -14 HP, -10 ATK, -3 DEF |

---

## 🔍 The Three Checks

Each card goes through three on-chain verification steps:

**1. FMV Oracle** — Is the asking price within 2.5x of fair market value?  
**2. SBT Provenance** — Does a Soul-Bound Token prove ownership history?  
**3. Vault Multi-Sig** — Have enough custodians signed off on physical custody?

After each check, an explanation teaches you what it means and why it matters.

---

## 🎯 How Power Level Works

```
Power = Total HP + (Total ATK × 3) + (Total DEF × 2)
```

- **No cards equipped:** 50 HP + 8 ATK + 1 DEF = **76 PWR**
- Floor selection shows green ✅ if you're ready, red 💀 if underpowered
- Each equipped card raises your power — smart purchases matter

---

## 🌐 Web3 Concepts Modeled

| In-Game | Real World |
|---|---|
| FMV Oracle check | Price oracle (Chainlink / Renaiss Index) |
| SBT provenance | Soulbound Token — proof of ownership |
| Vault multi-sig | Gnosis Safe threshold signing |
| Buying a card | RWA tokenization |
| Passing on fakes | Compliance gate / due diligence |
| Power Level | On-chain reputation score |
| Fake card debuffs | Penalty for unverified assets |

---

## 🛠️ Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS (no framework)
- **Rendering:** HTML5 Canvas at 60fps (battle + town)
- **Sprites:** Custom pixel-art PNG sheets (player, 5 enemies, shopkeeper)
- **Fonts:** Press Start 2P, Playfair Display, IBM Plex Mono
- **API:** Renaiss Marketplace via Node.js proxy
- **Fallback:** Pokemon TCG API for card images
- **Deploy:** Vercel (static + serverless)

---

## 🚀 Run Locally

```bash
cd vinci-appraiser
node server.js          # API proxy on port 3000
npx serve .             # Static server on port 3000 (or python3 -m http.server 8080)
```

Open `http://localhost:3000` — if the Renaiss API is down, mock data kicks in automatically.

---

## 📁 Project Structure

```
├── index.html       # Single-page app (all views)
├── style.css        # Full design system
├── app.js           # Game logic (town, shop, appraisal, inventory)
├── battle.js        # Combat engine (canvas, sprites, physics)
├── server.js        # API proxy (Renaiss CLI wrapper)
├── vercel.json      # Deployment config
├── api/proxy.js     # Serverless function for Vercel
└── assets/          # Sprites, backgrounds, title art
```

---

## 🗺️ Roadmap

| Phase | What's Next |
|---|---|
| ✅ Current | Town, arena floors, card market, educational appraisal, power system |
| 🔜 Next | Real SBT registry lookup, Gnosis Safe integration |
| 🔮 Future | RWA mint transactions, PvP leaderboards, mobile PWA |

---

Built by **Mikaela** for Renaiss Tech Hackathon S1
