/* ============================================
   Indian A/C Sales & Services — Complaints
   Clean Modern · Blue Professional
   ============================================ */

// ============================================
// Logo loading (cached) — used as PDF watermark
// ============================================
let LOGO_DATA_URL = null;
let LOGO_ROTATED_URL = null;

async function loadLogoDataUrl() {
  if (LOGO_DATA_URL) return LOGO_DATA_URL;
  try {
    const resp = await fetch("logo.png");
    const blob = await resp.blob();
    LOGO_DATA_URL = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    LOGO_ROTATED_URL = await rotateLogoDataUrl(LOGO_DATA_URL, 30);
  } catch (e) {
    console.warn("Logo load failed:", e);
    LOGO_DATA_URL = null;
  }
  return LOGO_DATA_URL;
}

function rotateLogoDataUrl(dataUrl, angleDeg) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = Math.max(img.width, img.height) * 1.5;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, size, size);
      ctx.translate(size / 2, size / 2);
      ctx.rotate((angleDeg * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

loadLogoDataUrl();

function addWatermark(doc) {
  if (!LOGO_ROTATED_URL) return;
  try {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.10 }));
    doc.addImage(LOGO_ROTATED_URL, "PNG", (pageW - 120) / 2, (pageH - 120) / 2, 120, 120, undefined, "FAST");
    doc.restoreGraphicsState();
  } catch (e) { console.warn("Watermark failed:", e); }
}

function addHeaderLogo(doc) {
  if (!LOGO_DATA_URL) return;
  try { doc.addImage(LOGO_DATA_URL, "PNG", 6, 6, 18, 18, undefined, "FAST"); } catch (e) {}
}

// ============================================
// Init
// ============================================
document.addEventListener("DOMContentLoaded", async () => {
  setupLanguageToggle();
  applyTranslations();
  setupLiveClock();
  await initEncryption();
  setupPageNav();
  initPage();
  applyTranslations();
  setupInactivityTracking();
  await hydrateFromServer();
  syncToServer();
});

// ============================================
// Live clock
// ============================================
function setupLiveClock() {
  const dateEl = document.getElementById("live-date");
  const timeEl = document.getElementById("live-time");
  if (!dateEl || !timeEl) return;
  function update() {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
    timeEl.textContent = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  update();
  setInterval(update, 1000);
}

// ============================================
// Auto Logout (30 min inactivity)
// ============================================
let lastActivity = Date.now();
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;
let inactivityTimer = null;

function resetInactivityTimer() {
  lastActivity = Date.now();
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(checkInactivity, 60000);
}

function checkInactivity() {
  if (Date.now() - lastActivity >= INACTIVITY_TIMEOUT) {
    doLogout();
  } else {
    inactivityTimer = setTimeout(checkInactivity, 60000);
  }
}

function setupInactivityTracking() {
  ["click", "keypress", "scroll", "mousemove"].forEach((e) => {
    document.addEventListener(e, resetInactivityTimer, { passive: true });
  });
  resetInactivityTimer();
}

function doLogout() {
  sessionStorage.removeItem("iacss_logged_in");
  sessionStorage.removeItem("iacss_user_name");
  sessionStorage.removeItem("iacss_login_id");
  sessionStorage.removeItem("iacss_role");
  sessionStorage.removeItem("iacss_unified_session");
  if (inactivityTimer) clearTimeout(inactivityTimer);
  window.location.href = "/index.html";
}

function isAdmin() {
  return sessionStorage.getItem("iacss_role") === "admin";
}

// ============================================
// Auth — unified session sync
// ============================================
function syncUnifiedAuth() {
  const urlParams = new URLSearchParams(window.location.search);
  const ssoUser = urlParams.get("u");
  const ssoRole = urlParams.get("r");
  if (ssoUser && !sessionStorage.getItem("iacss_logged_in")) {
    const role = ssoRole === "admin" ? "admin" : "user";
    sessionStorage.setItem("iacss_logged_in", "true");
    sessionStorage.setItem("iacss_user_name", ssoUser);
    sessionStorage.setItem("iacss_login_id", "INDIAN A/C");
    sessionStorage.setItem("iacss_role", role);
    window.history.replaceState({}, "", window.location.pathname);
    return;
  }
  const unifiedSession = sessionStorage.getItem("iacss_unified_session");
  if (unifiedSession && !sessionStorage.getItem("iacss_logged_in")) {
    const uSession = JSON.parse(unifiedSession);
    const role = uSession.role === "admin" ? "admin" : "user";
    sessionStorage.setItem("iacss_logged_in", "true");
    sessionStorage.setItem("iacss_user_name", uSession.username);
    sessionStorage.setItem("iacss_login_id", "INDIAN A/C");
    sessionStorage.setItem("iacss_role", role);
  }
}

function isAuthenticated() {
  return sessionStorage.getItem("iacss_logged_in") === "true";
}

// ============================================
// WhatsApp Share
// ============================================
const SHARE_WHATSAPP = "919865518560";

function formatWorkForSharing(record, type) {
  const status = type === "pending" ? t("share.statusPending") : t("share.statusCompleted");
  return `${t("share.header", status)}
${t("share.divider")}
${t("share.customer")} ${record.customerName}
${t("share.phone")} ${record.customerPhone}
${t("share.address")} ${record.address}
${t("share.city")} ${record.city || "\u2014"}
${t("share.location")} ${record.location || "\u2014"}
${t("share.complaint")} ${record.complaint}
${t("share.date")} ${record.date}
${t("share.recorded")} ${record.createdAt}
${record.completedAt ? t("share.completedAt") + " " + record.completedAt : ""}
${t("share.divider")}
${t("share.footer")}`.trim();
}

function shareViaWhatsApp(record, type) {
  const text = encodeURIComponent(formatWorkForSharing(record, type));
  window.open(`https://wa.me/${SHARE_WHATSAPP}?text=${text}`, "_blank");
}

function shareAllViaWhatsApp(list, type) {
  let text = (type === "pending" ? t("share.sectionPending", list.length) : t("share.sectionCompleted", list.length)) + "\n\n";
  list.forEach((c) => { text += formatWorkForSharing(c, type) + "\n\n"; });
  window.open(`https://wa.me/${SHARE_WHATSAPP}?text=${encodeURIComponent(text)}`, "_blank");
}

// ============================================
// Page Router
// ============================================
function setupPageNav() {
  const page = document.body.dataset.page;
  if (!page) return;
  document.querySelectorAll(".top-nav .nav-btn").forEach((btn) => {
    const href = btn.getAttribute("href");
    if (!href) return;
    const targetPage = href.split("/").pop().replace(".html", "");
    btn.classList.toggle("active", targetPage === page);
  });
}

function initPage() {
  const page = document.body.dataset.page;
  if (!page) return;
  syncUnifiedAuth();
  if (page !== "login" && !isAuthenticated()) {
    location.replace("index.html");
    return;
  }
  switch (page) {
    case "welcome": initWelcomePage(); break;
    case "complaint": initComplaintPage(); break;
    case "pending": initPendingPage(); break;
    case "completed": initCompletedPage(); break;
  }
}

// ============================================
// i18n — English / Tamil
// ============================================
const LANG_KEY = "iacss_lang";
let currentLang = (() => {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "ta" || saved === "en") return saved;
  } catch (e) {}
  return "en";
})();

