
import { db } from "./firebase.js";
import { collection, getDocs, query, where, limit } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { renderAttendance } from "./attendance.js";
import { renderTasks } from "./tasks.js";
import { renderReports } from "./reports.js";

const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

export async function renderTeacher({page,user,profile},root) {
  if(page==="attendance") return renderAttendance({user,profile},root,"teacher");
  if(page==="tasks") return renderTasks({page,user,profile},root,"teacher");
  if(page==="reports") return renderReports({user,profile},root,"teacher");
  root.innerHTML=`<div class="panel"><h3>${esc(page)}</h3><p>Loading your teaching workspace…</p></div>`;
  try {
    if(page==="dashboard") {
      const [cs,ts,as]=await Promise.all([
        getDocs(query(collection(db,"classes"),where("teacherIds","array-contains",user.uid),limit(100))),
        getDocs(query(collection(db,"tasks"),where("teacherId","==",user.uid),limit(200))),
        getDocs(query(collection(db,"attendance"),where("teacherId","==",user.uid),limit(300)))
      ]);
      const tasks=ts.docs.map(d=>d.data());
      root.innerHTML=`
        <div class="page-heading"><div><h2>Teaching Overview</h2><p>Review your assigned classes and teaching activity.</p></div></div>
        <div class="stats-grid">
          ${stat("Assigned Classes",cs.size,"Classes assigned to you")}
          ${stat("Assignments",ts.size,"Created by your account")}
          ${stat("Submitted",tasks.filter(t=>["submitted","completed"].includes(t.status)).length,"Submitted or completed")}
          ${stat("Attendance Records",as.size,"Your recorded entries")}
        </div>
        <div class="panel"><h3>Quick actions</h3><div class="toolbar"><button class="btn primary" data-go="attendance">Take attendance</button><button class="btn" data-go="tasks">Manage assignments</button><button class="btn" data-go="reports">View reports</button></div></div>`;
      root.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>document.querySelector(`[data-page="${b.dataset.go}"]`)?.click());
      return;
    }
    if(page==="classes") {
      const cs=await getDocs(query(collection(db,"classes"),where("teacherIds","array-contains",user.uid),limit(200)));
      root.innerHTML=`<div class="page-heading"><div><h2>My Classes</h2><p>Classes assigned by the Principal.</p></div></div>
      <div class="content-grid">${cs.docs.map(d=>{const c=d.data();return `<div class="panel"><h3>${esc(c.name)}</h3><p><strong>Program:</strong> ${esc(c.program)}</p><p><strong>Semester:</strong> ${esc(c.semester)}</p><p><strong>Subjects:</strong> ${esc((c.subjects||[]).join(", ")||"Not specified")}</p><p><strong>Class ID:</strong> ${esc(d.id)}</p><p><strong>Enrolled student UIDs:</strong> ${esc((c.studentIds||[]).join(", ")||"No student IDs added")}</p></div>`}).join("")||`<div class="panel"><p>No classes have been assigned to your account yet. Contact the Principal.</p></div>`}</div>`;
      return;
    }
    if(page==="notices") {
      const ns=await getDocs(query(collection(db,"notices"),limit(100)));
      const notices=ns.docs.map(d=>d.data()).filter(n=>n.published!==false&&["all","teacher"].includes(n.audience));
      root.innerHTML=`<div class="page-heading"><div><h2>College Notices</h2><p>Announcements published for staff and the whole college.</p></div></div><div class="panel">${notices.map(n=>`<div class="notice-card"><strong>${esc(n.title)}</strong><p>${esc(n.message)}</p><small>Audience: ${esc(n.audience)}</small></div>`).join("")||`<div class="empty-state">No notices available.</div>`}</div>`;
      return;
    }
    if(page==="exams") {
      const es=await getDocs(query(collection(db,"exams"),limit(200)));
      const cs=await getDocs(query(collection(db,"classes"),where("teacherIds","array-contains",user.uid),limit(100)));
      const ids=new Set(cs.docs.map(d=>d.id));
      const exams=es.docs.map(d=>({id:d.id,...d.data()})).filter(e=>ids.has(e.classId));
      root.innerHTML=`<div class="page-heading"><div><h2>Exams & Marks</h2><p>Exam schedule for your assigned classes.</p></div></div><div class="panel"><div class="data-wrap"><table class="data-table"><thead><tr><th>Exam</th><th>Class</th><th>Subject</th><th>Date</th><th>Maximum marks</th></tr></thead><tbody>${exams.map(e=>`<tr><td>${esc(e.title)}</td><td>${esc(e.classId)}</td><td>${esc(e.subject)}</td><td>${esc(e.date)}</td><td>${esc(e.maxMarks)}</td></tr>`).join("")||`<tr><td colspan="5" class="empty-state">No exams found for your assigned classes.</td></tr>`}</tbody></table></div><p>For exam marks, use your approved college workflow; only assigned-class results should be entered.</p></div>`;
      return;
    }
    root.innerHTML=`<div class="panel"><h3>${esc(page)}</h3><p>This section is not configured for the Teacher role.</p></div>`;
  }catch(error){root.innerHTML=`<div class="panel"><h3>Unable to load page</h3><p>${esc(error.message)}</p></div>`;}
}
function stat(label,value,note){return `<div class="stat-card"><div class="stat-label">${esc(label)}</div><div class="stat-value">${value}</div><div class="stat-note">${esc(note)}</div></div>`;}
