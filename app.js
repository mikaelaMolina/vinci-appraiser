/* ═══════════════════════════════════════════════════════════════
   VINCI APPRAISER — Main Game Controller
   Loop: Town → Arena → Shop → Appraise → Inventory → Town
   ═══════════════════════════════════════════════════════════════ */

// battle.js is loaded as a separate script before this one

const API = window.location.hostname === "localhost" ? "http://localhost:3000" : "";

/* ── Global Game State ──────────────────────────────────────────── */
const GS = {
    gold:          0,        // earned in battle, spent in shop
    inventory:     [],       // { card, appraisalResult, bonuses }
    shopCards:     [],       // cards shown in current shop visit
    appraisalQueue:[],       // cards bought, awaiting appraisal
    passedCards:   [],       // tokenIds of cards player passed on
    score:         0,        // correct appraisals this run
    runCount:      0,        // how many full loops completed
    checksRun:     { fmv: false, sbt: false, vault: false },
    currentCard:   null,     // card being appraised right now
};

/* ── View switcher ──────────────────────────────────────────────── */
function showView(id) {
    document.querySelectorAll(".view-container").forEach(v => {
        v.classList.remove("active");
        v.classList.add("hidden");
    });
    const target = document.getElementById(id);
    if (target) {
        target.classList.remove("hidden");
        requestAnimationFrame(() => target.classList.add("active"));
    }
}

/* ── DOM refs ───────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

/* ── Utilities ──────────────────────────────────────────────────── */
function updateGoldUI() {
    ["gold-display", "battle-gold", "shop-gold", "score-count"].forEach(id => {
        const el = $(id);
        if (el) el.textContent = `${GS.gold} G`;
    });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function shortAddr(addr) {
    if (!addr) return "—";
    return addr.slice(0, 6) + "…" + addr.slice(-4);
}

/* ── Renaiss API ────────────────────────────────────────────────── */
async function fetchMarketplace(limit = 20) {
    const res = await fetch(`${API}/api/marketplace?category=POKEMON&listed=true&limit=${limit}`);
    if (!res.ok) throw new Error("Marketplace fetch failed");
    const data = await res.json();
    // API returns { collection: [...] } or an array directly
    return Array.isArray(data) ? data : (data.collection || data.items || []);
}

/* ── Pokemon TCG image cache ────────────────────────────────────── */
const _imgCache = {};
const _imgFetching = {}; // promise cache to avoid duplicate in-flight requests

async function fetchPokemonImage(pokemonName) {
    if (!pokemonName) return null;
    const key = pokemonName.toLowerCase().split(" ")[0];
    if (_imgCache[key] !== undefined) return _imgCache[key];
    if (_imgFetching[key]) return _imgFetching[key];

    _imgFetching[key] = (async () => {
        try {
            const q = encodeURIComponent(`name:"${key}"`);
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=${q}&pageSize=1&select=images`, {
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (!res.ok) return null;
            const json = await res.json();
            const img = json.data?.[0]?.images?.large || json.data?.[0]?.images?.small || null;
            _imgCache[key] = img;
            return img;
        } catch {
            _imgCache[key] = null;
            return null;
        } finally {
            delete _imgFetching[key];
        }
    })();

    return _imgFetching[key];
}

/* ── Map raw card → game asset ──────────────────────────────────── */
const NPC_LINES = [
    n => `"A collector brought this ${n} in yesterday. Said it's been in a vault for 10 years. I haven't verified it myself."`,
    n => `"This ${n} came from an estate sale. The previous owner passed away — family wants it sold quick. Make of that what you will."`,
    n => `"A dealer I trust brought this ${n}. He says the grading is legit, but you know how dealers talk..."`,
    n => `"Some kid walked in with this ${n}. Claims he pulled it from a booster pack in 2019. No receipt though."`,
    n => `"This ${n} has been sitting in my shop for weeks. The client who left it was... nervous. Kept looking over his shoulder."`,
    n => `"A regular brought this ${n} in. She's sold me clean cards before, but everyone has a first mistake."`,
    n => `"Got this ${n} from an online trade. The chain of custody looks right on paper, but run your own checks."`,
    n => `"A vault transfer came in with this ${n}. The paperwork matches, but I've seen forgeries this good before."`,
];

// Injected red flags so ~40% of cards have something wrong
const RED_FLAG_TYPES = ["fmv_inflated", "sbt_missing", "vault_weak", "fmv_and_sbt", "vault_and_fmv"];

function mapToAsset(card, index) {
    const gradeNum  = parseFloat(card.grade) || 0;
    const fmvUSD    = Number(card.fmvPriceInUSD) || 0;
    const askUSDT   = Number(card.askPriceInUSDT) / 1e18;

    // Shop price: grade-based — low grades are cheap, high grades are expensive
    // Grade 7-8: affordable (80-200G), Grade 9: mid (200-400G), Grade 10: expensive (400-800G)
    let shopPrice;
    if (gradeNum >= 10) shopPrice = 500 + Math.round(Math.random() * 300);
    else if (gradeNum >= 9) shopPrice = 250 + Math.round(Math.random() * 200);
    else if (gradeNum >= 8) shopPrice = 120 + Math.round(Math.random() * 100);
    else shopPrice = 60 + Math.round(Math.random() * 60);

    const gradeStr  = `${card.gradingCompany} ${gradeNum}`;

    // ── Inject red flags on ~40% of cards ──────────────────────
    // Use a deterministic-ish seed based on tokenId so it's consistent
    const seed = parseInt(card.tokenId?.toString().slice(-3) || String(index * 137), 10);
    const flagRoll = seed % 5; // 0-4: 0,1,2 = clean (60%), 3,4 = flagged (40%)
    const flagType = flagRoll >= 3 ? RED_FLAG_TYPES[seed % RED_FLAG_TYPES.length] : null;

    // FMV
    const fmvInflated = flagType === "fmv_inflated" || flagType === "fmv_and_sbt" || flagType === "vault_and_fmv";
    // Real clean check: ask price should be within ~2x of FMV. Otherwise suspect.
    const fmvOk = !fmvInflated && (fmvUSD === 0 ? true : askUSDT < fmvUSD * 2.5);

    // SBT
    const sbtForced = flagType === "sbt_missing" || flagType === "fmv_and_sbt";
    const rawSbtOk  = !!card.ownerAddress && card.vaultLocation === "platform";
    const rawSbtWarn = !!card.ownerAddress && card.vaultLocation !== "platform";
    const sbtOk   = !sbtForced && rawSbtOk;
    const sbtWarn = !sbtForced && rawSbtWarn;

    // Vault sigs
    const vaultWeak = flagType === "vault_weak" || flagType === "vault_and_fmv";
    let vaultSigs, vaultOk;
    if (vaultWeak) {
        vaultSigs = "1-of-5 ✗"; vaultOk = false;
    } else if (gradeNum >= 10) {
        vaultSigs = "5-of-5 ✓"; vaultOk = true;
    } else if (gradeNum >= 9) {
        vaultSigs = "4-of-5 ✓"; vaultOk = true;
    } else if (gradeNum >= 8) {
        vaultSigs = "3-of-5 ✓"; vaultOk = true;
    } else {
        vaultSigs = "2-of-5 ✗"; vaultOk = false;
    }

    const shouldApprove = fmvOk && (sbtOk || sbtWarn) && vaultOk;

    return {
        tokenId:    card.tokenId,
        name:       card.pokemonName || card.name || "Unknown Card",
        set:        `${card.setName || "Set"} #${card.cardNumber || "?"}`,
        condition:  gradeStr,
        grade:      gradeNum,
        year:       card.year,
        imageUrl:   card.frontImageUrl || null,
        askUSDT,
        fmvUSD,
        shopPrice,
        ownerAddress: card.ownerAddress,
        npcLine: NPC_LINES[index % NPC_LINES.length](card.pokemonName || card.name || "card"),
        fmv: {
            value:      `$${fmvUSD.toLocaleString()} FMV`,
            status:     fmvOk ? "ok" : "warn",
            label:      fmvOk ? "CONFIRMED" : "SUSPECT",
            stampClass: fmvOk ? "stamp-ok" : "stamp-warn",
        },
        sbt: {
            value:      sbtForced ? "0x000…0000" : shortAddr(card.ownerAddress),
            status:     sbtOk ? "ok" : sbtWarn ? "warn" : "bad",
            label:      sbtOk ? "VERIFIED" : sbtWarn ? "FLAGGED" : "MISSING",
            stampClass: sbtOk ? "stamp-ok" : "stamp-warn",
        },
        vault: {
            value:      vaultSigs,
            status:     vaultOk ? "ok" : "bad",
            label:      vaultOk ? "SECURED" : "INSECURE",
            stampClass: vaultOk ? "stamp-ok" : "stamp-bad",
        },
        verdict:     shouldApprove ? "approve" : "reject",
        verdictNote: shouldApprove
            ? `${gradeStr} · FMV $${fmvUSD.toLocaleString()} · Chain intact.`
            : `Flags: ${!fmvOk ? "FMV suspect. " : ""}${!sbtOk && !sbtWarn ? "SBT missing. " : ""}${!vaultOk ? "Vault below threshold." : ""}`,
    };
}

/* ── Card bonuses: appraised cards boost battle stats ───────────── */
/* ── Card bonuses: appraised cards boost OR DEBUFF battle stats ──── */
function computeCardBonus(card, isLegit) {
    const grade = card.grade || 0;
    if (isLegit) {
        // Legit card: positive bonuses scaled by grade
        return {
            hp:  Math.round(grade * 6),
            atk: Math.round(grade * 3),
            def: Math.round(grade * 1),
            label: card.name,
            verified: true,
        };
    } else {
        // Fake/flagged card: NEGATIVE stats when equipped (penalty)
        return {
            hp:  -Math.round(grade * 2),
            atk: -Math.round(grade * 1.5),
            def: -Math.round(grade * 0.5),
            label: card.name,
            verified: false,
        };
    }
}

/* ════════════════════════════════════════════════════════════════
   PHASE 1: LANDING
   ════════════════════════════════════════════════════════════════ */
function initLanding() {
    const btn = $("start-btn");
    if (btn) btn.addEventListener("click", () => goToTown());
}

/* ════════════════════════════════════════════════════════════════
   PHASE 2: BATTLE
   ════════════════════════════════════════════════════════════════ */

// Preload marketplace data during battle so shop loads instantly
let _preloadedCards = null;

function preloadShopData() {
    _preloadedCards = (async () => {
        try {
            const rawCards = await fetchMarketplace(20);
            const cards = rawCards.slice(0, 12).map((c, i) => mapToAsset(c, i));
            // Warm up image cache
            cards.forEach(card => {
                if (!card.imageUrl) fetchPokemonImage(card.pokemonName || card.name);
            });
            return cards;
        } catch {
            return null;
        }
    })();
}

function goToBattle() {
    showView("battle-view");

    // Show floor selection overlay instead of immediately starting
    showFloorSelect();
}

function showFloorSelect() {
    const overlay = $("battle-result-overlay");
    if (!overlay) return;

    const power = getPowerLevel();
    const bonuses = getTotalBonuses();
    const eqCount = GS.inventory.filter(i => i.equipped).length;

    let floorsHTML = ARENA_FLOORS.map((floor, i) => {
        const canHandle = power >= floor.recPower;
        const diffClass = canHandle ? "floor-ok" : "floor-hard";
        const statusIcon = canHandle
            ? `<i class="fa-solid fa-check-circle" style="color:var(--sage)"></i>`
            : `<i class="fa-solid fa-skull" style="color:var(--crimson)"></i>`;
        const enemyIcons = floor.enemies.map(eid => {
            const names = ["🕵️","🐀","💻","🦹","🖨️"];
            return names[eid] || "?";
        }).join(" ");
        return `
            <button class="floor-btn ${diffClass}" data-floor="${i}">
                <div class="floor-btn-top">
                    <div class="floor-name">${floor.name}</div>
                    <div class="floor-status-icon">${statusIcon}</div>
                </div>
                <div class="floor-enemies">${enemyIcons}</div>
                <div class="floor-meta">
                    <span class="floor-rec"><i class="fa-solid fa-bolt"></i> ${floor.recPower}</span>
                    <span class="floor-reward"><i class="fa-solid fa-coins"></i> x${floor.rewardMult}</span>
                    <span class="floor-diff">${canHandle ? "READY" : "DANGER"}</span>
                </div>
            </button>
        `;
    }).join("");

    overlay.classList.remove("hidden");
    overlay.querySelector(".result-inner").innerHTML = `
        <div class="floor-select-header">
            <div class="floor-title-row">
                <i class="fa-solid fa-shield-halved floor-title-icon"></i>
                <div class="result-title">Arena</div>
            </div>
            <div class="floor-player-stats">
                <div class="floor-power-pill">
                    <i class="fa-solid fa-bolt"></i>
                    <span class="floor-power-num">${power}</span>
                    <span class="floor-power-label">POWER</span>
                </div>
                <div class="floor-stat-pills">
                    <span class="fsp fsp-hp"><i class="fa-solid fa-heart"></i> ${50 + bonuses.hp}</span>
                    <span class="fsp fsp-atk"><i class="fa-solid fa-burst"></i> ${8 + bonuses.atk}</span>
                    <span class="fsp fsp-def"><i class="fa-solid fa-shield"></i> ${1 + bonuses.def}</span>
                    <span class="fsp fsp-cards"><i class="fa-solid fa-layer-group"></i> ${eqCount}/5</span>
                </div>
            </div>
        </div>
        <div class="floor-list">
            ${floorsHTML}
        </div>
        <button class="primary-btn secondary-btn floor-back-btn" id="floor-back">
            <i class="fa-solid fa-door-open"></i> Back to Town
        </button>
    `;

    // Wire up floor buttons
    overlay.querySelectorAll(".floor-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const floorIdx = parseInt(btn.dataset.floor);
            overlay.classList.add("hidden");
            startFloorBattle(floorIdx);
        });
    });

    // Back button
    const backBtn = overlay.querySelector("#floor-back");
    if (backBtn) backBtn.addEventListener("click", () => {
        overlay.classList.add("hidden");
        goToTown();
    });
}