const I18N = {
  en: {
    "app.title": "Indian A/C Sales and Services",
    "app.contact": "Contact: +91 98655 18560",
    "app.support": "Tech support: Tony 6385691188",
    "app.copyright": "\u00a9 2026 Indian A/C Sales and Services",
    "nav.home": "Home",
    "nav.new": "New Entry",
    "nav.pending": "Pending Works",
    "nav.completed": "Completed Works",
    "common.login": "Login",
    "common.logout": "Logout",
    "common.backHome": "Back to Portal",
    "common.save": "Save Entry",
    "common.clear": "Clear",
    "common.required": "*",
    "common.cancel": "Cancel",
    "common.ok": "OK",
    "common.delete": "Delete",
    "common.markComplete": "Mark Complete",
    "common.downloadPdf": "PDF",
    "common.shareWa": "WhatsApp",
    "common.downloadAllPdf": "Download All PDFs",
    "common.shareAllWa": "Share All WhatsApp",
    "common.downloadFullReport": "Download Full Report",
    "common.shareFullReportWa": "Share via WhatsApp",
    "common.clearHistory": "Clear History (Admin)",
    "common.sortBy": "Sort by:",
    "common.sortDateDesc": "Date (Newest)",
    "common.sortDateAsc": "Date (Oldest)",
    "common.sortNameAsc": "Name (A-Z)",
    "common.sortNameDesc": "Name (Z-A)",
    "common.dateFrom": "From:",
    "common.dateTo": "To:",
    "common.print": "Print",
    "login.id": "Login ID",
    "login.name": "Name",
    "login.password": "Password",
    "login.namePh": "Enter your name",
    "login.passwordPh": "Enter password",
    "login.submit": "Login",
    "login.errEmpty": "Please enter your name and password.",
    "login.errWrong": "Wrong password. Please try again.",
    "login.errNoCrypto": "Encryption not available. Cannot login.",
    "welcome.heading": "Welcome",
    "welcome.sub": "What would you like to do today?",
    "welcome.new.label": "New Customer Complaint Entry",
    "welcome.new.desc": "Add a new A/C complaint",
    "welcome.pending.label": "Pending Works",
    "welcome.pending.desc": "View work in progress",
    "welcome.completed.label": "Completed Works",
    "welcome.completed.desc": "View finished work & PDFs",
    "welcome.statPending": "Pending",
    "welcome.statCompleted": "Completed",
    "welcome.statOverdue": "Overdue",
    "welcome.statTotal": "Total",
    "welcome.searchBtn": "Search",
    "welcome.searchPh": "Search by phone number...",
    "welcome.searchEmpty": "No complaints found for this phone number.",
    "welcome.sourcePending": "Pending",
    "welcome.sourceCompleted": "Completed",
    "complaint.title": "Customer Complaint Entry",
    "complaint.customerName": "Customer Name",
    "complaint.customerPhone": "Customer Phone No.",
    "complaint.address": "Address",
    "complaint.city": "City",
    "complaint.location": "Location / Area",
    "complaint.complaint": "Complaint",
    "complaint.date": "Date",
    "complaint.status": "Complaint Status",
    "complaint.status.pendingOpt": "Pending Work (work in progress)",
    "complaint.status.completeOpt": "Completed Work (work finished)",
    "complaint.selectCity": "-- Select City --",
    "complaint.cityKovilpatti": "Kovilpatti",
    "complaint.cityPasuvanthanai": "Pasuvanthanai",
    "complaint.phPhone": "10-digit mobile number",
    "complaint.phLocation": "Area / Landmark",
    "complaint.phComplaint": "Describe the A/C issue in detail...",
    "complaint.errRequired": "Please fill all required fields (including City).",
    "complaint.savedOk": "Entry saved successfully.",
    "pending.title": "Pending Works",
    "pending.hint": 'Works in progress \u2014 entries older than <strong>1 day</strong> are highlighted in <span style="color:#e53935;font-weight:600;">red</span>.',
    "pending.empty": "No pending works.",
    "pending.alertEmpty": "No pending works to download.",
    "pending.confirmAll": (n) => `Download a combined PDF for ${n} pending work(s)?`,
    "pending.alertShareEmpty": "No pending works to share.",
    "completed.title": "Completed Works",
    "completed.hint": "Finished works with download PDF option.",
    "completed.empty": "No completed works yet.",
    "completed.alertEmpty": "No completed works to download.",
    "completed.confirmAll": (n) => `Download a combined PDF for ${n} completed work(s)?`,
    "completed.alertShareEmpty": "No completed works to share.",
    "card.address": "Address:",
    "card.city": "City:",
    "card.location": "Location:",
    "card.complaint": "Complaint:",
    "card.added": "Added",
    "card.started": "Started",
    "card.completedAt": "Completed",
    "card.overdue": "OVERDUE > 1 DAY",
    "card.status.pending": "Status: pending",
    "card.status.complete": "Status: complete",
    "card.deleteAdminOnly": "Only admin can delete pending works.",
    "card.deleteCompletedAdminOnly": "Only admin can delete completed work record.",
    "card.deleteConfirm": "Delete this pending work?",
    "card.deleteCompletedConfirm": "Delete this completed work record?",
    "share.header": (status) => `Indian A/C Sales and Services - ${status} Work`,
    "share.divider": "----------------------------------------",
    "share.customer": "Customer:",
    "share.phone": "Phone:",
    "share.address": "Address:",
    "share.city": "City:",
    "share.location": "Location:",
    "share.complaint": "Complaint:",
    "share.date": "Date:",
    "share.recorded": "Recorded:",
    "share.completedAt": "Completed:",
    "share.statusPending": "PENDING",
    "share.statusCompleted": "COMPLETED",
    "share.footer": "Shared via IACSS App",
    "share.sectionPending": (n) => `PENDING WORKS (${n})`,
    "share.sectionCompleted": (n) => `COMPLETED WORKS (${n})`,
    "share.fullReportHead": (date) => `INDIAN A/C SALES AND SERVICES \u2014 FULL WORK REPORT\nDate: ${date}`,
    "share.noPending": "No pending works.",
    "share.noCompleted": "No completed works.",
    "pdf.pending": "Pending Work Record",
    "pdf.completed": "Completed Work Record",
    "pdf.generic": "Customer Complaint Record",
    "pdf.fullReportTitle": "Full Work Report",
    "pdf.fullReportSubtitle": (p, c, d) => `Pending: ${p}  |  Completed: ${c}  |  Generated: ${d}`,
    "pdf.fullReportSub": "Full Work Report",
    "pdf.generated": "Generated:",
    "pdf.summaryPending": "Pending Works",
    "pdf.summaryCompleted": "Completed Works",
    "pdf.totalRecords": (n, d) => `Total Records: ${n}  |  ${d}`,
    "pdf.index": "Index",
    "pdf.thankyou": "Thank you for choosing Indian A/C Sales and Services",
    "pdf.fields.customerName": "Customer Name",
    "pdf.fields.customerPhone": "Phone No.",
    "pdf.fields.address": "Address",
    "pdf.fields.city": "City",
    "pdf.fields.location": "Location",
    "pdf.fields.complaint": "Complaint",
    "pdf.fields.date": "Date",
    "pdf.fields.status": "Status",
    "pdf.fields.createdAt": "Recorded On",
    "pdf.fields.completedAt": "Work Completed",
    "pdf.header": "#",
    "pdf.statusPending": "Status: pending",
    "pdf.statusCompleted": "Status: complete",
    "alert.noDataExport": "No data to export.",
    "lang.toggle": "EN | \u0ba4\u0bae\u0bbf\u0bb4\u0bcd",
    "lang.toggleAria": "Switch language",
  },
  ta: {
    "app.title": "\u0b87\u0ba8\u0bcd\u0ba4\u0bbf\u0baf\u0ba9\u0bcd \u0b8f\u0b9a\u0bbf \u0bb5\u0bbf\u0bb1\u0bcd\u0baa\u0ba9\u0bc8 & \u0b9a\u0bc7\u0bb5\u0bc8",
    "app.contact": "\u0ba4\u0bca\u0b9f\u0bb0\u0bcd\u0baa\u0bc1: +91 98655 18560",
    "app.support": "\u0ba4\u0bca\u0bb4\u0bbf\u0bb2\u0bcd\u0ba9\u0bc1\u0b9f\u0bcd\u0baa\u0bc1 \u0b86\u0ba4\u0bb0\u0bb5\u0bc1: \u0b9f\u0bca\u0ba9\u0bbf 6385691188",
    "app.copyright": "\u00a9 2026 \u0b87\u0ba8\u0bcd\u0ba4\u0bbf\u0baf\u0ba9\u0bcd \u0b8f\u0b9a\u0bbf \u0bb5\u0bbf\u0bb1\u0bcd\u0baa\u0ba9\u0bc8 & \u0b9a\u0bc7\u0bb5\u0bc8",
    "nav.home": "\u0bae\u0bc1\u0b95\u0baa\u0bcd\u0baa\u0bc1",
    "nav.new": "\u0baa\u0bc1\u0ba4\u0bbf\u0baf \u0baa\u0ba4\u0bbf\u0bb5\u0bc1",
    "nav.pending": "\u0ba8\u0bbf\u0bb2\u0bc1\u0bb5\u0bc8 \u0baa\u0ba3\u0bbf\u0b95\u0bb3\u0bcd",
    "nav.completed": "\u0bae\u0bc1\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f \u0baa\u0ba3\u0bbf\u0b95\u0bb3\u0bcd",
    "common.login": "\u0b89\u0bb3\u0bcd\u0ba9\u0bc1\u0bb4\u0bc8\u0bb5\u0bc1",
    "common.logout": "\u0bb5\u0bc6\u0bb3\u0bbf\u0baf\u0bc7\u0bb1\u0bc1",
    "common.backHome": "\u0bae\u0bc1\u0b95\u0baa\u0bcd\u0baa\u0bc1\u0b95\u0bcd\u0b95\u0bc1 \u0ba4\u0bbf\u0bb0\u0bc1\u0bae\u0bcd\u0baa\u0bc1",
    "common.save": "\u0baa\u0ba4\u0bbf\u0bb5\u0bc1\u0b9a\u0bc7 \u0b9a\u0bc7\u0bae\u0bbf",
    "common.clear": "\u0b85\u0bb4\u0bbf",
    "common.required": "*",
    "common.cancel": "\u0bb0\u0ba4\u0bcd\u0ba4\u0bc1",
    "common.ok": "\u0b9a\u0bb0\u0bbf",
    "common.delete": "\u0ba8\u0bc0\u0b95\u0bcd\u0b95\u0bc1",
    "common.markComplete": "\u0bae\u0bc1\u0b9f\u0bbf\u0ba8\u0bcd\u0ba4\u0ba4\u0bbe\u0b95 \u0b95\u0bc1\u0bb1\u0bbf",
    "common.downloadPdf": "PDF",
    "common.shareWa": "\u0bb5\u0bbe\u0b9f\u0bcd\u0b9a\u0b83\u0aaa\u0bcd",
    "common.downloadAllPdf": "\u0b85\u0ba9\u0bc8\u0ba4\u0bcd\u0ba4\u0bc1 PDF-\u0b95\u0bb3\u0bc8\u0baf\u0bc1\u0bae\u0bcd \u0baa\u0ba4\u0bbf\u0bb5\u0bbf\u0bb1\u0b95\u0bcd\u0b95\u0bc1",
    "common.shareAllWa": "\u0b85\u0ba9\u0bc8\u0ba4\u0bcd\u0ba4\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bc8\u0baf\u0bc1\u0bae\u0bcd \u0bb5\u0bbe\u0b9f\u0bcd\u0b9a\u0b83\u0aaa\u0bcd\u0baa\u0bbf\u0bb2\u0bcd \u0baa\u0b95\u0bbf\u0bb1\u0bc7",
    "common.downloadFullReport": "\u0bae\u0bcd\u0b9a\u0bc1 \u0b85\u0bb1\u0bbf\u0b95\u0bcd\u0b95\u0bc8\u0af8\u0bc8\u0baa\u0bcd \u0baa\u0ba4\u0bbf\u0bb5\u0bbf\u0bb1\u0b95\u0bcd\u0b95\u0bc1",
    "common.shareFullReportWa": "\u0bb5\u0bbe\u0b9f\u0bcd\u0b9a\u0b83\u0aaa\u0bcd\u0baa\u0bbf\u0bb2\u0bcd \u0baa\u0b95\u0bbf\u0bb1\u0bc7",
    "common.clearHistory": "\u0bb5\u0bb0\u0bb2\u0bbe\u0b9f\u0bcd\u0b9f\u0bc1\u0baf\u0bc8 \u0b85\u0bb4\u0bbf (\u0ba8\u0bbf\u0bb0\u0bcd\u0bb5\u0bbe\u0b95\u0bbf)",
    "common.sortBy": "\u0bb5\u0bb0\u0bbf\u0b9a\u0bc8\u0baa\u0bcd\u0baa\u0b9f\u0bc1\u0ba4\u0bcd\u0ba4\u0bc1:",
    "common.sortDateDesc": "\u0ba4\u0bc7\u0bb5\u0bbf (\u0baa\u0bc1\u0ba4\u0bbf\u0baf\u0ba4\u0bc1)",
    "common.sortDateAsc": "\u0ba4\u0bc7\u0bb5\u0bbf (\u0baa\u0bb4\u0bc8\u0baf\u0ba4\u0bc1)",
    "common.sortNameAsc": "\u0baa\u0bc6\u0baf\u0bb0\u0bcd (\u0b86-\u0b9c\u0bc7)",
    "common.sortNameDesc": "\u0baa\u0bc6\u0baf\u0bb0\u0bcd (\u0b9c\u0bc7-\u0b86)",
    "common.dateFrom": "\u0b87\u0bb0\u0bc1\u0ba8\u0bcd\u0ba4\u0bc1:",
    "common.dateTo": "\u0bb5\u0bb0\u0bc8:",
    "common.print": "\u0b85\u0b9a\u0bcd\u0b9a\u0bbf\u0b9f\u0bc1",
    "login.errEmpty": "\u0b89\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0baa\u0bc6\u0baf\u0bb0\u0bc8 \u0bae\u0bb1\u0bcd\u0bb1\u0bc1\u0bae\u0bcd \u0b95\u0b9f\u0bb5\u0bc1\u0b9a\u0bcd\u0b9a\u0bb2\u0bc1\u0bae\u0bcd.",
    "login.errWrong": "\u0ba4\u0bb5\u0bb1\u0bbe\u0ba9 \u0b95\u0b9f\u0bb5\u0bc1\u0b9a\u0bcd\u0b9a\u0bb2\u0bcd. \u0bae\u0bc0\u0ba3\u0bcd\u0da4\u0bc1\u0bae\u0bcd \u0bae\u0bc1\u0baf\u0bb1\u0bcd\u0b9a\u0bbf\u0b95\u0bcd\u0b95\u0bb5\u0bc1\u0bae\u0bcd.",
    "login.errNoCrypto": "\u0b95\u0bc1\u0bb1\u0bbf\u0baf\u0bbe\u0b95\u0bcd\u0b95\u0bae\u0bcd \u0b95\u0bbf\u0b9f\u0bc8\u0b95\u0bcd\u0b95\u0bb5\u0bbf\u0bb2\u0bcd\u0bb2\u0bc8. \u0b89\u0bb3\u0bcd\u0ba9\u0bc1\u0bb4\u0bc8\u0baf \u0bae\u0bc1\u0b9f\u0bbf\u0baf\u0bbe\u0ba4\u0bc1.",
    "welcome.heading": "\u0bb5\u0bb0\u0b95\u0bc8\u0bb5\u0bc7\u0bb1\u0bcd\u0b95\u0bbf\u0bb1\u0bcb\u0bae\u0bcd",
    "welcome.sub": "\u0b87\u0ba8\u0bcd\u0ba4\u0bc1 \u0ba8\u0bc0\u0b95\u0bcd\u0b95\u0bc1 \u0b8e\u0ba9\u0bcd\u0ba9\u0bc1 \u0b9a\u0bc6\u0baf\u0bcd \u0bb5\u0bbf\u0bb1\u0bc1\u0baa\u0bcd\u0baa\u0b99\u0bcd\u0b95\u0bbf\u0bb1\u0bc0\u0bb0\u0bcd\u0b95\u0bb3\u0bcd?",
    "welcome.new.label": "\u0baa\u0bc1\u0ba4\u0bbf\u0baf \u0bb5\u0bbe\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0bc8\u0baf\u0bbe\u0bb3\u0bb0\u0bcd \u0baa\u0bc1\u0b95\u0bbe\u0bb0\u0bcd \u0baa\u0ba4\u0bbf\u0bb5\u0bc1",
    "welcome.new.desc": "\u0baa\u0bc1\u0ba4\u0bbf\u0baf \u0b8f\u0b9a\u0bbf \u0baa\u0bc1\u0b95\u0bbe\u0bb0\u0bcd \u0b9a\u0bc7\u0bb0\u0bcd",
    "welcome.pending.label": "\u0ba8\u0bbf\u0bb2\u0bc1\u0bb5\u0bc8 \u0baa\u0ba3\u0bbf\u0b95\u0bb3\u0bcd",
    "welcome.pending.desc": "\u0ba8\u0b9f\u0baa\u0bcd\u0baa\u0bbf\u0bb2\u0bcd \u0b89\u0b9c\u0bb0\u0bc1\u0b95\u0bcd\u0b95\u0bc1\u0bae\u0bcd \u0bb5\u0bc7\u0bb2\u0bc8\u0baf\u0bc8\u0baa\u0bcd \u0baa\u0bbe\u0bb0\u0bcd",
    "welcome.completed.label": "\u0bae\u0bc1\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f \u0baa\u0ba3\u0bbf\u0b95\u0bb3\u0bcd",
    "welcome.completed.desc": "\u0bae\u0bc1\u0b9f\u0bbf\u0ba8\u0bcd\u0ba4 \u0bb5\u0bc7\u0bb2\u0bc8 & PDF-\u0b95\u0bb3\u0bc8\u0baa\u0bcd \u0baa\u0bbe\u0bb0\u0bcd",
    "welcome.statPending": "\u0ba8\u0bbf\u0bb2\u0bc1\u0bb5\u0bc8",
    "welcome.statCompleted": "\u0bae\u0bc1\u0b9f\u0bbf\u0ba8\u0bcd\u0ba4\u0ba4\u0bc1",
    "welcome.statOverdue": "\u0ba4\u0bbe\u0bae\u0ba4\u0bae\u0bcd",
    "welcome.statTotal": "\u0bae\u0bca\u0ba4\u0bcd\u0ba4\u0bae\u0bcd",
    "welcome.searchBtn": "\u0ba4\u0bc7\u0b9f\u0bc1",
    "welcome.searchPh": "\u0ba4\u0bca\u0bb2\u0bc8\u0baa\u0bc7\u0b9a\u0bbf \u0b8e\u0ba3\u0bcd \u0bae\u0bc2\u0bb2\u0bae\u0bcd \u0ba4\u0bc7\u0b9f\u0bc1\u0b99\u0bcd\u0b95\u0bb2\u0bc1...",
    "welcome.searchEmpty": "\u0b87\u0ba8\u0bcd\u0ba4 \u0ba4\u0bca\u0bb2\u0bc8\u0baa\u0bc7\u0b9a\u0bbf \u0b8e\u0ba3\u0bcd \u0b8e\u0b99\u0bcd\u0b95\u0bc1\u0bae\u0bcd \u0b9a\u0bbf\u0b95\u0bb8\u0bca\u0bae\u0b95\u0bbf\u0bb1\u0bc8\u0bb2\u0bcd \u0b95\u0bbf\u0b9f\u0bc8\u0b95\u0bcd\u0b95\u0bb5\u0bbf\u0bb2\u0bcd\u0bb2\u0bc8.",
    "welcome.sourcePending": "\u0ba8\u0bbf\u0bb2\u0bc1\u0bb5\u0bc8",
    "welcome.sourceCompleted": "\u0bae\u0bc1\u0b9f\u0bbf\u0ba8\u0bcd\u0ba4\u0ba4\u0bc1",
    "complaint.title": "\u0bb5\u0bbe\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0bc8\u0baf\u0bbe\u0bb3\u0bb0\u0bcd \u0baa\u0bc1\u0b95\u0bbe\u0bb0\u0bcd \u0baa\u0ba4\u0bbf\u0bb5\u0bc1",
    "complaint.customerName": "\u0bb5\u0bbe\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0bc8\u0baf\u0bbe\u0bb3\u0bb0\u0bcd \u0baa\u0bc6\u0baf\u0bb0\u0bc1",
    "complaint.customerPhone": "\u0bb5\u0bbe\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0bc8\u0baf\u0bbe\u0bb3\u0bb0\u0bcd \u0ba4\u0bca\u0bb2\u0bc8\u0baa\u0bc7\u0b9a\u0bbf \u0b8e\u0ba3\u0bcd",
    "complaint.address": "\u0bae\u0bc1\u0b95\u0bb5\u0bb0\u0bbf",
    "complaint.city": "\u0ba8\u0b95\u0bb0\u0bae\u0bcd",
    "complaint.location": "\u0b87\u0b9f\u0bae\u0bcd / \u0baa\u0b95\u0bc1\u0ba4\u0bbf",
    "complaint.complaint": "\u0baa\u0bc1\u0b95\u0bbe\u0bb0\u0bcd",
    "complaint.date": "\u0ba4\u0bc7\u0bb5\u0bbf",
    "complaint.status": "\u0baa\u0bc1\u0b95\u0bbe\u0bb0\u0bcd \u0ba8\u0bbf\u0bb2\u0bc8",
    "complaint.status.pendingOpt": "\u0ba8\u0bbf\u0bb2\u0bc1\u0bb5\u0bc8 \u0bb5\u0bc7\u0bb2\u0bc8 (\u0bb5\u0bc7\u0bb2\u0bc8 \u0ba8\u0b9f\u0baa\u0bcd\u0baa\u0bbf\u0bb2\u0bcd)",
    "complaint.status.completeOpt": "\u0bae\u0bc1\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f \u0bb5\u0bc7\u0bb2\u0bc8 (\u0bb5\u0bc7\u0bb2\u0bc8 \u0bae\u0bc1\u0b9f\u0bbf\u0ba8\u0bcd\u0ba4\u0ba4\u0bc1)",
    "complaint.selectCity": "-- \u0ba8\u0b95\u0bb0\u0bae\u0bcd\u0ba4\u0bcd\u0ba4\u0bc8\u0ba4\u0bcd\u0ba4\u0bc1 \u0ba4\u0bc7\u0bb0\u0bcd\u0ba8\u0bcd\u0b9f\u0bc6\u0b9f\u0bc1 --",
    "complaint.cityKovilpatti": "\u0b95\u0bca\u0bb5\u0bbf\u0bb2\u0bcd\u0baa\u0b9f\u0bcd\u0b9f\u0bbf",
    "complaint.cityPasuvanthanai": "\u0baa\u0b9a\u0bc1\u0bb5\u0ba8\u0bcd\u0ba4\u0ba9\u0bc8",
    "complaint.phPhone": "10 \u0b87\u0bb2\u0b95\u0bcd \u0bae\u0bca\u0baa\u0bc8\u0bb2\u0bcd \u0b8e\u0ba3\u0bcd",
    "complaint.phLocation": "\u0baa\u0b95\u0bc1\u0ba4\u0bbf / \u0b85\u0b9f\u0bc8\u0baf\u0bbe\u0b95\u0bae\u0bcd",
    "complaint.phComplaint": "\u0b8f\u0b9a\u0bbf \u0b9a\u0bbf\u0b95\u0bcd\u0b95\u0bb2\u0bc8 \u0bb5\u0bbf\u0bb1\u0bbf\u0bb5\u0bb3\u0bcd\u0b9a\u0bbe\u0b95 \u0bb5\u0bbf\u0bb5\u0bb0\u0bbf\u0b95\u0bcd\u0b95\u0bb5\u0bc1\u0bae\u0bcd...",
    "complaint.errRequired": "\u0b85\u0ba9\u0bc8\u0ba4\u0bcd\u0ba4\u0bc1 \u0ba4\u0bc7\u0bb5\u0bc8\u0baf\u0bc1\u0bae\u0bcd \u0baa\u0bc1\u0bb2\u0b99\u0bcd\u0b95\u0bb3\u0bc8\u0baf\u0bc1\u0bae\u0bcd \u0ba8\u0bbf\u0bb0\u0baa\u0bcd\u0baa\u0bb5\u0bc1\u0bae\u0bcd (\u0ba8\u0b95\u0bb0\u0bae\u0bcd \u0b89\u0b9f\u0bcd\u0baa\u0bb0).",
    "complaint.savedOk": "\u0baa\u0ba4\u0bbf\u0bb5\u0bc1 \u0bb5\u0bc6\u0bb1\u0bcd\u0b95\u0bbf\u0bb1\u0b95\u0b9a\u0bb0\u0bae\u0bbe\u0b95 \u0b9a\u0bc7\u0bae\u0bbf\u0b95\u0bcd\u0b95\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f\u0ba4\u0bc1.",
    "pending.title": "\u0ba8\u0bbf\u0bb2\u0bc1\u0bb5\u0bc8 \u0baa\u0ba3\u0bbf\u0b95\u0bb3\u0bcd",
    "pending.hint": '\u0ba8\u0b9f\u0baa\u0bcd\u0baa\u0bbf\u0bb2\u0bcd \u0b89\u0b9c\u0bb0\u0bc1\u0b95\u0bcd\u0b95\u0bc1\u0bae\u0bcd \u0baa\u0ba3\u0bbf\u0b95\u0bb3\u0bcd \u2014 <strong>1 \u0ba8\u0bbe\u0bb3\u0bc8\u0b95\u0bcd\u0b95\u0bc1</strong> \u0bae\u0bc7\u0bb2\u0bcd\u0baa\u0b9f \u0baa\u0ba4\u0bbf\u0bb5\u0bc1\u0b95\u0bb3\u0bcd <span style="color:#e53935;font-weight:600;">\u0b9a\u0bbf\u0bb5\u0baa\u0bcd\u0baa\u0bc1</span> \u0bb5\u0ba3\u0bcd\u0ba3\u0ba4\u0bcd\u0ba4\u0b99\u0bcd\u0b95\u0bc1 \u0b95\u0bbe\u0b9f\u0bcd\u0b9f\u0baa\u0bcd\u0baa\u0b9f\u0b9f\u0bc1\u0bae\u0bcd.',
    "pending.empty": "\u0ba8\u0bbf\u0bb2\u0bc1\u0bb5\u0bc8 \u0baa\u0ba3\u0bbf\u0b95\u0bb3\u0bcd \u0b87\u0bb2\u0bcd\u0bb2\u0bc8.",
    "pending.alertEmpty": "\u0baa\u0ba4\u0bbf\u0bb5\u0bbf\u0bb1\u0b95\u0bcd\u0b95 \u0ba8\u0bbf\u0bb2\u0bc1\u0bb5\u0bc8 \u0baa\u0ba3\u0bbf\u0b95\u0bb3\u0bcd \u0b87\u0bb2\u0bcd\u0bb2\u0bc8.",
    "pending.confirmAll": (n) => `${n} \u0ba8\u0bbf\u0bb2\u0bc1\u0bb5\u0bc8 \u0baa\u0ba3\u0bbf(\u0b95\u0bb3\u0bc1\u0b95\u0bcd\u0b95\u0bbe\u0ba9) \u0b92\u0bb0\u0bc1\u0b99\u0bcd\u0b95\u0bbf\u0ba3\u0bc8\u0baf\u0b99\u0bcd\u0b95 \u0baa\u0b94\u0ba9 PDF-\u0b87\u0baf\u0bc8 \u0baa\u0ba4\u0bbf\u0bb5\u0bbf\u0bb1\u0b95\u0bcd\u0b95\u0bb5\u0bbe?`,
    "pending.alertShareEmpty": "\u0baa\u0b95\u0bbf\u0bb1 \u0ba8\u0bbf\u0bb2\u0bc1\u0bb5\u0bc8 \u0baa\u0ba3\u0bbf\u0b95\u0bb3\u0bcd \u0b87\u0bb2\u0bcd\u0bb2\u0bc8.",
    "completed.title": "\u0bae\u0bc1\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f \u0baa\u0ba3\u0bbf\u0b95\u0bb3\u0bcd",
    "completed.hint": "\u0bae\u0bc1\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f \u0baa\u0ba3\u0bbf\u0b95\u0bb3\u0bcd \u2014 PDF \u0baa\u0ba4\u0bbf\u0bb5\u0bbf\u0bb1\u0b95\u0bcd\u0b95 \u0bb5\u0bbf\u0bb1\u0baa\u0bcd\u0baa\u0baa\u0bcd.",
    "completed.empty": "\u0b87\u0ba8\u0bcd\u0ba4\u0bc1\u0b99\u0bcd\u0b95\u0bc1\u0bae\u0bcd \u0bae\u0bc1\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f \u0baa\u0ba3\u0bbf\u0b95\u0bb3\u0bcd \u0b87\u0bb2\u0bcd\u0bb2\u0bc8.",
    "completed.alertEmpty": "\u0baa\u0ba4\u0bbf\u0bb5\u0bbf\u0bb1\u0b95\u0bcd\u0b95 \u0bae\u0bc1\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f \u0baa\u0ba3\u0bbf\u0b95\u0bb3\u0bcd \u0b87\u0bb2\u0bcd\u0bb2\u0bc8.",
    "completed.confirmAll": (n) => `${n} \u0bae\u0bc1\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f \u0baa\u0ba3\u0bbf(\u0b95\u0bb3\u0bc1\u0b95\u0bcd\u0b95\u0bbe\u0ba9) \u0b92\u0bb0\u0bc1\u0b99\u0bcd\u0b95\u0bbf\u0ba3\u0bc8\u0baf\u0b99\u0bcd\u0b99 \u0baa\u0b94\u0ba9 PDF-\u0b87\u0baf\u0bc8 \u0baa\u0ba4\u0bbf\u0bb5\u0bbf\u0bb1\u0b95\u0bcd\u0b95\u0bb5\u0bbe?`,
    "completed.alertShareEmpty": "\u0baa\u0b95\u0bbf\u0bb1 \u0bae\u0bc1\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f \u0baa\u0ba3\u0bbf\u0b95\u0bb3\u0bcd \u0b87\u0bb2\u0bcd\u0bb2\u0bc8.",
    "card.address": "\u0bae\u0bc1\u0b95\u0bb5\u0bb0\u0bbf:",
    "card.city": "\u0ba8\u0b95\u0bb0\u0bae\u0bcd:",
    "card.location": "\u0b87\u0b9f\u0bae\u0bcd:",
    "card.complaint": "\u0baa\u0bc1\u0b95\u0bbe\u0bb0\u0bcd:",
    "card.added": "\u0b9a\u0bc7\u0bb0\u0bcd\u0b95\u0bcd\u0b95\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f\u0ba4\u0bc1",
    "card.started": "\u0ba4\u0bca\u0b9f\u0b99\u0bcd\u0b95\u0bbf\u0baf\u0ba4\u0bc1",
    "card.completedAt": "\u0bae\u0bc1\u0b9f\u0bbf\u0ba8\u0bcd\u0ba4\u0ba4\u0bc1",
    "card.overdue": "1 \u0ba8\u0bbe\u0bb3\u0bc8\u0b95\u0bcd\u0b95\u0bc1 \u0bae\u0bc7\u0bb2\u0bcd\u0baa\u0b9f \u0ba4\u0bbe\u0bae\u0ba4\u0bae\u0bcd",
    "card.status.pending": "\u0ba8\u0bbf\u0bb2\u0bc8: \u0ba8\u0bbf\u0bb2\u0bc1\u0bb5\u0bc8",
    "card.status.complete": "\u0ba8\u0bbf\u0bb2\u0bc8: \u0bae\u0bc1\u0b9f\u0bbf\u0ba8\u0bcd\u0ba4\u0ba4\u0bc1",
    "card.deleteAdminOnly": "\u0ba8\u0bbf\u0bb2\u0bc1\u0bb5\u0bc8 \u0baa\u0ba3\u0bbf\u0b95\u0bb3\u0bc8 \u0ba8\u0bc0\u0b95\u0bcd\u0b95 \u0ba8\u0bbf\u0bb0\u0bcd\u0bb5\u0bbe\u0b95\u0bbf \u0bae\u0b9f\u0bcd\u0b9f\u0bc1\u0bae\u0bcd \u0b85\u0ba9\u0bc1\u0bae\u0bbf\u0bb5\u0bbf.",
    "card.deleteCompletedAdminOnly": "\u0bae\u0bc1\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f \u0baa\u0ba3\u0bbf \u0baa\u0b9a\u0bbf\u0bb5\u0bc8 \u0ba8\u0bc0\u0b95\u0bcd\u0b95 \u0ba8\u0bbf\u0bb0\u0bcd\u0bb5\u0bbe\u0b95\u0bbf \u0bae\u0b9f\u0bcd\u0b9f\u0bc1\u0bae\u0bcd \u0b85\u0ba9\u0bc1\u0bae\u0bbf\u0bb5\u0bbf.",
    "card.deleteConfirm": "\u0b87\u0ba8\u0bcd\u0ba4 \u0ba8\u0bbf\u0bb2\u0bc1\u0bb5\u0bc8 \u0baa\u0ba3\u0bbf\u0b95\u0bb3\u0b99\u0bcd\u0b95\u0bc8 \u0ba8\u0bc0\u0b95\u0bcd\u0b95\u0bb5\u0bbe?",
    "card.deleteCompletedConfirm": "\u0b87\u0ba8\u0bcd\u0ba4 \u0bae\u0bc1\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f \u0baa\u0ba3\u0bbf \u0baa\u0b9a\u0bbf\u0bb5\u0bc8 \u0ba8\u0bc0\u0b95\u0bcd\u0b95\u0bb5\u0bbe?",
    "share.header": (status) => `\u0b87\u0ba8\u0bcd\u0ba4\u0bbf\u0baf\u0ba9\u0bcd \u0b8f\u0b9a\u0bbf \u0bb5\u0bbf\u0bb1\u0bcd\u0baa\u0ba9\u0bc8 & \u0b9a\u0bc7\u0bb5\u0bc8 - ${status} \u0baa\u0ba3\u0bbf`,
    "share.divider": "----------------------------------------",
    "share.customer": "\u0bb5\u0bbe\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0bc8\u0baf\u0bbe\u0bb3\u0bb0\u0bcd:",
    "share.phone": "\u0ba4\u0bca\u0bb2\u0bc8\u0baa\u0bc7\u0b9a\u0bbf:",
    "share.address": "\u0bae\u0bc1\u0b95\u0bb5\u0bb0\u0bbf:",
    "share.city": "\u0ba8\u0b95\u0bb0\u0bae\u0bcd:",
    "share.location": "\u0b87\u0b9f\u0bae\u0bcd:",
    "share.complaint": "\u0baa\u0bc1\u0b95\u0bbe\u0bb0\u0bcd:",
    "share.date": "\u0ba4\u0bc7\u0bb5\u0bbf:",
    "share.recorded": "\u0baa\u0ba4\u0bbf\u0bb5\u0bc1 \u0b9a\u0bc6\u0baf\u0bcd\u0baa\u0b9f\u0bcd\u0b9f\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f\u0ba4\u0bc1:",
    "share.completedAt": "\u0bae\u0bc1\u0b9f\u0bbf\u0ba8\u0bcd\u0ba4\u0ba4\u0bc1:",
    "share.statusPending": "\u0ba8\u0bbf\u0bb2\u0bc1\u0bb5\u0bc8",
    "share.statusCompleted": "\u0bae\u0bc1\u0b9f\u0bbf\u0ba8\u0bcd\u0ba4\u0ba4\u0bc1",
    "share.footer": "IACSS \u0b9a\u0bc7\u0baf\u0bb2\u0bbf \u0bb5\u0bb4\u0bbf\u0baf\u0bbe\u0b95 \u0baa\u0b95\u0bbf\u0bb1\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f\u0ba4\u0bc1",
    "share.sectionPending": (n) => `\u0ba8\u0bbf\u0bb2\u0bc1\u0bb5\u0bc8 \u0baa\u0ba3\u0bbf\u0b95\u0bb3\u0bcd (${n})`,
    "share.sectionCompleted": (n) => `\u0bae\u0bc1\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f \u0baa\u0ba3\u0bbf\u0b95\u0bb3\u0bcd (${n})`,
    "share.fullReportHead": (date) => `\u0b87\u0ba8\u0bcd\u0ba4\u0bbf\u0baf\u0ba9\u0bcd \u0b8f\u0b9a\u0bbf \u0bb5\u0bbf\u0bb1\u0bcd\u0baa\u0ba9\u0bc8 & \u0b9a\u0bc7\u0bb5\u0bc8 \u2014 \u0bae\u0bcd\u0b9a\u0bc1 \u0baa\u0ba3\u0bbf \u0b85\u0bb1\u0bbf\u0b95\u0bcd\u0b95\u0bc8\n\u0ba4\u0bc7\u0bb5\u0bbf: ${date}`,
    "share.noPending": "\u0ba8\u0bbf\u0bb2\u0bc1\u0bb5\u0bc8 \u0baa\u0ba3\u0bbf\u0b95\u0bb3\u0bcd \u0b87\u0bb2\u0bcd\u0bb2\u0bc8.",
    "share.noCompleted": "\u0bae\u0bc1\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f \u0baa\u0ba3\u0bbf\u0b95\u0bb3\u0bcd \u0b87\u0bb2\u0bcd\u0bb2\u0bc8.",
    "pdf.pending": "\u0ba8\u0bbf\u0bb2\u0bc1\u0bb5\u0bc8 \u0baa\u0ba3\u0bbf \u0baa\u0b9a\u0bbf\u0bb5\u0bc8",
    "pdf.completed": "\u0bae\u0bc1\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f \u0baa\u0ba3\u0bbf \u0baa\u0b9a\u0bbf\u0bb5\u0bc8",
    "pdf.generic": "\u0bb5\u0bbe\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0bc8\u0baf\u0bbe\u0bb3\u0bb0\u0bcd \u0baa\u0bc1\u0b95\u0bbe\u0bb0\u0bcd \u0baa\u0b9a\u0bbf\u0bb5\u0bc8",
    "pdf.fullReportTitle": "\u0bae\u0bcd\u0b9a\u0bc1 \u0baa\u0ba3\u0bbf \u0b85\u0bb1\u0bbf\u0b95\u0bcd\u0b95\u0bc8",
    "pdf.fullReportSubtitle": (p, c, d) => `\u0ba8\u0bbf\u0bb2\u0bc1\u0bb5\u0bc8: ${p}  |  \u0bae\u0bc1\u0b9f\u0bbf\u0ba8\u0bcd\u0ba4\u0ba4\u0bc1: ${c}  |  \u0b89\u0bb0\u0bc1\u0bb5\u0bbe\u0b95\u0bae\u0bcd\u0baa\u0b9f\u0bcd\u0b9f\u0ba4\u0bc1: ${d}`,
    "pdf.fullReportSub": "\u0bae\u0bcd\u0b9a\u0bc1 \u0baa\u0ba3\u0bbf \u0b85\u0bb1\u0bbf\u0b95\u0bcd\u0b95\u0bc8",
    "pdf.generated": "\u0b89\u0bb0\u0bc1\u0bb5\u0bbe\u0b95\u0bae\u0bcd\u0baa\u0b9f\u0bcd\u0b9f\u0ba4\u0bc1:",
    "pdf.summaryPending": "\u0ba8\u0bbf\u0bb2\u0bc1\u0bb5\u0bc8 \u0baa\u0ba3\u0bbf\u0b95\u0bb3\u0bcd",
    "pdf.summaryCompleted": "\u0bae\u0bc1\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f \u0baa\u0ba3\u0bbf\u0b95\u0bb3\u0bcd",
    "pdf.totalRecords": (n, d) => `\u0bae\u0bca\u0ba4\u0bcd\u0ba4 \u0baa\u0ba4\u0bbf\u0bb5\u0bc1\u0b95\u0bb3\u0bcd: ${n}  |  ${d}`,
    "pdf.index": "\u0baa\u0b9f\u0bcd\u0b9f\u0baf\u0bb2\u0bcd",
    "pdf.thankyou": "\u0b87\u0ba8\u0bcd\u0ba4\u0bbf\u0baf\u0ba9\u0bcd \u0b8f\u0b9a\u0bbf \u0bb5\u0bbf\u0bb1\u0bcd\u0baa\u0ba9\u0bc8 & \u0b9a\u0bc7\u0bb5\u0bc8\u0baf\u0bc8 \u0ba4\u0bc7\u0bb0\u0bcd\u0bb5\u0bc1 \u0b9a\u0bc6\u0baf\u0bcd\u0ba4\u0ba4\u0bc1\u0b95\u0bcd\u0b95\u0bc1 \u0ba8\u0ba9\u0bcd\u0bb1\u0bbf",
    "pdf.fields.customerName": "\u0bb5\u0bbe\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0bc8\u0baf\u0bbe\u0bb3\u0bb0\u0bcd \u0baa\u0bc6\u0baf\u0bb0\u0bc1",
    "pdf.fields.customerPhone": "\u0b8e\u0ba3\u0bcd \u0b8e\u0ba3\u0bcd",
    "pdf.fields.address": "\u0bae\u0bc1\u0b95\u0bb5\u0bb0\u0bbf",
    "pdf.fields.city": "\u0ba8\u0b95\u0bb0\u0bae\u0bcd",
    "pdf.fields.location": "\u0b87\u0b9f\u0bae\u0bcd",
    "pdf.fields.complaint": "\u0baa\u0bc1\u0b95\u0bbe\u0bb0\u0bcd",
    "pdf.fields.date": "\u0ba4\u0bc7\u0bb5\u0bbf",
    "pdf.fields.status": "\u0ba8\u0bbf\u0bb2\u0bc8",
    "pdf.fields.createdAt": "\u0baa\u0ba4\u0bbf\u0bb5\u0bc1 \u0b9a\u0bc6\u0baf\u0bcd\u0baa\u0b9f\u0bcd\u0b9f \u0ba4\u0bc7\u0bb5\u0bbf",
    "pdf.fields.completedAt": "\u0bb5\u0bc7\u0bb2\u0bc8 \u0bae\u0bc1\u0b9f\u0bbf\u0ba8\u0bcd\u0ba4\u0ba4\u0bc1",
    "pdf.header": "#",
    "pdf.statusPending": "\u0ba8\u0bbf\u0bb2\u0bc8: \u0ba8\u0bbf\u0bb2\u0bc1\u0bb5\u0bc8",
    "pdf.statusCompleted": "\u0ba8\u0bbf\u0bb2\u0bc8: \u0bae\u0bc1\u0b9f\u0bbf\u0ba8\u0bcd\u0ba4\u0ba4\u0bc1",
    "alert.noDataExport": "\u0b8f\u0bb1\u0bcd\u0ba4\u0bc1\u0bae\u0ba4\u0bcd\u0ba4\u0bbf \u0b9a\u0bc6\u0baf\u0bcd \u0ba4\u0bb0\u0bb5\u0bc1 \u0b87\u0bb2\u0bcd\u0bb2\u0bc8.",
    "lang.toggle": "\u0ba4\u0bae\u0bbf\u0bb4\u0bcd | EN",
    "lang.toggleAria": "\u0bae\u0bca\u0bb4\u0bbf\u0baf\u0bc8 \u0bae\u0bbe\u0bb1\u0bcd\u0b95\u0bc1",
  },
};

