"use strict";

/* ===================== LocalStorage keys ===================== */
const LS_KEYS = {
  name: "player:name",
  avatar: "player:avatar",
  hero: "player:hero", // hero id (per-hero stats)
  wins: "player:wins",
  losses: "player:losses",
};

/* ===================== Getters / helpers ===================== */
const getPlayerName = () => localStorage.getItem(LS_KEYS.name) || "";
const getPlayerAvatar = () => localStorage.getItem(LS_KEYS.avatar) || "";
const getHeroId = () => localStorage.getItem(LS_KEYS.hero) || "";
const app = () => document.getElementById("app");

/* Start a brand-new cycle: clear identity → go to #/register (used by navbar & end-of-battle) */
function restartCycle() {
  localStorage.removeItem(LS_KEYS.name);
  localStorage.removeItem(LS_KEYS.avatar);
  localStorage.removeItem(LS_KEYS.hero);
  currentBattle = null;
  window.location.hash = "#/register";
  updateNewBattleLinkVisibility();
}

/* Small util to reflect visual disabled state without CSS edits */
function setBtnEnabled(btn, enabled) {
  btn.disabled = !enabled;
  btn.setAttribute("aria-disabled", String(!enabled));
  // subtle visual hint
  btn.style.opacity = enabled ? "1" : "0.6";
  btn.style.cursor = enabled ? "pointer" : "not-allowed";
  btn.style.filter = enabled ? "" : "grayscale(0.2)";
}

/* ===================== Avatars / Heroes ===================== */
const playerAvatars = [
  {
    id: "assasin",
    name: "Assasin",
    label: "Assasin",
    src: "images/heroes/assasin.png",
  },
  {
    id: "ladyShooter",
    name: "Lady Shooter",
    label: "LadyShooter",
    src: "images/heroes/ladyShooter.png",
  },
  {
    id: "swordMasterLady",
    name: "Sword Lady",
    label: "SwordMasterLady",
    src: "images/heroes/swordMasterLady.png",
  },
  {
    id: "yellowMaster",
    name: "Yellow Master",
    label: "YellowMaster",
    src: "images/heroes/yellowMaster.png",
  },
];

const ZONES = ["Head", "Body", "Arms", "Legs"];

/* Per-hero base stats (fallback preserved for old saves) */
const HERO_BASES = {
  assasin: { hp: 150, dmg: 12, critChance: 0.35, critMult: 1.7 },
  ladyShooter: { hp: 150, dmg: 12, critChance: 0.28, critMult: 1.6 },
  swordMasterLady: { hp: 150, dmg: 14, critChance: 0.18, critMult: 1.5 },
  yellowMaster: { hp: 150, dmg: 11, critChance: 0.15, critMult: 1.4 },
};
const PLAYER_BASE = { hp: 140, dmg: 13, critChance: 0.25, critMult: 1.6 };
function getCurrentHeroBase() {
  const id = getHeroId();
  return HERO_BASES[id] || PLAYER_BASE;
}

/* ===================== Enemies ===================== */
const ENEMIES = [
  {
    id: "alien",
    name: "Alien",
    attackCount: 2,
    blockCount: 1,
    hp: 125,
    dmg: 8,
    critChance: 0.15,
    critMult: 1.6,
    img: "images/monsters/alienMonster.png",
  },
  {
    id: "redneck",
    name: "Redneck",
    attackCount: 1,
    blockCount: 2,
    hp: 150,
    dmg: 12,
    critChance: 0.15,
    critMult: 1.5,
    img: "images/monsters/monster1.png",
  },
  {
    id: "werewolf",
    name: "Werewolf",
    attackCount: 1,
    blockCount: 2,
    hp: 140,
    dmg: 15,
    critChance: 0.2,
    critMult: 1.5,
    img: "images/monsters/werewolf.png",
  },
];

let currentBattle = null;
let lastEnemyId = null;

