
import { auth, db } from "./firebase.js";
import { loginUser, registerUser, logoutUser, watchAuth } from "./auth.js";
import { renderPrincipal } from "./principal.js";
import { renderTeacher } from "./teacher.js";
import { renderStudent } from "./student.js";

export const $ = id => document.getElementById(id);

export const escapeHTML = value => String(value ?? "").replace(
  /[&<>"']/g,
  c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[c]
);

export function toast(message, error = false) {
  const el = $("toast");
  el.textContent = message;
  el.className = "toast show" + (error ? " error" : "");
  clearTimeout(window.__campusToast);
  window.__campusToast = setTimeout(() => {
    el.className = "toast";
  }, 3500);
}

export const current = { user: null, profile: null };
let signupMode = false;
let page = "dashboard";

function authMode(signup) {
  signupMode = signup;
  $("loginTab").classList.toggle("active", !signup);
  $("signupTab").classList.toggle("active", signup);
  $("nameField").classList.toggle("hidden", !signup);
  $("fullName").required = signup;
  $("password").autocomplete = signup ? "new-password" : "current-password";
  $("authTitle").textContent = signup ? "Create your account" : "Welcome back";
  $("authSubtitle").textContent = signup
    ? "Register as a student."
    : "Sign in to CampusCore.";
  $("authSubmit").textContent = signup ? "Create Student Account" : "Login to CampusCore";
  $("authError").textContent = "";
}

$("loginTab").addEventListener("click", () => authMode(false));
$("signupTab").addEventListener("click", () => authMode(true));

$("authForm").addEventListener("submit", async event => {
  event.preventDefault();
  $("authSubmit").disabled = true;
  $("authError").textContent = "";

  try {
    if (signupMode) {
      await registerUser(
        $("fullName").value,
        $("email").value,
        $("password").value
      );
      toast("Account created. You can now log in.");
      await logoutUser();
      authMode(false);
      $("password").value = "";
    } else {
      await loginUser($("email").value, $("password").value);
      toast("Login successful.");
    }
  } catch (error) {
    $("authError").textContent = error.message || "Authentication failed.";
  } finally {
    $("authSubmit").disabled = false;
  }
});

$("logoutBtn").addEventListener("click", async () => {
  try {
    await logoutUser();
    toast("Signed out.");
  } catch (error) {
    toast(error.message, true);
  }
});

$("menuBtn").addEventListener("click", () => {
  $("sidebar").classList.toggle("open");
});

document.addEventListener("click", event => {
  if (window.innerWidth <= 720 &&
      !$("sidebar").contains(event.target) &&
      !$("menuBtn").contains(event.target)) {
    $("sidebar").classList.remove("open");
  }
});

function navItems(role) {
  if (role === "principal") {
    return [
      ["dashboard", "Overview"],
      ["users", "User Management"],
      ["classes", "Classes & Subjects"],
      ["tasks", "All Tasks"],
      ["attendance", "Attendance"],
      ["reports", "Reports"]
    ];
  }
  if (role === "teacher") {
    return [
      ["dashboard", "Overview"],
      ["classes", "My Classes"],
      ["tasks", "My Tasks"],
      ["attendance", "Lecture Attendance"],
      ["reports", "My Reports"]
    ];
  }
  return [
    ["dashboard", "Overview"],
    ["tasks", "My Assignments"],
    ["attendance", "My Attendance"],
    ["reports", "My Progress"]
  ];
}

export async function openPage(nextPage) {
  page = nextPage;
  $("pageTitle").textContent =
    navItems(current.profile.role).find(item => item[0] === page)?.[1]
    || "Dashboard";

  $("sidebarNav").querySelectorAll("button").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  $("sidebar").classList.remove("open");
  const root = $("dashboardContent");
  root.innerHTML = '<div class="loading-state">Loading...</div>';

  try {
    const role = current.profile.role;

    if (role === "principal") {
      await renderPrincipal(page, root, current);
    } else if (role === "teacher") {
      await renderTeacher(page, root, current);
    } else {
      await renderStudent(page, root, current);
    }
  } catch (error) {
    root.innerHTML = `<div class="panel">Could not load this page. Please check your permissions and connection.</div>`;
    console.error(error);
  }
}

function showPortal(user, profile) {
  current.user = user;
  current.profile = profile;

  $("authScreen").classList.add("hidden");
  $("appShell").classList.remove("hidden");
  $("sidebarName").textContent = profile.name || user.email;
  $("sidebarRole").textContent = profile.role.toUpperCase();
  $("userAvatar").textContent = (profile.name || user.email)[0].toUpperCase();
  $("topbarEmail").textContent = user.email;

  $("sidebarNav").innerHTML = navItems(profile.role).map(([id, label]) =>
    `<button class="nav-btn ${id === page ? "active" : ""}"
      type="button" data-page="${id}">${label}</button>`
  ).join("");

  $("sidebarNav").querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => openPage(button.dataset.page));
  });

  openPage(page);
}

watchAuth((user, profile, error) => {
  if (!user) {
    current.user = null;
    current.profile = null;
    $("appShell").classList.add("hidden");
    $("authScreen").classList.remove("hidden");
    return;
  }

  if (error || !profile) {
    $("authScreen").classList.remove("hidden");
    $("appShell").classList.add("hidden");
    $("authError").textContent = error || "Profile not found.";
    return;
  }

  showPortal(user, profile);
});