function t(key, ...args) {
  const dict = I18N[currentLang] || I18N.en;
  const v = dict[key];
  if (v == null) {
    const fallback = I18N.en[key];
    return typeof fallback === "function" ? fallback(...args) : (fallback != null ? fallback : key);
  }
  return typeof v === "function" ? v(...args) : v;
}

function applyTranslations() {
  document.documentElement.lang = currentLang === "ta" ? "ta" : "en";
  document.querySelectorAll("[data-i18n]").forEach((el) => { const k = el.dataset.i18n; if (k) el.textContent = t(k); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { const k = el.dataset.i18nPlaceholder; if (k) el.placeholder = t(k); });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => { const k = el.dataset.i18nTitle; if (k) el.title = t(k); });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => { const k = el.dataset.i18nAria; if (k) el.setAttribute("aria-label", t(k)); });
  const toggle = document.getElementById("langSwitcher");
  if (toggle) {
    const langText = toggle.querySelector(".lang-text");
    const label = currentLang === "ta" ? "EN" : "\u0ba4\u0bae\u0bbf\u0bb4\u0bcd";
    if (langText) langText.textContent = label;
    toggle.setAttribute("aria-label", t("lang.toggleAria"));
    toggle.title = t("lang.toggleAria");
  }
  const titleEl = document.querySelector("title");
  if (titleEl && titleEl.dataset.i18nTitle) titleEl.textContent = t(titleEl.dataset.i18nTitle);
  document.body.classList.toggle("lang-ta", currentLang === "ta");
  document.body.classList.toggle("lang-en", currentLang === "en");
  if (typeof renderLists === "function") { try { renderLists(); } catch (e) {} }
  if (typeof renderLoginHistory === "function") { try { renderLoginHistory(); } catch (e) {} }
}