/* ===================== Header “New battle” link visibility ===================== */
function updateNewBattleLinkVisibility() {
  const container = document.querySelector(".start-page");
  if (!container) return;
  const hasName = !!getPlayerName();
  const hasAvatar = !!getPlayerAvatar();
  const isActiveBattle = !!(currentBattle && !currentBattle.over);
  const shouldShow = hasName && hasAvatar && isActiveBattle;
  container.style.display = shouldShow ? "block" : "none";
  container.style.pointerEvents = shouldShow ? "" : "none";
}

/* ===================== Battle prep ===================== */
function pickRandomEnemyExcludeLast() {
  if (ENEMIES.length === 0) throw new Error("ENEMIES is empty");
  if (ENEMIES.length === 1) return ENEMIES[0];
  let enemy;
  do {
    enemy = ENEMIES[Math.floor(Math.random() * ENEMIES.length)];
  } while (enemy.id === lastEnemyId);
  return enemy;
}

function initBattle() {
  const baseEnemy = pickRandomEnemyExcludeLast();
  const enemy = JSON.parse(JSON.stringify(baseEnemy));
  enemy.hpCurrent = enemy.hp;

  const base = getCurrentHeroBase();

  currentBattle = {
    zones: ZONES,
    player: {
      ...base,
      hp: Number(base.hp),
      dmg: Number(base.dmg),
      hpCurrent: Number(base.hp),
    },
    enemy: {
      ...enemy,
      hp: Number(enemy.hp),
      dmg: Number(enemy.dmg),
      hpCurrent: Number(enemy.hp),
    },
    log: [],
    over: false,
  };

  lastEnemyId = enemy.id;
  updateNewBattleLinkVisibility();
}

/* ===================== Battle mechanics ===================== */
function pickUnique(arr, n) {
  const pool = [...arr],
    out = [];
  while (out.length < n && pool.length)
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}
function enemyTurn(enemy, zones) {
  return {
    attack: pickUnique(zones, enemy.attackCount),
    blocks: pickUnique(zones, enemy.blockCount),
  };
}
function rollCrit(chance) {
  return Math.random() < chance;
}
function resolveHit({
  attacker,
  target,
  zone,
  targetBlocks,
  baseDmg,
  crit,
  critMult,
}) {
  const blocked = targetBlocks.has(zone);
  const damage = crit
    ? Math.round(Number(baseDmg) * Number(critMult))
    : blocked
    ? 0
    : Number(baseDmg);
  return { attacker, target, zone, damage, blocked, critical: crit };
}
function doRound(playerChoice) {
  const B = currentBattle;
  if (!B) return "NONE";
  const { player, enemy, zones } = B;

  const ePlan = enemyTurn(enemy, zones);
  const events = [];

  events.push(
    resolveHit({
      attacker: "PLAYER",
      target: "ENEMY",
      zone: playerChoice.attack,
      targetBlocks: new Set(ePlan.blocks),
      baseDmg: player.dmg,
      crit: rollCrit(player.critChance),
      critMult: player.critMult,
    })
  );
  ePlan.attack.forEach((zone) =>
    events.push(
      resolveHit({
        attacker: "ENEMY",
        target: "PLAYER",
        zone,
        targetBlocks: new Set(playerChoice.blocks),
        baseDmg: enemy.dmg,
        crit: rollCrit(enemy.critChance),
        critMult: enemy.critMult,
      })
    )
  );

  const dmgToEnemy = events
    .filter((e) => e.target === "ENEMY")
    .reduce((s, e) => s + e.damage, 0);
  const dmgToPlayer = events
    .filter((e) => e.target === "PLAYER")
    .reduce((s, e) => s + e.damage, 0);

  enemy.hpCurrent = Math.max(0, enemy.hpCurrent - dmgToEnemy);
  player.hpCurrent = Math.max(0, player.hpCurrent - dmgToPlayer);

  B.log.push(...events);
  if (enemy.hpCurrent === 0) return "WIN";
  if (player.hpCurrent === 0) return "LOSE";
  return "NONE";
}

