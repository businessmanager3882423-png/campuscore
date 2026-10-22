

import { db } from "./firebase.js";
import { escapeHTML } from "./app.js";
import {
  collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

export async function renderReports(root, ctx, role) {
  let attendanceQuery;

  if (role === "student") {
    attendanceQuery = query(
      collection(db, "attendance"),
      where("studentId", "==", ctx.user.uid)
    );
  } else if (role === "teacher") {
    attendanceQuery = query(
      collection(db, "attendance"),
      where("teacherId", "==", ctx.user.uid)
    );
  } else {
    attendanceQuery = collection(db, "attendance");
  }

  const [attendance, tasks] = await Promise.all([
    getDocs(attendanceQuery),
    role === "student"
      ? getDocs(query(collection(db, "tasks"),
          where("studentIds", "array-contains", ctx.user.uid)))
      : role === "teacher"
        ? getDocs(query(collection(db, "tasks"),
            where("teacherId", "==", ctx.user.uid)))
        : getDocs(collection(db, "tasks"))
  ]);

  const records = attendance.docs.map(d => d.data());
  const present = records.filter(r => r.status === "present").length;
  const absent = records.filter(r => r.status === "absent").length;
  const late = records.filter(r => r.status === "late").length;
  const percentage = records.length
    ? Math.round(present / records.length * 100)
    : 0;

  const completed = tasks.docs.filter(d => {
    const t = d.data();
    return role === "student"
      ? ["submitted", "completed"].includes(t.submissions?.[ctx.user.uid]?.status)
      : t.status === "completed";
  }).length;

  root.innerHTML = `
    <div class="grid">
      ${stat("Attendance records", records.length)}
      ${stat("Present", present)}
      ${stat("Absent", absent)}
      ${stat("Attendance rate", percentage + "%")}
    </div>
    <div class="grid">
      ${stat("Late arrivals", late)}
      ${stat("Tasks", tasks.size)}
      ${stat("Completed / submitted", completed)}
      ${stat("Pending tasks", Math.max(0, tasks.size - completed))}
    </div>
    <div class="panel">
      <h2>Attendance Report</h2>
      <p>Present: ${present} · Absent: ${absent} · Late: ${late}</p>
      <div style="height:12px;background:#25344b;border-radius:12px;overflow:hidden">
        <div style="height:100%;width:${percentage}%;background:#4ed5a0"></div>
      </div>
      <p class="muted small">This percentage uses recorded attendance entries. It is not an official monthly percentage unless all scheduled lectures have been recorded.</p>
    </div>
    <div class="panel">
      <h2>Recent Attendance</h2>
      ${records.length ? `<table><thead><tr><th>Date</th><th>Subject</th><th>Status</th></tr></thead>
      <tbody>${records.slice().sort((a,b) => String(b.date).localeCompare(String(a.date)))
      .slice(0,30).map(r => `<tr>
        <td>${escapeHTML(r.date)}</td>
        <td>${escapeHTML(r.subject)}</td>
        <td><span class="status ${escapeHTML(r.status)}">${escapeHTML(r.status)}</span></td>
      </tr>`).join("")}</tbody></table>`
      : '<div class="empty-state">No attendance records available.</div>'}
    </div>`;
}

function stat(label, value) {
  return `<div class="stat-card"><div class="label">${label}</div>
    <div class="value">${value}</div></div>`;
}

