

import { db } from "./firebase.js";
import { escapeHTML, toast } from "./app.js";
import {
  collection, getDocs, query, where, doc, getDoc, setDoc,
  serverTimestamp, addDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

export async function renderAttendance(root, ctx, role) {
  const classSnap = role === "teacher"
    ? await getDocs(query(collection(db, "classes"), where("teacherIds", "array-contains", ctx.user.uid)))
    : null;

  const classes = classSnap ? classSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];

  root.innerHTML = `
    <div class="panel">
      <h2>${role === "student" ? "My Attendance" : "Lecture Attendance"}</h2>
      ${role === "teacher" ? `
        <form id="attendanceForm">
          <div class="form-grid">
            <div class="field"><label>Class</label>
              <select name="classId" required>
                <option value="">Select class</option>
                ${classes.map(c => `<option value="${c.id}">${escapeHTML(c.name)} — ${escapeHTML(c.section)}</option>`).join("")}
              </select>
            </div>
            <div class="field"><label>Lecture subject</label><input name="subject" required placeholder="e.g. Computer Science"></div>
            <div class="field"><label>Lecture date</label><input name="date" type="date" value="${today()}" required></div>
          </div>
          <button class="secondary-btn" type="submit">Load students</button>
        </form>
        <div id="attendanceRoster"></div>
      ` : `<div id="attendanceRoster"></div>`}
    </div>
    ${role === "teacher" ? `
      <div class="panel">
        <h2>Submit Monthly Register</h2>
        <form id="monthForm" class="form-grid">
          <div class="field"><label>Class</label>
            <select name="classId" required>
              <option value="">Select class</option>
              ${classes.map(c => `<option value="${c.id}">${escapeHTML(c.name)} — ${escapeHTML(c.section)} / ${escapeHTML(c.subject)}</option>`).join("")}
            </select>
          </div>
          <div class="field"><label>Month</label><input name="month" type="month" value="${today().slice(0,7)}" required></div>
          <div class="wide"><button class="primary-btn">Submit monthly register to Principal</button></div>
        </form>
      </div>` : ""}
    <div class="panel"><h2>Attendance History</h2><div id="attendanceHistory"></div></div>`;

  const roster = root.querySelector("#attendanceRoster");

  if (role === "teacher") {
    root.querySelector("#attendanceForm").addEventListener("submit", async e => {
      e.preventDefault();
      const form = new FormData(e.currentTarget);
      const c = classes.find(item => item.id === form.get("classId"));
      if (!c) return toast("Select a class.", true);

      const ids = [...new Set(c.studentIds || [])];
      if (!ids.length) return toast("No students enrolled.", true);

      try {
        const students = await Promise.all(ids.map(async id => {
          const s = await getDoc(doc(db, "users", id));
          return { id, ...(s.exists() ? s.data() : { name: "Student" }) };
        }));

        roster.innerHTML = `
          <form id="markForm">
            <p class="muted">${escapeHTML(c.name)} / ${escapeHTML(form.get("subject"))} / ${escapeHTML(form.get("date"))}</p>
            <input type="hidden" name="classId" value="${c.id}">
            <input type="hidden" name="subject" value="${escapeHTML(form.get("subject"))}">
            <input type="hidden" name="date" value="${escapeHTML(form.get("date"))}">
            <table><thead><tr><th>Student</th><th>Attendance</th></tr></thead>
            <tbody>${students.map(s => `<tr><td>${escapeHTML(s.name)}<br><small>${escapeHTML(s.email || "")}</small></td>
              <td><select name="${s.id}">
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="leave">Leave</option>
              </select></td></tr>`).join("")}</tbody></table>
            <button class="primary-btn" type="submit">Save lecture attendance</button>
          </form>`;

        root.querySelector("#markForm").addEventListener("submit", async ev => {
          ev.preventDefault();
          const data = new FormData(ev.currentTarget);
          const date = String(data.get("date"));
          const subject = String(data.get("subject")).trim();
          const classId = String(data.get("classId"));

          try {
            for (const studentId of ids) {
              await setDoc(doc(db, "attendance", `${classId}_${date}_${studentId}_${ctx.user.uid}`), {
                classId, studentId, teacherId: ctx.user.uid,
                teacherName: ctx.profile.name, subject, date,
                status: String(data.get(studentId)),
                updatedAt: serverTimestamp()
              }, { merge: true });
            }
            toast("Lecture attendance saved.");
            await loadHistory(root, ctx, role);
          } catch (error) {
            toast(error.message, true);
          }
        });
      } catch (error) {
        toast(error.message, true);
      }
    });

    root.querySelector("#monthForm").addEventListener("submit", async e => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      const classId = String(data.get("classId"));
      const month = String(data.get("month"));
      const c = classes.find(item => item.id === classId);
      if (!c) return toast("Select a class.", true);

      try {
        const records = await getDocs(query(
          collection(db, "attendance"),
          where("classId", "==", classId),
          where("teacherId", "==", ctx.user.uid)
        ));

        const monthRecords = records.docs.map(d => d.data())
          .filter(r => r.date?.startsWith(month));

        if (!monthRecords.length) {
          return toast("No attendance records found for this month.", true);
        }

        await addDoc(collection(db, "monthlyRegisters"), {
          classId, className: c.name, month,
          teacherId: ctx.user.uid,
          teacherName: ctx.profile.name,
          recordCount: monthRecords.length,
          records: monthRecords.map(r => ({
            studentId: r.studentId, date: r.date,
            subject: r.subject, status: r.status
          })),
          status: "submitted",
          submittedAt: serverTimestamp()
        });
        toast("Monthly register submitted to Principal.");
      } catch (error) {
        toast(error.message, true);
      }
    });
  }

  await loadHistory(root, ctx, role);
}

async function loadHistory(root, ctx, role) {
  const history = root.querySelector("#attendanceHistory");
  if (!history) return;

  try {
    const snap = role === "student"
      ? await getDocs(query(collection(db, "attendance"), where("studentId", "==", ctx.user.uid)))
      : await getDocs(query(collection(db, "attendance"), where("teacherId", "==", ctx.user.uid)));

    const records = snap.docs.map(d => d.data())
      .sort((a,b) => String(b.date).localeCompare(String(a.date)));

    history.innerHTML = records.length ? `<table><thead><tr>
      <th>Date</th><th>Subject</th><th>Status</th><th>${role === "student" ? "Teacher" : "Student ID"}</th>
      </tr></thead><tbody>${records.map(r => `<tr>
      <td>${escapeHTML(r.date)}</td><td>${escapeHTML(r.subject)}</td>
      <td><span class="status ${escapeHTML(r.status)}">${escapeHTML(r.status)}</span></td>
      <td>${escapeHTML(role === "student" ? r.teacherName : r.studentId)}</td>
      </tr>`).join("")}</tbody></table>` : '<div class="empty-state">No attendance records yet.</div>';
  } catch (error) {
    history.innerHTML = '<p class="muted">Attendance history is not available.</p>';
  }
}