function startFloorBattle(floorIdx) {
    const floor = ARENA_FLOORS[floorIdx] || ARENA_FLOORS[0];

    renderCardBonusesInBattle();

    // Start preloading shop data while player is fighting
    preloadShopData();

    // Sync equipped cards from inventory into battle engine global
    if (typeof equippedCards !== "undefined") {
        equippedCards.length = 0;
        GS.inventory.forEach(item => {
            if (item.equipped) equippedCards.push(item.card);
        });
    }

    const bonuses = getTotalBonuses();
    const power = getPowerLevel();

    // Update battle HUD with power level + equipped cards
    const waveLabel = $("wave-label");
    if (waveLabel) waveLabel.textContent = `${floor.name} | PWR ${power}`;

    startBattle((goldEarned) => {
        // Apply floor reward multiplier
        const totalGold = Math.round(goldEarned * floor.rewardMult);
        GS.gold += totalGold;
        updateGoldUI();
        showBattleVictory(totalGold);
    }, bonuses, floor);

    // Card ability button
    const cardBtn = $("btn-card-ability");
    if (cardBtn) {
        cardBtn.onclick = () => {
            if (typeof doCardAbility === "function") doCardAbility();
        };
    }

    // Retry button
    const retryBtn = $("btn-retry");
    if (retryBtn) {
        retryBtn.onclick = () => {
            $("battle-result-overlay").classList.add("hidden");
            startFloorBattle(floorIdx);
        };
    }
}

