

import { db } from "./firebase.js";
import { escapeHTML, toast } from "./app.js";
import {
  collection, getDocs, getDoc, query, where, doc, addDoc,
  updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

export async function renderTasks(root, ctx, role) {
  const tasksQuery = role === "student"
    ? query(collection(db, "tasks"), where("studentIds", "array-contains", ctx.user.uid))
    : query(collection(db, "tasks"), where("teacherId", "==", ctx.user.uid));

  const [taskSnap, classSnap] = await Promise.all([
    getDocs(tasksQuery),
    role === "teacher"
      ? getDocs(query(collection(db, "classes"), where("teacherIds", "array-contains", ctx.user.uid)))
      : Promise.resolve(null)
  ]);

  const classes = classSnap ? classSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
  const tasks = taskSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  root.innerHTML = `
    ${role === "teacher" ? `
      <div class="panel">
        <h2>Assign a task</h2>
        <form id="taskForm" class="form-grid">
          <div class="field wide"><label>Assigned class</label>
            <select name="classId" required>
              <option value="">Select class</option>
              ${classes.map(c => `<option value="${c.id}">${escapeHTML(c.name)} — ${escapeHTML(c.section)} / ${escapeHTML(c.subject)}</option>`).join("")}
            </select>
          </div>
          <div class="field wide"><label>Task title</label><input name="title" maxlength="150" required></div>
          <div class="field wide"><label>Instructions</label><textarea name="description" required></textarea></div>
          <div class="field"><label>Deadline</label><input name="deadline" type="date" required></div>
          <div class="field"><label>Priority</label>
            <select name="priority"><option>Normal</option><option>High</option><option>Low</option></select>
          </div>
          <div class="wide"><button class="primary-btn">Assign task</button></div>
        </form>
      </div>` : ""}
    <div class="panel"><h2>${role === "student" ? "My Assignments" : "Tasks Assigned by Me"}</h2>
      <div id="taskList"></div>
    </div>`;

  if (role === "teacher") {
    root.querySelector("#taskForm").addEventListener("submit", async e => {
      e.preventDefault();
      const form = new FormData(e.currentTarget);
      const classItem = classes.find(c => c.id === form.get("classId"));
      if (!classItem) return toast("Select a valid class.", true);

      const studentIds = [...new Set(classItem.studentIds || [])];
      if (!studentIds.length) return toast("This class has no enrolled students.", true);

      try {
        await addDoc(collection(db, "tasks"), {
          title: String(form.get("title")).trim(),
          description: String(form.get("description")).trim(),
          deadline: String(form.get("deadline")),
          priority: String(form.get("priority")),
          classId: classItem.id,
          subject: classItem.subject,
          studentIds,
          teacherId: ctx.user.uid,
          teacherName: ctx.profile.name,
          createdBy: ctx.user.uid,
          createdAt: serverTimestamp(),
          status: "assigned"
        });
        toast("Task assigned to enrolled students.");
        await renderTasks(root, ctx, role);
      } catch (error) {
        toast(error.message, true);
      }
    });
  }

  const list = root.querySelector("#taskList");

  if (!tasks.length) {
    list.innerHTML = '<div class="empty-state">No tasks found.</div>';
    return;
  }

  list.innerHTML = tasks.map(t => {
    const studentStatus = t.submissions?.[ctx.user.uid]?.status || t.status;
    const isStudent = role === "student";
    const submission = t.submissions?.[ctx.user.uid]?.text || "";

    return `<article class="panel">
      <div class="section-heading">
        <h3>${escapeHTML(t.title)}</h3>
        <span class="status">${escapeHTML(studentStatus)}</span>
      </div>
      <p>${escapeHTML(t.description)}</p>
      <p class="muted">Teacher: ${escapeHTML(t.teacherName || "College staff")}</p>
      <p class="muted">Subject: ${escapeHTML(t.subject || "")} · Deadline: ${escapeHTML(t.deadline || "Not set")}</p>
      ${isStudent ? `
        <form class="submission-form" data-id="${t.id}">
          <div class="field"><label>Your submission / response</label>
            <textarea name="submission" required>${escapeHTML(submission)}</textarea>
          </div>
          <button class="primary-btn" type="submit">Submit assignment</button>
        </form>` : `
        <p class="muted">Assigned to ${(t.studentIds || []).length} student(s).</p>
      `}
    </article>`;
  }).join("");

  if (role === "student") {
    list.querySelectorAll(".submission-form").forEach(form => {
      form.addEventListener("submit", async e => {
        e.preventDefault();
        const text = new FormData(form).get("submission").toString().trim();
        try {
          const ref = doc(db, "tasks", form.dataset.id);
          const snap = await getDoc(ref);
          if (!snap.exists()) throw new Error("Task no longer exists.");

          const task = snap.data();
          if (!(task.studentIds || []).includes(ctx.user.uid)) {
            throw new Error("This task is not assigned to your account.");
          }

          await updateDoc(ref, {
            [`submissions.${ctx.user.uid}`]: {
              text,
              status: "submitted",
              submittedAt: new Date().toISOString()
            }
          });
          toast("Assignment submitted.");
          await renderTasks(root, ctx, role);
        } catch (error) {
          toast(error.message, true);
        }
      });
    });
  }
}

