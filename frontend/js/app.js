// Change this URL if your Express backend uses another host or port.
const API_BASE = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? `http://${location.hostname}:4000/api`
  : "/api";
let currentUser = null;
let otpPurpose = null;
let otpSent = false;
let pendingDelete = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function toast(message) {
  const box = $("#toast");
  box.textContent = message;
  box.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => box.classList.remove("show"), 3200);
}

async function api(path, options = {}) {
  const config = {
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) },
    credentials: "include"
  };
  const response = await fetch(`${API_BASE}${path}`, config);
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
  if (!response.ok) throw new Error(data.message || data.error || `Request failed (${response.status})`);
  return data;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
const DELETE_ENDPOINTS = {
  announcement: "/announcements",
  concern: "/concerns",
  event: "/events",
  assistance: "/assistance",
  foundListing: "/lost-found"
};
const DELETE_LABELS = {
  announcement: "announcement",
  concern: "concern report",
  event: "event",
  assistance: "assistance program",
  foundListing: "found listing"
};
function renderDeleteButton(type, id) {
  if (!currentUser || !["official", "admin"].includes(currentUser.role)) return "";
  return `<button class="btn btn-outline btn-small btn-delete" data-delete-type="${type}" data-delete-id="${escapeHTML(id)}">Delete</button>`;
}
function openDeleteConfirmation(type, id, trigger) {
  pendingDelete = { type, id, trigger };
  $("#deleteConfirmMessage").textContent = `Delete this ${DELETE_LABELS[type]}? This action cannot be undone.`;
  $("#deleteConfirmModal").classList.remove("hidden");
  $("#deleteConfirmCancel").focus();
}
function closeDeleteConfirmation(restoreFocus = true) {
  const trigger = pendingDelete && pendingDelete.trigger;
  $("#deleteConfirmModal").classList.add("hidden");
  pendingDelete = null;
  if (restoreFocus && trigger && trigger.isConnected) trigger.focus();
}
function refreshAfterDelete(type) {
  if (type === "announcement") loadAnnouncements();
  if (type === "concern") {
    if ($("#concerns").classList.contains("active-page")) loadMyConcerns();
    if ($("#officials").classList.contains("active-page")) loadDashboard();
  }
  if (type === "event") loadEvents();
  if (type === "assistance") loadAssistance();
  if (type === "foundListing") loadLostFound();
}
function showPage(page) {
  $$(".page").forEach(el => el.classList.toggle("active-page", el.id === page));
  $$(".nav-link").forEach(el => el.classList.toggle("active", el.dataset.page === page));
  $("#mainNav").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (page === "announcements" || page === "home") loadAnnouncements();
  if (page === "concerns") loadMyConcerns();
  if (page === "events") loadEvents();
  if (page === "assistance") loadAssistance();
  if (page === "lostfound") loadLostFound();
  if (page === "officials") loadDashboard();
}
function goTo(page) { showPage(page); }
function formObject(form) { return Object.fromEntries(new FormData(form).entries()); }

function updateAuthUI() {
  const loggedIn = !!currentUser;
  $("#loginOpen").classList.toggle("hidden", loggedIn);
  $("#registerOpen").classList.toggle("hidden", loggedIn);
  $("#logoutBtn").classList.toggle("hidden", !loggedIn);
  $("#userGreeting").textContent = loggedIn ? `Hi, ${currentUser.full_name || currentUser.name || "there"}` : "";
  $$(".official-only").forEach(el => el.classList.toggle("hidden", !(loggedIn && ["official","admin"].includes(currentUser.role))));
  const isOfficial = loggedIn && ["official","admin"].includes(currentUser.role);
  $("#myConcernsBtn").textContent = isOfficial ? "View all concerns" : "View my concerns";
  $("#officialDashboard .dashboard-lock").classList.toggle("hidden", isOfficial);
  $("#dashboardContent").classList.toggle("hidden", !isOfficial);
}