function renderCardBonusesInBattle() {
    const el = $("card-bonuses");
    if (!el) return;
    if (GS.inventory.length === 0) { el.classList.add("hidden"); return; }

    const bonuses = getTotalBonuses();
    el.classList.remove("hidden");
    el.innerHTML = `
        <div class="bonus-title">Card Bonuses Active</div>
        <div class="bonus-stats">
            <span>+${bonuses.hp} HP</span>
            <span>+${bonuses.atk} ATK</span>
            <span>+${bonuses.def} DEF</span>
        </div>
    `;
}

function showBattleVictory(gold) {
    const overlay = $("battle-result-overlay");
    if (!overlay) return;
    overlay.classList.add("hidden");

    // Rebuild overlay content (floor select may have replaced it)
    overlay.querySelector(".result-inner").innerHTML = `
        <div class="result-icon" id="result-icon"><i class="fa-solid fa-trophy"></i></div>
        <div class="result-title" id="result-title">Victory!</div>
        <div class="result-gold" id="result-gold">${gold} G earned</div>
        <div class="result-sub" id="result-sub">Head to the shop and spend your gold on cards!</div>
        <button class="primary-btn" id="btn-to-shop">
            Back to Town <i class="fa-solid fa-door-open"></i>
        </button>
    `;

    const toShop = overlay.querySelector("#btn-to-shop");
    if (toShop) toShop.onclick = () => { overlay.classList.add("hidden"); goToTown(); };

    setTimeout(() => overlay.classList.remove("hidden"), 600);
}

/* ── Death → Return to town with 10s recovery ──────────────────── */
function goToTownWithRecovery() {
    // Go to town view immediately
    goToTown();

    // Start recovering HP over 10 seconds
    GS.recovering = true;
    GS.recoverTimer = 10;

    // Show recovery overlay on top of town
    const overlay = $("battle-result-overlay");
    if (!overlay) return;

    let remaining = 10;
    overlay.querySelector(".result-inner").innerHTML = `
        <div class="result-icon"><i class="fa-solid fa-skull" style="color:var(--crimson)"></i></div>
        <div class="result-title">Defeated</div>
        <div class="result-sub">Recuperating health...</div>
        <div class="recovery-timer" id="recovery-timer">${remaining}s</div>
        <div class="recovery-bar-track"><div class="recovery-bar-fill" id="recovery-bar"></div></div>
    `;
    overlay.classList.remove("hidden");

    const timerEl = document.getElementById("recovery-timer");
    const barEl = document.getElementById("recovery-bar");

    const interval = setInterval(() => {
        remaining--;
        if (timerEl) timerEl.textContent = `${remaining}s`;
        if (barEl) barEl.style.width = `${((10 - remaining) / 10) * 100}%`;
        if (remaining <= 0) {
            clearInterval(interval);
            GS.recovering = false;
            overlay.classList.add("hidden");
            // Restore the overlay inner HTML for future use
            overlay.querySelector(".result-inner").innerHTML = `
                <div class="result-icon" id="result-icon"></div>
                <div class="result-title" id="result-title"></div>
                <div class="result-gold" id="result-gold"></div>
                <div class="result-sub" id="result-sub"></div>
                <button class="primary-btn" id="btn-to-shop">Back to Town <i class="fa-solid fa-door-open"></i></button>
                <button class="primary-btn secondary-btn" id="btn-retry" style="display:none"><i class="fa-solid fa-rotate-right"></i> Try Again</button>
            `;
        }
    }, 1000);
}

/* ════════════════════════════════════════════════════════════════
   PHASE 3: SHOP
   ════════════════════════════════════════════════════════════════ */
async function goToShop() {
    showView("shop-view");
    updateGoldUI();

    const grid = $("shop-cards-grid");
    grid.innerHTML = `<div class="shop-loading">[ FETCHING MARKET DATA… ]</div>`;

    // Skip shop button → go back to town
    $("btn-skip-shop").onclick = () => goToTown();

    try {
        // Use preloaded data if available (loaded during battle)
        let cards = _preloadedCards ? await _preloadedCards : null;
        _preloadedCards = null; // consume it

        if (!cards) {
            const rawCards = await fetchMarketplace(20);
            cards = rawCards.slice(0, 12).map((c, i) => mapToAsset(c, i));
        }

        GS.shopCards = cards;
        renderShop(cards);
        loadShopImages(cards);
    } catch (err) {
        console.warn("API failed, using mock:", err.message);
        const mockCards = generateMockShopCards();
        GS.shopCards = mockCards;
        renderShop(mockCards);
        loadShopImages(mockCards);
    }
}

function generateMockShopCards() {
    const names = ["Charizard VMAX", "Pikachu Gold", "Mewtwo EX", "Rayquaza GX", "Eevee Hero", "Gengar V", "Umbreon VMAX", "Lugia V", "Mew Gold", "Arceus VSTAR", "Giratina V", "Palkia VSTAR"];
    const sets   = ["Champion's Path", "Gold Series", "Base Set", "Sky Legends", "Evolution", "Darkness Ablaze", "Moonlit", "Silver Tempest", "Crown Zenith", "Astral Radiance", "Lost Origin", "Diamond"];
    const grades = [10, 9, 9, 8, 8, 7, 10, 9, 8, 9, 7, 8];
    const mockFlags = [null, "fmv_inflated", null, "sbt_missing", null, "vault_weak", null, "fmv_inflated", null, null, "vault_weak", "sbt_missing"];

    return names.map((name, i) => {
        const flag     = mockFlags[i];
        const grade    = grades[i];
        const fmvBase  = 200 + i * 80;
        const fmvUSD   = fmvBase;

        const fmvOk   = flag !== "fmv_inflated";
        const sbtOk   = flag !== "sbt_missing";
        const vaultOk = flag !== "vault_weak" && grade >= 8;

        let vaultSigs = vaultOk ? `${grade >= 10 ? 5 : grade >= 9 ? 4 : 3}-of-5 ✓` : "1-of-5 ✗";
        const shouldApprove = fmvOk && sbtOk && vaultOk;

        return {
            tokenId:  `mock-${i}`,
            name,
            set:      `${sets[i]} #${10 + i}`,
            condition:`PSA ${grade}`,
            grade,
            imageUrl: null,
            shopPrice: grades[i] >= 10 ? 550 + i * 30 : grades[i] >= 9 ? 280 + i * 25 : 100 + i * 20,
            fmv: {
                value: `$${fmvUSD.toLocaleString()} FMV`,
                status: fmvOk ? "ok" : "warn",
                label:  fmvOk ? "CONFIRMED" : "SUSPECT",
                stampClass: fmvOk ? "stamp-ok" : "stamp-warn",
            },
            sbt: {
                value: sbtOk ? "0xAb3…f29" : "0x000…0000",
                status: sbtOk ? "ok" : "bad",
                label:  sbtOk ? "VERIFIED" : "MISSING",
                stampClass: sbtOk ? "stamp-ok" : "stamp-warn",
            },
            vault: {
                value: vaultSigs,
                status: vaultOk ? "ok" : "bad",
                label:  vaultOk ? "SECURED" : "INSECURE",
                stampClass: vaultOk ? "stamp-ok" : "stamp-bad",
            },
            verdict: shouldApprove ? "approve" : "reject",
            verdictNote: shouldApprove
                ? `PSA ${grade} · Chain intact.`
                : `Flags: ${!fmvOk ? "FMV suspect. " : ""}${!sbtOk ? "SBT missing. " : ""}${!vaultOk ? "Vault below threshold." : ""}`,
            npcLine: `"I'd like this ${name} verified before I list it."`,
        };
    });
}