function setLanguage(lang) {
  if (lang !== "en" && lang !== "ta") return;
  currentLang = lang;
  try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
  applyTranslations();
}

function toggleLanguage() { setLanguage(currentLang === "ta" ? "en" : "ta"); }

function setupLanguageToggle() {
  const btn = document.getElementById("langSwitcher");
  if (btn) { btn.addEventListener("click", (e) => { e.preventDefault(); toggleLanguage(); }); }
}

// ============================================
// Page Init
// ============================================
function initWelcomePage() {
  renderStats();
  const downloadBtn = document.getElementById("downloadFullReport");
  if (downloadBtn) downloadBtn.addEventListener("click", generateFullReportPDF);
  const shareBtn = document.getElementById("shareFullReportWa");
  if (shareBtn) shareBtn.addEventListener("click", shareFullReportViaWhatsApp);
  const searchBtn = document.getElementById("searchBtn");
  const searchInput = document.getElementById("searchPhone");
  if (searchBtn && searchInput) {
    searchBtn.addEventListener("click", () => { renderSearchResults(searchByPhone(searchInput.value)); });
    searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") renderSearchResults(searchByPhone(searchInput.value)); });
  }
}

function initComplaintPage() {
  const dateInput = document.getElementById("date");
  if (dateInput) { dateInput.value = new Date().toISOString().split("T")[0]; dateInput.max = dateInput.value; }
  const complaintForm = document.getElementById("complaintForm");
  if (!complaintForm) return;
  complaintForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const record = {
      id: Date.now(),
      customerName: document.getElementById("customerName").value.trim(),
      customerPhone: document.getElementById("customerPhone").value.trim(),
      address: document.getElementById("address").value.trim(),
      city: document.getElementById("city").value,
      location: document.getElementById("location").value.trim() || "\u2014",
      complaint: document.getElementById("complaint").value.trim(),
      date: document.getElementById("date").value,
      status: document.getElementById("status").value,
      createdAt: new Date().toLocaleString("en-IN"),
      startedAt: null,
      completedAt: null,
    };
    if (!record.customerName || !record.customerPhone || !record.address || !record.city || !record.complaint || !record.date) {
      alert(t("complaint.errRequired"));
      return;
    }
    if (record.status === "Pending") {
      record.startedAt = new Date().toLocaleString("en-IN");
      await savePending(getPending().concat([record]));
    } else {
      record.startedAt = record.startedAt || new Date().toLocaleString("en-IN");
      record.completedAt = new Date().toLocaleString("en-IN");
      await saveCompleted(getCompleted().concat([record]));
    }
    event.target.reset();
    if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];
    const details = `${t("complaint.savedOk")}\n\n` +
      `${t("complaint.customerName")}: ${record.customerName}\n` +
      `${t("complaint.customerPhone")}: ${record.customerPhone}\n` +
      `${t("complaint.city")}: ${record.city}\n` +
      `${t("complaint.status")}: ${record.status === "Pending" ? t("complaint.status.pendingOpt") : t("complaint.status.completeOpt")}`;
    alert(details);
    window.location.href = record.status === "Pending" ? "pending.html" : "completed.html";
  });
}

