
import { auth, db } from "./firebase.js";
import { registerStudent, loginUser, logoutUser, resetPassword, watchAuth } from "./auth.js";
import { renderPrincipal } from "./principal.js";
import { renderTeacher } from "./teacher.js";
import { renderStudent } from "./student.js";
import { renderProfile } from "./reports.js";

const $ = id => document.getElementById(id);
const state = { user: null, profile: null, page: "dashboard", signup: false };

const navConfig = {
  principal: [
    ["dashboard","▦","Dashboard"],["users","♙","Users"],["classes","▤","Classes & Subjects"],
    ["attendance","✓","Attendance"],["tasks","▣","Assignments"],["exams","✎","Exams & Marks"],
    ["notices","◉","Notices"],["fees","＄","Fees"],["reports","▥","Reports & Audit"]
  ],
  teacher: [
    ["dashboard","▦","Dashboard"],["classes","▤","My Classes"],["attendance","✓","Attendance"],
    ["tasks","▣","Assignments"],["exams","✎","Exams & Marks"],["notices","◉","Notices"],
    ["reports","▥","Reports"]
  ],
  student: [
    ["dashboard","▦","Dashboard"],["classes","▤","My Classes"],["attendance","✓","My Attendance"],
    ["tasks","▣","Assignments"],["exams","✎","My Results"],["notices","◉","Notices"],
    ["reports","▥","My Progress"]
  ]
};

function toast(message, error = false) {
  const el = $("toast");
  el.textContent = message;
  el.className = `toast show${error ? " error" : ""}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 3500);
}
export { toast, $, state, db, auth };

function authMessage(id, message, error = false) {
  $(id).textContent = message || "";
  $(id).classList.toggle("error", error);
}
function setSignup(on) {
  state.signup = on;
  $("nameField").classList.toggle("hidden", !on);
  $("loginTab").classList.toggle("active", !on);
  $("signupTab").classList.toggle("active", on);
  $("authTitle").textContent = on ? "Create student account" : "Welcome back";
  $("authSubtitle").textContent = on
    ? "Create your student portal account. Staff accounts are created by the college."
    : "Sign in to continue to your campus workspace.";
  $("authSubmit").textContent = on ? "Create student account" : "Sign in";
  $("forgotPasswordBtn").classList.toggle("hidden", on);
  $("password").autocomplete = on ? "new-password" : "current-password";
  authMessage("authError", "");
  authMessage("authNotice", "");
}

$("currentYear").textContent = new Date().getFullYear();
$("loginTab").addEventListener("click", () => setSignup(false));
$("signupTab").addEventListener("click", () => setSignup(true));

$("authForm").addEventListener("submit", async event => {
  event.preventDefault();
  const submit = $("authSubmit");
  submit.disabled = true;
  authMessage("authError", "");
  authMessage("authNotice", "");
  try {
    if (state.signup) {
      await registerStudent($("fullName").value, $("email").value, $("password").value);
      authMessage("authNotice", "Account created. Loading your student portal…");
    } else {
      await loginUser($("email").value, $("password").value);
      authMessage("authNotice", "Signed in successfully.");
    }
  } catch (error) {
    authMessage("authError", friendlyError(error), true);
  } finally {
    submit.disabled = false;
  }
});

$("forgotPasswordBtn").addEventListener("click", async () => {
  try {
    await resetPassword($("email").value);
    authMessage("authNotice", "If the email is registered, a password reset email will be sent.");
  } catch (error) {
    authMessage("authError", friendlyError(error), true);
  }
});

function friendlyError(error) {
  const code = error?.code || "";
  const messages = {
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/user-not-found": "No account was found for this email.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/email-already-in-use": "An account already exists for this email.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Choose a stronger password with at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "permission-denied": "Permission denied by Firestore security rules."
  };
  return messages[code] || error?.message || "Something went wrong. Please try again.";
}

function renderNav() {
  const items = navConfig[state.profile.role] || [];
  $("sidebarNav").innerHTML = items.map(([id, icon, label]) =>
    `<button type="button" class="nav-btn ${state.page === id ? "active" : ""}" data-page="${id}">
      <span class="nav-icon">${icon}</span><span>${label}</span>
    </button>`
  ).join("");
}

function showShell(user, profile) {
  state.user = user;
  state.profile = profile;
  $("authScreen").classList.add("hidden");
  $("appShell").classList.remove("hidden");
  $("sidebarName").textContent = profile.name || user.email || "Campus User";
  $("sidebarRole").textContent = profile.role;
  $("userAvatar").textContent = (profile.name || user.email || "U").trim().charAt(0).toUpperCase();
  $("topbarEmail").textContent = user.email || "";
  $("sidebarOverlay").classList.remove("open");
  $("sidebar").classList.remove("open");
  renderNav();
  renderPage();
}

function renderPage() {
  if (!state.profile) return;
  const item = (navConfig[state.profile.role] || []).find(x => x[0] === state.page);
  $("pageTitle").textContent = state.page === "profile" ? "My Profile" : (item?.[2] || "Dashboard");
  renderNav();
  const args = { page: state.page, user: state.user, profile: state.profile };
  if (state.page === "profile") renderProfile(args, $("dashboardContent"));
  else if (state.profile.role === "principal") renderPrincipal(args, $("dashboardContent"));
  else if (state.profile.role === "teacher") renderTeacher(args, $("dashboardContent"));
  else renderStudent(args, $("dashboardContent"));
}

$("sidebarNav").addEventListener("click", event => {
  const button = event.target.closest("[data-page]");
  if (!button) return;
  state.page = button.dataset.page;
  $("sidebar").classList.remove("open");
  $("sidebarOverlay").classList.remove("open");
  renderPage();
});
$("profileBtn").addEventListener("click", () => {
  state.page = "profile";
  renderPage();
});
$("menuBtn").addEventListener("click", () => {
  $("sidebar").classList.add("open");
  $("sidebarOverlay").classList.add("open");
});
function closeSidebar() {
  $("sidebar").classList.remove("open");
  $("sidebarOverlay").classList.remove("open");
}
$("sidebarCloseBtn").addEventListener("click", closeSidebar);
$("sidebarOverlay").addEventListener("click", closeSidebar);
$("logoutBtn").addEventListener("click", async () => {
  try {
    await logoutUser();
    state.page = "dashboard";
    toast("Signed out successfully.");
  } catch (error) {
    toast(friendlyError(error), true);
  }
});

watchAuth((user, profile, error) => {
  if (!user) {
    state.user = null;
    state.profile = null;
    $("appShell").classList.add("hidden");
    $("authScreen").classList.remove("hidden");
    if (error) authMessage("authError", error, true);
    return;
  }
  if (error || !profile) {
    $("appShell").classList.add("hidden");
    $("authScreen").classList.remove("hidden");
    authMessage("authError", error || "Profile not configured.", true);
    return;
  }
  showShell(user, profile);
});