function renderShop(cards) {
    const grid = $("shop-cards-grid");
    grid.innerHTML = "";

    cards.forEach((card) => {
        const alreadyOwned = GS.inventory.some(i => i.card.tokenId === card.tokenId);
        const canAfford = GS.gold >= card.shopPrice;
        const wasPassed = GS.passedCards && GS.passedCards.includes(card.tokenId);

        const el = document.createElement("div");
        el.className = "shop-card" + (alreadyOwned ? " shop-card-bought" : "") + (!canAfford && !alreadyOwned ? " shop-card-broke" : "") + (wasPassed ? " shop-card-passed" : "");
        el.innerHTML = `
            ${wasPassed ? `<div class="shop-passed-badge"><i class="fa-solid fa-hand"></i> Passed</div>` : ""}
            <div class="shop-card-img">
                ${card.imageUrl
                    ? `<img src="${card.imageUrl}" alt="${card.name}" class="shop-card-art" />`
                    : `<div class="shop-card-art-placeholder shop-img-loading"><i class="fa-solid fa-layer-group"></i></div>`}
            </div>
            <div class="shop-card-info">
                <div class="shop-card-name">${card.name}</div>
                <div class="shop-card-set">${card.set}</div>
                <div class="shop-card-grade">${card.condition}</div>
                <div class="shop-card-bonus-hint">${getBonusHint(card.grade)}</div>
            </div>
            <div class="shop-card-footer">
                <span class="shop-card-price ${canAfford ? '' : 'price-cant-afford'}">
                    <i class="fa-solid fa-coins"></i> ${card.shopPrice} G
                </span>
                <button class="shop-buy-btn ${alreadyOwned ? 'btn-owned' : ''}"
                    data-id="${card.tokenId}"
                    ${alreadyOwned ? "disabled" : ""}>
                    ${alreadyOwned ? "Owned" : "Inspect"}
                </button>
            </div>
        `;

        if (!alreadyOwned) {
            el.querySelector(".shop-buy-btn")?.addEventListener("click", () => inspectCard(card));
        }
        grid.appendChild(el);
    });
}

// Player clicks "Inspect" on a shop card → go to appraisal desk
function inspectCard(card) {
    GS.currentCard = card;
    goToAppraisal();
}

/* ── Skip shop → go to inventory ───────────────────────────────── */

async function loadShopImages(cards) {
    // Fire all fetches in parallel and inject each image AS SOON as it resolves
    // (don't wait for all — race-style immediate rendering)
    const promises = cards.map(async (card) => {
        // Cards that already have imageUrl from API: skip fetch
        if (card.imageUrl) return;

        const imgUrl = await fetchPokemonImage(card.pokemonName || card.name);
        if (!imgUrl) return;
        card.imageUrl = imgUrl;

        // Immediately inject into the DOM
        const grid = $("shop-cards-grid");
        if (!grid) return;
        const cardEl = grid.querySelector(`.shop-buy-btn[data-id="${card.tokenId}"]`)?.closest(".shop-card");
        if (!cardEl) return;
        const placeholder = cardEl.querySelector(".shop-card-art-placeholder");
        if (placeholder) {
            const img = document.createElement("img");
            img.src = imgUrl;
            img.alt = card.name;
            img.className = "shop-card-art";
            img.onerror = () => img.remove();
            placeholder.replaceWith(img);
        }
    });

    // Don't await — let them resolve independently
    Promise.allSettled(promises);
}

function getBonusHint(grade) {
    const hp  = Math.round(grade * 6);
    const atk = Math.round(grade * 3);
    const def = Math.round(grade * 1);
    return `Potential: +${hp}HP +${atk}ATK +${def}DEF`;
}

function showShopProceedPrompt() {
    // No longer needed — inspection happens inline from the shop
}

/* ════════════════════════════════════════════════════════════════
   PHASE 4: APPRAISAL (now = INSPECTION before buying)
   Player picks a card from shop → inspects it → decides BUY or PASS
   ════════════════════════════════════════════════════════════════ */

// Shopkeeper talk animation
let _shopkeeperInterval = null;

function startShopkeeperTalk() {
    stopShopkeeperTalk();
    const img = $("shopkeeper-img");
    if (!img) return;
    let frame = 1;
    const totalFrames = 6;
    let cycles = 0;
    _shopkeeperInterval = setInterval(() => {
        frame = (frame % totalFrames) + 1;
        img.src = `assets/sprite_shopkeeper/shopkeeper_talk${frame}.png`;
        cycles++;
        // Stop after ~3 seconds of talking (18 frame changes at 180ms each)
        if (cycles >= 18) {
            stopShopkeeperTalk();
            img.src = "assets/sprite_shopkeeper/shopkeeper_talk1.png"; // rest on frame 1
        }
    }, 180);
}

function stopShopkeeperTalk() {
    if (_shopkeeperInterval) {
        clearInterval(_shopkeeperInterval);
        _shopkeeperInterval = null;
    }
}

function goToAppraisal() {
    // Called when player clicks "Inspect" on a shop card
    const card = GS.currentCard;
    if (!card) { goToShop(); return; }

    GS.checksRun = { fmv: false, sbt: false, vault: false };
    showView("game-view");
    loadCardIntoAppraisalDesk(card);
    wireAppraisalButtons();
}

function loadCardIntoAppraisalDesk(card) {
    // Reset stamps and tool statuses
    $("stamps-layer").innerHTML = "";
    ["fmv","sbt","vault"].forEach(k => {
        const btn = $(`btn-${k}`);
        const stat = $(`status-${k}`);
        if (btn)  { btn.classList.remove("used"); btn.disabled = false; }
        if (stat) { stat.className = "tool-status"; stat.textContent = "PENDING"; }
    });
    const fmvEl   = $("card-fmv");
    const sbtEl   = $("card-sbt");
    const vaultEl = $("card-vault");
    if (fmvEl)   fmvEl.innerHTML   = `<span class="data-locked">● ● ●</span>`;
    if (sbtEl)   sbtEl.innerHTML   = `<span class="data-locked">● ● ●</span>`;
    if (vaultEl) vaultEl.innerHTML = `<span class="data-locked">● ● ●</span>`;

    const acceptBtn = $("btn-accept");
    const rejectBtn = $("btn-reject");
    if (acceptBtn) acceptBtn.disabled = true;
    if (rejectBtn) rejectBtn.disabled = true;

    // Populate card display
    const nameEl = $("card-name");
    const setEl  = $("card-set");
    const condEl = $("card-condition");
    const npcEl  = $("npc-dialogue");
    const artImg = $("card-artwork-img");
    const artSvg = document.querySelector(".card-artwork-svg");

    if (nameEl) nameEl.textContent = card.name;
    if (setEl)  setEl.textContent  = card.set;
    if (condEl) condEl.textContent = card.condition;
    if (npcEl)  npcEl.textContent  = card.npcLine;

    // Animate shopkeeper talking
    startShopkeeperTalk();

    if (card.imageUrl && artImg && artSvg) {
        artImg.src = card.imageUrl;
        artImg.style.display = "block";
        artSvg.style.display = "none";
    } else if (artImg && artSvg) {
        artImg.style.display = "none";
        artSvg.style.display = "block";
    }

    // Show queue info
    const remaining = GS.appraisalQueue.length;
    const scoreEl = $("score-count");
    if (scoreEl) scoreEl.textContent = GS.score;

    // Show bonus preview
    showBonusPreview(card);
}

function showBonusPreview(card) {
    const el = $("appraisal-bonus-preview");
    const content = $("bonus-preview-content");
    if (!el || !content) return;

    const potentialBonus = computeCardBonus(card, true); // show potential if legit
    el.classList.remove("hidden");
    content.innerHTML = `
        <div class="bonus-row bonus-correct">
            <i class="fa-solid fa-coins"></i> Price: ${card.shopPrice} G
        </div>
        <div class="bonus-row bonus-correct">
            <i class="fa-solid fa-arrow-up"></i> If legit: +${potentialBonus.hp}HP +${potentialBonus.atk}ATK +${potentialBonus.def}DEF
        </div>
        <div class="bonus-row bonus-wrong">
            <i class="fa-solid fa-skull-crossbones"></i> If fake: stats will DECREASE
        </div>
    `;
}

