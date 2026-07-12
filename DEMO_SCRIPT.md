# Vinci Appraiser — 10-Minute Demo Script

**Presenter:** Mikaela (uruzuy / @mikae_luv)  
**Track:** Game Track  
**Live demo:** https://vinciappraiser.creates.works

---

## [0:00–1:00] Opening — The Problem

> "Physical collectibles — graded Pokémon cards, sports memorabilia, vintage prints — are a massive market. But bringing them on-chain as Real-World Assets has a trust problem."

> "Before you mint a collectible on-chain, someone has to answer three questions: Is the price real? Does the seller actually own it? Is the physical card actually in a vault somewhere?"

> "That's verification. And right now, verification is boring. It's documentation, compliance checklists, and legal review. Nobody is excited about due diligence."

> "What if verification was a game?"

---

## [1:00–2:00] Introducing Vinci Appraiser

> "This is Vinci Appraiser — a pixel-art action RPG where players learn Web3 verification by doing it."

*Open the live demo at vinciappraiser.creates.works. Show the landing page.*

> "You're an adventurer in a town. You fight enemies in an arena to earn gold. You spend that gold at a card shop stocked with real collectible cards pulled live from the Renaiss marketplace API. But before you buy, you run three on-chain checks — and the game teaches you what each one means."

> "Verified cards make you stronger. Fake cards weaken you. Verification isn't a chore — it's your power source."

---

## [2:00–3:30] The Town & Tutorial

*Click "Play Now" to enter the town. Let the tutorial spotlight play through.*

> "When a new player enters for the first time, they get a spotlight tutorial showing them around. This is you — the adventurer. That's the Arena where you fight. The Card Shop where you buy. And your Home where you equip cards."

*After tutorial, walk around briefly with WASD.*

> "The town is a pixel-art overworld with a scrolling camera. Your Gold and Power Level are always visible in the HUD. Power Level is a single number that represents your combat strength — it rises as you equip verified cards."

---

## [3:30–5:00] Arena Battle

*Walk to the Arena. Press Space/E to enter. Show the floor selection screen.*

> "The Arena has five floors, each with a recommended Power Level. Green means you're ready, red means you're underpowered. Higher floors have tougher enemies but give better gold multipliers."

> "Right now we're weak — 76 Power, no cards equipped. Let's try Floor 1."

*Select Floor 1. Fight the rats. Demonstrate WASD movement, click to attack, Shift to dodge.*

> "Combat is real-time — WASD to move, click or Space to attack, Shift to dodge roll. Enemies drop gold coins you walk over to collect. Kill streaks give bonus gold."

*Win the fight. Show the victory overlay with gold earned.*

> "We earned gold. Now let's spend it wisely."

---

## [5:00–7:30] Card Shop & Inspection (Core Mechanic)

*Go back to town, walk to the Shop, enter.*

> "The shop pulls real cards from the Renaiss marketplace API. These aren't fake placeholder cards — they're real PSA-graded Pokémon cards currently listed on the Renaiss platform, with real images, real grades, and real fair market values."

> "Pricing is grade-based. PSA 7s are cheap — around 60 to 120 gold. PSA 10s cost 500 to 800. Higher grade means bigger stat bonuses when equipped."

*Click "Inspect" on a card.*

> "This is the appraisal desk. The shopkeeper tells us what they know about the card. Now we run three checks."

*Click the FMV Oracle button.*

> "First: the FMV Oracle. This queries the Renaiss price index to check if the asking price is reasonable. In the real Renaiss ecosystem, this is how decentralized price oracles prevent market manipulation. If someone lists a $400 card for $12,000 — that's a red flag."

*Show the educational explanation that appears. Click "Got it".*

*Click the SBT Provenance button.*

> "Second: SBT Provenance. SBT stands for Soulbound Token — a non-transferable on-chain record of ownership history. In Renaiss, each card has an owner address. If that address is zeroed out or missing, there's no proof of custody chain. The card could be stolen or fabricated."

*Click the Vault Multi-Sig button.*

> "Third: Vault Multi-Sig. Renaiss uses RenaissOS to turn independent vaults and card shops into on-chain verification nodes. Physical cards are co-signed through cryptographic multi-signature — multiple custodians must confirm the card exists in storage. Higher-grade cards require more signatures."

> "Now we see the full picture. All three checks have results. We decide: Buy or Pass."

*If the card is clean, buy it. If flagged, pass and show the "Passed" badge.*

> "Passing marks the card so we remember we already reviewed it. This is due diligence as gameplay."

---

## [7:30–8:30] Equip & Power Up

*Go to Home (inventory).*

> "Cards we've bought appear here with their stat bonuses. Legit cards give positive HP, ATK, and DEF scaled by grade. Fake cards — ones that failed checks but we bought anyway — actually debuff your stats."

*Equip a card. Show Power Level update.*

> "We can equip up to five cards. Watch the Power Level rise. Now we can attempt higher arena floors."

> "This is the core loop: Fight to earn gold. Buy cards. Verify them. Equip verified ones. Get stronger. Fight harder floors. Repeat."

---

## [8:30–9:30] How It Connects to Renaiss

> "Everything you just saw is built on real Renaiss data:"

> "The card images, grades, prices, owner addresses, and vault locations all come from the Renaiss marketplace API. The three checks model real infrastructure that Renaiss is building:"

> "FMV Oracle maps to the Renaiss Index — their on-chain price feed for collectibles."

> "SBT Provenance maps to community identity tokens that Renaiss already issues for roles and reputation."

> "Vault Multi-Sig maps directly to RenaissOS — their system that turns vaults into cryptographic co-signing nodes."

> "About 40% of cards in the game carry simulated red flags — inflated prices, missing provenance, or weak vault signatures. This is clearly labeled as simulated data for UX demonstration. In a production version, these checks would query actual on-chain state."

---

## [9:30–10:00] Closing & Roadmap

> "Vinci Appraiser turns RWA verification from a compliance chore into a core gameplay loop. Players learn what price oracles, soulbound tokens, and multi-sig custody actually mean — not from a whitepaper, but by using them to make their character stronger."

> "The roadmap goes from here to real SBT registry lookups, actual Gnosis Safe queries, and eventually letting an in-game purchase trigger a real RWA mint on the Vinci World smart contract."

> "I built this as a newcomer to Web3 myself. I learned how Renaiss works by building with it. That's exactly the accessibility I want to give other players."

> "Thank you. The game is live right now at vinciappraiser.creates.works — no wallet needed, just open and play."

---

## Key Facts for Q&A

- **Data source:** Renaiss marketplace API via Node.js proxy, with Pokemon TCG API as image fallback
- **Simulated vs real:** The three checks use real marketplace data (FMV, owner address, vault location) but the pass/fail logic is simulated for demo purposes. Clearly labeled.
- **Renaiss funding:** $1.5M first round led by YZi Labs (June 2026) to build trustless infrastructure for collectibles
- **RenaissOS:** Turns vaults and card shops into on-chain verification nodes using cryptographic multi-sig
- **BNB Chain:** Renaiss is built on BNB Chain
- **SBT usage in Renaiss:** Already used for Community Leader SBT Program (identity-based soulbound tokens for community organizers)
- **Closed beta:** All cards sold out within 3 hours of launch
- **Tech:** Vanilla HTML/CSS/JS, Canvas at 60fps, no framework dependencies, deployed on Vercel
- **Solo build:** Built by Mikaela (uruzuy) in the Game Track
