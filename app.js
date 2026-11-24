const $ = s => document.querySelector(s);
const GROUPS = ["Under 10", "Under 12", "Under 14", "Under 16", "Under 19"];

let players = JSON.parse(localStorage.getItem("xpress_players") || "[]");
let attendance = JSON.parse(localStorage.getItem("xpress_attendance") || "{}");
let parentAccounts = JSON.parse(localStorage.getItem("xpress_parent_accounts") || "[]");
let performance = JSON.parse(localStorage.getItem("xpress_performance") || "{}");
let activeParent = null;
let currentRole = "coach";

const savePlayers = () => localStorage.setItem("xpress_players", JSON.stringify(players));

function login() {
  const role = $("#role").value;
  const pass = $("#passcode").value;

  if (role === "coach" && pass === "1234") {
    currentRole = "coach";
    activeParent = null;
  } else if (role === "parent") {
    const acct = parentAccounts.find(a => a.password === pass);
    if (acct) {
      currentRole = "parent";
      activeParent = acct;
    } else if (pass === "1111" && parentAccounts.length === 0) {
      currentRole = "parent";
      activeParent = null;
    } else {
      $("#login-error").textContent = "Parent login not found. Ask the coach to create your account.";
      return;
    }
  } else {
    $("#login-error").textContent = "Incorrect demo passcode. Please try again.";
    return;
  }

  $("#login-error").textContent = "";
  $("#login-screen").classList.add("hidden");
  $("#app").classList.remove("hidden");
  $("#role-label").textContent = currentRole === "coach" ? "Coach / Admin" : "Parent";
  document.querySelectorAll('[data-page="parent-accounts"]').forEach(el =>
    el.classList.toggle("hidden", currentRole !== "coach")
  );
  document.querySelectorAll(".coach-only").forEach(el =>
    el.classList.toggle("hidden", currentRole !== "coach")
  );
  render();
}

$("#login-btn").addEventListener("click", login);
$("#passcode").addEventListener("keydown", e => {
  if (e.key === "Enter") login();
});
$("#logout-btn").addEventListener("click", () => {
  $("#app").classList.add("hidden");
  $("#login-screen").classList.remove("hidden");
  $("#passcode").value = "";
});

document.querySelectorAll(".nav-item").forEach(btn =>
  btn.addEventListener("click", () => showPage(btn.dataset.page))
);

function showPage(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  const target = $("#" + page + "-page");
  if (target) target.classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach(b =>
    b.classList.toggle("active", b.dataset.page === page)
  );
  $("#page-title").textContent = page[0].toUpperCase() + page.slice(1);
  if (page === "players") renderPlayers();
  if (page === "attendance") renderAttendance();
  if (page === "parent-accounts") renderParentAccounts();
  if (page === "performance") renderPerformance();
}

function render() {
  $("#total-players").textContent = players.length;
  $("#today-count").textContent = Object.entries(attendance)
    .filter(([k]) => k.startsWith(new Date().toISOString().slice(0, 10)))
    .reduce((n, [, v]) => n + Object.values(v).filter(Boolean).length, 0);
  $("#group-cards").innerHTML = GROUPS.map(g =>
    `<div class="group-card"><b>${g.replace("Under ", "U")}</b><small>${players.filter(p => p.group === g).length} players</small></div>`
  ).join("");
  renderPlayers();
}

$("#add-player-open").addEventListener("click", () => $("#player-dialog").showModal());
$("#close-dialog").addEventListener("click", () => $("#player-dialog").close());

$("#player-form").addEventListener("submit", e => {
  e.preventDefault();
  players.push({
    id: Date.now(),
    name: $("#new-name").value.trim(),
    group: $("#new-group").value,
    jersey: $("#new-jersey").value,
    contact: $("#new-contact").value
  });
  savePlayers();
  e.target.reset();
  $("#player-dialog").close();
  render();
});