function wireAppraisalButtons() {
    // Tool check buttons
    ["fmv", "sbt", "vault"].forEach(tool => {
        const btn = $(`btn-${tool}`);
        if (!btn) return;
        // Remove old listeners by replacing the element clone
        const fresh = btn.cloneNode(true);
        btn.parentNode.replaceChild(fresh, btn);
        fresh.addEventListener("click", () => runCheck(tool));
    });

    // Verdict buttons
    const acceptBtn = $("btn-accept");
    const rejectBtn = $("btn-reject");

    if (acceptBtn) {
        const fresh = acceptBtn.cloneNode(true);
        acceptBtn.parentNode.replaceChild(fresh, acceptBtn);
        fresh.addEventListener("click", () => handleVerdict("approve"));
    }
    if (rejectBtn) {
        const fresh = rejectBtn.cloneNode(true);
        rejectBtn.parentNode.replaceChild(fresh, rejectBtn);
        fresh.addEventListener("click", () => handleVerdict("reject"));
    }
}

// Educational explanations for each check type
const CHECK_EXPLANATIONS = {
    fmv: {
        ok: "The asking price is within a reasonable range of the Fair Market Value (FMV). This means the card hasn't been artificially inflated — the seller isn't trying to pass off a $400 card as worth $12,000.",
        warn: "The asking price is significantly higher than the Fair Market Value. This is a red flag — the seller may be inflating the price to launder money or dump a counterfeit card at an unrealistic valuation."
    },
    sbt: {
        ok: "The Soul-Bound Token (SBT) shows a valid owner address with chain-of-custody records. This proves the card has a traceable provenance history on-chain.",
        warn: "The SBT shows a zeroed or missing owner address. Without chain-of-custody, there's no proof this card wasn't stolen, duplicated, or fabricated. Provenance is unverifiable.",
        bad: "No Soul-Bound Token exists for this card. This means there's zero on-chain proof of ownership or transfer history. It could be a phantom asset."
    },
    vault: {
        ok: "The card meets the multi-signature vault custody threshold (3+ of 5 custodians have signed). This means multiple independent parties verified the physical card exists in secure storage.",
        bad: "The vault shows insufficient signatures (1 of 5). This means the card hasn't been properly verified by enough custodians — it may not actually exist in physical storage."
    }
};

function runCheck(tool) {
    const card = GS.currentCard;
    if (!card) return;

    GS.checksRun[tool] = true;
    const btn  = $(`btn-${tool}`);
    const stat = $(`status-${tool}`);
    const dataEl = $(`card-${tool}`);

    if (btn)  { btn.classList.add("used"); btn.disabled = true; }
    if (stat) { stat.className = "tool-status loading"; stat.textContent = "…"; }

    // Simulate async oracle query
    setTimeout(() => {
        const info = card[tool];
        if (stat) {
            stat.className = `tool-status ${info.status}`;
            stat.textContent = info.label;
        }
        if (dataEl) {
            dataEl.innerHTML = info.value;
            dataEl.className = `data-value revealed-${info.status}`;
        }

        // Add stamp to card
        addStamp(info.stampClass, info.label);

        // Show educational explanation
        showCheckExplanation(tool, info.status);

        // Enable verdict buttons once all three checks done
        if (GS.checksRun.fmv && GS.checksRun.sbt && GS.checksRun.vault) {
            const ab = $("btn-accept");
            const rb = $("btn-reject");
            if (ab) ab.disabled = false;
            if (rb) rb.disabled = false;
        }
    }, 600 + Math.random() * 400);
}

function showCheckExplanation(tool, status) {
    const explanations = CHECK_EXPLANATIONS[tool];
    if (!explanations) return;
    const text = explanations[status] || explanations.ok || "";
    if (!text) return;

    const toolNames = { fmv: "FMV Oracle", sbt: "SBT Provenance", vault: "Vault Multi-Sig" };
    const isGood = status === "ok";

    // Create or reuse the explanation panel
    let panel = document.getElementById("check-explanation");
    if (!panel) {
        panel = document.createElement("div");
        panel.id = "check-explanation";
        panel.className = "check-explanation";
        // Insert it into the action panel area
        const actionPanel = document.querySelector(".action-panel");
        if (actionPanel) {
            actionPanel.appendChild(panel);
        } else {
            document.body.appendChild(panel);
        }
    }

    panel.innerHTML = `
        <div class="check-exp-header ${isGood ? 'check-exp-ok' : 'check-exp-warn'}">
            <i class="fa-solid ${isGood ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
            <span>${toolNames[tool]}: ${isGood ? 'PASSED' : 'FLAGGED'}</span>
        </div>
        <div class="check-exp-body">${text}</div>
        <button class="check-exp-skip" onclick="document.getElementById('check-explanation').classList.add('hidden')">
            <i class="fa-solid fa-forward"></i> Got it
        </button>
    `;
    panel.classList.remove("hidden");
}

function addStamp(stampClass, label) {
    const layer = $("stamps-layer");
    if (!layer) return;
    const stamp = document.createElement("div");
    stamp.className = `stamp ${stampClass}`;
    stamp.textContent = label;
    layer.appendChild(stamp);
}

function handleVerdict(playerChoice) {
    const card = GS.currentCard;
    if (!card) return;

    if (playerChoice === "approve") {
        // BUY — player commits gold
        if (GS.gold < card.shopPrice) {
            const overlay = $("verdict-overlay");
            if (overlay) {
                $("verdict-icon").innerHTML = `<i class="fa-solid fa-coins" style="color:var(--crimson)"></i>`;
                $("verdict-title").textContent = "Not Enough Gold!";
                $("verdict-sub").textContent = `Need ${card.shopPrice} G but you only have ${GS.gold} G.`;
                overlay.classList.remove("hidden");
                const nextBtn = $("btn-next");
                if (nextBtn) {
                    const fresh = nextBtn.cloneNode(true);
                    nextBtn.parentNode.replaceChild(fresh, nextBtn);
                    fresh.addEventListener("click", () => {
                        overlay.classList.add("hidden");
                        goToShopView();
                    });
                }
            }
            return;
        }

        // Spend gold
        GS.gold -= card.shopPrice;
        updateGoldUI();

        // Card legitimacy is hidden — player doesn't know yet
        const isLegit = card.verdict === "approve";
        const bonuses = computeCardBonus(card, isLegit);

        // Store in inventory — don't reveal legitimacy
        GS.inventory.push({
            card,
            bonuses,
            equipped: false,
            isLegit, // hidden from UI until player discovers via stats
            sellValue: Math.round(card.shopPrice * (isLegit ? 0.7 : 0.1)), // fakes are nearly worthless
        });

        // Remove from shop pool
        GS.shopCards = GS.shopCards.filter(c => c.tokenId !== card.tokenId);

        const iconHtml = `<i class="fa-solid fa-box-archive" style="color:var(--brass)"></i>`;
        showVerdictOverlay(iconHtml, "Card Purchased!", `${card.name} added to your collection.\nEquip it in your inventory to apply its effects.`, () => goToShopView());

    } else {
        // PASS — no gold spent, card stays, mark as passed
        if (!GS.passedCards) GS.passedCards = [];
        if (!GS.passedCards.includes(card.tokenId)) {
            GS.passedCards.push(card.tokenId);
        }
        const iconHtml = `<i class="fa-solid fa-hand" style="color:var(--muted)"></i>`;
        showVerdictOverlay(iconHtml, "Passed", "Card remains in the market.", () => goToShopView());
    }
}

