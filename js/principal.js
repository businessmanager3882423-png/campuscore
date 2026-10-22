
import { db } from "./firebase.js";
import { $, escapeHTML, toast, openPage } from "./app.js";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

export async function renderPrincipal(page, root, ctx) {
  if (page === "users") return usersPage(root);
  if (page === "classes") return classesPage(root, ctx);
  if (page === "tasks") return simpleList(root, "tasks", "All Tasks", ctx);
  if (page === "attendance") return simpleList(root, "attendance", "Attendance Records", ctx);
  if (page === "reports") return reportsPage(root);
  return dashboard(root);
}

async function dashboard(root) {
  const [u, c, t, a] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "classes")),
    getDocs(collection(db, "tasks")),
    getDocs(collection(db, "attendance"))
  ]);

  root.innerHTML = `
    <div class="grid">
      ${stat("Registered users", u.size)}
      ${stat("Classes", c.size)}
      ${stat("Tasks", t.size)}
      ${stat("Attendance records", a.size)}
    </div>
    <div class="panel">
      <h2>Principal Control Center</h2>
      <p class="muted">Manage registered accounts, classes, academic tasks and attendance.</p>
      <div class="actions">
        <button id="goUsers">Manage users</button>
        <button id="goClasses">Manage classes</button>
        <button id="goReports">View reports</button>
      </div>
    </div>`;
  root.querySelector("#goUsers").onclick = () => openPage("users");
  root.querySelector("#goClasses").onclick = () => openPage("classes");
  root.querySelector("#goReports").onclick = () => openPage("reports");
}

function stat(label, value) {
  return `<div class="stat-card"><div class="label">${label}</div>
    <div class="value">${value}</div></div>`;
}

async function usersPage(root) {
  const snap = await getDocs(collection(db, "users"));
  const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  root.innerHTML = `
    <div class="panel">
      <h2>User Management</h2>
      <p class="muted">Only promote accounts belonging to verified college staff.</p>
      <div class="field">
        <label>Search by email</label>
        <input id="userSearch" placeholder="Search registered users">
      </div>
      <div id="userTable"></div>
    </div>`;

  const table = root.querySelector("#userTable");

  function draw(filter = "") {
    const filtered = users.filter(u =>
      `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(filter.toLowerCase())
    );

    table.innerHTML = `<table><thead><tr>
      <th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th>
      </tr></thead><tbody>${filtered.map(u => `
      <tr>
        <td>${escapeHTML(u.name)}</td>
        <td>${escapeHTML(u.email)}</td>
        <td>${escapeHTML(u.role)}</td>
        <td>${escapeHTML(u.status)}</td>
        <td>
          <div class="actions">
            ${u.role !== "principal" ? `
              <button class="table-btn" data-id="${u.id}" data-role="teacher">Make Teacher</button>
              <button class="table-btn" data-id="${u.id}" data-role="student">Make Student</button>
              <button class="table-btn" data-id="${u.id}" data-status="${u.status === "active" ? "inactive" : "active"}">
                ${u.status === "active" ? "Suspend" : "Activate"}
              </button>` : "Protected"}
          </div>
        </td>
      </tr>`).join("")}</tbody></table>`;
  }

  draw();
  root.querySelector("#userSearch").addEventListener("input", e => draw(e.target.value));

  table.addEventListener("click", async e => {
    const button = e.target.closest("button");
    if (!button) return;
    try {
      const ref = doc(db, "users", button.dataset.id);
      if (button.dataset.role) {
        await updateDoc(ref, { role: button.dataset.role, updatedAt: serverTimestamp() });
      } else if (button.dataset.status) {
        await updateDoc(ref, { status: button.dataset.status, updatedAt: serverTimestamp() });
      }
      toast("User updated.");
      await usersPage(root);
    } catch (error) {
      toast(error.message, true);
    }
  });
}

async function classesPage(root, ctx) {
  const usersSnap = await getDocs(query(
    collection(db, "users"), where("role", "==", "teacher")
  ));
  const teachers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const classSnap = await getDocs(collection(db, "classes"));

  root.innerHTML = `
    <div class="panel">
      <h2>Create a class</h2>
      <form id="classForm" class="form-grid">
        <div class="field"><label>Class name</label><input name="name" required></div>
        <div class="field"><label>Section</label><input name="section" required></div>
        <div class="field"><label>Semester</label><input name="semester"></div>
        <div class="field"><label>Subject</label><input name="subject" required></div>
        <div class="field wide"><label>Teacher</label>
          <select name="teacherId" required>
            <option value="">Select teacher</option>
            ${teachers.map(t => `<option value="${t.id}">${escapeHTML(t.name)} — ${escapeHTML(t.email)}</option>`).join("")}
          </select>
        </div>
        <div class="wide"><button class="primary-btn">Create class</button></div>
      </form>
    </div>
    <div class="panel"><h2>All Classes</h2><div id="classTable"></div></div>`;

  root.querySelector("#classForm").addEventListener("submit", async e => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const teacherId = form.get("teacherId");
    const teacher = teachers.find(t => t.id === teacherId);

    try {
      const ref = doc(collection(db, "classes"));
      await setDoc(ref, {
        name: String(form.get("name")).trim(),
        section: String(form.get("section")).trim(),
        semester: String(form.get("semester") || "").trim(),
        subject: String(form.get("subject")).trim(),
        teacherIds: [teacherId],
        teacherNames: { [teacherId]: teacher?.name || "" },
        studentIds: [],
        createdBy: ctx.user.uid,
        createdAt: serverTimestamp(),
        status: "active"
      });
      toast("Class created.");
      await classesPage(root, ctx);
    } catch (error) {
      toast(error.message, true);
    }
  });

  root.querySelector("#classTable").innerHTML = `<table><thead><tr>
    <th>Class</th><th>Section</th><th>Subject</th><th>Teacher</th>
    </tr></thead><tbody>${classSnap.docs.map(d => {
      const c = d.data();
      return `<tr><td>${escapeHTML(c.name)}</td>
      <td>${escapeHTML(c.section)}</td><td>${escapeHTML(c.subject)}</td>
      <td>${escapeHTML((c.teacherIds || []).map(id => c.teacherNames?.[id] || id).join(", "))}</td></tr>`;
    }).join("")}</tbody></table>`;
}

async function simpleList(root, collectionName, title, ctx) {
  const snap = await getDocs(collection(db, collectionName));
  const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  root.innerHTML = `<div class="panel"><h2>${title}</h2>
    ${records.length ? `<table><thead><tr><th>Record ID</th><th>Details</th><th>Status</th></tr></thead>
    <tbody>${records.map(r => `<tr><td>${escapeHTML(r.id)}</td>
    <td>${escapeHTML(r.title || r.subject || r.date || r.name || "Record")}</td>
    <td>${escapeHTML(r.status || "saved")}</td></tr>`).join("")}</tbody></table>`
    : '<div class="empty-state">No records yet.</div>'}</div>`;
}

async function reportsPage(root) {
  const [users, classes, tasks, attendance] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "classes")),
    getDocs(collection(db, "tasks")),
    getDocs(collection(db, "attendance"))
  ]);
  root.innerHTML = `<div class="grid">
    ${stat("Users", users.size)}${stat("Classes", classes.size)}
    ${stat("Tasks", tasks.size)}${stat("Lecture records", attendance.size)}
    </div><div class="panel"><h2>College overview</h2>
    <p>These are total database records, not attendance percentages.</p></div>`;
}

