const $ = s => document.querySelector(s);
const GROUPS = ["Under 10", "Under 12", "Under 14", "Under 16", "Under 19"];

let players = JSON.parse(localStorage.getItem("xpress_players") || "[]");
let attendance = JSON.parse(localStorage.getItem("xpress_attendance") || "{}");
let parentAccounts = JSON.parse(localStorage.getItem("xpress_parent_accounts") || "[]");
let performance = JSON.parse(localStorage.getItem("xpress_performance") || "{}");
let activeParent = null;
let currentRole = "coach";

const savePlayers = () => localStorage.setItem("xpress_players", JSON.stringify(players));

// Supabase configuration for Xpress Cricket Academy.
const SUPABASE_URL = "https://ayrixcmsfkxqweizwlyv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_s3JLAtdLjX6q0X_PGoTb2Q_V2xy91G9";
const COACH_EMAIL = "xpresscricketacademy@gmail.com"; 
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let authUser = null;
let cloudStudent = null;

function showAuthError(message) {
  $("#login-error").textContent = message;
}
function showApp(role) {
  currentRole = role;
  $("#login-screen").classList.add("hidden");
  $("#app").classList.remove("hidden");
  $("#role-label").textContent = role === "coach" ? "Coach / Admin" : "Parent";
  document.querySelectorAll(".coach-only").forEach(el => el.classList.toggle("hidden", role !== "coach"));
  document.querySelectorAll('[data-page="parent-accounts"]').forEach(el => el.classList.toggle("hidden", role !== "coach"));
  if (role === "parent") {
    document.querySelectorAll(".nav-item").forEach(el => el.classList.add("hidden"));
    $("#parent-dashboard-page").classList.remove("hidden");
    $("#page-title").textContent = "My Child";
    renderMyChild();
  } else {
    document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("hidden"));
    render();
  }
}
async function login() {
  const role = $("#role").value;
  const email = $("#auth-email").value.trim().toLowerCase();
  const password = $("#auth-password").value;
  if (!email || !password) return showAuthError("Email and password are required.");
  showAuthError("Signing in...");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return showAuthError(error.message);
  authUser = data.user;
  if (role === "coach") {
    if (email !== COACH_EMAIL) {
      await supabase.auth.signOut();
      authUser = null;
      return showAuthError("This email is not authorized as Coach.");
    }
    showApp("coach");
    await loadApprovals();
  } else {
    if (email === COACH_EMAIL) {
      await supabase.auth.signOut();
      authUser = null;
      return showAuthError("Please choose Coach / Admin.");
    }
    const { data: rows, error: rowError } = await supabase
      .from("Students").select("*").eq("parent_user_id", authUser.id).limit(1);
    if (rowError) return showAuthError("Could not load registration: " + rowError.message);
    cloudStudent = rows && rows[0] ? rows[0] : null;
    if (!cloudStudent) return showAuthError("No child registration found for this account. Please register first.");
    if (String(cloudStudent.Approval_status).toLowerCase() !== "approved") {
      await supabase.auth.signOut();
      authUser = null;
      return showAuthError("Your registration is pending Coach approval. Please try again after approval.");
    }
    showApp("parent");
  }
}
$("#login-btn").addEventListener("click", login);
$("#auth-password").addEventListener("keydown", e => { if (e.key === "Enter") login(); });
$("#role").addEventListener("change", () => {
  $("#show-register").classList.toggle("hidden", $("#role").value !== "parent");
});
$("#show-register").addEventListener("click", () => $("#register-panel").classList.toggle("hidden"));
$("#register-btn").addEventListener("click", async () => {
  const email = $("#auth-email").value.trim().toLowerCase();
  const password = $("#auth-password").value;
  const student = $("#reg-student").value.trim();
  const dob = $("#reg-dob").value;
  const parent = $("#reg-parent").value.trim();
  const mobile = $("#reg-mobile").value.trim();
  const group = $("#reg-group").value;
  const photo = $("#reg-photo").files[0];
  if (!email || password.length < 8 || !student || !dob || !parent || !mobile || !group) {
    return showAuthError("Fill all required fields. Password must be at least 8 characters.");
  }
  if (email === COACH_EMAIL) return showAuthError("Please use a parent email address.");
  showAuthError("Submitting registration...");
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return showAuthError(error.message);
  if (!data.user) return showAuthError("Account could not be created. Please try again.");
  let photoPath = null;
  if (photo) {
    if (!photo.type.startsWith("image/") || photo.size > 5 * 1024 * 1024) {
      return showAuthError("Photo must be an image smaller than 5 MB.");
    }
    const ext = (photo.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    photoPath = `${data.user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("student-photos").upload(photoPath, photo, { upsert: false });
    if (uploadError) return showAuthError("Account created, but photo upload failed: " + uploadError.message);
  }
  const payload = {
    parent_user_id: data.user.id,
    Student_name: student,
    Date_of_birth: dob,
    Parent_name: parent,
    Parent_mobile: mobile,
    Age_group: group,
    Photo_url: photoPath,
    Approval_status: "Pending"
  };
  const { error: insertError } = await supabase.from("Students").insert(payload);
  if (insertError) return showAuthError("Account created, but student registration failed: " + insertError.message);
  showAuthError("Registration submitted. Coach approval is required before login.");
  $("#register-panel").classList.add("hidden");
});
$("#logout-btn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  authUser = null; cloudStudent = null; activeParent = null;
  $("#app").classList.add("hidden");
  $("#login-screen").classList.remove("hidden");
  $("#auth-password").value = "";
});
$("#refresh-approvals")?.addEventListener("click", loadApprovals);

async function renderMyChild() {
  if (!cloudStudent) return;
  let photoMarkup = "";
  if (cloudStudent.Photo_url) {
    const { data } = await supabase.storage.from("student-photos").createSignedUrl(cloudStudent.Photo_url, 3600);
    if (data?.signedUrl) photoMarkup = `<p><img src="${data.signedUrl}" alt="Child photo" style="max-width:150px;border-radius:12px"></p>`;
  }
  $("#my-child-details").innerHTML = `${photoMarkup}<b>${escapeHtml(cloudStudent.Student_name)}</b>
    <p>Date of birth: ${escapeHtml(cloudStudent.Date_of_birth || "—")}</p>
    <p>Age group: ${escapeHtml(cloudStudent.Age_group || "—")}</p>
    <p>Parent: ${escapeHtml(cloudStudent.Parent_name || "—")}</p>
    <p>Parent mobile: ${escapeHtml(cloudStudent.Parent_mobile || "—")}</p>
    <p>Registration status: ${escapeHtml(cloudStudent.Approval_status || "Pending")}</p>`;
}
async function loadApprovals() {
  const target = $("#approval-list");
  if (!target || currentRole !== "coach") return;
  target.textContent = "Loading registrations...";
  const { data, error } = await supabase.from("Students").select("*").order("created_at", { ascending: false });
  if (error) { target.textContent = "Could not load registrations: " + error.message; return; }
  if (!data.length) { target.textContent = "No registrations yet."; return; }
  target.innerHTML = `<table><thead><tr><th>Child</th><th>DOB</th><th>Parent</th><th>Mobile</th><th>Age group</th><th>Status</th><th>Action</th></tr></thead><tbody>${
    data.map(s => `<tr><td>${escapeHtml(s.Student_name || "")}</td><td>${escapeHtml(s.Date_of_birth || "")}</td><td>${escapeHtml(s.Parent_name || "")}</td><td>${escapeHtml(s.Parent_mobile || "")}</td><td>${escapeHtml(s.Age_group || "")}</td><td>${escapeHtml(s.Approval_status || "Pending")}</td><td>${String(s.Approval_status).toLowerCase() === "pending" ? `<button class="primary" data-approve="${s.id}">Approve</button> <button class="secondary" data-reject="${s.id}">Reject</button>` : "—"}</td></tr>`).join("")
  }</tbody></table>`;
  target.querySelectorAll("[data-approve]").forEach(btn => btn.addEventListener("click", () => setApproval(btn.dataset.approve, "Approved")));
  target.querySelectorAll("[data-reject]").forEach(btn => btn.addEventListener("click", () => setApproval(btn.dataset.reject, "Rejected")));
}
async function setApproval(id, status) {
  const { error } = await supabase.from("Students").update({ Approval_status: status }).eq("id", id);
  $("#approval-message").textContent = error ? error.message : `Registration ${status.toLowerCase()}.`;
  await loadApprovals();
}

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
  if (page === "approvals") loadApprovals();
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
