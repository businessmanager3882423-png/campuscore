
import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, query, where, serverTimestamp,
  orderBy, limit
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

export async function renderAttendance({ user, profile }, root, role) {
  root.innerHTML = `<div class="panel"><h3>Attendance</h3><p>Loading register…</p></div>`;
  try {
    let snap;
    if (role === "principal") {
      snap = await getDocs(query(collection(db,"attendance"), orderBy("date","desc"), limit(150)));
    } else if (role === "teacher") {
      snap = await getDocs(query(collection(db,"attendance"), where("teacherId","==",user.uid), limit(150)));
    } else {
      snap = await getDocs(query(collection(db,"attendance"), where("studentId","==",user.uid), limit(150)));
    }
    const rows = snap.docs.map(d=>({id:d.id,...d.data()}));
    root.innerHTML = `
      <div class="page-heading"><div><h2>Attendance Register</h2><p>Record and review attendance records by date and class.</p></div></div>
      ${role !== "student" ? `<div class="panel"><h3>Record attendance</h3>
      <form id="attendanceForm" class="form-grid">
        <div class="field"><label>Class ID</label><input name="classId" required></div>
        <div class="field"><label>Student UID</label><input name="studentId" required></div>
        <div class="field"><label>Date</label><input name="date" type="date" required value="${new Date().toISOString().slice(0,10)}"></div>
        <div class="field"><label>Status</label><select name="status"><option>present</option><option>absent</option><option>late</option><option>leave</option></select></div>
        <div class="field span-2"><label>Notes (optional)</label><input name="notes" maxlength="500"></div>
        <div class="span-2 form-actions"><button class="btn primary">Save attendance</button></div>
      </form></div>` : ""}
      <div class="panel"><h3>${role === "student" ? "My attendance history" : "Attendance history"}</h3>
      <div class="data-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Student UID</th><th>Class</th><th>Status</th><th>Notes</th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.studentId)}</td><td>${esc(r.classId)}</td><td><span class="badge ${r.status==="present"?"success":r.status==="absent"?"danger":"warning"}">${esc(r.status)}</span></td><td>${esc(r.notes)}</td></tr>`).join("") || `<tr><td colspan="5" class="empty-state">No attendance records found.</td></tr>`}
      </tbody></table></div></div>`;

    document.getElementById("attendanceForm")?.addEventListener("submit", async e=>{
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      await addDoc(collection(db,"attendance"),{
        classId:String(f.get("classId")).trim(),
        studentId:String(f.get("studentId")).trim(),
        teacherId:user.uid,
        date:String(f.get("date")),
        status:String(f.get("status")),
        notes:String(f.get("notes")||"").trim(),
        recordedBy:user.uid,
        createdAt:serverTimestamp()
      });
      alert("Attendance record saved.");
      await renderAttendance({user,profile},root,role);
    });
  } catch(error) {
    root.innerHTML = `<div class="panel"><h3>Attendance unavailable</h3><p>${esc(error.message)}</p><p>Confirm the attendance collection and security rules are configured.</p></div>`;
  }
}