// Helper to return to shop view (re-render with remaining cards)
function goToShopView() {
    showView("shop-view");
    updateGoldUI();
    if (GS.shopCards.length > 0) {
        renderShop(GS.shopCards);
    } else {
        const grid = $("shop-cards-grid");
        if (grid) grid.innerHTML = `<div class="shop-loading">Market cleared! Move on.</div>`;
    }
}

function showVerdictOverlay(iconHtml, title, sub, onNext) {
    const overlay = $("verdict-overlay");
    if (!overlay) return;
    $("verdict-icon").innerHTML    = iconHtml;
    $("verdict-title").textContent = title;
    $("verdict-sub").textContent   = sub;
    overlay.classList.remove("hidden");

    const nextBtn = $("btn-next");
    if (nextBtn) {
        const fresh = nextBtn.cloneNode(true);
        nextBtn.parentNode.replaceChild(fresh, nextBtn);
        fresh.addEventListener("click", () => {
            overlay.classList.add("hidden");
            onNext();
        });
    }
}

/* ════════════════════════════════════════════════════════════════
   PHASE 5: INVENTORY
   ════════════════════════════════════════════════════════════════ */
function goToInventory() {
    showView("inventory-view");

    const countEl = $("inv-card-count");
    if (countEl) countEl.textContent = GS.inventory.length;

    renderInventory();

    const fightBtn = $("btn-fight-again");
    if (fightBtn) fightBtn.onclick = () => {
        GS.runCount++;
        goToTown();
    };
}

function renderInventory() {
    const grid = $("inventory-grid");
    if (!grid) return;

    if (GS.inventory.length === 0) {
        grid.innerHTML = `<div class="shop-loading">No cards yet. Buy some in the shop!</div>`;
        return;
    }

    grid.innerHTML = "";
    GS.inventory.forEach((item, idx) => {
        const { card, bonuses, equipped, sellValue, isLegit } = item;
        const isNegative = bonuses.hp < 0 || bonuses.atk < 0 || bonuses.def < 0;
        const statColor = isNegative ? "color:var(--crimson)" : "color:var(--sage)";

        const el = document.createElement("div");
        el.className = `shop-card inv-card ${isNegative && equipped ? "inv-card-cursed" : ""}`;
        el.innerHTML = `
            <div class="shop-card-img">
                ${card.imageUrl
                    ? `<img src="${card.imageUrl}" alt="${card.name}" class="shop-card-art" />`
                    : `<div class="shop-card-art-placeholder"><i class="fa-solid fa-layer-group"></i></div>`}
                ${equipped ? `<div class="eq-badge"><i class="fa-solid fa-shield-halved"></i> EQUIPPED</div>` : ""}
            </div>
            <div class="shop-card-info">
                <div class="shop-card-name">${card.name}</div>
                <div class="shop-card-set">${card.condition}</div>
                <div class="shop-card-bonus-hint" style="${statColor}">
                    ${bonuses.hp >= 0 ? '+' : ''}${bonuses.hp}HP
                    ${bonuses.atk >= 0 ? '+' : ''}${bonuses.atk}ATK
                    ${bonuses.def >= 0 ? '+' : ''}${bonuses.def}DEF
                    ${isNegative ? '<i class="fa-solid fa-skull-crossbones"></i>' : ''}
                </div>
                <div style="display:flex;gap:4px;margin-top:6px">
                    <button class="shop-equip-btn ${equipped ? "btn-equipped" : ""}" style="flex:1"
                        data-action="equip" data-idx="${idx}">
                        ${equipped ? "Unequip" : "Equip"}
                    </button>
                    <button class="shop-equip-btn sell-btn" data-action="sell" data-idx="${idx}">
                        <i class="fa-solid fa-coins"></i> Sell ${sellValue || Math.round(card.shopPrice * 0.5)}G
                    </button>
                </div>
            </div>
        `;

        // Equip handler
        el.querySelector('[data-action="equip"]').addEventListener("click", () => {
            item.equipped = !item.equipped;
            // Max 5 equipped
            const eqCount = GS.inventory.filter(i => i.equipped).length;
            if (eqCount > 5) item.equipped = false;
            syncEquippedCards();
            renderInventory();
        });

        // Sell handler
        el.querySelector('[data-action="sell"]').addEventListener("click", () => {
            const goldBack = item.sellValue || Math.round(card.shopPrice * 0.5);
            GS.gold += goldBack;
            updateGoldUI();
            if (item.equipped) item.equipped = false;
            GS.inventory.splice(idx, 1);
            syncEquippedCards();
            renderInventory();
            const countEl = $("inv-card-count");
            if (countEl) countEl.textContent = GS.inventory.length;
        });

        grid.appendChild(el);
    });

    // Show total bonus summary (only for equipped cards)
    const totals = getTotalBonuses();
    const isNet = totals.hp < 0 || totals.atk < 0 || totals.def < 0;
    const summary = document.createElement("div");
    summary.className = "inv-total-summary";
    summary.innerHTML = `
        <div class="bonus-title"><i class="fa-solid fa-shield-halved"></i> Equipped Bonuses</div>
        <div class="bonus-stats" style="${isNet ? 'color:var(--crimson)' : ''}">
            <span>${totals.hp >= 0 ? '+' : ''}${totals.hp} HP</span>
            <span>${totals.atk >= 0 ? '+' : ''}${totals.atk} ATK</span>
            <span>${totals.def >= 0 ? '+' : ''}${totals.def} DEF</span>
        </div>
        ${isNet ? '<div style="font-size:0.55rem;color:var(--crimson);margin-top:4px"><i class="fa-solid fa-triangle-exclamation"></i> Fake cards are reducing your stats!</div>' : ''}
    `;
    grid.appendChild(summary);
}

// Sync equipped cards to battle engine
function syncEquippedCards() {
    if (typeof equippedCards !== "undefined") {
        equippedCards.length = 0;
        GS.inventory.forEach(i => { if (i.equipped) equippedCards.push(i.card); });
        if (equippedCards.length > 3) equippedCards.splice(3);
    }
}

// getTotalBonuses now only counts EQUIPPED cards
function getTotalBonuses() {
    return GS.inventory
        .filter(item => item.equipped)
        .reduce((acc, item) => {
            acc.hp  += item.bonuses.hp;
            acc.atk += item.bonuses.atk;
            acc.def += item.bonuses.def;
            return acc;
        }, { hp: 0, atk: 0, def: 0 });
}

// Power level — single number representing player strength
function getPowerLevel() {
    const bonuses = getTotalBonuses();
    const baseHP = 50, baseATK = 8, baseDEF = 1;
    const totalHP  = baseHP + bonuses.hp;
    const totalATK = baseATK + bonuses.atk;
    const totalDEF = baseDEF + bonuses.def;
    return totalHP + totalATK * 3 + totalDEF * 2;
}

// Arena floor definitions — each floor has a recommended power + reward multiplier
const ARENA_FLOORS = [
    { name: "Floor 1 — Rats",         recPower: 70,  rewardMult: 1.0, scaleMult: 0.5, enemies: [1,1],     desc: "A few vault rats. Good for beginners." },
    { name: "Floor 2 — Dealers",      recPower: 100, rewardMult: 1.3, scaleMult: 1.0, enemies: [0,1],     desc: "Counterfeit dealers start showing up." },
    { name: "Floor 3 — Hackers",      recPower: 150, rewardMult: 1.6, scaleMult: 1.8, enemies: [0,2,1],   desc: "Oracle hackers join the fray." },
    { name: "Floor 4 — Forgers",      recPower: 220, rewardMult: 2.0, scaleMult: 2.5, enemies: [4,0,2],   desc: "Slab forgers and ranged enemies." },
    { name: "Floor 5 — Shadow Broker", recPower: 320, rewardMult: 3.0, scaleMult: 3.5, enemies: [3,4,2],  desc: "The boss appears. Bring your best cards." },
];