function openAuth(mode = "login") {
  $("#authModal").classList.remove("hidden");
  setAuthTab(mode);
}
function closeAuth() { $("#authModal").classList.add("hidden"); }
function setAuthTab(mode) {
  otpPurpose = null;
  otpSent = false;
  $("#authTabs").classList.remove("hidden");
  $$(".auth-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.auth === mode));
  $("#loginForm").classList.toggle("hidden", mode !== "login");
  $("#registerForm").classList.toggle("hidden", mode !== "register");
  $("#otpForm").classList.add("hidden");
  $("#sendOtpBtn").classList.add("hidden");
  setOtpDigitInputsDisabled(true);
  clearOtpDigits();
}
function showOtpChallenge(purpose, message, hasCode) {
  otpPurpose = purpose;
  otpSent = hasCode;
  $("#authTabs").classList.add("hidden");
  $("#loginForm").classList.add("hidden");
  $("#registerForm").classList.add("hidden");
  $("#otpForm").classList.remove("hidden");
  $("#otpHeading").textContent = purpose === "register" ? "Verify your email." : "Check your email.";
  $("#otpDescription").textContent = message;
  $("#otpSubmitBtn").textContent = purpose === "register" ? "Verify email" : "Verify and log in";
  $("#otpBackBtn").textContent = purpose === "register" ? "Back to registration" : "Back to login";
  $("#sendOtpBtn").classList.toggle("hidden", purpose !== "register");
  $("#sendOtpBtn").textContent = hasCode ? "Resend OTP" : "Send OTP";
  setOtpDigitInputsDisabled(!hasCode);
  clearOtpDigits();
  if (hasCode) $$(".otp-digit")[0].focus();
}
function setOtpDigitInputsDisabled(disabled) {
  $$(".otp-digit").forEach(input => { input.disabled = disabled; });
}
function clearOtpDigits() {
  $$(".otp-digit").forEach(input => { input.value = ""; });
  $("#otpInput").value = "";
  updateOtpValue();
}
function updateOtpValue() {
  const digits = $$(".otp-digit").map(input => input.value).join("");
  $("#otpInput").value = digits;
  $("#otpSubmitBtn").disabled = !otpSent || !/^\d{6}$/.test(digits);
}
function fillOtpDigits(startIndex, value) {
  const inputs = $$(".otp-digit");
  const digits = value.replace(/\D/g, "").slice(0, inputs.length - startIndex);
  for (let index = startIndex; index < inputs.length; index += 1) {
    inputs[index].value = digits[index - startIndex] || "";
  }
  updateOtpValue();
  const nextEmpty = inputs.findIndex((input, index) => index >= startIndex && !input.value);
  inputs[nextEmpty === -1 ? inputs.length - 1 : nextEmpty].focus();
}

async function checkSession() {
  try {
    const result = await api("/auth/me");
    currentUser = result.user || result;
  } catch { currentUser = null; }
  updateAuthUI();
}

async function loadAnnouncements() {
  const targets = [$("#announcementList"), $("#homeAnnouncements")].filter(Boolean);
  try {
    const result = await api("/announcements");
    const items = result.announcements || result.data || result || [];
    const html = Array.isArray(items) && items.length ? items.map(item => `
      <article class="content-card"><div class="meta">${escapeHTML(item.category || "Barangay update")} · ${formatDate(item.created_at)}</div>
      <h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.content || item.description || "")}</p>${renderDeleteButton("announcement", item.id)}</article>`).join("") : '<div class="empty-state">No announcements have been posted yet.</div>';
    targets.forEach(el => el.innerHTML = html);
  } catch (err) { targets.forEach(el => el.innerHTML = `<div class="empty-state">${escapeHTML(err.message)}<br>ERROR 502.</div>`); }
}
async function loadMyConcerns() {
  const box = $("#myConcernList");
  if (!currentUser) { box.innerHTML = '<div class="empty-state">Please log in to view your submitted concerns.</div>'; return; }
  const canViewAll = ["official", "admin"].includes(currentUser.role);
  $("#concernListTitle").textContent = canViewAll ? "All concern reports" : "My concern reports";
  $("#concernListDescription").textContent = canViewAll
    ? "Reports submitted by residents."
    : "Your submitted reports and their latest status.";
  try {
    const result = await api(canViewAll ? "/concerns" : "/concerns/my-reports");
    const items = result.concerns || result.data || result || [];
    box.innerHTML = Array.isArray(items) && items.length ? items.map(item => `
      <div class="list-item"><div><h4>${escapeHTML(item.title)}</h4><p>${escapeHTML(item.category || "General")} · ${escapeHTML(item.location || "")}</p>${item.resident_name ? `<p>Submitted by ${escapeHTML(item.resident_name)}</p>` : ""}<p>${escapeHTML(item.description || "")}</p></div><span class="pill ${statusClass(item.status)}">${escapeHTML(item.status || "Pending")}</span>${canViewAll ? renderDeleteButton("concern", item.id) : ""}</div>`).join("") : `<div class="empty-state">${canViewAll ? "No concern reports have been submitted yet." : "You have not submitted any concerns yet."}</div>`;
  } catch (err) { box.innerHTML = `<div class="empty-state">${escapeHTML(err.message)}</div>`; }
}
async function loadEvents() {
  renderListFromApi("/events", "#eventList", items => items.map(item => `<article class="content-card"><div class="meta">📅 ${formatDate(item.event_date || item.date)}</div><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.description || "")}</p><p>📍 ${escapeHTML(item.location || "Location to be announced")}</p><button class="btn btn-outline btn-small" data-event-register="${item.id}">Register interest</button>${renderDeleteButton("event", item.id)}</article>`).join(""));
}
async function loadAssistance() {
  renderListFromApi("/assistance", "#assistanceList", items => items.map(item => `<article class="content-card"><div class="meta">${escapeHTML(item.category || "Community program")}</div><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.description || "")}</p><p><strong>Eligibility:</strong> ${escapeHTML(item.eligibility || "See program details")}</p><p><strong>Deadline:</strong> ${formatDate(item.deadline)}</p>${renderDeleteButton("assistance", item.id)}</article>`).join(""));
}
async function loadLostFound() {
  renderListFromApi("/lost-found", "#lostFoundList", items => items.map(item => `<article class="content-card"><div class="meta">${escapeHTML(item.item_status || item.status || "Listing")}</div><h3>${escapeHTML(item.item_name || item.title)}</h3><p>${escapeHTML(item.description || "")}</p><p>📍 ${escapeHTML(item.location || "Location not specified")}</p>${item.item_status === "Found" ? renderDeleteButton("foundListing", item.id) : ""}</article>`).join(""));
}
async function renderListFromApi(path, selector, render) {
  const box = $(selector);
  try {
    const result = await api(path);
    const items = result.items || result.events || result.programs || result.listings || result.data || result || [];
    box.innerHTML = Array.isArray(items) && items.length ? render(items) : '<div class="empty-state">Nothing has been posted yet.</div>';
  } catch (err) { box.innerHTML = `<div class="empty-state">${escapeHTML(err.message)}<br>HTTP 404: Not Found</div>`; }
}
function statusClass(status = "") { return String(status).toLowerCase().replace(/\s+/g, "-"); }
function formatDate(value) { if (!value) return "Recently posted"; const d = new Date(value); return Number.isNaN(d.getTime()) ? escapeHTML(value) : d.toLocaleDateString(); }

async function loadDashboard() {
  if (!currentUser || !["official","admin"].includes(currentUser.role)) return;
  try {
    const result = await api("/analytics/overview");
    const data = result.overview || result;
    $("#statTotal").textContent = data.total_reports ?? data.totalReports ?? 0;
    $("#statPending").textContent = data.pending_reports ?? data.pendingReports ?? 0;
    $("#statResolved").textContent = data.resolved_reports ?? data.resolvedReports ?? 0;
    $("#statEvents").textContent = data.upcoming_events ?? data.upcomingEvents ?? 0;
  } catch (err) { toast(`Dashboard summary: ${err.message}`); }
  try {
    const result = await api("/analytics/concerns");
    const rows = result.categories || result.data || result || [];
    const max = Math.max(1, ...rows.map(x => Number(x.total || x.count || 0)));
    $("#categoryChart").innerHTML = Array.isArray(rows) && rows.length ? rows.map(x => `<div class="bar-row"><span>${escapeHTML(x.category)}</span><div class="bar-track"><div class="bar-fill" style="width:${(Number(x.total || x.count || 0)/max)*100}%"></div></div><strong>${Number(x.total || x.count || 0)}</strong></div>`).join("") : "No analytics data yet.";
  } catch { $("#categoryChart").textContent = "Category analytics endpoint is not available yet."; }
  try {
    const result = await api("/concerns");
    const items = result.concerns || result.data || result || [];
    const html = Array.isArray(items) ? items.map(renderOfficialConcern).join("") : "";
    $("#officialConcernList").innerHTML = html || '<div class="empty-state">No concerns found.</div>';
    $("#manageConcernList").innerHTML = html || '<div class="empty-state">No concerns found.</div>';
  } catch (err) {
    const error = `<div class="empty-state">${escapeHTML(err.message)}</div>`;
    $("#officialConcernList").innerHTML = error;
    $("#manageConcernList").innerHTML = error;
  }
  await loadFeedback();
}
function renderOfficialConcern(item) {
  const details = [item.category, item.location].filter(Boolean).map(escapeHTML).join(" · ");
  const submittedBy = item.resident_name ? `Submitted by ${escapeHTML(item.resident_name)}` : "Submitted by resident";
  return `<div class="list-item"><div><h4>${escapeHTML(item.title)}</h4><p>${details || "General concern"}</p><p>${escapeHTML(item.description || "")}</p><p class="meta">${submittedBy} · ${formatDate(item.created_at)}</p></div><div class="status-actions"><select class="status-select" aria-label="Update concern status" data-status-id="${item.id}"><option ${item.status==="Pending"?"selected":""}>Pending</option><option ${item.status==="In Progress"?"selected":""}>In Progress</option><option ${item.status==="Resolved"?"selected":""}>Resolved</option></select><button class="btn btn-outline btn-small" data-update-id="${item.id}">Update</button>${renderDeleteButton("concern", item.id)}</div></div>`;
}
async function loadFeedback() {
  const box = $("#officialFeedbackList");
  box.innerHTML = '<div class="empty-state">Loading feedback...</div>';
  try {
    const result = await api("/feedback");
    const items = result.feedback || result.data || result;
    if (!Array.isArray(items)) throw new Error("Unexpected feedback response.");
    box.innerHTML = items.length ? items.map(item => `
      <div class="list-item"><div>
        <h4>${escapeHTML(item.resident_name || "Resident")}</h4>
        <p>Rating: ${escapeHTML(item.rating)} / 5 · ${formatDate(item.created_at)}</p>
        <p>${escapeHTML(item.message || "").replace(/\r?\n/g, "<br>")}</p>
      </div></div>`).join("") : '<div class="empty-state">No resident feedback has been submitted yet.</div>';
  } catch (err) {
    box.innerHTML = `<div class="empty-state">${escapeHTML(err.message)}</div>`;
  }
}

$("#mainNav").addEventListener("click", e => { const b = e.target.closest("[data-page]"); if (b) showPage(b.dataset.page); });
$$("[data-go]").forEach(b => b.addEventListener("click", () => showPage(b.dataset.go)));
$("#menuToggle").addEventListener("click", () => $("#mainNav").classList.toggle("open"));
$("#loginOpen").addEventListener("click", () => openAuth("login"));
$("#registerOpen").addEventListener("click", () => openAuth("register"));
$("#deleteConfirmCancel").addEventListener("click", () => closeDeleteConfirmation());
$("#deleteConfirmModal").addEventListener("click", e => {
  if (e.target.id === "deleteConfirmModal") closeDeleteConfirmation();
});
$("#deleteConfirmDelete").addEventListener("click", async () => {
  if (!pendingDelete) return;

  const { type, id } = pendingDelete;
  const endpoint = DELETE_ENDPOINTS[type];
  const confirmButton = $("#deleteConfirmDelete");
  confirmButton.disabled = true;
  confirmButton.textContent = "Deleting...";

  try {
    await api(`${endpoint}/${encodeURIComponent(id)}`, { method: "DELETE" });
    closeDeleteConfirmation(false);
    toast(`${DELETE_LABELS[type]} deleted.`);
    refreshAfterDelete(type);
  } catch (err) {
    closeDeleteConfirmation();
    toast(err.message);
  } finally {
    confirmButton.disabled = false;
    confirmButton.textContent = "Delete";
  }
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("#deleteConfirmModal").classList.contains("hidden")) {
    closeDeleteConfirmation();
  }
});
$("#officialLoginBtn").addEventListener("click", () => openAuth("login"));
$("#modalClose").addEventListener("click", closeAuth);
$("#authModal").addEventListener("click", e => { if (e.target.id === "authModal") closeAuth(); });
$$(".auth-tab").forEach(tab => tab.addEventListener("click", () => setAuthTab(tab.dataset.auth)));
$("#otpBackBtn").addEventListener("click", () => {
  const returnTab = otpPurpose === "register" ? "register" : "login";
  $("#otpForm").reset();
  setAuthTab(returnTab);
});
$$(".otp-digit").forEach((input, index, inputs) => {
  input.addEventListener("input", () => {
    const value = input.value.replace(/\D/g, "");
    if (value.length > 1) {
      fillOtpDigits(index, value);
      return;
    }
    input.value = value;
    updateOtpValue();
    if (value && inputs[index + 1]) inputs[index + 1].focus();
  });
  input.addEventListener("keydown", event => {
    if (event.key === "Backspace" && !input.value && inputs[index - 1]) {
      inputs[index - 1].focus();
    } else if (event.key === "ArrowLeft" && inputs[index - 1]) {
      event.preventDefault();
      inputs[index - 1].focus();
    } else if (event.key === "ArrowRight" && inputs[index + 1]) {
      event.preventDefault();
      inputs[index + 1].focus();
    }
  });
  input.addEventListener("paste", event => {
    const value = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!value) return;
    event.preventDefault();
    fillOtpDigits(index, value);
  });
});
$("#sendOtpBtn").addEventListener("click", async () => {
  if (otpPurpose !== "register") return;
  const button = $("#sendOtpBtn");
  button.disabled = true;
  try {
    const result = await api("/auth/register/send-otp", { method:"POST" });
    if (!result.otpSent) throw new Error("The verification code was not sent.");
    otpSent = true;
    setOtpDigitInputsDisabled(false);
    clearOtpDigits();
    button.textContent = "Resend OTP";
    $("#otpDescription").textContent = result.message;
    $$(".otp-digit")[0].focus();
    toast(result.message);
  } catch (err) {
    toast(err.message);
  } finally {
    button.disabled = false;
  }
});
$("#refreshFeedbackBtn").addEventListener("click", loadFeedback);
$("#myConcernsBtn").addEventListener("click", async () => {
  if (!currentUser) { openAuth("login"); return; }
  const box = $("#myConcernList");
  box.innerHTML = '<div class="empty-state">Loading your concerns...</div>';
  box.scrollIntoView({ behavior: "smooth", block: "center" });
  await loadMyConcerns();
});

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const result = await api("/auth/login", { method:"POST", body:JSON.stringify(formObject(e.target)) });
    if (!result.user) throw new Error("Login did not complete.");
    currentUser = result.user;
    e.target.reset();
    updateAuthUI();
    closeAuth();
    toast(result.message || "Login successful.");
    showPage("home");
  } catch (err) { toast(err.message); }
});
$("#otpForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const result = await api("/auth/verify-otp", { method:"POST", body:JSON.stringify(formObject(e.target)) });
    if (!result.registrationComplete) throw new Error("Email verification did not complete.");
    e.target.reset();
    $("#registerForm").reset();
    setAuthTab("login");
    toast(result.message);
  } catch (err) { toast(err.message); }
});
$("#registerForm").addEventListener("submit", async e => {
  e.preventDefault();
  const data = formObject(e.target);
  if (data.password !== data.confirm_password) return toast("Passwords do not match.");
  delete data.confirm_password;
  try {
    const result = await api("/auth/register", { method:"POST", body:JSON.stringify(data) });
    if (!result.requiresOtp || result.purpose !== "register") {
      throw new Error("Email verification is not enabled on the backend. Restart the backend and try again.");
    }
    showOtpChallenge("register", result.message, false);
    toast(result.message);
  } catch (err) { toast(err.message); }
});
$("#logoutBtn").addEventListener("click", async () => {
  try { await api("/auth/logout", { method:"POST" }); } catch {}
  currentUser = null; updateAuthUI(); toast("You have logged out.");
});

