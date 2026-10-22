
import { db } from "./firebase.js";
import { $, escapeHTML, toast } from "./app.js";
import { renderTasks } from "./tasks.js";
import { renderAttendance } from "./attendance.js";
import { renderReports } from "./reports.js";
import {
  collection, getDocs, query, where, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

export async function renderTeacher(page, root, ctx) {
  if (page === "tasks") return renderTasks(root, ctx, "teacher");
  if (page === "attendance") return renderAttendance(root, ctx, "teacher");
  if (page === "reports") return renderReports(root, ctx, "teacher");
  return classesPage(root, ctx);
}

async function classesPage(root, ctx) {
  const snap = await getDocs(query(
    collection(db, "classes"),
    where("teacherIds", "array-contains", ctx.user.uid)
  ));

  const classes = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  root.innerHTML = `
    <div class="panel">
      <h2>My Assigned Classes</h2>
      <p class="muted">Only classes assigned to your account are shown here.</p>
      ${classes.length ? `<table><thead><tr>
        <th>Class</th><th>Section</th><th>Subject</th><th>Students</th>
        </tr></thead><tbody>${classes.map(c => `<tr>
        <td>${escapeHTML(c.name)}</td>
        <td>${escapeHTML(c.section)}</td>
        <td>${escapeHTML(c.subject)}</td>
        <td>${(c.studentIds || []).length}</td>
        </tr>`).join("")}</tbody></table>`
        : '<div class="empty-state">No classes have been assigned to you yet.</div>'}
    </div>
    <div class="panel">
      <h2>Class roster</h2>
      <p class="muted">Student accounts must be enrolled by an authorized workflow.</p>
      <label for="classPicker">Select class</label>
      <select id="classPicker"><option value="">Choose a class</option>
      ${classes.map(c => `<option value="${c.id}">${escapeHTML(c.name)} — ${escapeHTML(c.section)} / ${escapeHTML(c.subject)}</option>`).join("")}
      </select>
      <div id="roster"></div>
    </div>`;

  root.querySelector("#classPicker").addEventListener("change", async e => {
    const c = classes.find(item => item.id === e.target.value);
    const roster = root.querySelector("#roster");
    if (!c) {
      roster.innerHTML = "";
      return;
    }

    const ids = c.studentIds || [];
    const profiles = await Promise.all(ids.map(async id => {
      try {
        const { getDoc } = await import(
          "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js"
        );
        const s = await getDoc(doc(db, "users", id));
        return s.exists() ? { id, ...s.data() } : { id, name: "Unavailable profile" };
      } catch {
        return { id, name: "Profile not accessible" };
      }
    }));

    roster.innerHTML = profiles.length ? `<table><thead><tr>
      <th>Student</th><th>Email</th></tr></thead><tbody>
      ${profiles.map(s => `<tr><td>${escapeHTML(s.name)}</td>
      <td>${escapeHTML(s.email || "")}</td></tr>`).join("")}</tbody></table>`
      : '<div class="empty-state">No students enrolled in this class.</div>';
  });
}

