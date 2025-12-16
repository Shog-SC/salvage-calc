// assets/js/hauling.js — V1_5_3
// Mode Débutant : calcul instantané (sans UEX).
// Patch V1_5_0:
// - Suppression du bouton "Max SCU" : auto-remplissage du Cargo (SCU) à la sélection du vaisseau
// - Fermeture automatique du menu vaisseau après sélection
// - Recherche dans la liste des vaisseaux
// - "Type de cargo" = profil de risque (seuils) + raison simple sous le verdict

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  // Tabs
  const tabBeginner = $("tabBeginner");
  const tabAdvanced = $("tabAdvanced");
  const panelBeginner = $("panelBeginner");
  const panelAdvanced = $("panelAdvanced");

  // Inputs
  const cargoScu = $("cargoScu");
  const loopMinutes = $("loopMinutes");
  const buyPrice = $("buyPrice");
  const sellPrice = $("sellPrice");
  const targetProfitHour = $("targetProfitHour");
  const btnReset = $("btnReset");

  // Custom ship
  const customShipBox = $("customShipBox");
  const customShipName = $("customShipName");
  const customShipScu = $("customShipScu");

  // Ship picker
  const shipPickerBtn = $("shipPickerBtn");
  const shipPickerLabel = $("shipPickerLabel");
  const shipPickerMenu = $("shipPickerMenu");
  const shipPickerSearch = $("shipPickerSearch");
  const shipPickerList = $("shipPickerList");

  // Cargo type picker (custom UI + hidden select)
  const cargoTypeSelect = $("cargoType");
  const cargoTypePickerBtn = $("cargoTypePickerBtn");
  const cargoTypePickerLabel = $("cargoTypePickerLabel");
  const cargoTypePickerMenu = $("cargoTypePickerMenu");

  // Outputs
  const kpiInvest = $("kpiInvest");
  const kpiRevenue = $("kpiRevenue");
  const kpiProfit = $("kpiProfit");
  const kpiProfitHour = $("kpiProfitHour");
  const verdictText = $("verdictText");
  const cargoProfile = $("cargoProfile");
  const verdictReason = $("verdictReason");
  const riskNote = $("riskNote");
  const statusChip = $("statusChip");
  const manualBadge = $("manualBadge");

  // State
  let ALL_SHIPS = [];
  let selectedShipId = "none"; // "none" | "custom" | "ship:<idx>"
  let manualCargo = false;

  // ---------- Utilities ----------
  const fmt = new Intl.NumberFormat("fr-FR");
  const fmtAuec = (n) => `${fmt.format(Math.round(n || 0))} aUEC`;
  const fmtAuecH = (n) => `${fmt.format(Math.round(n || 0))} aUEC/h`;

  function setMode(mode) {
    const isBeginner = mode === "beginner";
    tabBeginner?.classList.toggle("is-active", isBeginner);
    tabAdvanced?.classList.toggle("is-active", !isBeginner);
    panelBeginner?.classList.toggle("is-hidden", !isBeginner);
    panelAdvanced?.classList.toggle("is-hidden", isBeginner);
  }

  function openShipPicker() {
    if (!shipPickerMenu || !shipPickerBtn) return;
    shipPickerMenu.classList.remove("is-hidden");
    shipPickerBtn.setAttribute("aria-expanded", "true");
    // focus search
    setTimeout(() => shipPickerSearch?.focus(), 0);
  }

  function closeShipPicker() {
    if (!shipPickerMenu || !shipPickerBtn) return;
    shipPickerMenu.classList.add("is-hidden");
    shipPickerBtn.setAttribute("aria-expanded", "false");
  }

  function toggleShipPicker() {
    const isHidden = shipPickerMenu?.classList.contains("is-hidden");
    if (isHidden) openShipPicker();
    else closeShipPicker();
  }

  function openCargoTypePicker() {
    if (!cargoTypePickerMenu || !cargoTypePickerBtn) return;
    cargoTypePickerMenu.classList.remove("is-hidden");
    cargoTypePickerBtn.setAttribute("aria-expanded", "true");
  }

  function closeCargoTypePicker() {
    if (!cargoTypePickerMenu || !cargoTypePickerBtn) return;
    cargoTypePickerMenu.classList.add("is-hidden");
    cargoTypePickerBtn.setAttribute("aria-expanded", "false");
  }

  function toggleCargoTypePicker() {
    const isHidden = cargoTypePickerMenu?.classList.contains("is-hidden");
    if (isHidden) openCargoTypePicker();
    else closeCargoTypePicker();
  }

  function showRiskBadge(show) {
    if (!riskNote) return;
    riskNote.classList.toggle("is-hidden", !show);
  }

  function setManual(isManual) {
    manualCargo = Boolean(isManual);
    if (manualBadge) manualBadge.classList.toggle("is-hidden", !manualCargo);
  }

  function getShipById(id) {
    if (!id || id === "none" || id === "custom") return null;
    if (!id.startsWith("ship:")) return null;
    const idx = Number(id.split(":")[1]);
    if (!Number.isFinite(idx)) return null;
    return ALL_SHIPS[idx] || null;
  }

  // Auto-fill SCU from selected ship (unless user overridden manually)
  function applySelectedShipCapacity() {
    if (!cargoScu) return;
    if (manualCargo) return;

    if (selectedShipId === "custom") {
      const customVal = Number(customShipScu?.value || 0) || 0;
      if (customVal > 0) cargoScu.value = String(customVal);
      return;
    }

    const ship = getShipById(selectedShipId);
    const shipScu = Number(ship?.scu || 0);
    if (!ship || shipScu <= 0) return;

    cargoScu.value = String(shipScu);
  }

  // ---------- Rendering ----------
  function renderShipList(filterText = "") {
    if (!shipPickerList) return;

    const q = (filterText || "").trim().toLowerCase();
    shipPickerList.innerHTML = "";

    const makeItem = (label, sub, id) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ship-item";
      btn.setAttribute("role", "option");
      btn.dataset.shipId = id;

      const left = document.createElement("span");
      left.className = "ship-name";
      left.textContent = label;

      const right = document.createElement("span");
      right.className = "ship-scu";
      right.textContent = sub;

      btn.appendChild(left);
      btn.appendChild(right);

      btn.addEventListener("click", () => {
        selectShip(id);
      });

      return btn;
    };

    const filtered = ALL_SHIPS
      .map((s, idx) => ({ ...s, _id: `ship:${idx}` }))
      .filter((s) => {
        if (!q) return true;
        return (s.name || "").toLowerCase().includes(q);
      });

    // Custom always at bottom
    const customBtn = makeItem("Custom", "saisie manuelle", "custom");

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ship-empty";
      empty.textContent = "Aucun résultat.";
      shipPickerList.appendChild(empty);
      shipPickerList.appendChild(customBtn);
      return;
    }

    for (const s of filtered) {
      const scu = Number(s.scu || 0);
      const scuTxt = scu > 0 ? `${fmt.format(scu)} SCU` : "SCU ?";
      shipPickerList.appendChild(makeItem(s.name, scuTxt, s._id));
    }
    shipPickerList.appendChild(customBtn);
  }

  function selectShip(id) {
    selectedShipId = id || "none";

    if (selectedShipId === "custom") {
      shipPickerLabel.textContent = (customShipName?.value || "Custom").trim() || "Custom";
      customShipBox?.classList.remove("is-hidden");
      // On repasse en mode auto (car customShipScu pilote le SCU max)
      setManual(false);
    } else {
      const ship = getShipById(selectedShipId);
      shipPickerLabel.textContent = ship?.name || "—";
      customShipBox?.classList.add("is-hidden");
      setManual(false);
    }

    applySelectedShipCapacity();
    closeShipPicker();
    recalc();
    saveState();
  }

  function buildCargoTypeMenu() {
    if (!cargoTypePickerMenu) return;

    const options = [
      { value: "standard", label: "Standard" },
      { value: "highValue", label: "Haute valeur" },
      { value: "risky", label: "Risque élevé" },
    ];

    cargoTypePickerMenu.innerHTML = "";
    for (const opt of options) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ship-item";
      btn.setAttribute("role", "option");
      btn.dataset.value = opt.value;

      const left = document.createElement("span");
      left.className = "ship-name";
      left.textContent = opt.label;

      const right = document.createElement("span");
      right.className = "ship-scu";
      right.textContent = "";

      btn.appendChild(left);
      btn.appendChild(right);

      btn.addEventListener("click", () => {
        if (cargoTypeSelect) cargoTypeSelect.value = opt.value;
        if (cargoTypePickerLabel) cargoTypePickerLabel.textContent = opt.label;
        closeCargoTypePicker();
        recalc();
        saveState();
      });

      cargoTypePickerMenu.appendChild(btn);
    }
  }

  function syncCargoTypeLabelFromSelect() {
    const v = (cargoTypeSelect?.value || "standard");
    const map = {
      standard: "Standard",
      highValue: "Haute valeur",
      risky: "Risque élevé",
    };
    if (cargoTypePickerLabel) cargoTypePickerLabel.textContent = map[v] || "Standard";
  }

  // ---------- Calculations ----------
  function computeVerdictReason({ profitHour, target, marginPerScu, loopMin, cargo }) {
    if (!Number.isFinite(profitHour) || !Number.isFinite(target)) return "";
    if (profitHour >= target) return "";

    if (marginPerScu <= 0) return "Marge insuffisante (vente ≤ achat).";
    if (loopMin >= 45) return "Boucle trop longue pour atteindre l’objectif.";
    if (cargo > 0 && cargo < 40) return "Cargo faible : augmente le SCU ou change de vaisseau.";
    if ((target - profitHour) > (0.5 * target)) return "Objectif élevé : baisse l’objectif ou améliore la marge/temps.";
    return "Sous objectif : améliore la marge ou réduis la durée de boucle.";
  }

  function recalc() {
    const cargo = Number(cargoScu?.value || 0) || 0;
    const minutes = Number(loopMinutes?.value || 0) || 0;
    const buy = Number(buyPrice?.value || 0) || 0;
    const sell = Number(sellPrice?.value || 0) || 0;
    const target = Number(targetProfitHour?.value || 0) || 0;

    const investment = buy * cargo;
    const revenue = sell * cargo;
    const profitRun = (sell - buy) * cargo;
    const profitHour = minutes > 0 ? (profitRun * 60) / minutes : 0;

    if (kpiInvest) kpiInvest.textContent = fmtAuec(investment);
    if (kpiRevenue) kpiRevenue.textContent = fmtAuec(revenue);
    if (kpiProfit) kpiProfit.textContent = fmtAuec(profitRun);
    if (kpiProfitHour) kpiProfitHour.textContent = fmtAuecH(profitHour);

    // Cargo type profile + risk thresholds
    const cargoTypeVal = (cargoTypeSelect?.value || "standard");
    let profileLabel = "Profil : Standard";
    let riskInv = 150000;
    let riskLoop = 45;

    if (cargoTypeVal === "highValue") {
      profileLabel = "Profil : Haute valeur";
      riskInv = 120000;
      riskLoop = 40;
    } else if (cargoTypeVal === "risky") {
      profileLabel = "Profil : Risque élevé";
      riskInv = 80000;
      riskLoop = 35;
    }

    if (cargoProfile) cargoProfile.textContent = profileLabel;

    const hasRisk = (investment >= riskInv) || (minutes >= riskLoop);
    showRiskBadge(hasRisk);

    // Verdict
    let verdict = "—";
    let ok = false;

    if (minutes > 0) {
      ok = profitHour >= target;
      verdict = ok ? "OK (objectif atteint)" : "À éviter (sous objectif)";
    }

    if (verdictText) verdictText.textContent = verdict;

    if (statusChip) {
      statusChip.textContent = ok ? "OK" : "—";
      statusChip.classList.toggle("is-ok", ok);
    }

    if (verdictReason) {
      verdictReason.textContent = computeVerdictReason({
        profitHour,
        target,
        marginPerScu: (sell - buy),
        loopMin: minutes,
        cargo,
      });
    }
  }

  // ---------- Persistence ----------
  const STORAGE_KEY = "hauling_beginner_v1";

  function saveState() {
    try {
      const state = {
        selectedShipId,
        customShipName: customShipName?.value || "",
        customShipScu: Number(customShipScu?.value || 0) || 0,
        cargoScu: Number(cargoScu?.value || 0) || 0,
        manualCargo,
        cargoType: cargoTypeSelect?.value || "standard",
        loopMinutes: Number(loopMinutes?.value || 0) || 0,
        buyPrice: Number(buyPrice?.value || 0) || 0,
        sellPrice: Number(sellPrice?.value || 0) || 0,
        targetProfitHour: Number(targetProfitHour?.value || 0) || 0,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);

      selectedShipId = s.selectedShipId || "none";
      if (customShipName) customShipName.value = s.customShipName || "";
      if (customShipScu) customShipScu.value = String(Number(s.customShipScu || 0) || 0);

      if (cargoTypeSelect) cargoTypeSelect.value = s.cargoType || "standard";
      syncCargoTypeLabelFromSelect();

      if (loopMinutes) loopMinutes.value = String(Number(s.loopMinutes || 0) || 0);
      if (buyPrice) buyPrice.value = String(Number(s.buyPrice || 0) || 0);
      if (sellPrice) sellPrice.value = String(Number(s.sellPrice || 0) || 0);
      if (targetProfitHour) targetProfitHour.value = String(Number(s.targetProfitHour || 0) || 0);

      setManual(Boolean(s.manualCargo));

      if (cargoScu) cargoScu.value = String(Number(s.cargoScu || 0) || 0);
    } catch (_) {}
  }

  // ---------- Data loading ----------
  async function fetchJsonTry(urls) {
  let lastErr;
  for (const u of urls) {
    try {
      const res = await fetch(u, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Robust JSON parsing even if server sets a weird Content-Type
      const txt = await res.text();
      return JSON.parse(txt);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("fetch failed");
}

async function loadShips() {

    // Accept multiple file names (Windows users sometimes remove extension)
    // Prefer an absolute path to avoid relative-path issues (pages/* vs root).
// Expected file: /assets/data/ships_v2_json.json (or /assets/data/ships_v2_json)
// Ship list source (local JSON generated by generate_ships_v2_json.js)
// Different servers resolve paths differently; try a short list in priority order.
// Ship list source (local JSON generated by generate_ships_v2_json.js)
// Locked to the actual existing file name.
const urls = [
  "/assets/data/ships_v2.json",
  "../assets/data/ships_v2.json",
  "assets/data/ships_v2.json",
];



    const data = await fetchJsonTry(urls);

    // Accept either array or {ships:[...]}
    const list = Array.isArray(data) ? data : (data?.ships || []);
    const normalized = list
      .map((x) => ({
        name: String(x?.name || x?.title || "").trim(),
        scu: Number(x?.scu || x?.cargo || x?.max_scu || 0) || 0,
      }))
      .filter((x) => x.name.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));

    ALL_SHIPS = normalized;

    // Render list
    renderShipList(shipPickerSearch?.value || "");
  }

  // ---------- Init ----------
  function resetBeginner() {
    selectedShipId = "none";
    if (shipPickerLabel) shipPickerLabel.textContent = "—";
    customShipBox?.classList.add("is-hidden");

    if (customShipName) customShipName.value = "";
    if (customShipScu) customShipScu.value = "0";

    setManual(false);

    // Keep sensible defaults
    if (cargoScu) cargoScu.value = "0";
    if (loopMinutes) loopMinutes.value = "25";
    if (buyPrice) buyPrice.value = "0";
    if (sellPrice) sellPrice.value = "0";
    if (targetProfitHour) targetProfitHour.value = "80000";

    if (cargoTypeSelect) cargoTypeSelect.value = "standard";
    syncCargoTypeLabelFromSelect();

    showRiskBadge(false);
    if (verdictText) verdictText.textContent = "—";
    if (verdictReason) verdictReason.textContent = "";
    if (cargoProfile) cargoProfile.textContent = "Profil : Standard";
    if (statusChip) {
      statusChip.textContent = "—";
      statusChip.classList.remove("is-ok");
    }

    saveState();
    recalc();
  }

  function init() {
    // Tabs
    tabBeginner?.addEventListener("click", () => setMode("beginner"));
    tabAdvanced?.addEventListener("click", () => setMode("advanced"));
    setMode("beginner");

    // Picker toggles
    shipPickerBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      toggleShipPicker();
    });

    cargoTypePickerBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      toggleCargoTypePicker();
    });

    // Close on outside click
    document.addEventListener("click", (e) => {
      const t = e.target;
      // ship picker
      if (shipPickerMenu && shipPickerBtn) {
        const insideShip = shipPickerMenu.contains(t) || shipPickerBtn.contains(t);
        if (!insideShip) closeShipPicker();
      }
      // cargo type picker
      if (cargoTypePickerMenu && cargoTypePickerBtn) {
        const insideType = cargoTypePickerMenu.contains(t) || cargoTypePickerBtn.contains(t);
        if (!insideType) closeCargoTypePicker();
      }
    });

    // Search
    shipPickerSearch?.addEventListener("input", () => {
      renderShipList(shipPickerSearch.value || "");
    });

    // Inputs
    cargoScu?.addEventListener("input", () => {
      // if user edits cargo, it's manual
      setManual(true);
      recalc();
      saveState();
    });

    // Custom ship: name updates label, SCU auto-updates cargo when not manual
    customShipName?.addEventListener("input", () => {
      if (selectedShipId === "custom") {
        shipPickerLabel.textContent = (customShipName.value || "Custom").trim() || "Custom";
        saveState();
      }
    });

    customShipScu?.addEventListener("input", () => {
      if (selectedShipId !== "custom") return;
      // custom capacity drives cargo unless user manually overrides cargoScu
      applySelectedShipCapacity();
      recalc();
      saveState();
    });

    [loopMinutes, buyPrice, sellPrice, targetProfitHour].forEach((el) => {
      el?.addEventListener("input", () => {
        recalc();
        saveState();
      });
    });

    btnReset?.addEventListener("click", (e) => {
      e.preventDefault();
      resetBeginner();
    });

    // Cargo type menu
    buildCargoTypeMenu();
    syncCargoTypeLabelFromSelect();

    // Restore state (before ships load, we still render list)
    loadState();

    // Load ships then apply selection
    loadShips()
      .then(() => {
        // Re-apply selection label after ships are loaded
        if (selectedShipId === "custom") {
          shipPickerLabel.textContent = (customShipName?.value || "Custom").trim() || "Custom";
          customShipBox?.classList.remove("is-hidden");
        } else {
          const ship = getShipById(selectedShipId);
          shipPickerLabel.textContent = ship?.name || "—";
          customShipBox?.classList.add("is-hidden");
        }

        // Auto-fill cargo for valid ship (unless manual)
        applySelectedShipCapacity();
        recalc();
      })
      .catch(() => {
        // If ships fail to load, keep UI usable (custom/manual)
        renderShipList("");
        recalc();
      });
  }

  init();
})();