$("#concernForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!currentUser) return openAuth("login");
  const data = formObject(e.target);
  try { await api("/concerns", {method:"POST",body:JSON.stringify(data)}); e.target.reset(); toast("Concern submitted successfully."); loadMyConcerns(); }
  catch (err) { toast(err.message); }
});
$("#announcementForm").addEventListener("submit", async e => {
  e.preventDefault();
  try { await api("/announcements", {method:"POST",body:JSON.stringify(formObject(e.target))}); e.target.reset(); toast("Announcement published."); loadAnnouncements(); }
  catch (err) { toast(err.message); }
});
$("#eventForm").addEventListener("submit", async e => {
  e.preventDefault();
  try { await api("/events", {method:"POST",body:JSON.stringify(formObject(e.target))}); e.target.reset(); toast("Event created."); loadEvents(); }
  catch (err) { toast(err.message); }
});
$("#assistanceForm").addEventListener("submit", async e => {
  e.preventDefault();
  try { await api("/assistance", {method:"POST",body:JSON.stringify(formObject(e.target))}); e.target.reset(); toast("Program published."); loadAssistance(); }
  catch (err) { toast(err.message); }
});
$("#lostFoundForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!currentUser) return openAuth("login");
  try { await api("/lost-found", {method:"POST",body:JSON.stringify(formObject(e.target))}); e.target.reset(); toast("Listing submitted."); loadLostFound(); }
  catch (err) { toast(err.message); }
});
$("#feedbackForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!currentUser) return openAuth("login");
  try { await api("/feedback", {method:"POST",body:JSON.stringify(formObject(e.target))}); e.target.reset(); toast("Thank you for your feedback."); }
  catch (err) { toast(err.message); }
});
document.addEventListener("click", async e => {
  const deleteButton = e.target.closest("[data-delete-type]");
  if (deleteButton) {
    const type = deleteButton.dataset.deleteType;
    if (!DELETE_ENDPOINTS[type]) return;
    openDeleteConfirmation(type, deleteButton.dataset.deleteId, deleteButton);
    return;
  }

  const register = e.target.closest("[data-event-register]");
  if (register) {
    if (!currentUser) return openAuth("login");
    try { await api(`/events/${register.dataset.eventRegister}/register`, {method:"POST"}); toast("Your event registration was recorded."); }
    catch (err) { toast(err.message); }
  }
  const update = e.target.closest("[data-update-id]");
  if (update) {
    const id = update.dataset.updateId;
    const status = update.closest(".list-item").querySelector("[data-status-id]").value;
    const update_message = `Status changed to ${status}.`;
    try { await api(`/concerns/${id}/status`, {method:"PATCH",body:JSON.stringify({status, update_message})}); toast("Concern status updated."); loadDashboard(); }
    catch (err) { toast(err.message); }
  }
});
$("#year").textContent = new Date().getFullYear();
checkSession().then(() => { loadAnnouncements(); });