function initPendingPage() {
  renderPending();
  setupToolbar();
  const downloadAllPending = document.getElementById("downloadAllPending");
  const shareAllPendingWa = document.getElementById("shareAllPendingWa");
  if (downloadAllPending) {
    downloadAllPending.addEventListener("click", () => {
      const list = getPending();
      if (list.length === 0) return alert(t("pending.alertEmpty"));
      if (!confirm(t("pending.confirmAll", list.length))) return;
      generateCombinedPDF(list, "Pending_Works");
    });
  }
  if (shareAllPendingWa) {
    shareAllPendingWa.addEventListener("click", () => {
      const list = getPending();
      if (list.length === 0) return alert(t("pending.alertShareEmpty"));
      shareAllViaWhatsApp(list, "pending");
    });
  }
}

function initCompletedPage() {
  renderCompleted();
  setupToolbar();
  const downloadAllCompleted = document.getElementById("downloadAllCompleted");
  const shareAllCompletedWa = document.getElementById("shareAllCompletedWa");
  if (downloadAllCompleted) {
    downloadAllCompleted.addEventListener("click", () => {
      const list = getCompleted();
      if (list.length === 0) return alert(t("completed.alertEmpty"));
      if (!confirm(t("completed.confirmAll", list.length))) return;
      generateCombinedPDF(list, "Completed_Works");
    });
  }
  if (shareAllCompletedWa) {
    shareAllCompletedWa.addEventListener("click", () => {
      const list = getCompleted();
      if (list.length === 0) return alert(t("completed.alertShareEmpty"));
      shareAllViaWhatsApp(list, "completed");
    });
  }
}