/* ════════════════════════════════════════════════════════════════
   TOWN HUB — Overworld with scrolling camera
   ════════════════════════════════════════════════════════════════ */
let townState = null;
let townRAF = null;

// Load town background as an Image for canvas drawing
const _townImg = new Image();
_townImg.src = "assets/town.png";

// Town map — 1000x1000 image at 2.5x = 2500px world (zoomed out)
const TOWN_SCALE = 2.5;
const TOWN_WORLD_W = 1000 * TOWN_SCALE;
const TOWN_WORLD_H = 1000 * TOWN_SCALE;

// Location zones in world space (2.5x scale)
const TOWN_ZONES = {
    arena: { x: 650,  y: 1000, radius: 280, label: "lbl-arena" },
    shop:  { x: 1720, y: 850,  radius: 280, label: "lbl-shop" },
    house: { x: 1250, y: 2000, radius: 280, label: "lbl-house" },
};

// Building collision boxes — rectangles the player cannot walk into
// Format: { x, y, w, h } in world space (top-left corner + size)
const TOWN_COLLIDERS = [
    // Arena building (left side)
    { x: 350,  y: 500,  w: 800, h: 600 },
    // Shop building (right side)
    { x: 1500, y: 200,  w: 600, h: 800 },
    // House building (center-bottom)
    { x: 1000, y: 1560, w: 850, h: 550 },
];

// Check if a point collides with any building
function townCollides(px, py, padding) {
    padding = padding || 20;
    for (const c of TOWN_COLLIDERS) {
        if (px > c.x - padding && px < c.x + c.w + padding &&
            py > c.y - padding && py < c.y + c.h + padding) {
            return true;
        }
    }
    return false;
}

function goToTown() {
    showView("town-view");
    updateGoldUI();

    const canvas = $("town-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function resize() {
        const wrap = canvas.parentElement;
        canvas.width = wrap.clientWidth || 800;
        canvas.height = wrap.clientHeight || 500;
    }
    resize();
    window.addEventListener("resize", resize);

    const goldEl = $("town-gold-val");
    if (goldEl) goldEl.textContent = `${GS.gold} G`;
    const powerEl = $("town-power-val");
    if (powerEl) powerEl.textContent = `PWR ${getPowerLevel()}`;

    townState = {
        // Player position in world space — use last position or center
        px: (GS.lastTownPos && GS.lastTownPos.x) || 1250,
        py: (GS.lastTownPos && GS.lastTownPos.y) || 1250,
        facing: 1,
        spriteFrame: 0,
        spriteTimer: 0,
        spriteState: "idle",
        keys: {},
        nearZone: null,
    };

    const keyDown = e => { if (townState) townState.keys[e.key] = true; };
    const keyUp   = e => { if (townState) townState.keys[e.key] = false; };
    const interact = e => {
        if (!townState) return;
        // Only handle keys when town view is actually visible
        const townView = document.getElementById("town-view");
        if (!townView || townView.classList.contains("hidden")) return;
        // Consume Enter/Space/E in town view so they don't trigger other buttons
        if (e.key === "Enter" || e.key === " " || e.key === "e" || e.key === "E") {
            e.preventDefault();
            e.stopPropagation();
            if (townState.nearZone) {
                enterZone(townState.nearZone);
            }
        }
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keydown", interact);
    window.addEventListener("keyup", keyUp);

    townState._cleanup = () => {
        window.removeEventListener("keydown", keyDown);
        window.removeEventListener("keydown", interact);
        window.removeEventListener("keyup", keyUp);
    };

    if (townRAF) cancelAnimationFrame(townRAF);
    townLoop(ctx, canvas);

    // Show tutorial on first ever visit
    if (!GS._tutorialDone) {
        GS._tutorialDone = true;
        showTownTutorial();
    }
}

/* ── Town Tutorial Spotlight ───────────────────────────────────── */
const TUTORIAL_STEPS = [
    { target: "player", text: "This is you. You are an adventurer." },
    { target: "arena",  text: "This is the Arena — fight enemies and earn gold." },
    { target: "shop",   text: "This is the Card Shop — inspect and buy cards." },
    { target: "house",  text: "This is your Home — equip cards to power up." },
];

function showTownTutorial() {
    let step = 0;

    // Save original player position
    const origPx = townState.px;
    const origPy = townState.py;

    // Use a camera override — doesn't move the player
    townState._camOverride = null;

    // Create overlay
    const overlay = document.createElement("div");
    overlay.id = "tutorial-overlay";
    overlay.className = "tutorial-overlay";
    overlay.innerHTML = `
        <div class="tutorial-spotlight" id="tutorial-spotlight"></div>
        <div class="tutorial-text-box" id="tutorial-text"></div>
        <div class="tutorial-skip">Click or press any key to continue</div>
        <button class="tutorial-skip-btn" id="tutorial-skip-btn">Skip Tutorial</button>
    `;
    document.querySelector(".town-wrap").appendChild(overlay);

    function showStep() {
        if (step >= TUTORIAL_STEPS.length) {
            // Remove override, restore player position
            townState._camOverride = null;
            townState.px = origPx;
            townState.py = origPy;
            overlay.remove();
            return;
        }
        const s = TUTORIAL_STEPS[step];
        const textEl = document.getElementById("tutorial-text");
        const spotEl = document.getElementById("tutorial-spotlight");
        if (textEl) textEl.textContent = s.text;

        const canvas = $("town-canvas");
        const W = canvas ? canvas.width : 800;
        const H = canvas ? canvas.height : 500;

        if (s.target === "player") {
            // Camera stays on player (no override)
            townState._camOverride = null;
            if (spotEl) {
                spotEl.style.left = (W / 2) + "px";
                spotEl.style.top = (H / 2) + "px";
            }
        } else {
            // Pan camera to zone WITHOUT moving player
            const zone = TOWN_ZONES[s.target];
            if (zone) {
                // Override camera center to zone position
                townState._camOverride = { x: zone.x, y: zone.y };

                const camX = Math.max(0, Math.min(TOWN_WORLD_W - W, zone.x - W / 2));
                const camY = Math.max(0, Math.min(TOWN_WORLD_H - H, zone.y - H / 2));

                // Spotlight on zone label (above zone center)
                const screenX = zone.x - camX;
                const screenY = zone.y - camY - 40;

                if (spotEl) {
                    spotEl.style.left = screenX + "px";
                    spotEl.style.top = screenY + "px";
                }

                // Force render with camera override
                const ctx = canvas.getContext("2d");
                townRender(ctx, canvas);
            }
        }
    }

    function advance() {
        step++;
        showStep();
    }

    overlay.addEventListener("click", (e) => {
        if (e.target.id === "tutorial-skip-btn") return; // handled separately
        advance();
    });
    const onKey = (e) => {
        e.preventDefault();
        e.stopPropagation();
        advance();
        if (step >= TUTORIAL_STEPS.length) {
            window.removeEventListener("keydown", onKey);
        }
    };
    window.addEventListener("keydown", onKey);

    // Skip button ends tutorial immediately
    const skipBtn = overlay.querySelector("#tutorial-skip-btn");
    if (skipBtn) {
        skipBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            step = TUTORIAL_STEPS.length;
            townState._camOverride = null;
            townState.px = origPx;
            townState.py = origPy;
            overlay.remove();
            window.removeEventListener("keydown", onKey);
        });
    }

    showStep();
}

function townLoop(ctx, canvas) {
    townUpdate(canvas);
    townRender(ctx, canvas);
    townRAF = requestAnimationFrame(() => townLoop(ctx, canvas));
}