/* ===================== Modals ===================== */
function showConfirmModal({
  title,
  message,
  yesText = "Yes",
  cancelText = "Cancel",
  onYes,
}) {
  if (document.querySelector(".modal-overlay")) return;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <h2 id="modalTitle">${title}</h2>
      <p>${message}</p>
      <div class="actions">
        <button class="btn btn-ghost" id="btnCancel">${cancelText}</button>
        <button class="btn btn-primary" id="btnYes">${yesText}</button>
      </div>
    </div>
  `;
  document.body.append(overlay);
  document.body.classList.add("modal-open");

  const cleanup = () => {
    overlay.remove();
    document.body.classList.remove("modal-open");
    document.removeEventListener("keydown", onEsc);
  };
  const onEsc = (e) => {
    if (e.key === "Escape") cleanup();
  };
  document.addEventListener("keydown", onEsc);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) cleanup();
  });
  overlay.querySelector("#btnCancel").addEventListener("click", cleanup);
  overlay.querySelector("#btnYes").addEventListener("click", () => {
    cleanup();
    onYes && onYes();
  });

  overlay.querySelector("#btnYes").focus();
}

function finishBattle(result) {
  if (document.querySelector(".modal-overlay")) return;

  if (result === "WIN") {
    const wins = Number(localStorage.getItem(LS_KEYS.wins) || "0") + 1;
    localStorage.setItem(LS_KEYS.wins, String(wins));
  } else if (result === "LOSE") {
    const losses = Number(localStorage.getItem(LS_KEYS.losses) || "0") + 1;
    localStorage.setItem(LS_KEYS.losses, String(losses));
  }

  if (currentBattle) currentBattle.over = true;
  updateNewBattleLinkVisibility();

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal end-modal" role="dialog" aria-modal="true" aria-label="${
      result === "WIN" ? "Victory" : "Defeat"
    }">
      <h2>${result === "WIN" ? "Victory!" : "Defeat!"}</h2>
      <div class="actions">
        <button id="btnNewBattle" class="btn btn-primary">New battle</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.classList.add("modal-open");

  overlay.querySelector("#btnNewBattle")?.addEventListener("click", () => {
    restartCycle();
    document.body.classList.remove("modal-open");
    overlay.remove();
  });
}

/* ===================== Log rendering ===================== */
function renderLogList() {
  const box = document.getElementById("battleLog");
  if (!box || !currentBattle) return;

  const items = currentBattle.log.slice().reverse();
  box.innerHTML = items
    .map((e) => {
      const WHO = e.attacker === "PLAYER" ? "Player" : "Enemy";
      const WHOM = e.target === "ENEMY" ? "Enemy's" : "Player's";
      const flags = `${e.critical ? " КРИТ" : ""}${e.blocked ? " BLOCK" : ""}`;
      return `
      <div class="log-item${e.critical ? " is-crit" : ""}${
        e.blocked ? " is-blocked" : ""
      }">
        <span class="who">${WHO}</span> attacked <span class="whom">${WHOM}</span>
        <span class="zone">${e.zone}</span> → damage: <span class="damage">${
        e.damage
      }</span>
        <span class="flags">${flags}</span> 
      </div>
    `;
    })
    .join("");
}

/* ===================== Pages ===================== */
function renderRegister() {
  app().innerHTML = `
    <section class="page page-register">
      <form id="create-player" class="form">
        <fieldset>
          <legend>Create your fighter</legend>
          <label for="name">Name</label>
          <input id="name" name="playerName" type="text" placeholder="Type your name" autocomplete="name" required />
          <div id="nameError" class="form-error" aria-live="polite"></div>    
          <button id="btnRegister" type="submit" disabled>Continue</button>
        </fieldset>
      </form>
    </section>`;

  const form = document.getElementById("create-player");
  const nameInput = document.getElementById("name");
  const nameError = document.getElementById("nameError");
  const btn = document.getElementById("btnRegister");

  const updateBtn = () =>
    setBtnEnabled(btn, !!isValidName(nameInput.value || ""));
  nameInput.addEventListener("input", () => {
    nameError.textContent = "";
    updateBtn();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = (nameInput.value || "").trim();
    if (!isValidName(name)) {
      nameError.textContent =
        "Name length should be not less than 2 symbols and no more than 20 symbols (letters/numbers/space/hyphen)";
      nameInput.focus();
      return;
    }
    localStorage.setItem(LS_KEYS.name, name);
    if (localStorage.getItem(LS_KEYS.wins) === null)
      localStorage.setItem(LS_KEYS.wins, "0");
    if (localStorage.getItem(LS_KEYS.losses) === null)
      localStorage.setItem(LS_KEYS.losses, "0");
    window.location.hash = "#/avatar";
  });

  nameInput.focus();
  updateBtn();
  updateNewBattleLinkVisibility();
}

function renderAvatar() {
  app().innerHTML = `
    <section class="container page-avatar">
      <form id="pick-avatar" class="form">
        <fieldset>
          <legend>Choose your avatar</legend>
          <div class="avatars-grid" id="avatarsGrid">
            ${playerAvatars
              .map(
                (a) => `
              <label class="avatar-card" data-id="${a.id}">
                <input type="radio" name="avatar" value="${a.id}"/>
                <img src="${a.src}" alt="${a.label}"/>
                <span>${a.label}</span>
              </label>`
              )
              .join("")}
          </div>
          <div id="avatarError" class="form-error" aria-live="polite"></div>
          <button id="btnAvatar" type="submit" disabled>Pick avatar</button>
        </fieldset>
      </form>
    </section>
  `;

  const form = document.getElementById("pick-avatar");
  const grid = document.getElementById("avatarsGrid");
  const avatarError = document.getElementById("avatarError");
  const btn = document.getElementById("btnAvatar");

  let pickedHeroId = "";

  grid.addEventListener("change", (e) => {
    if (e.target.name === "avatar") {
      pickedHeroId = e.target.value;
      grid.querySelectorAll(".avatar-card").forEach((card) => {
        const input = card.querySelector('input[type="radio"]');
        card.classList.toggle("selected", input && input.checked);
      });
      avatarError.textContent = "";
      setBtnEnabled(btn, !!pickedHeroId);
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!pickedHeroId) {
      avatarError.textContent = "Choose avatar";
      return;
    }
    const hero = playerAvatars.find((a) => a.id === pickedHeroId);
    localStorage.setItem(LS_KEYS.hero, pickedHeroId);
    localStorage.setItem(LS_KEYS.avatar, hero.src);

    // ⬇️ Immediately start a battle and go to /battle (fixes the Home loop)
    initBattle();
    window.location.hash = "#/battle";
  });

  setBtnEnabled(btn, false);
  updateNewBattleLinkVisibility();
}

/* === Home: centered “Fight” button that starts the right next step === */
function renderHome() {
  app().innerHTML = `
    <section class="container page-home">
      <div style="min-height:60vh;display:flex;align-items:center;justify-content:center;">
        <button id="btnFight"
          style="padding:14px 22px;border:0;border-radius:12px;
                 background:linear-gradient(180deg,#ff4949,#e33737);
                 color:#fff;font-weight:800;letter-spacing:.3px;
                 box-shadow:0 10px 22px rgba(227,55,55,.35);cursor:pointer;">
          Fight
        </button>
      </div>
    </section>
  `;

  document.getElementById("btnFight").addEventListener("click", () => {
    const hasName = !!getPlayerName();
    const hasAvatar = !!getPlayerAvatar();

    if (!hasName) {
      window.location.hash = "#/register";
      return;
    }
    if (!hasAvatar) {
      window.location.hash = "#/avatar";
      return;
    }
    // if a battle is already active, resume it; else start a new one
    if (currentBattle && !currentBattle.over) {
      window.location.hash = "#/battle";
      return;
    }
    initBattle();
    window.location.hash = "#/battle";
  });

  updateNewBattleLinkVisibility();
}

function renderCharacter() {
  const name = getPlayerName() || "fighter";
  const avatar = getPlayerAvatar();
  const heroId = getHeroId();
  const heroMeta = playerAvatars.find((a) => a.id === heroId);
  const base = getCurrentHeroBase();

  const wins = Number(localStorage.getItem(LS_KEYS.wins) || "0");
  const losses = Number(localStorage.getItem(LS_KEYS.losses) || "0");
  const total = wins + losses;
  const winRate = total ? Math.round((wins / total) * 100) : 0;

  app().innerHTML = `
    <section class="container page-character">
      <div class="char-card" style="
        display:grid;grid-template-columns:220px 1fr;gap:24px;align-items:start;
        max-width:900px;margin:24px auto;padding:20px;border-radius:16px;
        background:#1f1f1f0f;box-shadow:0 6px 16px rgba(0,0,0,.08);
      ">
        <div class="char-left" style="display:flex;flex-direction:column;gap:12px;align-items:center;">
          <img class="avatar" src="${avatar}" alt="${name}'s avatar" style="width:220px;height:auto;object-fit:contain"/>
          <button id="btnChangeAvatar" class="btn btn-primary" style="width:100%;">Change avatar</button>
        </div>

        <div class="char-right" style="display:flex;flex-direction:column;gap:16px;">
          <header>
            <h2 style="margin:0 0 8px 0;">
              Current player: ${name}
              ${
                heroMeta
                  ? ` · <small style="font-weight:500;opacity:.8">${heroMeta.label}</small>`
                  : ""
              }
            </h2>
          </header>

          <section class="stats" aria-label="Overall stats">
            <h3 style="margin:0 0 8px 0;">Stats</h3>
            <ul style="list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:8px;">
              <li style="padding:10px;border-radius:10px;background:#fafafa;">🏆 <strong>Wins:</strong> ${wins}</li>
              <li style="padding:10px;border-radius:10px;background:#fafafa;">💀 <strong>Losses:</strong> ${losses}</li>
              <li style="padding:10px;border-radius:10px;background:#fafafa;">📈 <strong>Win rate:</strong> ${winRate}%</li>
            </ul>
          </section>

          <section class="hero-base" aria-label="Current hero base stats">
            <h3 style="margin:12px 0 8px 0;">Hero base</h3>
            <ul style="list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:8px;">
              <li style="padding:10px;border-radius:10px;background:#f5f5f5;">❤️ HP: ${
                base.hp
              }</li>
              <li style="padding:10px;border-radius:10px;background:#f5f5f5;">🗡️ DMG: ${
                base.dmg
              }</li>
              <li style="padding:10px;border-radius:10px;background:#f5f5f5;">🎯 Crit: ${(
                Number(base.critChance) * 100
              ).toFixed(0)}%</li>
              <li style="padding:10px;border-radius:10px;background:#f5f5f5;">⚡ Crit ×: ${
                base.critMult
              }</li>
            </ul>
            ${
              !heroMeta
                ? `<p style="margin:8px 0 0;opacity:.7">No hero selected yet.</p>`
                : ""
            }
          </section>
        </div>
      </div>
    </section>
  `;

  document.getElementById("btnChangeAvatar")?.addEventListener("click", () => {
    // Keep name and stats, just re-pick the hero
    window.location.hash = "#/avatar";
  });

  updateNewBattleLinkVisibility();
}

// -------------------------
// **************---------- Settings page
// ------------------------

function renderSettings() {
  const currentName = getPlayerName();

  app().innerHTML = `
    <section class="container page-settings">
      <div class="settings-card">
        <h2>Settings</h2>

        <div class="setting-row" id="nameRow">
          <div class="setting-label">Player name</div>
          <div class="setting-value" id="nameValue">${currentName || "—"}</div>
          <div class="setting-actions">
            <button id="btnEditName" class="btn btn-primary">Edit name</button>
          </div>
        </div>

        <form id="editNameForm" class="setting-edit" style="display:none">
          <label for="newName" class="setting-label">New name</label>
          <input id="newName" type="text" autocomplete="name" placeholder="Type new name" />
          <div id="nameEditError" class="form-error" aria-live="polite"></div>

          <div class="edit-actions">
            <button id="btnSaveName" class="btn btn-primary" type="submit" disabled>Save</button>
            <button id="btnCancelEdit" class="btn btn-ghost" type="button">Cancel</button>
          </div>
        </form>

        <p class="muted">Changing your name won’t affect your selected hero, avatar, or battle stats.</p>
      </div>
    </section>
  `;

  const btnEdit = document.getElementById("btnEditName");
  const form = document.getElementById("editNameForm");
  const input = document.getElementById("newName");
  const error = document.getElementById("nameEditError");
  const btnSave = document.getElementById("btnSaveName");
  const btnCancel = document.getElementById("btnCancelEdit");
  const nameValue = document.getElementById("nameValue");

  const openEditor = () => {
    form.style.display = "grid";
    btnEdit.disabled = true;
    input.value = getPlayerName();
    error.textContent = "";
    setBtnEnabled(btnSave, !!isValidName(input.value || ""));
    input.focus();
    input.select();
  };

  const closeEditor = () => {
    form.style.display = "none";
    btnEdit.disabled = false;
    error.textContent = "";
    input.value = "";
    setBtnEnabled(btnSave, false);
  };

  input.addEventListener("input", () => {
    error.textContent = "";
    const ok = isValidName(input.value || "");
    setBtnEnabled(btnSave, ok);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const newName = (input.value || "").trim();
    if (!isValidName(newName)) {
      error.textContent =
        "Имя должно быть от 2х до 20 символов (буквы/цифры/пробел/дефис)";
      input.focus();
      return;
    }
    // Save name only; keep hero/avatar/stats intact
    localStorage.setItem(LS_KEYS.name, newName);
    nameValue.textContent = newName;
    closeEditor();
    updateNewBattleLinkVisibility();
  });

  btnCancel.addEventListener("click", closeEditor);
  btnEdit.addEventListener("click", openEditor);

  updateNewBattleLinkVisibility();
}

// -------------
// ------------- Rendering Battle ---------------------------
// ******************************************************

function renderBattle() {
  if (!currentBattle) {
    window.location.hash = "#/home";
    return;
  }
  const { player, enemy, zones } = currentBattle;

  const heroId = getHeroId();
  const heroLabel = playerAvatars.find((a) => a.id === heroId)?.label || "";

  app().innerHTML = `
    <section class="container page-battle">
      <div class="row">
        <div class="col">
          <h2>Player:<br> ${getPlayerName() || "fighter"}${
    heroLabel ? ` · <small>${heroLabel}</small>` : ""
  }</h2>
          <img class="avatar" src="${getPlayerAvatar()}" alt="${getPlayerName()}'s avatar" />
          <div>HP: <progress id="hpPlayer" max="${player.hp}" value="${
    player.hpCurrent
  }"></progress> ${player.hpCurrent}/${player.hp}</div>
        </div>

        <div class="col col-center">
          <div class="panel">
            <div class="inner-panel">
              <div class="attack">
                <h3>Attack (pick 1)</h3>
                ${zones
                  .map(
                    (z) =>
                      `<label><input type="radio" name="atk" value="${z}">${z}</label>`
                  )
                  .join("")}
              </div>
              <div class="defense">
                <h3>Defense (pick 2)</h3>
                ${zones
                  .map(
                    (z) =>
                      `<label><input type="checkbox" name="def" value="${z}">${z}</label>`
                  )
                  .join("")}
              </div>
            </div>
            <button id="btnDo" disabled>Attack</button>
          </div>
        </div>

        <div class="col">
          <h2>Enemy: <br> ${enemy.name}</h2>
          ${
            enemy.img
              ? `<img class="avatar" src="${enemy.img}" alt="${enemy.name} avatar" />`
              : ""
          }
          <div>HP: <progress id="hpEnemy" max="${enemy.hp}" value="${
    enemy.hpCurrent
  }"></progress> ${enemy.hpCurrent}/${enemy.hp}</div>
        </div>
      </div>

      <div class="battle-log" id="battleLog"></div>
    </section>
  `;

  const btnDo = document.getElementById("btnDo");
  const getSelectedAttack = () => {
    const el = document.querySelector('input[name="atk"]:checked');
    return el ? el.value : "";
  };
  const getSelectedDefs = () =>
    [...document.querySelectorAll('input[name="def"]:checked')].map(
      (i) => i.value
    );

  const updateBtn = () => {
    const atk = getSelectedAttack();
    const defs = getSelectedDefs();
    const ready = !!(atk && defs.length === 2);
    setBtnEnabled(btnDo, ready); // visual + disabled state
  };

  document
    .querySelectorAll('input[name="atk"]')
    .forEach((i) => i.addEventListener("change", updateBtn));
  document.querySelectorAll('input[name="def"]').forEach((i) =>
    i.addEventListener("change", (e) => {
      const defs = getSelectedDefs();
      if (defs.length > 2) e.target.checked = false;
      updateBtn();
    })
  );
  updateBtn();

  btnDo.addEventListener("click", () => {
    const result = doRound({
      attack: getSelectedAttack(),
      blocks: getSelectedDefs(),
    });
    renderBattle();
    if (result !== "NONE") finishBattle(result);
  });

  renderLogList();
  if (player.hpCurrent === 0 || enemy.hpCurrent === 0) {
    finishBattle(player.hpCurrent === 0 ? "LOSE" : "WIN");
  }

  updateNewBattleLinkVisibility();
}

/* ===================== Routing ===================== */
const ROUTES = {
  "/register": renderRegister,
  "/home": renderHome, // Home is the main landing page
  "/character": renderCharacter,
  "/settings": renderSettings,
  "/battle": renderBattle,
  "/avatar": renderAvatar,
};

function getPathFromHash() {
  const h = window.location.hash || "";
  if (h.startsWith("#/")) return h.slice(1);
  if (h === "" || h === "#") return "/";
  return "/" + h.replace(/^#/, "");
}

/* Home is always allowed and is the default landing.
   Other pages are gated until the user creates a player. */
function guard(path) {
  const hasName = !!getPlayerName();
  const hasAvatar = !!getPlayerAvatar();

  // Home is always allowed and is the default landing
  if (path === "/" || path === "" || path === "/home") return "/home";

  // No name yet → allow only Home and Register
  if (!hasName) {
    return path === "/register" ? "/register" : "/home";
  }

  // Has name but no avatar → allow Home, Register, Avatar; gate others
  if (hasName && !hasAvatar) {
    if (path === "/avatar" || path === "/register" || path === "/home")
      return path;
    return "/avatar";
  }

  // Has both → proceed as requested
  return path;
}

function setActiveNav(path) {
  document.querySelectorAll(".nav-bar a").forEach((a) => {
    const isActive = a.getAttribute("href") === `#${path}`;
    a.classList.toggle("active", isActive);
  });
}

