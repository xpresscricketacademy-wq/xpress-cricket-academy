const $=s=>document.querySelector(s);
const GROUPS=["Under 10","Under 12","Under 14","Under 16","Under 19"];
let players=JSON.parse(localStorage.getItem("xpress_players")||"[]");
let attendance=JSON.parse(localStorage.getItem("xpress_attendance")||"{}");
let currentRole="coach";
const savePlayers=()=>localStorage.setItem("xpress_players",JSON.stringify(players));
function login(){const role=$("#role").value,pass=$("#passcode").value;if((role==="coach"&&pass==="1234")||(role==="parent"&&pass==="1111")){currentRole=role;$("#login-screen").classList.add("hidden");$("#app").classList.remove("hidden");$("#role-label").textContent=role==="coach"?"Coach / Admin":"Parent";document.querySelectorAll(".coach-only").forEach(el=>el.classList.toggle("hidden",role!=="coach"));render();}else{$("#login-error").textContent="Incorrect demo passcode. Please try again.";}}
$("#login-btn").addEventListener("click",login);$("#passcode").addEventListener("keydown",e=>{if(e.key==="Enter")login()});
$("#logout-btn").addEventListener("click",()=>{$("#app").classList.add("hidden");$("#login-screen").classList.remove("hidden");$("#passcode").value="";});
document.querySelectorAll(".nav-item").forEach(btn=>btn.addEventListener("click",()=>showPage(btn.dataset.page)));
function showPage(page){document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));$("#"+page+"-page").classList.remove("hidden");document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));$("#page-title").textContent=page[0].toUpperCase()+page.slice(1);if(page==="players")renderPlayers();if(page==="attendance")renderAttendance();}
function render(){ $("#total-players").textContent=players.length;$("#today-count").textContent=Object.entries(attendance).filter(([k,v])=>k.startsWith(new Date().toISOString().slice(0,10))).reduce((n,[,v])=>n+Object.values(v).filter(Boolean).length,0);$("#group-cards").innerHTML=GROUPS.map(g=>`<div class="group-card"><b>${g.replace("Under ","U")}</b><small>${players.filter(p=>p.group===g).length} players</small></div>`).join("");renderPlayers();}
$("#add-player-open").addEventListener("click",()=>$("#player-dialog").showModal());$("#close-dialog").addEventListener("click",()=>$("#player-dialog").close());
$("#player-form").addEventListener("submit",e=>{e.preventDefault();players.push({id:Date.now(),name:$("#new-name").value.trim(),group:$("#new-group").value,jersey:$("#new-jersey").value,contact:$("#new-contact").value});savePlayers();e.target.reset();$("#player-dialog").close();render();});
function renderPlayers(){const q=$("#player-search").value.toLowerCase(),g=$("#group-filter").value;const list=players.filter(p=>p.name.toLowerCase().includes(q)&&(!g||p.group===g));$("#player-rows").innerHTML=list.map(p=>`<tr><td class="player-name">${escapeHtml(p.name)}</td><td>${p.group||"Not assigned"}</td><td>${p.jersey||"—"}</td><td>${escapeHtml(p.contact||"—")}</td><td class="coach-only"><button data-delete="${p.id}" class="delete-btn">Remove</button></td></tr>`).join("");$("#empty-players").classList.toggle("hidden",list.length>0);document.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>{if(confirm("Remove this player?")){players=players.filter(p=>p.id!==Number(b.dataset.delete));savePlayers();render();}}));document.querySelectorAll(".coach-only").forEach(el=>el.classList.toggle("hidden",currentRole!=="coach"));}
$("#player-search").addEventListener("input",renderPlayers);$("#group-filter").addEventListener("change",renderPlayers);
function renderAttendance(){if(!$("#attendance-date").value)$("#attendance-date").value=new Date().toISOString().slice(0,10);const date=$("#attendance-date").value,g=$("#attendance-group").value;const key=date+"|";const saved=attendance[key]||{};const list=players.filter(p=>!g||p.group===g);$("#attendance-list").innerHTML=list.length?list.map(p=>`<div class="attendance-row"><label>${escapeHtml(p.name)} <small>· ${p.group}</small></label><input type="checkbox" data-att="${p.id}" ${saved[p.id]?"checked":""} ${currentRole!=="coach"?"disabled":""} aria-label="Present"></div>`).join(""):'<p class="empty">No players in this group yet.</p>';}
$("#attendance-date").addEventListener("change",renderAttendance);$("#attendance-group").addEventListener("change",renderAttendance);
$("#save-attendance").addEventListener("click",()=>{const key=$("#attendance-date").value+"|";attendance[key]=attendance[key]||{};document.querySelectorAll("[data-att]").forEach(c=>attendance[key][c.dataset.att]=c.checked);localStorage.setItem("xpress_attendance",JSON.stringify(attendance));$("#attendance-message").textContent="Attendance saved on this device.";render();});
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));}

// Import a prepared list of player names from a TXT/CSV file.
$("#bulk-upload-btn")?.addEventListener("click", async () => {
  const file = $("#bulk-player-file")?.files?.[0];
  const message = $("#bulk-upload-message");
  if (!file) {
    message.textContent = "Please select the player names file first.";
    return;
  }
  try {
    const content = (await file.text()).replace(/^\uFEFF/, "");
    const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    let added = 0, skipped = 0;
    const known = new Set(players.map(p => p.name.trim().toLowerCase()));
    for (let line of lines) {
      // Accept a simple one-name-per-line TXT file or a CSV with a name column.
      if (line.includes(",")) line = line.split(",")[0].replace(/^"|"$/g, "").trim();
      if (/^(player name|name)$/i.test(line)) continue;
      if (!line || known.has(line.toLowerCase())) { skipped++; continue; }
      players.push({
        id: Date.now() + added,
        name: line,
        group: "",
        jersey: "",
        contact: ""
      });
      known.add(line.toLowerCase());
      added++;
    }
    savePlayers();
    render();
    message.textContent = `Successfully added ${added} players. Skipped ${skipped} blank, header or duplicate rows.`;
  } catch (error) {
    message.textContent = "Unable to read this file. Please select the supplied TXT file.";
  }
});