function townUpdate(canvas) {
    if (!townState) return;
    const speed = 7; // fast movement for larger world

    let dx = 0, dy = 0;
    if (townState.keys["a"]||townState.keys["A"]||townState.keys["ArrowLeft"])  { dx -= 1; townState.facing = -1; }
    if (townState.keys["d"]||townState.keys["D"]||townState.keys["ArrowRight"]) { dx += 1; townState.facing = 1; }
    if (townState.keys["w"]||townState.keys["W"]||townState.keys["ArrowUp"])    dy -= 1;
    if (townState.keys["s"]||townState.keys["S"]||townState.keys["ArrowDown"])  dy += 1;
    if (dx && dy) { dx *= 0.707; dy *= 0.707; }

    // Player can roam the full map; camera clamps separately to avoid void
    // Move each axis independently so player slides along building walls
    const newX = Math.max(0, Math.min(TOWN_WORLD_W, townState.px + dx * speed));
    const newY = Math.max(550, Math.min(TOWN_WORLD_H, townState.py + dy * speed));

    // Try X first
    if (!townCollides(newX, townState.py)) {
        townState.px = newX;
    }
    // Try Y
    if (!townCollides(townState.px, newY)) {
        townState.py = newY;
    }

    // Sprite animation
    const moving = dx !== 0 || dy !== 0;
    const targetState = moving ? "run" : "idle";
    if (targetState !== townState.spriteState) {
        townState.spriteState = targetState;
        townState.spriteFrame = 0;
        townState.spriteTimer = 0;
    }
    townState.spriteTimer++;
    const spd = targetState === "run" ? 6 : 20;
    if (townState.spriteTimer >= spd) {
        townState.spriteTimer = 0;
        const frames = _sprites[targetState] || _sprites.idle;
        if (frames) townState.spriteFrame = (townState.spriteFrame + 1) % frames.length;
    }

    // Zone proximity check
    townState.nearZone = null;
    for (const [id, zone] of Object.entries(TOWN_ZONES)) {
        const dist = Math.sqrt((townState.px - zone.x)**2 + (townState.py - zone.y)**2);
        const labelEl = $(zone.label);
        if (dist < zone.radius) {
            townState.nearZone = id;
            if (labelEl) labelEl.classList.add("town-label-active");
        } else {
            if (labelEl) labelEl.classList.remove("town-label-active");
        }
    }

    // Update hint
    const hintEl = $("town-hint");
    if (hintEl) {
        if (townState.nearZone) {
            const names = { arena: "Arena", shop: "Card Shop", house: "Inventory" };
            hintEl.textContent = `Press E or Space to enter ${names[townState.nearZone]}`;
            hintEl.style.borderColor = "rgba(240,228,208,0.6)";
        } else {
            hintEl.textContent = "Use WASD to move. Walk to a building to enter.";
            hintEl.style.borderColor = "";
        }
    }

    // Update floating label positions based on camera
    const W = canvas.width, H = canvas.height;
    const camX = Math.max(0, Math.min(TOWN_WORLD_W - W, townState.px - W / 2));
    const camY = Math.max(0, Math.min(TOWN_WORLD_H - H, townState.py - H / 2));
    for (const [id, zone] of Object.entries(TOWN_ZONES)) {
        const labelEl = $(zone.label);
        if (labelEl) {
            const screenX = zone.x - camX;
            const screenY = zone.y - camY - 60;
            labelEl.style.left = screenX + "px";
            labelEl.style.top = screenY + "px";
            labelEl.style.transform = "translateX(-50%)";
            // Hide if off screen
            labelEl.style.display = (screenX > -100 && screenX < W + 100) ? "" : "none";
        }
    }
}

function townRender(ctx, canvas) {
    if (!townState) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Camera: follow player or tutorial override, clamped to map edges
    const camCenterX = (townState._camOverride ? townState._camOverride.x : townState.px);
    const camCenterY = (townState._camOverride ? townState._camOverride.y : townState.py);
    const camX = Math.max(0, Math.min(TOWN_WORLD_W - W, camCenterX - W / 2));
    const camY = Math.max(0, Math.min(TOWN_WORLD_H - H, camCenterY - H / 2));

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Draw town background image offset by camera
    if (_townImg.complete && _townImg.naturalWidth > 0) {
        // Scale town image to fill TOWN_WORLD_W x TOWN_WORLD_H
        ctx.drawImage(_townImg, -camX, -camY, TOWN_WORLD_W, TOWN_WORLD_H);
    } else {
        ctx.fillStyle = "#2a1e14";
        ctx.fillRect(0, 0, W, H);
    }

    // Draw player at world position offset by camera (not always center)
    const screenPx = townState.px - camX;
    const screenPy = townState.py - camY;

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(screenPx, screenPy + 12, 18, 6, 0, 0, Math.PI*2);
    ctx.fill();

    // Sprite — 180px tall
    const frames = _sprites[townState.spriteState] || _sprites.idle;
    const sprImg = frames ? frames[townState.spriteFrame % frames.length] : null;
    const sprH = 180;
    const sprW = sprImg && sprImg.naturalWidth
        ? Math.round(sprH * (sprImg.naturalWidth / sprImg.naturalHeight))
        : 70;

    ctx.save();
    ctx.translate(screenPx, screenPy);
    ctx.scale(townState.facing, 1);
    if (sprImg && sprImg.complete && sprImg.naturalWidth > 0) {
        ctx.drawImage(sprImg, -sprW/2, -sprH + 8, sprW, sprH);
    } else {
        ctx.fillStyle = "#c49a6c";
        ctx.fillRect(-8, -24, 16, 24);
    }
    ctx.restore();

    // Draw zone markers in world space (converted to screen)
    for (const [id, zone] of Object.entries(TOWN_ZONES)) {
        const zx = zone.x - camX;
        const zy = zone.y - camY;
        if (zx < -60 || zx > W + 60) continue;
        const isNear = townState.nearZone === id;
        ctx.save();
        ctx.globalAlpha = isNear ? 0.6 : 0.2;
        ctx.strokeStyle = isNear ? "#fff" : "#C8963C";
        ctx.lineWidth = 2;
        ctx.setLineDash([4,4]);
        ctx.beginPath();
        ctx.arc(zx, zy, zone.radius, 0, Math.PI*2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    ctx.restore();
}

function enterZone(zone) {
    if (!townState) return;
    // Block arena entry while recovering
    if (zone === "arena" && GS.recovering) return;

    // Remember position so player returns to where they left
    GS.lastTownPos = { x: townState.px, y: townState.py };

    if (townState._cleanup) townState._cleanup();
    if (townRAF) { cancelAnimationFrame(townRAF); townRAF = null; }
    townState = null;

    if (zone === "arena") goToBattle();
    else if (zone === "shop") goToShop();
    else if (zone === "house") goToInventory();
}

/* ════════════════════════════════════════════════════════════════
   BOOT
   ════════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
    initLanding();

    // Preload shop data early so cards are ready when player reaches the shop
    preloadShopData();

    // All play buttons across the landing page start the game
    ["hero-play-btn", "cta-play-btn"].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener("click", () => goToTown());
    });

    // Landing page nav smooth-scroll
    document.querySelectorAll(".lp-nav-link[href^='#']").forEach(link => {
        link.addEventListener("click", e => {
            e.preventDefault();
            const target = document.querySelector(link.getAttribute("href"));
            if (target) {
                const landingView = document.getElementById("landing-view");
                const offset = target.getBoundingClientRect().top
                    + (landingView ? landingView.scrollTop : 0)
                    - 68;
                (landingView || window).scrollTo({ top: offset, behavior: "smooth" });
            }
        });
    });

    // Ghost "how it works" link smooth scroll too
    document.querySelectorAll(".lp-hero-btn-ghost[href^='#']").forEach(link => {
        link.addEventListener("click", e => {
            e.preventDefault();
            const target = document.querySelector(link.getAttribute("href"));
            if (target) {
                const landingView = document.getElementById("landing-view");
                const offset = target.getBoundingClientRect().top
                    + (landingView ? landingView.scrollTop : 0)
                    - 68;
                (landingView || window).scrollTo({ top: offset, behavior: "smooth" });
            }
        });
    });
});
