
import { db } from "./firebase.js";
import {
  collection, getDocs, addDoc, updateDoc, doc, query, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { renderAttendance } from "./attendance.js";
import { renderTasks } from "./tasks.js";
import { renderReports } from "./reports.js";

const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cols = {
  users:["Name","Email","Role","Status","Action"],
  classes:["Class","Program","Semester","Teacher UIDs","Action"],
  notices:["Title","Audience","Published","Message"],
  exams:["Exam","Class","Subject","Date","Maximum marks"],
  fees:["Student UID","Description","Amount","Status","Due date"]
};

export async function renderPrincipal({page,user,profile},root) {
  if(page==="attendance") return renderAttendance({user,profile},root,"principal");
  if(page==="tasks") return renderTasks({page,user,profile},root,"principal");
  if(page==="reports") return renderReports({user,profile},root,"principal");

  root.innerHTML=`<div class="panel"><h3>${esc(page)}</h3><p>Loading college records…</p></div>`;
  try {
    if(page==="dashboard") {
      const [u,c,t,a]=await Promise.all([
        getDocs(query(collection(db,"users"),limit(500))),
        getDocs(query(collection(db,"classes"),limit(300))),
        getDocs(query(collection(db,"tasks"),limit(500))),
        getDocs(query(collection(db,"attendance"),limit(500)))
      ]);
      const users=u.docs.map(d=>d.data()), teachers=users.filter(x=>x.role==="teacher").length;
      const students=users.filter(x=>x.role==="student").length;
      const submitted=t.docs.filter(d=>["submitted","completed"].includes(d.data().status)).length;
      const present=a.docs.filter(d=>d.data().status==="present").length;
      root.innerHTML=`
        <div class="page-heading"><div><h2>Principal Overview</h2><p>Academic operations at Government College of Technology Kamalia.</p></div></div>
        <div class="stats-grid">
          ${stat("Total Students",students,"Student profiles")}
          ${stat("Teachers / Admin",teachers,"Staff profiles")}
          ${stat("Classes & Sections",c.size,"Available class records")}
          ${stat("Assignments Submitted",submitted,"Submitted or completed")}
        </div>
        <div class="content-grid">
          <div class="panel"><h3>Attendance snapshot</h3><div class="stat-value">${a.size?Math.round(present/a.size*100):0}%</div><p>${present} present records out of ${a.size} visible records. This is a record-based snapshot, not a unique-student attendance percentage.</p></div>
          <div class="panel"><h3>Quick actions</h3><div class="toolbar"><button class="btn primary" data-go="users">Manage users</button><button class="btn" data-go="classes">Manage classes</button><button class="btn" data-go="notices">Publish notice</button><button class="btn" data-go="reports">Open reports</button></div><p>Use the sidebar for attendance, assignments, exams, fees and audit/report views.</p></div>
        </div>`;
      root.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{document.querySelector(`[data-page="${b.dataset.go}"]`)?.click();});
      return;
    }

    const collectionName = ({
      users:"users", classes:"classes", notices:"notices", exams:"exams", fees:"fees"
    })[page];

    if(!collectionName) {
      root.innerHTML=`<div class="panel"><h3>${esc(page)}</h3><p>This module is not configured yet. Use the implemented Users, Classes, Attendance, Assignments, Notices, Exams, Fees and Reports sections.</p></div>`;
      return;
    }

    const snap=await getDocs(query(collection(db,collectionName),limit(500)));
    const records=snap.docs.map(d=>({id:d.id,...d.data()}));
    const headers=cols[page]||[];
    root.innerHTML=`
      <div class="page-heading"><div><h2>${esc(({users:"User Management",classes:"Classes & Subjects",notices:"College Notices",exams:"Exams & Marks",fees:"Fees & Invoices"})[page])}</h2><p>Manage the ${esc(page)} records available in Firestore.</p></div></div>
      ${page==="users"?`<div class="panel"><h3>Account workflow</h3><p>First create the user in Firebase Authentication (Firebase Console → Authentication → Users), then create a matching users document whose document ID is that user's Firebase UID. This page can then update the profile's role and status. Do not share passwords or let users select privileged roles.</p></div>`:""}
      ${page==="classes"?`<div class="panel"><h3>Create class / section</h3><form id="createRecord" class="form-grid">
        <div class="field"><label>Class name</label><input name="name" required maxlength="120"></div>
        <div class="field"><label>Program / department</label><input name="program" required maxlength="120"></div>
        <div class="field"><label>Semester</label><input name="semester" required maxlength="40"></div>
        <div class="field"><label>Teacher UIDs (comma-separated)</label><input name="teacherIds" placeholder="Firebase UIDs"></div>
        <div class="field span-2"><label>Subject names (comma-separated)</label><input name="subjects" placeholder="Computer Science, Mathematics"></div>
        <div class="span-2 form-actions"><button class="btn primary">Create class</button></div>
      </form></div>`:""}
      ${page==="notices"?`<div class="panel"><h3>Publish notice</h3><form id="createRecord" class="form-grid">
        <div class="field"><label>Title</label><input name="title" required maxlength="160"></div>
        <div class="field"><label>Audience</label><select name="audience"><option value="all">Everyone</option><option value="student">Students</option><option value="teacher">Teachers</option></select></div>
        <div class="field span-2"><label>Message</label><textarea name="message" required maxlength="5000"></textarea></div>
        <div class="span-2 form-actions"><button class="btn primary">Publish notice</button></div>
      </form></div>`:""}
      ${page==="exams"?`<div class="panel"><h3>Create exam record</h3><form id="createRecord" class="form-grid">
        <div class="field"><label>Exam title</label><input name="title" required></div><div class="field"><label>Class ID</label><input name="classId" required></div>
        <div class="field"><label>Subject</label><input name="subject" required></div><div class="field"><label>Date</label><input name="date" type="date" required></div>
        <div class="field"><label>Maximum marks</label><input name="maxMarks" type="number" min="1" required></div>
        <div class="span-2 form-actions"><button class="btn primary">Create exam</button></div>
      </form></div>`:""}
      ${page==="fees"?`<div class="panel"><h3>Create fee record</h3><form id="createRecord" class="form-grid">
        <div class="field"><label>Student UID</label><input name="studentId" required></div><div class="field"><label>Description</label><input name="description" required></div>
        <div class="field"><label>Amount (PKR)</label><input name="amount" type="number" min="0" step="0.01" required></div>
        <div class="field"><label>Due date</label><input name="dueDate" type="date" required></div>
        <div class="span-2 form-actions"><button class="btn primary">Create fee record</button></div>
      </form></div>`:""}
      <div class="panel"><h3>Records (${records.length})</h3>
        ${page==="users"?`<div class="toolbar"><input id="userSearch" placeholder="Search name or email"></div>`:""}
        <div class="data-wrap"><table class="data-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody id="recordRows">
        ${records.map(r=>rowFor(page,r)).join("")||`<tr><td colspan="${headers.length}" class="empty-state">No records found.</td></tr>`}
        </tbody></table></div>
      </div>`;

    root.querySelectorAll("[data-user-status]").forEach(b=>b.addEventListener("click",async()=>{
      const next=b.dataset.userStatus;
      if(!confirm(`Change this account status to "${next}"?`))return;
      await updateDoc(doc(db,"users",b.dataset.id),{status:next,updatedAt:serverTimestamp()});
      alert("User status updated.");
      await renderPrincipal({page,user,profile},root);
    }));
    root.querySelectorAll("[data-user-role]").forEach(s=>s.addEventListener("change",async()=>{
      const next=s.value;
      if(!["principal","teacher","student"].includes(next))return;
      if(!confirm(`Change this user's role to "${next}"?`))return;
      await updateDoc(doc(db,"users",s.dataset.id),{role:next,updatedAt:serverTimestamp()});
      alert("Role updated.");
      await renderPrincipal({page,user,profile},root);
    }));

    document.getElementById("userSearch")?.addEventListener("input",e=>{
      const term=e.target.value.toLowerCase();
      root.querySelectorAll("#recordRows tr").forEach(tr=>tr.hidden=!tr.textContent.toLowerCase().includes(term));
    });

    document.getElementById("createRecord")?.addEventListener("submit",async e=>{
      e.preventDefault();const f=new FormData(e.currentTarget);let data={createdBy:user.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
      if(page==="classes") data={...data,name:String(f.get("name")).trim(),program:String(f.get("program")).trim(),semester:String(f.get("semester")).trim(),teacherIds:String(f.get("teacherIds")||"").split(",").map(x=>x.trim()).filter(Boolean),subjects:String(f.get("subjects")||"").split(",").map(x=>x.trim()).filter(Boolean),studentIds:[]};
      if(page==="notices") data={...data,title:String(f.get("title")).trim(),audience:String(f.get("audience")),message:String(f.get("message")).trim(),published:true,publishedAt:serverTimestamp()};
      if(page==="exams") data={...data,title:String(f.get("title")).trim(),classId:String(f.get("classId")).trim(),subject:String(f.get("subject")).trim(),date:String(f.get("date")),maxMarks:Number(f.get("maxMarks"))};
      if(page==="fees") data={...data,studentId:String(f.get("studentId")).trim(),description:String(f.get("description")).trim(),amount:Number(f.get("amount")),dueDate:String(f.get("dueDate")),status:"unpaid"};
      await addDoc(collection(db,collectionName),data);
      alert("Record created.");
      await renderPrincipal({page,user,profile},root);
    });
  } catch(error) {
    root.innerHTML=`<div class="panel"><h3>Could not load ${esc(page)}</h3><p>${esc(error.message)}</p><p>Confirm Firestore rules and collection permissions.</p></div>`;
  }
}

function stat(label,value,note){return `<div class="stat-card"><div class="stat-label">${esc(label)}</div><div class="stat-value">${value}</div><div class="stat-note">${esc(note)}</div></div>`;}
function rowFor(page,r){
  if(page==="users") return `<tr><td>${esc(r.name)}</td><td>${esc(r.email)}</td><td><select data-user-role data-id="${esc(r.id)}"><option ${r.role==="principal"?"selected":""}>principal</option><option ${r.role==="teacher"?"selected":""}>teacher</option><option ${r.role==="student"?"selected":""}>student</option></select></td><td><span class="badge ${r.status==="active"?"success":"danger"}">${esc(r.status)}</span></td><td><button class="btn ${r.status==="active"?"danger":"primary"}" data-user-status="${r.status==="active"?"suspended":"active"}" data-id="${esc(r.id)}">${r.status==="active"?"Suspend":"Activate"}</button></td></tr>`;
  if(page==="classes") return `<tr><td>${esc(r.name)}</td><td>${esc(r.program)}</td><td>${esc(r.semester)}</td><td>${esc((r.teacherIds||[]).join(", "))}</td><td>${esc(r.id)}</td></tr>`;
  if(page==="notices") return `<tr><td>${esc(r.title)}</td><td>${esc(r.audience)}</td><td>${r.published?"Yes":"No"}</td><td>${esc(r.message)}</td></tr>`;
  if(page==="exams") return `<tr><td>${esc(r.title)}</td><td>${esc(r.classId)}</td><td>${esc(r.subject)}</td><td>${esc(r.date)}</td><td>${esc(r.maxMarks)}</td></tr>`;
  if(page==="fees") return `<tr><td>${esc(r.studentId)}</td><td>${esc(r.description)}</td><td>${esc(r.amount)}</td><td><span class="badge ${r.status==="paid"?"success":"warning"}">${esc(r.status)}</span></td><td>${esc(r.dueDate)}</td></tr>`;
  return "";
}