function renderRoute() {
  let path = getPathFromHash();
  path = guard(path);
  const view = ROUTES[path] || renderNotFound;
  view();
  setActiveNav(path);

  const expectedHash = `#${path}`;
  if (window.location.hash !== expectedHash)
    window.location.hash = expectedHash;

  updateNewBattleLinkVisibility();
}

function renderNotFound() {
  app().innerHTML = `<section><h1>404</h1><p>Страница не найдена</p></section>`;
  updateNewBattleLinkVisibility();
}

/* ===================== Listeners ===================== */
window.addEventListener("hashchange", renderRoute);
window.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("app")) {
    console.error('Не найден <main id="app"> в index.html');
    return;
  }

  // Navbar “New battle” → confirm → restart
  const newBattleLink = document.querySelector(".start-page a");
  if (newBattleLink) {
    newBattleLink.addEventListener("click", (e) => {
      e.preventDefault();
      showConfirmModal({
        title: "Start a new battle?",
        message: "Are you sure you want to start a new battle?",
        yesText: "Yes",
        cancelText: "Cancel",
        onYes: restartCycle,
      });
    });
  }

  renderRoute(); // lands on /home by default
  updateNewBattleLinkVisibility();
});

/* ===================== Validation ===================== */
function isValidName(name) {
  return /^[\p{L}\d -]{2,20}$/u.test(name.trim());
}