// ============================================
// Data Layer
// ============================================
const PENDING_KEY = "iacss_pending_v3";
const COMPLETED_KEY = "iacss_completed_v3";
let pendingCache = [];
let completedCache = [];

function getPending() { return Array.isArray(pendingCache) ? pendingCache : []; }
function savePending(list) {
  pendingCache = Array.isArray(list) ? list : [];
  return saveEncrypted(PENDING_KEY, pendingCache).catch(() => {}).then(() => syncToServer().catch(() => {}));
}
function getCompleted() { return Array.isArray(completedCache) ? completedCache : []; }
function saveCompleted(list) {
  completedCache = Array.isArray(list) ? list : [];
  return saveEncrypted(COMPLETED_KEY, completedCache).catch(() => {}).then(() => syncToServer().catch(() => {}));
}

// ============================================
// Search
// ============================================
function searchByPhone(query) {
  const q = query.trim().replace(/\s+/g, "");
  if (!q) return [];
  const pending = getPending().filter(c => (c.customerPhone || "").replace(/\s+/g, "").includes(q));
  const completed = getCompleted().filter(c => (c.customerPhone || "").replace(/\s+/g, "").includes(q));
  return [
    ...pending.map(c => ({ ...c, _source: "pending" })),
    ...completed.map(c => ({ ...c, _source: "completed" }))
  ];
}

function renderSearchResults(results) {
  const container = document.getElementById("searchResults");
  if (!container) return;
  if (results.length === 0) { container.innerHTML = `<p class="empty-msg">${escapeHtml(t("welcome.searchEmpty"))}</p>`; return; }
  container.innerHTML = results.map(c => {
    const statusClass = c._source === "completed" ? "completed" : "pending";
    const statusLabel = c._source === "completed" ? t("welcome.sourceCompleted") : t("welcome.sourcePending");
    return `<div class="complaint-card ${statusClass}">
      <div>
        <h3>${escapeHtml(c.customerName)} <span>(${escapeHtml(c.customerPhone)})</span>
          <span class="search-source-badge" style="background:${c._source === 'completed' ? '#43a047' : '#ff9800'};color:#fff;font-size:.7rem;padding:2px 8px;border-radius:10px;margin-left:6px;">${escapeHtml(statusLabel)}</span>
        </h3>
        <p><strong>${escapeHtml(t("card.address"))}</strong> ${escapeHtml(c.address)}</p>
        <p><strong>${escapeHtml(t("card.city"))}</strong> ${escapeHtml(c.city || "\u2014")}
           &nbsp;<strong>${escapeHtml(t("card.location"))}</strong> ${escapeHtml(c.location)}</p>
        <p><strong>${escapeHtml(t("card.complaint"))}</strong> ${escapeHtml(c.complaint)}</p>
        <p class="meta">${escapeHtml(c.date)} &bull; ${escapeHtml(c.createdAt || "")}</p>
      </div>
    </div>`;
  }).join("");
}

// ============================================
// Cloud Sync — Bidirectional with Delete
// ============================================
function mergeById(local, cloud) {
  const map = new Map();
  local.forEach(item => map.set(item.id, item));
  cloud.forEach(item => {
    const existing = map.get(item.id);
    if (!existing || item.id > existing.id) map.set(item.id, item);
  });
  return Array.from(map.values());
}

