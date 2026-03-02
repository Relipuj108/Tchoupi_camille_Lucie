// ======================
// CONFIG
// ======================
const API_URL = "https://script.google.com/macros/s/AKfycbyh8-4LXWB1op0TJw90hvdvGSjawvTLTyFnlpA0jsHHTc_j3Db4VnH-CwtFqsv5tmib/exec";

const MAIN_JSON = "./data.json";
const DV_JSON   = "./data-dv.json";

const EXPECTED_PW = "recquignies"; // comparaison locale

// ======================
// DOM
// ======================
const tbodyMain = document.getElementById("tbody-main");
const tbodyDv   = document.getElementById("tbody-dv");

const statusEl      = document.getElementById("status");
const passwordInput = document.getElementById("passwordInput");
const unlockBtn     = document.getElementById("unlockBtn");
const authStatus    = document.getElementById("authStatus");
const modeChip      = document.getElementById("modeChip");

// ======================
// STATE
// ======================
let isWriteEnabled = false;
let currentPassword = "";

// ======================
// UI
// ======================
function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "crimson" : "inherit";
}

function updateCheckboxState() {
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.disabled = !isWriteEnabled;
  });
}

// ======================
// AUTH
// ======================
unlockBtn.addEventListener("click", () => {
  const pw = (passwordInput.value || "").trim();

  if (!pw) {
    authStatus.textContent = "Entre un mot de passe";
    return;
  }

  if (pw.toLowerCase() !== EXPECTED_PW) {
    authStatus.textContent = "Mot de passe incorrect";
    return;
  }

  currentPassword = pw;
  isWriteEnabled = true;

  authStatus.textContent = "Écriture activée";
  if (modeChip) modeChip.textContent = "Écriture";

  updateCheckboxState();
});

// ======================
// FETCH HELPERS
// ======================
async function fetchLocalJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Erreur chargement ${path} (HTTP ${res.status})`);
  return res.json();
}

async function fetchApi(url) {
  const finalUrl = `${url}${url.includes("?") ? "&" : "?"}_ts=${Date.now()}`;

  const res = await fetch(finalUrl, {
    method: "GET",
    cache: "no-store"
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`API HTTP ${res.status}`);
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("API réponse non JSON");
  }

  return json;
}

// ======================
// API
// ======================
async function apiReadState() {
  const json = await fetchApi(`${API_URL}?action=read`);
  if (!json.ok) throw new Error(json.error || "Erreur read");
  return json.data || {};
}

async function apiWriteCell({ id, column, value }) {
  const url =
    `${API_URL}?action=write` +
    `&id=${encodeURIComponent(id)}` +
    `&column=${encodeURIComponent(column)}` +
    `&value=${value ? "true" : "false"}` +
    `&password=${encodeURIComponent(currentPassword)}`;

  const json = await fetchApi(url);
  if (!json.ok) throw new Error(json.error || "Erreur write");

  return true;
}

// ======================
// CHECKBOX FACTORY
// ======================
function createCheckbox({ id, column, checked }) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "kid-check";
  input.checked = !!checked;
  input.disabled = !isWriteEnabled;

  input.addEventListener("change", async () => {
    if (!isWriteEnabled) return;

    const newValue = input.checked;
    const previousValue = !newValue;

    try {
      setStatus("Sauvegarde…");
      await apiWriteCell({ id, column, value: newValue });
      setStatus("Enregistré ✅");
    } catch (err) {
      input.checked = previousValue;
      setStatus("Erreur : " + err.message, true);
    }
  });

  return input;
}

// ======================
// RENDER PRINCIPAL
// ======================
function renderTableMain({ rows, state }) {
  tbodyMain.innerHTML = "";
  const fragment = document.createDocumentFragment();

  for (const row of rows) {
    const tr = document.createElement("tr");

    const tdLabel = document.createElement("td");
    tdLabel.textContent = row.label;
    tr.appendChild(tdLabel);

    const tdA = document.createElement("td");
    tdA.className = "center";
    tdA.appendChild(createCheckbox({
      id: row.id,
      column: "A",
      checked: state[row.id]?.A
    }));
    tr.appendChild(tdA);

    const tdB = document.createElement("td");
    tdB.className = "center";
    tdB.appendChild(createCheckbox({
      id: row.id,
      column: "B",
      checked: state[row.id]?.B
    }));
    tr.appendChild(tdB);

    fragment.appendChild(tr);
  }

  tbodyMain.appendChild(fragment);
}

// ======================
// RENDER DEUX-VOIX
// ======================
function renderTableDv({ rows, state }) {
  tbodyDv.innerHTML = "";
  const fragment = document.createDocumentFragment();

  for (const row of rows) {
    const tr = document.createElement("tr");

    const tdLabel = document.createElement("td");
    tdLabel.textContent = row.label;
    tr.appendChild(tdLabel);

    const tdOne = document.createElement("td");
    tdOne.className = "center";
    tdOne.appendChild(createCheckbox({
      id: row.id,
      column: "A",
      checked: state[row.id]?.A
    }));
    tr.appendChild(tdOne);

    fragment.appendChild(tr);
  }

  tbodyDv.appendChild(fragment);
}

// ======================
// INIT
// ======================
async function init() {
  try {
    setStatus("Chargement…");

    if (modeChip) modeChip.textContent = "Lecture";

    const [mainRows, dvRows] = await Promise.all([
      fetchLocalJson(MAIN_JSON),
      fetchLocalJson(DV_JSON)
    ]);

    if (!Array.isArray(mainRows)) throw new Error("data.json invalide");
    if (!Array.isArray(dvRows)) throw new Error("data-dv.json invalide");

    const state = await apiReadState();

    renderTableMain({ rows: mainRows, state });
    renderTableDv({ rows: dvRows, state });

    updateCheckboxState();
    setStatus("Prêt.");
  } catch (err) {
    setStatus("Erreur : " + err.message, true);
  }
}

init();
