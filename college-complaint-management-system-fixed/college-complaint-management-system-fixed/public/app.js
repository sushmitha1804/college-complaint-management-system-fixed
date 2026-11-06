const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
let currentUser = null;
let allComplaints = [];
let toastTimer;

function toast(message, error = false) {
  const el = $("#toast");
  el.textContent = message;
  el.className = "toast show" + (error ? " error" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.className = "toast", 3500);
}
async function api(url, options = {}) {
  const config = { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } };
  const response = await fetch(url, config);
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function initials(name = "User") {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
}
function dateShort(value) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function dateFull(value) {
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function statusClass(status) { return status.toLowerCase().replace(/\s+/g, "-"); }
function statusPill(status) { return `<span class="status-pill ${statusClass(status)}">${escapeHtml(status)}</span>`; }
function categoryIcon(category) {
  return ({ Facilities:"⌂", Hostel:"⌂", Academic:"▤", Harassment:"♡", "IT Support":"⌘", Transport:"↗", Cleanliness:"✧", Other:"◈" })[category] || "◈";
}
function showAuth(mode = "login") {
  $("#authView").classList.remove("hidden");
  $("#appView").classList.add("hidden");
  const login = mode === "login";
  $("#loginForm").classList.toggle("hidden", !login);
  $("#registerForm").classList.toggle("hidden", login);
  $("#loginTab").classList.toggle("active", login);
  $("#registerTab").classList.toggle("active", !login);
  $("#authEyebrow").textContent = login ? "WELCOME TO CAMPUSCARE" : "JOIN YOUR CAMPUS COMMUNITY";
  $("#authTitle").textContent = login ? "Good to see you." : "Let's get you started.";
  $("#authSubtitle").textContent = login ? "Sign in to manage your campus concerns." : "Create your student account in just a moment.";
  $("#authFoot").innerHTML = login
    ? 'New to CampusCare? <button id="footSwitch" type="button">Create an account</button>'
    : 'Already have an account? <button id="footSwitch" type="button">Sign in</button>';
  $("#footSwitch").onclick = () => showAuth(login ? "register" : "login");
}
function showApp(user) {
  currentUser = user;
  $("#authView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  $("#sideName").textContent = user.name;
  $("#sideRole").textContent = user.role === "admin" ? "Administrator" : (user.department || "Student account");
  $("#sideAvatar").textContent = initials(user.name);
  $("#topAvatar").textContent = initials(user.name);
  $("#todayLabel").textContent = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  $("#year").textContent = new Date().getFullYear();
  $$(".student-only").forEach(el => el.classList.toggle("hidden", user.role === "admin"));
  $("#complaintNavLabel").textContent = user.role === "admin" ? "All complaints" : "My complaints";
  $("#listHeading").textContent = user.role === "admin" ? "All complaints" : "My complaints";
  $("#listSubheading").textContent = user.role === "admin" ? "Review submissions and keep students informed." : "All your submitted concerns in one place.";
  $("#welcomeEyebrow").textContent = user.role === "admin" ? "ADMINISTRATOR WORKSPACE" : "YOUR STUDENT SPACE";
  $("#welcomeTitle").textContent = `Hello, ${user.name.split(" ")[0]} 👋`;
  $("#welcomeText").textContent = user.role === "admin" ? "Review campus concerns and help move them towards resolution." : "Keep track of your concerns and stay in the loop.";
  $("#formName").textContent = user.name;
  $("#formEmail").textContent = user.email;
  $("#formAvatar").textContent = initials(user.name);
  navigate("overview");
}
function navigate(page) {
  if (page === "new" && currentUser?.role === "admin") page = "complaints";
  $$(".page").forEach(el => el.classList.add("hidden"));
  const pageEl = $("#page-" + page);
  if (pageEl) pageEl.classList.remove("hidden");
  $$(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.page === page));
  const names = { overview: "Overview", complaints: currentUser?.role === "admin" ? "All complaints" : "My complaints", new: "Raise a complaint", detail: "Complaint details" };
  $("#crumb").textContent = names[page] || "Overview";
  $("#pageTitle").textContent = page === "overview" ? "Your campus, in view." : (names[page] || "CampusCare");
  if (page === "overview") loadOverview();
  if (page === "complaints") loadComplaints();
}
async function loadOverview() {
  try {
    const { complaints } = await api("/api/complaints");
    allComplaints = complaints;
    if (currentUser.role === "admin") {
      const s = await api("/api/admin/summary");
      $("#statsGrid").innerHTML = [
        stat("Total complaints", s.total, "▤", "purple", "All submissions received"),
        stat("Awaiting review", s.submitted, "◷", "orange", "Newly submitted"),
        stat("Being handled", s.active, "↗", "blue", "Under review or in progress"),
        stat("Resolved", s.resolved, "✓", "green", `${s.students} registered students`)
      ].join("");
    } else {
      const count = status => complaints.filter(c => c.status === status).length;
      $("#statsGrid").innerHTML = [
        stat("Total complaints", complaints.length, "▤", "purple", "All your submissions"),
        stat("Under review", count("Under Review") + count("Submitted"), "◷", "orange", "Waiting for college action"),
        stat("In progress", count("In Progress"), "↗", "blue", "Currently being handled"),
        stat("Resolved", count("Resolved"), "✓", "green", "Concerns marked complete")
      ].join("");
    }
    const recent = complaints.slice(0, 4);
    $("#recentList").innerHTML = recent.length ? recent.map(c => `
      <div class="complaint-row" data-detail="${escapeHtml(c.id)}">
        <div class="row-icon">${categoryIcon(c.category)}</div>
        <div class="row-main"><div class="row-title">${escapeHtml(c.title)}</div><div class="row-sub">${escapeHtml(c.id)} · ${escapeHtml(c.category)}</div></div>
        <div class="row-end">${statusPill(c.status)}<span class="row-date">${dateShort(c.createdAt)}</span></div>
      </div>`).join("") : emptyState("Nothing here yet", currentUser.role === "admin" ? "New student complaints will appear here." : "When you submit a complaint, it will appear here.", currentUser.role !== "admin");
  } catch (e) { toast(e.message, true); }
}
function stat(label, number, icon, color, foot) {
  return `<div class="stat-card"><div class="stat-top"><span class="stat-label">${label}</span><span class="stat-icon ${color}">${icon}</span></div><div class="stat-number">${number}</div><div class="stat-foot">${foot}</div></div>`;
}
function emptyState(title, description, showButton = false) {
  return `<div class="empty-state"><div class="empty-icon">▤</div><h4>${escapeHtml(title)}</h4><p>${escapeHtml(description)}</p>${showButton ? '<button class="btn btn-primary" data-go="new">＋ Raise your first complaint</button>' : ""}</div>`;
}
async function loadComplaints() {
  try {
    const { complaints } = await api("/api/complaints");
    allComplaints = complaints;
    renderComplaints();
  } catch (e) { toast(e.message, true); }
}
function renderComplaints() {
  const query = ($("#searchInput").value || "").toLowerCase();
  const status = $("#statusFilter").value;
  const category = $("#categoryFilter").value;
  const list = allComplaints.filter(c =>
    (!query || [c.id,c.title,c.category,c.studentName,c.studentEmail].some(v => String(v || "").toLowerCase().includes(query))) &&
    (!status || c.status === status) && (!category || c.category === category)
  );
  if (!list.length) {
    $("#complaintsTable").innerHTML = emptyState("No matching complaints", "Try changing your filters, or submit a new complaint.", currentUser.role !== "admin");
    return;
  }
  $("#complaintsTable").innerHTML = `<div class="table-scroll"><table><thead><tr><th>COMPLAINT</th>${currentUser.role === "admin" ? "<th>STUDENT</th>" : ""}<th>CATEGORY</th><th>SUBMITTED</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>${list.map(c => `<tr>
    <td><div class="table-title">${escapeHtml(c.title)}</div><div class="table-muted">${escapeHtml(c.id)} · ${escapeHtml(c.priority)} priority</div></td>
    ${currentUser.role === "admin" ? `<td><div class="table-title">${escapeHtml(c.studentName)}</div><div class="table-muted">${escapeHtml(c.studentEmail)}</div></td>` : ""}
    <td>${escapeHtml(c.category)}</td><td>${dateShort(c.createdAt)}</td><td>${statusPill(c.status)}</td><td><button class="small-action" data-detail="${escapeHtml(c.id)}">${currentUser.role === "admin" ? "Review" : "View details"} →</button></td>
  </tr>`).join("")}</tbody></table></div>`;
}
async function openDetail(id) {
  try {
    let complaint = allComplaints.find(c => c.id === id);
    if (!complaint) {
      const { complaints } = await api("/api/complaints");
      allComplaints = complaints;
      complaint = allComplaints.find(c => c.id === id);
    }
    if (!complaint) return toast("Complaint not found.", true);
    $("#page-complaints").classList.add("hidden");
    $("#page-overview").classList.add("hidden");
    $("#page-new").classList.add("hidden");
    $("#page-detail").classList.remove("hidden");
    $("#crumb").textContent = "Complaint details";
    $("#pageTitle").textContent = complaint.id;
    const admin = currentUser.role === "admin";
    $("#detailContent").innerHTML = `
      <div class="detail-header"><div><div class="table-muted">${escapeHtml(complaint.id)} · Submitted ${dateShort(complaint.createdAt)}</div><h3>${escapeHtml(complaint.title)}</h3><p>${escapeHtml(complaint.category)} · ${escapeHtml(complaint.priority)} priority</p></div>${statusPill(complaint.status)}</div>
      <div class="detail-grid"><section class="panel detail-card"><h4>Complaint description</h4><div class="detail-description">${escapeHtml(complaint.description)}</div>
        <div class="aside-rule"></div><div class="detail-meta"><div><div class="meta-label">Location</div><div class="meta-value">${escapeHtml(complaint.location || "Not specified")}</div></div><div><div class="meta-label">Last updated</div><div class="meta-value">${dateFull(complaint.updatedAt)}</div></div></div>
        <div class="response-box"><strong>Administrator response</strong><p>${escapeHtml(complaint.adminResponse || "No response has been added yet. Check back for updates.")}</p></div>
      </section>
      <section class="panel detail-card"><h4>${admin ? "Review complaint" : "Submitted by"}</h4>
        ${admin ? `<div class="detail-meta" style="margin-bottom:20px"><div><div class="meta-label">Student name</div><div class="meta-value">${escapeHtml(complaint.studentName)}</div></div><div><div class="meta-label">Student email</div><div class="meta-value">${escapeHtml(complaint.studentEmail)}</div></div><div><div class="meta-label">Department</div><div class="meta-value">${escapeHtml(complaint.department || "Not specified")}</div></div></div>
          <form id="adminUpdateForm" class="admin-edit"><label>Status<select name="status">${["Submitted","Under Review","In Progress","Resolved","Rejected"].map(s => `<option ${s === complaint.status ? "selected" : ""}>${s}</option>`).join("")}</select></label><label>Response to student<textarea name="adminResponse" rows="5" maxlength="2000" placeholder="Share an update or resolution note...">${escapeHtml(complaint.adminResponse || "")}</textarea></label><button class="btn btn-primary" type="submit">Save update →</button></form>`
        : `<div class="contact-preview"><div class="avatar">${initials(complaint.studentName)}</div><div><strong>${escapeHtml(complaint.studentName)}</strong><p>${escapeHtml(complaint.studentEmail)}</p></div></div><div class="aside-rule"></div><h4>What happens next?</h4><p class="detail-description">The college administrator will review your complaint and update its status. Your status and any response will appear here.</p>`}
      </section></div>`;
    $("#adminUpdateForm")?.addEventListener("submit", async e => {
      e.preventDefault();
      const form = new FormData(e.currentTarget);
      const button = e.currentTarget.querySelector("button");
      button.disabled = true; button.textContent = "Saving...";
      try {
        await api("/api/complaints/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify({ status: form.get("status"), adminResponse: form.get("adminResponse") }) });
        toast("Complaint updated successfully.");
        await loadComplaints();
        openDetail(id);
      } catch (err) { toast(err.message, true); button.disabled = false; button.textContent = "Save update →"; }
    });
  } catch (e) { toast(e.message, true); }
}
$("#loginTab").onclick = () => showAuth("login");
$("#registerTab").onclick = () => showAuth("register");
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const button = e.currentTarget.querySelector("button");
  button.disabled = true;
  try {
    const result = await api("/api/login", { method: "POST", body: JSON.stringify(Object.fromEntries(form)) });
    showApp(result.user);
    toast("Welcome back!");
  } catch (err) { toast(err.message, true); }
  finally { button.disabled = false; }
});
$("#registerForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const button = e.currentTarget.querySelector("button");
  button.disabled = true;
  try {
    const result = await api("/api/register", { method: "POST", body: JSON.stringify(Object.fromEntries(form)) });
    showApp(result.user);
    toast("Your student account has been created.");
  } catch (err) { toast(err.message, true); }
  finally { button.disabled = false; }
});
$("#complaintForm").addEventListener("submit", async e => {
  e.preventDefault();
  // Keep a reference to the form before awaiting: e.currentTarget becomes null
  // after the event handler yields, so using e.currentTarget.reset() later throws.
  const formElement = e.currentTarget;
  const form = new FormData(formElement);
  const button = formElement.querySelector('button[type="submit"]');
  button.disabled = true; button.textContent = "Submitting...";
  try {
    const { complaint } = await api("/api/complaints", { method: "POST", body: JSON.stringify(Object.fromEntries(form)) });
    formElement.reset();
    toast("Complaint submitted. Reference: " + complaint.id);
    await loadComplaints();
    navigate("complaints");
  } catch (err) { toast(err.message, true); }
  finally { button.disabled = false; button.innerHTML = 'Submit complaint <span>→</span>'; }
});
$("#logoutBtn").addEventListener("click", async () => {
  try { await api("/api/logout", { method: "POST" }); currentUser = null; showAuth("login"); toast("You have signed out."); }
  catch (e) { toast(e.message, true); }
});
$("#searchInput").addEventListener("input", renderComplaints);
$("#statusFilter").addEventListener("change", renderComplaints);
$("#categoryFilter").addEventListener("change", renderComplaints);
document.addEventListener("click", e => {
  const nav = e.target.closest("[data-page]");
  const go = e.target.closest("[data-go]");
  const detail = e.target.closest("[data-detail]");
  if (nav) navigate(nav.dataset.page);
  if (go) navigate(go.dataset.go);
  if (detail) openDetail(detail.dataset.detail);
});
(async function init() {
  showAuth("login");
  try {
    const { user } = await api("/api/me");
    if (user) showApp(user);
  } catch {}
})();
