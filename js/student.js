
import { db } from "./firebase.js";
import { escapeHTML } from "./app.js";
import { renderTasks } from "./tasks.js";
import { renderAttendance } from "./attendance.js";
import { renderReports } from "./reports.js";
import {
  collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

export async function renderStudent(page, root, ctx) {
  if (page === "tasks") return renderTasks(root, ctx, "student");
  if (page === "attendance") return renderAttendance(root, ctx, "student");
  if (page === "reports") return renderReports(root, ctx, "student");

  const [taskSnap, attendanceSnap] = await Promise.all([
    getDocs(query(
      collection(db, "tasks"),
      where("studentIds", "array-contains", ctx.user.uid)
    )),
    getDocs(query(
      collection(db, "attendance"),
      where("studentId", "==", ctx.user.uid)
    ))
  ]);

  const pending = taskSnap.docs.filter(d =>
    !["completed", "submitted"].includes(d.data().status)
  ).length;

  const records = attendanceSnap.docs.map(d => d.data());
  const present = records.filter(r => r.status === "present").length;
  const percentage = records.length
    ? Math.round(present / records.length * 100)
    : 0;

  root.innerHTML = `
    <div class="grid">
      <div class="stat-card"><div class="label">My assignments</div>
        <div class="value">${taskSnap.size}</div></div>
      <div class="stat-card"><div class="label">Pending tasks</div>
        <div class="value">${pending}</div></div>
      <div class="stat-card"><div class="label">Lecture records</div>
        <div class="value">${records.length}</div></div>
      <div class="stat-card"><div class="label">Present percentage</div>
        <div class="value">${percentage}%</div></div>
    </div>
    <div class="panel"><h2>Welcome to CampusCore</h2>
      <p>Your dashboard shows assignments and attendance linked to your account.</p>
      <p class="muted">Attendance percentage is based on recorded lecture entries. Confirmed class schedules and approved registers should be used for official reports.</p>
    </div>`;
}

