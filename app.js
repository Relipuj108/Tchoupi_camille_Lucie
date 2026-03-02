// ======================
// CONFIG
// ======================
const API_URL = "https://script.google.com/macros/s/AKfycby2NwNGz43queQJHO_zil-rkTIRi_R-NXvsjOULpqHInSLay6R2AAx44sCrXkd0ElW8/exec";
const MAIN_JSON = "./data.json";
const DV_JSON = "./data-dv.json";

const EXPECTED_PW = "recquignies"; // comparaison locale (insensible à la casse)

// ======================
// DOM
// ======================
const tbodyMain = document.getElementById("tbody-main");
const tbodyDv = document.getElementById("tbody-dv");

const statusEl = document.getElementById("status");
const passwordInput = document.getElementById("passwordInput");
const unlockBtn = document.getElementById("unlockBtn");
const authStatus = document.getElementById("authStatus");
const modeChip = document.getElementById("modeChip");

// ======================
// STATE
// ======================
let isWriteEnabled = false;
let currentPassword = "";

// ======================
// DIAGNOSTIC UI
// ======================
function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "crimson" : "inherit";
}

function diag(msg) {
  // écrit dans status (append)
  statusEl.innerHTML += `<div style="margin-top:6px;">• ${escapeHtml(msg)}</div>`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function updateCheckboxState() {
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.disabled = !isWriteEnabled;
  });
}

// ======================
// AUTH
// ======================
unlockBtn.addEventListener("click", async () => {
  const pw = (passwordInput.value || "").trim();
  diag(`Mot de passe saisi: "${pw}" (len=${pw.length})`);

  if (!pw) {
    authStatus.textContent = "Entre un mot de passe";
    return;
  }

  if (pw.toLowerCase() !== EXPECTED_PW) {
    authStatus.textContent = "Mot de passe incorrect";
    diag(`Comparaison locale KO: "${pw.toLowerCase()}" !== "${EXPECTED_PW}"`);
    return;
  }

  currentPassword = pw;
  isWriteEnabled = true;

  authStatus.textContent = "Écriture activée";
  if (modeChip) modeChip.textContent = "Écriture";
  updateCheckboxState();

  // test immédiat write "à blanc" sur une ligne fake (ne doit pas créer si id vide)
  diag("Mode écriture activé ✅");
});

// ======================
// FETCH DEBUG (anti-cache)
// ======================
async function fetchTextWithMeta(url, opts = {}) {
  const u = new URL(url);
  u.searchParams.set("_ts", Date.now().toString());

  const finalUrl = u.toString();
  diag(`FETCH → ${finalUrl}`);

  let res;
  try {
    res = await fetch(finalUrl, { cache: "no-store", redirect: "follow", ...opts });
  } catch (e) {
    throw new Error(`fetch() a échoué (réseau/CORS) → ${e.message}`);
  }

  const text = await res.text();
  diag(`HTTP ${res.status} (${res.ok ? "OK" : "NOT OK"}) • ${text.slice(0, 80).replaceAll("\n", " ")}...`);

  return { res, text, finalUrl };
}

async function fetchJsonDebug(url, label) {
  const { res, text, finalUrl } = await fetchTextWithMeta(url, { method: "GET" });

  if (!res.ok) {
    throw new Error(`${label}: HTTP ${res.status} sur ${finalUrl}`);
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${label}: réponse non JSON sur ${finalUrl} (début="${text.slice(0, 120)}")`);
  }

  return json;
}

// ======================
// API
// ======================
async function apiReadState() {
  const json = await fetchJsonDebug(`${API_URL}?action=read`, "API read");
  if (!json.ok) throw new Error(`API read: ${json.error || "ok=false"}`);
  return json.data || {};
}

async function apiWriteCell({ id, column, value }) {
  const u = new URL(API_URL);
  u.searchParams.set("action", "write");
  u.searchParams.set("id", id);
  u.searchParams.set("column", column);
  u.searchParams.set("value", value ? "true" : "false");
  u.searchParams.set("password", currentPassword);

  const json = await fetchJsonDebug(u.toString(), `API write ${id} ${column}`);
  if (!json.ok) throw new Error(`API write: ${json.error || "ok=false"}`);
  return true;
}

// ======================
// CHECKBOX
// ======================
function createCheckbox({ id, column, checked }) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "kid-check";
  input.checked = !!checked;
  input.disabled = !isWriteEnabled;

  input.addEventListener("change", async () => {
    if (!isWriteEnabled) {
      diag("Click ignoré: mode lecture seule");
      return;
    }

    const newValue = input.checked;
    const previousValue = !newValue;

    try {
      setStatus("Sauvegarde…");
      diag(`WRITE demandé: id=${id} col=${column} val=${newValue}`);
      await apiWriteCell({ id, column, value: newValue });
      setStatus("Enregistré ✅");
    } catch (err) {
      input.checked = previousValue;
      setStatus("Erreur : " + err.message, true);
      diag("ERREUR write: " + err.message);
    }
  });

  return input;
}

// ======================
// RENDER
// ======================
function renderTableMain({ tbody, rows, state }) {
  tbody.innerHTML = "";
  const fragment = document.createDocumentFragment();

  for (const row of rows) {
    const tr = document.createElement("tr");

    const tdLabel = document.createElement("td");
    tdLabel.textContent = row.label;
    tr.appendChild(tdLabel);

    const tdA = document.createElement("td");
    tdA.className = "center";
    tdA.appendChild(createCheckbox({ id: row.id, column: "A", checked: state[row.id]?.A }));
    tr.appendChild(tdA);

    const tdB = document.createElement("td");
    tdB.className = "center";
    tdB.appendChild(createCheckbox({ id: row.id, column: "B", checked: state[row.id]?.B }));
    tr.appendChild(tdB);

    fragment.appendChild(tr);
  }
  tbody.appendChild(fragment);
}

function renderTableDv({ tbody, rows, state }) {
  tbody.innerHTML = "";
  const fragment = document.createDocumentFragment();

  for (const row of rows) {
    const tr = document.createElement("tr");

    const tdLabel = document.createElement("td");
    tdLabel.textContent = row.label;
    tr.appendChild(tdLabel);

    const tdOne = document.createElement("td");
    tdOne.className = "center";
    tdOne.appendChild(createCheckbox({ id: row.id, column: "A", checked: state[row.id]?.A }));
    tr.appendChild(tdOne);

    fragment.appendChild(tr);
  }
  tbody.appendChild(fragment);
}

// ======================
// INIT
// ======================
async function init() {
  try {
    setStatus("DIAGNOSTIC: démarrage…");

    if (modeChip) modeChip.textContent = "Lecture";

    // 1) JSON locaux
    const mainRows = await fetchJsonDebug(MAIN_JSON, "data.json");
    const dvRows = await fetchJsonDebug(DV_JSON, "data-dv.json");
    if (!Array.isArray(mainRows)) throw new Error("data.json doit être un tableau []");
    if (!Array.isArray(dvRows)) throw new Error("data-dv.json doit être un tableau []");

    // 2) API read
    const state = await apiReadState();

    renderTableMain({ tbody: tbodyMain, rows: mainRows, state });
    renderTableDv({ tbody: tbodyDv, rows: dvRows, state });

    updateCheckboxState();
    setStatus("DIAGNOSTIC: prêt. Clique une checkbox et lis les logs ci-dessous.");
  } catch (err) {
    setStatus("DIAGNOSTIC: ERREUR → " + err.message, true);
  }
}

init();
