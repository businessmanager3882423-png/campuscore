
import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, query, where, doc, updateDoc,
  serverTimestamp, orderBy, limit
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));
const dateText = value => value?.toDate ? value.toDate().toLocaleDateString() : (value || "—");

export async function renderTasks({ page, user, profile }, root, role) {
  root.innerHTML = `<div class="panel"><h3>Assignments & Submissions</h3><p>Loading assignments…</p></div>`;
  try {
    let snap;
    if (role === "principal") {
      snap = await getDocs(query(collection(db,"tasks"), orderBy("createdAt","desc"), limit(100)));
    } else if (role === "teacher") {
      snap = await getDocs(query(collection(db,"tasks"), where("teacherId","==",user.uid), limit(100)));
    } else {
      snap = await getDocs(query(collection(db,"tasks"), where("studentIds","array-contains",user.uid), limit(100)));
    }
    const tasks = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    const canCreate = role === "teacher" || role === "principal";
    root.innerHTML = `
      <div class="page-heading"><div><h2>Assignments</h2><p>Manage coursework, deadlines, submissions and feedback.</p></div></div>
      ${canCreate ? `<div class="panel"><h3>Create assignment</h3>
      <form id="taskCreateForm" class="form-grid">
        <div class="field"><label>Title</label><input name="title" required maxlength="120"></div>
        <div class="field"><label>Class ID</label><input name="classId" required placeholder="Use the class ID"></div>
        <div class="field"><label>Subject</label><input name="subject" required maxlength="100"></div>
        <div class="field"><label>Due date</label><input name="dueDate" type="date" required></div>
        <div class="field span-2"><label>Instructions</label><textarea name="description" required maxlength="4000"></textarea></div>
        <div class="field span-2"><label>Student UIDs (comma-separated, optional)</label><input name="studentIds" placeholder="Leave empty only if your class setup supports class-based assignments"></div>
        <div class="span-2 form-actions"><button class="btn primary" type="submit">Create assignment</button></div>
      </form></div>` : ""}
      <div class="panel"><h3>${role === "student" ? "Your coursework" : "Assignment register"}</h3>
      <div class="data-wrap"><table class="data-table"><thead><tr><th>Assignment</th><th>Subject / Class</th><th>Deadline</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>${tasks.map(t => `<tr><td><strong>${esc(t.title)}</strong><br><small>${esc(t.description || "")}</small></td>
      <td>${esc(t.subject)}<br><small>${esc(t.classId)}</small></td><td>${esc(dateText(t.dueDate))}</td>
      <td><span class="badge ${t.status === "submitted" ? "success" : "warning"}">${esc(t.status || "assigned")}</span></td>
      <td>${role === "student" ? `<button class="btn" data-submit-task="${esc(t.id)}">Submit work</button>` :
      (role === "teacher" ? `<button class="btn" data-review-task="${esc(t.id)}">Review</button>` : "View only")}</td></tr>`).join("") || `<tr><td colspan="5" class="empty-state">No assignments found.</td></tr>`}</tbody></table></div></div>`;

    $("taskCreateForm")?.addEventListener("submit", async e => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const studentIds = String(f.get("studentIds") || "").split(",").map(x=>x.trim()).filter(Boolean);
      if (role === "teacher" && !studentIds.length) {
        alert("Enter the student UIDs assigned to this task. Use the class roster to identify students.");
        return;
      }
      await addDoc(collection(db,"tasks"), {
        title:String(f.get("title")).trim(),
        classId:String(f.get("classId")).trim(),
        subject:String(f.get("subject")).trim(),
        description:String(f.get("description")).trim(),
        dueDate:String(f.get("dueDate")),
        studentIds,
        teacherId:user.uid,
        createdBy:user.uid,
        status:"assigned",
        createdAt:serverTimestamp(),
        updatedAt:serverTimestamp()
      });
      alert("Assignment created.");
      await renderTasks({page,user,profile},root,role);
    });

    root.querySelectorAll("[data-submit-task]").forEach(button => button.addEventListener("click", async () => {
      const submission = prompt("Paste your work, answer, or a link to your submission:");
      if (!submission?.trim()) return;
      await updateDoc(doc(db,"tasks",button.dataset.submitTask), {
        [`submissions.${user.uid}`]: {
          text:submission.trim(),
          status:"submitted",
          submittedAt:new Date().toISOString()
        },
        updatedAt:serverTimestamp()
      });
      alert("Submission saved.");
      await renderTasks({page,user,profile},root,role);
    }));

    root.querySelectorAll("[data-review-task]").forEach(button => button.addEventListener("click", async () => {
      const task = tasks.find(t=>t.id===button.dataset.reviewTask);
      const studentUid = prompt("Enter the student's UID to review their submission:");
      if (!studentUid || !task?.submissions?.[studentUid]) {
        alert("No submission was found for that student UID.");
        return;
      }
      const mark = prompt("Enter marks awarded (optional):", "");
      const feedback = prompt("Enter feedback:");
      await updateDoc(doc(db,"tasks",task.id), {
        [`submissions.${studentUid}.marks`]:mark === "" ? null : Number(mark),
        [`submissions.${studentUid}.feedback`]:feedback || "",
        [`submissions.${studentUid}.status`]:"reviewed",
        updatedAt:serverTimestamp()
      });
      alert("Submission reviewed.");
      await renderTasks({page,user,profile},root,role);
    }));
  } catch (error) {
    root.innerHTML = `<div class="panel"><h3>Assignments unavailable</h3><p>${esc(error.message)}</p><p>Check Firestore rules and confirm that the tasks collection is accessible to your role.</p></div>`;
  }
}
function $(id) { return document.getElementById(id); }