/* Bulk import: one player name per line in the supplied .txt file or CSV. */
const bulkButton = $("#bulk-upload-btn");
if (bulkButton) {
  bulkButton.addEventListener("click", () => {
    const fileInput = $("#bulk-player-file");
    const message = $("#bulk-player-message");
    const file = fileInput && fileInput.files && fileInput.files[0];

    if (!message) {
      alert("Bulk upload message area is missing. Please update index.html and app.js together.");
      return;
    }
    if (!fileInput || !file) {
      message.textContent = "Please choose Xpress_Cricket_Player_Names.txt first.";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || "").replace(/^\uFEFF/, "");
      const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const names = lines.filter((line, index) => {
        const normalized = line.toLowerCase().replace(/[^a-z0-9]/g, "");
        return !(index === 0 && ["playername", "name", "players"].includes(normalized));
      });

      const existing = new Set(players.map(p => p.name.trim().toLowerCase()));
      const fresh = [];
      names.forEach((name, index) => {
        // Support a simple CSV row by taking the first column.
        const cleanName = name.split(",")[0].replace(/^["']|["']$/g, "").trim();
        const key = cleanName.toLowerCase();
        if (cleanName && !existing.has(key)) {
          existing.add(key);
          fresh.push({
            id: Date.now() + index,
            name: cleanName,
            group: "",
            jersey: "",
            contact: ""
          });
        }
      });

      if (!fresh.length) {
        message.textContent = "No new player names found. Check that the text file has one name per line.";
        return;
      }

      players = players.concat(fresh);
      savePlayers();
      render();
      message.textContent = `${fresh.length} players imported successfully. Age groups can be assigned later.`;
      fileInput.value = "";
    };
    reader.onerror = () => {
      message.textContent = "Could not read this file. Please select the TXT file again.";
    };
    reader.readAsText(file);
  });
}

function renderPlayers() {
  const q = $("#player-search").value.toLowerCase();
  const g = $("#group-filter").value;
  const allowed = currentRole === "parent" && activeParent ? [activeParent.playerId] : null;
  const list = players.filter(p =>
    (!allowed || allowed.includes(p.id)) &&
    p.name.toLowerCase().includes(q) &&
    (!g || p.group === g)
  );

  $("#player-rows").innerHTML = list.map(p =>
    `<tr><td class="player-name">${escapeHtml(p.name)}</td><td>${escapeHtml(p.group || "Not assigned")}</td><td>${p.jersey || "—"}</td><td>${escapeHtml(p.contact || "—")}</td><td class="coach-only"><button data-delete="${p.id}" class="delete-btn">Remove</button></td></tr>`
  ).join("");

  $("#empty-players").classList.toggle("hidden", list.length > 0);
  document.querySelectorAll("[data-delete]").forEach(b =>
    b.addEventListener("click", () => {
      if (confirm("Remove this player?")) {
        players = players.filter(p => p.id !== Number(b.dataset.delete));
        savePlayers();
        render();
      }
    })
  );
  document.querySelectorAll(".coach-only").forEach(el =>
    el.classList.toggle("hidden", currentRole !== "coach")
  );
}

$("#player-search").addEventListener("input", renderPlayers);
$("#group-filter").addEventListener("change", renderPlayers);

function renderAttendance() {
  if (!$("#attendance-date").value) {
    $("#attendance-date").value = new Date().toISOString().slice(0, 10);
  }
  const date = $("#attendance-date").value;
  const g = $("#attendance-group").value;
  const key = date + "|";
  const saved = attendance[key] || {};
  const list = players.filter(p =>
    (currentRole !== "parent" || !activeParent || p.id === activeParent.playerId) &&
    (!g || p.group === g)
  );
  $("#attendance-list").innerHTML = list.length
    ? list.map(p =>
        `<div class="attendance-row"><label>${escapeHtml(p.name)} <small>· ${escapeHtml(p.group || "Not assigned")}</small></label><input type="checkbox" data-att="${p.id}" ${saved[p.id] ? "checked" : ""} ${currentRole !== "coach" ? "disabled" : ""} aria-label="Present"></div>`
      ).join("")
    : '<p class="empty">No players in this group yet.</p>';
}

$("#attendance-date").addEventListener("change", renderAttendance);
$("#attendance-group").addEventListener("change", renderAttendance);
$("#save-attendance").addEventListener("click", () => {
  const key = $("#attendance-date").value + "|";
  attendance[key] = attendance[key] || {};
  document.querySelectorAll("[data-att]").forEach(c => {
    attendance[key][c.dataset.att] = c.checked;
  });
  localStorage.setItem("xpress_attendance", JSON.stringify(attendance));
  $("#attendance-message").textContent = "Attendance saved on this device.";
  render();
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

function renderParentAccounts() {
  const sel = $("#parent-player");
  if (!sel) return;
  sel.innerHTML = players.map(p =>
    `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.group || "Not assigned")})</option>`
  ).join("");
  $("#parent-rows").innerHTML = parentAccounts.map(a => {
    const p = players.find(x => x.id === a.playerId);
    return `<tr><td>${escapeHtml(a.name)}</td><td>${escapeHtml(a.mobile)}</td><td>${p ? escapeHtml(p.name) : "Player removed"}</td></tr>`;
  }).join("");
}

$("#create-parent")?.addEventListener("click", () => {
  const playerId = Number($("#parent-player").value);
  const name = $("#parent-name").value.trim();
  const mobile = $("#parent-mobile").value.trim();
  const password = $("#parent-pass").value;
  if (!playerId || !name || !mobile || password.length < 4) {
    alert("Select a player and enter parent name, mobile and a password of at least 4 characters.");
    return;
  }
  parentAccounts.push({ id: Date.now(), playerId, name, mobile, password });
  localStorage.setItem("xpress_parent_accounts", JSON.stringify(parentAccounts));
  $("#parent-name").value = "";
  $("#parent-mobile").value = "";
  $("#parent-pass").value = "";
  renderParentAccounts();
  alert("Demo parent account created. Login ID is the mobile number; demo login currently uses the password field.");
});

function renderPerformance() {
  const ids = currentRole === "parent" && activeParent
    ? [activeParent.playerId]
    : players.map(p => p.id);
  const records = ids.map(id => {
    const p = players.find(x => x.id === id);
    const v = performance[id] || {};
    return p ? `<tr><td>${escapeHtml(p.name)}</td><td>${v.runs ?? "—"}</td><td>${v.wickets ?? "—"}</td></tr>` : "";
  }).join("");
  const target = $("#performance-records");
  if (target) target.innerHTML = `<table><thead><tr><th>Player</th><th>Runs</th><th>Wickets</th></tr></thead><tbody>${records}</tbody></table>`;
  const sel = $("#performance-player");
  if (sel) {
    sel.innerHTML = players.map(p =>
      `<option value="${p.id}">${escapeHtml(p.name)}</option>`
    ).join("");
  }
}

$("#save-performance")?.addEventListener("click", () => {
  const id = Number($("#performance-player").value);
  if (!id) return;
  performance[id] = {
    runs: Number($("#runs-input").value || 0),
    wickets: Number($("#wickets-input").value || 0)
  };
  localStorage.setItem("xpress_performance", JSON.stringify(performance));
  renderPerformance();
});