async function hydrateFromServer() {
  try {
    var [pRes, cRes] = await Promise.all([
      fetch('/api/complaints/pending').then(function(r){return r.json();}),
      fetch('/api/complaints/completed').then(function(r){return r.json();})
    ]);
    if (pRes && pRes.success && Array.isArray(pRes.data)) {
      pendingCache = mergeById(pendingCache, pRes.data);
      await saveEncrypted(PENDING_KEY, pendingCache).catch(function(){});
    }
    if (cRes && cRes.success && Array.isArray(cRes.data)) {
      completedCache = mergeById(completedCache, cRes.data);
      await saveEncrypted(COMPLETED_KEY, completedCache).catch(function(){});
    }
  } catch (e) { console.warn("Server hydration failed:", e); }
}

async function syncToServer() {
  try {
    var [pRes, cRes] = await Promise.all([
      fetch('/api/complaints/pending').then(function(r){return r.json();}),
      fetch('/api/complaints/completed').then(function(r){return r.json();})
    ]);
    var serverPending = (pRes && pRes.success && pRes.data) || [];
    var serverCompleted = (cRes && cRes.success && cRes.data) || [];
    var serverPendingIds = new Set(serverPending.map(function(c){return c.id;}));
    var serverCompletedIds = new Set(serverCompleted.map(function(c){return c.id;}));
    pendingCache.forEach(function(c){
      if (serverPendingIds.has(c.id)) {
        fetch('/api/complaints/pending/'+c.id, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({data:c})}).catch(function(){});
      } else {
        fetch('/api/complaints/pending', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({data:c})}).catch(function(){});
      }
    });
    serverPending.forEach(function(c){
      if (!pendingCache.find(function(l){return l.id===c.id;})) {
        fetch('/api/complaints/pending/'+c.id, {method:'DELETE'}).catch(function(){});
      }
    });
    completedCache.forEach(function(c){
      if (serverCompletedIds.has(c.id)) {
        fetch('/api/complaints/completed/'+c.id, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({data:c})}).catch(function(){});
      } else {
        fetch('/api/complaints/completed', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({data:c})}).catch(function(){});
      }
    });
    serverCompleted.forEach(function(c){
      if (!completedCache.find(function(l){return l.id===c.id;})) {
        fetch('/api/complaints/completed/'+c.id, {method:'DELETE'}).catch(function(){});
      }
    });
  } catch (e) { console.warn("Server sync failed:", e); }
}

// ============================================
// Overdue
// ============================================
function isOverdue(record) {
  if (!record.date) return false;
  const diffDays = (Date.now() - new Date(record.date).getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > 1;
}

// ============================================
// Dashboard Stats
// ============================================
function renderStats() {
  const pending = getPending();
  const completed = getCompleted();
  const overdue = pending.filter(c => isOverdue(c)).length;
  const total = pending.length + completed.length;
  const el = (id) => document.getElementById(id);
  if (el("statPending")) el("statPending").textContent = pending.length;
  if (el("statCompleted")) el("statCompleted").textContent = completed.length;
  if (el("statOverdue")) el("statOverdue").textContent = overdue;
  if (el("statTotal")) el("statTotal").textContent = total;
  const badgeP = el("badgePending");
  if (badgeP) { badgeP.textContent = pending.length > 0 ? pending.length : ""; badgeP.style.display = pending.length > 0 ? "" : "none"; }
  const badgeC = el("badgeCompleted");
  if (badgeC) { badgeC.textContent = completed.length > 0 ? completed.length : ""; badgeC.style.display = completed.length > 0 ? "" : "none"; }
}

// ============================================
// Sort & Filter
// ============================================
function filterAndSortList(list) {
  let result = [...list];
  const fromEl = document.getElementById("dateFrom");
  const toEl = document.getElementById("dateTo");
  if (fromEl && toEl) {
    const from = fromEl.value, to = toEl.value;
    if (from || to) {
      result = result.filter(c => { if (!c.date) return false; if (from && c.date < from) return false; if (to && c.date > to) return false; return true; });
    }
  }
  const sortEl = document.getElementById("sortSelect");
  const sortVal = sortEl ? sortEl.value : "date-desc";
  result.sort((a, b) => {
    switch (sortVal) {
      case "date-asc": return (a.date || "").localeCompare(b.date || "");
      case "name-asc": return (a.customerName || "").localeCompare(b.customerName || "");
      case "name-desc": return (b.customerName || "").localeCompare(a.customerName || "");
      case "date-desc": default: return (b.date || "").localeCompare(a.date || "");
    }
  });
  return result;
}

function setupToolbar() {
  const sortEl = document.getElementById("sortSelect");
  const dateFrom = document.getElementById("dateFrom");
  const dateTo = document.getElementById("dateTo");
  const printBtn = document.getElementById("printPage");
  if (sortEl) sortEl.addEventListener("change", renderLists);
  if (dateFrom) dateFrom.addEventListener("change", renderLists);
  if (dateTo) dateTo.addEventListener("change", renderLists);
  if (printBtn) printBtn.addEventListener("click", () => window.print());
}

// ============================================
// Render Lists
// ============================================
function renderLists() { renderPending(); renderCompleted(); }

function renderPending() {
  const container = document.getElementById("pendingList");
  if (!container) return;
  let list = getPending();
  if (list.length === 0) { container.innerHTML = `<p class="empty-msg">${escapeHtml(t("pending.empty"))}</p>`; return; }
  list = filterAndSortList(list);
  container.innerHTML = list.map(c => {
    const overdue = isOverdue(c);
    const cardClass = overdue ? "complaint-card overdue" : "complaint-card pending";
    const adminDelete = isAdmin() ? `<button class="btn btn-delete" onclick="deletePending(${c.id})">${escapeHtml(t("common.delete"))}</button>` : "";
    return `<div class="${cardClass}" data-id="${c.id}">
      ${cardBody(c, overdue)}
      <div class="actions">
        <button class="btn btn-resolve" onclick="movePendingToCompleted(${c.id})">${escapeHtml(t("common.markComplete"))}</button>
        <button class="btn btn-pdf" onclick="generatePDFById(${c.id}, 'pending')">${escapeHtml(t("common.downloadPdf"))}</button>
        <button class="btn btn-share-wa" onclick="shareViaWhatsApp(getPending().find(x=>x.id===${c.id}), 'pending')">${escapeHtml(t("common.shareWa"))}</button>
        ${adminDelete}
      </div>
    </div>`;
  }).join("");
}

function renderCompleted() {
  const container = document.getElementById("completedList");
  if (!container) return;
  let list = getCompleted();
  if (list.length === 0) { container.innerHTML = `<p class="empty-msg">${escapeHtml(t("completed.empty"))}</p>`; return; }
  list = filterAndSortList(list);
  container.innerHTML = list.map(c => {
    const adminDeleteC = isAdmin() ? `<button class="btn btn-delete" onclick="deleteCompleted(${c.id})">${escapeHtml(t("common.delete"))}</button>` : "";
    return `<div class="complaint-card completed" data-id="${c.id}">
      ${cardBody(c)}
      <div class="actions">
        <button class="btn btn-pdf" onclick="generatePDFById(${c.id}, 'completed')">${escapeHtml(t("common.downloadPdf"))}</button>
        <button class="btn btn-share-wa" onclick="shareViaWhatsApp(getCompleted().find(x=>x.id===${c.id}), 'completed')">${escapeHtml(t("common.shareWa"))}</button>
        ${adminDeleteC}
      </div>
    </div>`;
  }).join("");
}

function cardBody(c, overdue = false) {
  return `<div>
    <h3>${escapeHtml(c.customerName)} <span>(${escapeHtml(c.customerPhone)})</span>
      ${overdue ? `<span class="overdue-badge">${escapeHtml(t("card.overdue"))}</span>` : ""}
    </h3>
    <p><strong>${escapeHtml(t("card.address"))}</strong> ${escapeHtml(c.address)}</p>
    <p><strong>${escapeHtml(t("card.city"))}</strong> ${escapeHtml(c.city || "\u2014")}
       &nbsp;<strong>${escapeHtml(t("card.location"))}</strong> ${escapeHtml(c.location)}</p>
    <p><strong>${escapeHtml(t("card.complaint"))}</strong> ${escapeHtml(c.complaint)}</p>
    <p class="meta">
      ${escapeHtml(c.date)} &bull; ${escapeHtml(t("card.added"))} ${escapeHtml(c.createdAt)}
      ${c.startedAt ? ` &bull; ${escapeHtml(t("card.started"))} ${escapeHtml(c.startedAt)}` : ""}
      ${c.completedAt ? ` &bull; ${escapeHtml(t("card.completedAt"))} ${escapeHtml(c.completedAt)}` : ""}
    </p>
  </div>`;
}

// ============================================
// Movement & Delete Actions
// ============================================
function movePendingToCompleted(id) {
  const list = getPending();
  const idx = list.findIndex(c => c.id === id);
  if (idx === -1) return;
  const rec = list[idx];
  rec.status = "Complete";
  rec.completedAt = new Date().toLocaleString("en-IN");
  saveCompleted(getCompleted().concat([rec]));
  list.splice(idx, 1);
  savePending(list);
  renderLists();
}

function deletePending(id) {
  if (!isAdmin()) { alert(t("card.deleteAdminOnly")); return; }
  if (!confirm(t("card.deleteConfirm"))) return;
  savePending(getPending().filter(c => c.id !== id));
  renderLists();
}

function deleteCompleted(id) {
  if (!isAdmin()) { alert(t("card.deleteCompletedAdminOnly")); return; }
  if (!confirm(t("card.deleteCompletedConfirm"))) return;
  saveCompleted(getCompleted().filter(c => c.id !== id));
  renderLists();
}

// ============================================
// PDF Generation
// ============================================
function generatePDFById(id, source) {
  let record;
  if (source === "pending") record = getPending().find(c => c.id === id);
  else if (source === "completed") record = getCompleted().find(c => c.id === id);
  if (!record) return;
  generatePDF(record);
}

function generatePDF(record) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  drawRecordOnDoc(doc, record, true);
  const safeName = (record.customerName || "Customer").replace(/\s+/g, "_");
  doc.save(`${record.status}_${safeName}_${record.date}.pdf`);
}

