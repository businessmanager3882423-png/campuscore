
import { db } from "./firebase.js";
import { collection, getDocs, query, where, limit } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { renderAttendance } from "./attendance.js";
import { renderTasks } from "./tasks.js";
import { renderReports } from "./reports.js";

const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

export async function renderStudent({page,user,profile},root) {
  if(page==="attendance") return renderAttendance({user,profile},root,"student");
  if(page==="tasks") return renderTasks({page,user,profile},root,"student");
  if(page==="reports") return renderReports({user,profile},root,"student");
  root.innerHTML=`<div class="panel"><h3>${esc(page)}</h3><p>Loading your student portal…</p></div>`;
  try {
    if(page==="dashboard") {
      const [ts,as,cs]=await Promise.all([
        getDocs(query(collection(db,"tasks"),where("studentIds","array-contains",user.uid),limit(200))),
        getDocs(query(collection(db,"attendance"),where("studentId","==",user.uid),limit(300))),
        getDocs(query(collection(db,"classes"),where("studentIds","array-contains",user.uid),limit(100)))
      ]);
      const tasks=ts.docs.map(d=>d.data());
      const attendance=as.docs.map(d=>d.data());
      const present=attendance.filter(a=>a.status==="present").length;
      root.innerHTML=`
        <div class="page-heading"><div><h2>Student Overview</h2><p>Welcome to your personal academic workspace, ${esc(profile.name)}.</p></div></div>
        <div class="stats-grid">
          ${stat("My Classes",cs.size,"Enrolled classes")}
          ${stat("Assignments",ts.size,"Assigned coursework")}
          ${stat("Submitted",tasks.filter(t=>["submitted","completed"].includes(t.status)).length,"Submitted or completed")}
          ${stat("Attendance",attendance.length?Math.round(present/attendance.length*100):0,"% of visible records")}
        </div>
        <div class="panel"><h3>Quick actions</h3><div class="toolbar"><button class="btn primary" data-go="tasks">View assignments</button><button class="btn" data-go="attendance">Attendance history</button><button class="btn" data-go="exams">Exam schedule</button><button class="btn" data-go="notices">College notices</button></div></div>`;
      root.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>document.querySelector(`[data-page="${b.dataset.go}"]`)?.click());
      return;
    }
    if(page==="classes") {
      const cs=await getDocs(query(collection(db,"classes"),where("studentIds","array-contains",user.uid),limit(200)));
      root.innerHTML=`<div class="page-heading"><div><h2>My Classes & Subjects</h2><p>Classes in which your student account is enrolled.</p></div></div><div class="content-grid">${cs.docs.map(d=>{const c=d.data();return `<div class="panel"><h3>${esc(c.name)}</h3><p><strong>Program:</strong> ${esc(c.program)}</p><p><strong>Semester:</strong> ${esc(c.semester)}</p><p><strong>Subjects:</strong> ${esc((c.subjects||[]).join(", ")||"Not specified")}</p></div>`}).join("")||`<div class="panel"><p>No classes are linked to your student account yet. Contact your teacher or the Principal.</p></div>`}</div>`;
      return;
    }
    if(page==="notices") {
      const ns=await getDocs(query(collection(db,"notices"),limit(100)));
      const notices=ns.docs.map(d=>d.data()).filter(n=>n.published!==false&&["all","student"].includes(n.audience));
      root.innerHTML=`<div class="page-heading"><div><h2>College Notices</h2><p>Important campus announcements.</p></div></div><div class="panel">${notices.map(n=>`<div class="notice-card"><strong>${esc(n.title)}</strong><p>${esc(n.message)}</p><small>Audience: ${esc(n.audience)}</small></div>`).join("")||`<div class="empty-state">No notices available.</div>`}</div>`;
      return;
    }
    if(page==="exams") {
      const es=await getDocs(query(collection(db,"exams"),limit(200)));
      const cs=await getDocs(query(collection(db,"classes"),where("studentIds","array-contains",user.uid),limit(100)));
      const ids=new Set(cs.docs.map(d=>d.id));
      const exams=es.docs.map(d=>d.data()).filter(e=>ids.has(e.classId));
      root.innerHTML=`<div class="page-heading"><div><h2>Exam Schedule & Results</h2><p>Exam information for your enrolled classes.</p></div></div><div class="panel"><div class="data-wrap"><table class="data-table"><thead><tr><th>Exam</th><th>Subject</th><th>Date</th><th>Maximum marks</th></tr></thead><tbody>${exams.map(e=>`<tr><td>${esc(e.title)}</td><td>${esc(e.subject)}</td><td>${esc(e.date)}</td><td>${esc(e.maxMarks)}</td></tr>`).join("")||`<tr><td colspan="4" class="empty-state">No exam schedule has been published for your classes.</td></tr>`}</tbody></table></div></div>`;
      return;
    }
    root.innerHTML=`<div class="panel"><h3>${esc(page)}</h3><p>This section is not configured for the Student role.</p></div>`;
  }catch(error){root.innerHTML=`<div class="panel"><h3>Unable to load page</h3><p>${esc(error.message)}</p></div>`;}
}
function stat(label,value,note){return `<div class="stat-card"><div class="stat-label">${esc(label)}</div><div class="stat-value">${value}</div><div class="stat-note">${esc(note)}</div></div>`;}
