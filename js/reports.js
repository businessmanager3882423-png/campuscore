
import { db } from "./firebase.js";
import {
  collection, getDocs, query, where, doc, updateDoc, serverTimestamp, limit
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

export async function renderProfile({user,profile},root) {
  root.innerHTML = `
    <div class="page-heading"><div><h2>My Profile</h2><p>View your campus account details and update your contact information.</p></div></div>
    <div class="panel"><form id="profileForm" class="form-grid">
      <div class="field"><label>Full name</label><input name="name" value="${esc(profile.name)}" required maxlength="100"></div>
      <div class="field"><label>Email (managed by sign-in account)</label><input value="${esc(user.email)}" disabled></div>
      <div class="field"><label>Role</label><input value="${esc(profile.role)}" disabled></div>
      <div class="field"><label>Account status</label><input value="${esc(profile.status)}" disabled></div>
      <div class="field"><label>Student ID</label><input value="${esc(profile.studentId)}" disabled></div>
      <div class="field"><label>Program</label><input name="program" value="${esc(profile.program)}" maxlength="120"></div>
      <div class="field"><label>Semester</label><input name="semester" value="${esc(profile.semester)}" maxlength="40"></div>
      <div class="span-2 form-actions"><button class="btn primary">Save profile</button></div>
    </form></div>`;
  document.getElementById("profileForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    await updateDoc(doc(db,"users",user.uid),{
      name:String(f.get("name")).trim(),
      program:String(f.get("program")||"").trim(),
      semester:String(f.get("semester")||"").trim(),
      updatedAt:serverTimestamp()
    });
    alert("Profile updated. Sign in again if the sidebar still shows the previous name.");
  });
}

export async function renderReports({user,profile},root,role) {
  root.innerHTML = `<div class="panel"><h3>Reports</h3><p>Loading reports…</p></div>`;
  try {
    const [usersSnap,classesSnap,tasksSnap,attendanceSnap] = await Promise.all([
      role==="principal" ? getDocs(query(collection(db,"users"),limit(500))) : Promise.resolve(null),
      role==="student" ? Promise.resolve(null) : getDocs(query(collection(db,"classes"),limit(200))),
      role==="principal" ? getDocs(query(collection(db,"tasks"),limit(300))) :
        role==="teacher" ? getDocs(query(collection(db,"tasks"),where("teacherId","==",user.uid),limit(300))) :
        getDocs(query(collection(db,"tasks"),where("studentIds","array-contains",user.uid),limit(300))),
      role==="principal" ? getDocs(query(collection(db,"attendance"),limit(500))) :
        role==="teacher" ? getDocs(query(collection(db,"attendance"),where("teacherId","==",user.uid),limit(500))) :
        getDocs(query(collection(db,"attendance"),where("studentId","==",user.uid),limit(500)))
    ]);
    const users=usersSnap?.docs.map(d=>d.data())||[];
    const classes=classesSnap?.docs.map(d=>d.data())||[];
    const tasks=tasksSnap.docs.map(d=>d.data());
    const attendance=attendanceSnap.docs.map(d=>d.data());
    const completed=tasks.filter(t=>t.status==="completed"||t.status==="submitted").length;
    const present=attendance.filter(a=>a.status==="present").length;
    const percentage=attendance.length?Math.round(present/attendance.length*100):0;
    const csvRows=[["Date","Class ID","Student ID","Status"],...attendance.map(a=>[a.date,a.classId,a.studentId,a.status])];
    const csv=csvRows.map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");
    root.innerHTML=`
      <div class="page-heading"><div><h2>Reports & Progress</h2><p>Summary of available academic records. Export the attendance data for offline review.</p></div></div>
      <div class="stats-grid">
        ${role==="principal"?`<div class="stat-card"><div class="stat-label">Total Users</div><div class="stat-value">${users.length}</div><div class="stat-note">All visible profiles</div></div>`:""}
        <div class="stat-card"><div class="stat-label">Visible Classes</div><div class="stat-value">${classes.length}</div><div class="stat-note">Accessible records</div></div>
        <div class="stat-card"><div class="stat-label">Assignments</div><div class="stat-value">${tasks.length}</div><div class="stat-note">${completed} submitted or completed</div></div>
        <div class="stat-card"><div class="stat-label">Attendance Present</div><div class="stat-value">${percentage}%</div><div class="stat-note">${present} of ${attendance.length} visible records</div></div>
      </div>
      <div class="panel"><h3>Attendance export</h3><p>Download the attendance records available to your account. Exported files should be stored securely because they may contain student information.</p><button id="exportAttendance" class="btn primary">Export attendance CSV</button></div>`;
    document.getElementById("exportAttendance").addEventListener("click",()=>{
      const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
      const a=document.createElement("a");a.href=url;a.download="campuscore-attendance-report.csv";a.click();URL.revokeObjectURL(url);
    });
  }catch(error){
    root.innerHTML=`<div class="panel"><h3>Reports unavailable</h3><p>${esc(error.message)}</p></div>`;
  }
}