function drawRecordOnDoc(doc, record, withFooter) {
  addWatermark(doc);
  doc.setFillColor(13, 71, 161);
  doc.rect(0, 0, 210, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Indian A/C Sales and Services", 105, 12, { align: "center" });
  addHeaderLogo(doc);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 220, 255);
  const dateOnly = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  doc.text(`${record.city || ""}  |  ${dateOnly}`, 26, 20);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  const titleByStatus = { Pending: t("pdf.pending"), Complete: t("pdf.completed") };
  doc.text(titleByStatus[record.status] || t("pdf.generic"), 105, 30, { align: "center" });
  doc.setDrawColor(13, 71, 161);
  doc.setLineWidth(0.4);
  doc.line(15, 33, 195, 33);
  let y = 40;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const fields = [
    [t("pdf.fields.customerName"), record.customerName],
    [t("pdf.fields.customerPhone"), record.customerPhone],
    [t("pdf.fields.address"), record.address],
    [t("pdf.fields.city"), record.city || "\u2014"],
    [t("pdf.fields.location"), record.location || "\u2014"],
    [t("pdf.fields.complaint"), record.complaint],
    [t("pdf.fields.date"), record.date],
    [t("pdf.fields.status"), record.status],
    [t("pdf.fields.createdAt"), record.createdAt],
    [t("pdf.fields.completedAt"), record.completedAt || "\u2014"],
  ];
  fields.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 15, y);
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(String(value || "\u2014"), 125);
    doc.text(wrapped, 58, y);
    y += Math.max(5, wrapped.length * 4.5);
  });
  if (withFooter) { doc.setFontSize(8); doc.setTextColor(120, 120, 120); doc.text(t("pdf.thankyou"), 105, 148, { align: "center" }); }
}

function generateCombinedPDF(records, titleSuffix) {
  if (!records || records.length === 0) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  addWatermark(doc);
  doc.setFillColor(13, 71, 161);
  doc.rect(0, 0, 210, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Indian A/C Sales and Services", 105, 12, { align: "center" });
  addHeaderLogo(doc);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(titleSuffix.replace(/_/g, " "), 105, 55, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const dateOnly = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  doc.text(t("pdf.totalRecords", records.length, dateOnly), 105, 70, { align: "center" });
  let y = 95;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(t("pdf.index"), 20, y);
  y += 7;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  records.forEach((c, i) => { if (y > 130) return; doc.text(`${i + 1}. ${c.customerName} \u2014 ${c.city || "\u2014"} \u2014 ${c.date}`, 24, y); y += 5.5; });
  records.forEach(c => { doc.addPage(); drawRecordOnDoc(doc, c, true); });
  doc.save(`${titleSuffix}_${new Date().toISOString().split("T")[0]}.pdf`);
}

// ============================================
// Full Report PDF
// ============================================
function generateFullReportPDF() {
  const pending = getPending(), completed = getCompleted();
  if (pending.length === 0 && completed.length === 0) { alert(t("alert.noDataExport")); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const allRecords = [...pending.map(r => ({ ...r, _type: "Pending" })), ...completed.map(r => ({ ...r, _type: "Completed" }))];
  const COLOR_PENDING = [255, 193, 7], COLOR_COMPLETED = [33, 150, 243];
  const cellsPerPage = 6, cellRows = 3, cellCols = 2;
  const tableX = 10, tableY = 38, gridW = 190, gridH = 240;
  const cellW = gridW / cellCols, cellH = gridH / cellRows;
  const totalPages = Math.ceil(allRecords.length / cellsPerPage);
  for (let pageStart = 0; pageStart < allRecords.length; pageStart += cellsPerPage) {
    if (pageStart > 0) doc.addPage();
    addWatermark(doc);
    doc.setFillColor(13, 71, 161);
    doc.rect(0, 0, 210, 18, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(t("app.title"), 105, 11, { align: "center" });
    addHeaderLogo(doc);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text(t("pdf.fullReportTitle"), 105, 26, { align: "center" });
    const dateOnly = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(t("pdf.fullReportSubtitle", pending.length, completed.length, dateOnly), 105, 33, { align: "center" });
    doc.setTextColor(0, 0, 0);
    const pageRecords = allRecords.slice(pageStart, pageStart + cellsPerPage);
    pageRecords.forEach((rec, idx) => {
      const r = Math.floor(idx / cellCols), c = idx % cellCols;
      const x = tableX + c * cellW, y = tableY + r * cellH;
      const isPending = rec._type === "Pending";
      const cellBg = (r + c) % 2 === 0 ? [252, 252, 252] : [244, 250, 249];
      doc.setFillColor(cellBg[0], cellBg[1], cellBg[2]);
      doc.setDrawColor(13, 71, 161);
      doc.setLineWidth(0.4);
      doc.rect(x, y, cellW, cellH, "FD");
      const cx = x + 4, cw = cellW - 8;
      let cy = y + 7;
      doc.setTextColor(13, 71, 161);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(`#${pageStart + idx + 1}`, cx, cy);
      cy += 5;
      function drawField(label, value) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        const labelText = label + ": ";
        const labelW = doc.getTextWidth(labelText);
        doc.text(labelText, cx, cy);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        const valLines = doc.splitTextToSize(value || "\u2014", cw - labelW);
        doc.text(valLines[0], cx + labelW, cy);
        cy += 4;
      }
      drawField("Customer Name", rec.customerName);
      drawField("Phone No.", rec.customerPhone);
      drawField("Address", rec.address);
      drawField("City", rec.city);
      drawField("Location", rec.location);
      drawField("Complaint", rec.complaint);
      drawField("Date", rec.date);
      drawField("Status", isPending ? t("pdf.statusPending") : t("pdf.statusCompleted"));
      drawField("Recorded On", rec.createdAt);
      drawField("Work Completed", rec.completedAt);
    });
    const pageNum = Math.floor(pageStart / cellsPerPage) + 1;
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.setFont("helvetica", "normal");
    doc.text(`Page ${pageNum} of ${totalPages}`, 105, 292, { align: "center" });
  }
  doc.save(`Full_Work_Report_${new Date().toISOString().split("T")[0]}.pdf`);
}

function shareFullReportViaWhatsApp() {
  const pending = getPending(), completed = getCompleted();
  const dateOnly = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  let text = t("share.fullReportHead", dateOnly) + "\n\n";
  text += t("share.sectionPending", pending.length) + "\n";
  if (pending.length === 0) { text += t("share.noPending") + "\n"; }
  else { pending.forEach((c, i) => { text += `${i + 1}. ${c.customerName} | ${c.customerPhone}\n   ${c.address}${c.city ? ", " + c.city : ""}\n   ${c.complaint}\n   ${t("share.date")} ${c.date}\n\n`; }); }
  text += `\n${t("share.sectionCompleted", completed.length)}\n`;
  if (completed.length === 0) { text += t("share.noCompleted") + "\n"; }
  else { completed.forEach((c, i) => { text += `${i + 1}. ${c.customerName} | ${c.customerPhone}\n   ${c.address}${c.city ? ", " + c.city : ""}\n   ${c.complaint}\n   ${t("share.date")} ${c.date}\n\n`; }); }
  text += "\n" + t("share.footer");
  window.open(`https://wa.me/${SHARE_WHATSAPP}?text=${encodeURIComponent(text)}`, "_blank");
}

// ============================================
// Utilities
// ============================================
async function hashString(str) {
  const enc = new TextEncoder();
  const data = enc.encode(String(str));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const PBKDF2_SALT = "iacss_salt_v1";
const PBKDF2_ITER = 100000;
let ENCRYPTION_KEY = null;

async function deriveKeyFromHash(hexHash) {
  const pwBytes = hexToBytes(hexHash);
  const keyMaterial = await crypto.subtle.importKey("raw", pwBytes, { name: "PBKDF2" }, false, ["deriveKey"]);
  const saltBytes = new TextEncoder().encode(PBKDF2_SALT);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITER, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptJson(obj) {
  if (!ENCRYPTION_KEY) throw new Error("No encryption key");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, ENCRYPTION_KEY, data);
  return JSON.stringify({ v: 1, iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(cipher)) });
}

async function decryptJson(pkgStr) {
  if (!ENCRYPTION_KEY) throw new Error("No encryption key");
  let pkg;
  try { pkg = JSON.parse(pkgStr); } catch (e) { return null; }
  if (!pkg || !pkg.iv || !pkg.data) return null;
  try {
    const iv = base64ToBytes(pkg.iv);
    const cipherBytes = base64ToBytes(pkg.data);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, ENCRYPTION_KEY, cipherBytes);
    return JSON.parse(new TextDecoder().decode(new Uint8Array(plain)));
  } catch (e) { return null; }
}

async function loadAndEncryptIfNeeded(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  const dec = await decryptJson(raw).catch(() => null);
  if (dec != null) return dec;
  try {
    const parsed = JSON.parse(raw);
    await saveEncrypted(key, parsed).catch(() => {});
    return parsed;
  } catch (e) { return []; }
}

async function saveEncrypted(key, obj) {
  try {
    const pkg = await encryptJson(obj);
    localStorage.setItem(key, pkg);
  } catch (e) {
    try { localStorage.setItem(key, JSON.stringify(obj)); } catch (err) {}
  }
}

async function initEncryption() {
  try { ENCRYPTION_KEY = await deriveKeyFromHash("61f271850a70f84ad3056fc7d41ab9d081201ac2340eef64302ffa56201186a6"); }
  catch (e) { ENCRYPTION_KEY = null; }
  try {
    pendingCache = Array.isArray(await loadAndEncryptIfNeeded(PENDING_KEY)) ? await loadAndEncryptIfNeeded(PENDING_KEY) : [];
    completedCache = Array.isArray(await loadAndEncryptIfNeeded(COMPLETED_KEY)) ? await loadAndEncryptIfNeeded(COMPLETED_KEY) : [];
  } catch (e) { pendingCache = []; completedCache = []; }
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// ============================================
// Legacy migration
// ============================================
(function migrate() {
  const oldNew = localStorage.getItem("iacss_complaints_v2");
  if (oldNew) {
    try {
      const items = JSON.parse(oldNew);
      if (Array.isArray(items) && items.length) {
        const pending = getPending();
        items.forEach(c => { c.status = "Pending"; c.startedAt = c.startedAt || new Date().toLocaleString("en-IN"); pending.push(c); });
        savePending(pending);
        localStorage.removeItem("iacss_complaints_v2");
      }
    } catch (e) {}
  }
})();
