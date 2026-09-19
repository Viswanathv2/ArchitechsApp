import { useEffect, useMemo, useState } from "react";
import RouteLoading from "../components/RouteLoading";
import { usePortalPage } from "../hooks/usePortalPage";
import { useTrackVisit } from "../hooks/useTrackVisit";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { downloadCsv } from "../lib/exportCsv";
import { useResizableTable } from "../hooks/useResizableTable";

// Small circular placeholder avatar
const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' fill='%23e5e8f0'/%3E%3Ccircle cx='40' cy='32' r='16' fill='%23a8aec4'/%3E%3Cpath d='M 10 74 Q 10 50 40 50 Q 70 50 70 74 Z' fill='%23a8aec4'/%3E%3C/svg%3E";

const STATUS_OPTIONS = ["Not Started", "In Progress", "Completed", "Blocked"];
const CLOSED_STATUS = "Completed";

function statusClass(status) {
  switch (status) {
    case "Completed":
      return "task-status-completed";
    case "In Progress":
      return "task-status-progress";
    case "Blocked":
      return "task-status-blocked";
    default:
      return "task-status-pending";
  }
}

const emptyTask = { memberKey: "", task: "", hours: "", start_date: "", end_date: "", status: "Not Started", notes: "" };

const TASK_COLUMNS = [
  { key: "member_name", label: "Member" },
  { key: "member_type", label: "Type" },
  { key: "task", label: "Task" },
  { key: "hours", label: "Hours" },
  { key: "start_date", label: "Start Date" },
  { key: "end_date", label: "End Date" },
  { key: "status", label: "Status" },
  { key: "notes", label: "Notes" },
  { key: "archived", label: "Archived" },
  { key: "archived_by", label: "Archived By" }
];

export default function SchedulePage() {
  const page = usePortalPage("schedule");
  useTrackVisit("schedule");
  const { user, profile } = useAuth();

  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [newTask, setNewTask] = useState(emptyTask);
  const [showClosed, setShowClosed] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [notesTaskId, setNotesTaskId] = useState(null);
  const [notesDraft, setNotesDraft] = useState("");
  const tableRef = useResizableTable();

  const isCoach = Boolean(profile?.isCoach || profile?.isPortalAdmin);
  const myEmail = String(user?.email || "").trim().toLowerCase();
  const myDisplayName = profile?.displayName || user?.email || "Someone";

  useEffect(() => {
    loadAll();
  }, []);

  // Close whichever popup is open on Escape.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== "Escape") return;
      setShowAddModal(false);
      setNotesTaskId(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  async function loadAll() {
    setLoading(true);
    const [membersResp, coachesResp, mentorsResp, tasksResp] = await Promise.all([
      supabase
        .from("team_members")
        .select("id,name,roles,image_url,email")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase
        .from("coaches")
        .select("id,name,role,image_url,email")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase
        .from("mentors")
        .select("id,name,role,image_url,email")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase
        .from("tasks")
        .select("id,member_id,member_type,task,hours,notes,start_date,end_date,status,is_archived,archived_at,archived_by,created_at")
        .order("created_at", { ascending: true })
    ]);

    const teamMembers = (Array.isArray(membersResp.data) ? membersResp.data : []).map((m) => ({
      ...m,
      type: "team_member",
      typeLabel: "Member"
    }));
    const coaches = (Array.isArray(coachesResp.data) ? coachesResp.data : []).map((m) => ({
      ...m,
      type: "coach",
      typeLabel: "Coach"
    }));
    const mentors = (Array.isArray(mentorsResp.data) ? mentorsResp.data : []).map((m) => ({
      ...m,
      type: "mentor",
      typeLabel: "Mentor"
    }));

    setMembers([...teamMembers, ...coaches, ...mentors]);
    setTasks(Array.isArray(tasksResp.data) ? tasksResp.data : []);
    setLoading(false);
  }

  // The member record (team member, coach, or mentor) matching the signed-in
  // user's email, if any. Non-coaches can only add tasks under this record.
  const selfMember = useMemo(
    () => members.find((m) => String(m.email || "").trim().toLowerCase() === myEmail) || null,
    [members, myEmail]
  );

  useEffect(() => {
    if (!isCoach && selfMember) {
      setNewTask((p) => (p.memberKey ? p : { ...p, memberKey: `${selfMember.type}:${selfMember.id}` }));
    }
  }, [isCoach, selfMember]);

  const memberByKey = useMemo(() => {
    const map = new Map();
    for (const m of members) {
      map.set(`${m.type}:${m.id}`, m);
    }
    return map;
  }, [members]);

  const enrichedTasks = useMemo(
    () =>
      tasks.map((t) => ({
        ...t,
        member: memberByKey.get(`${t.member_type}:${t.member_id}`) || null
      })),
    [tasks, memberByKey]
  );

  const openTasks = useMemo(
    () =>
      enrichedTasks
        .filter((t) => !t.is_archived && t.status !== CLOSED_STATUS)
        .sort((a, b) => {
          const aDate = a.end_date || "9999-12-31";
          const bDate = b.end_date || "9999-12-31";
          if (aDate !== bDate) return aDate < bDate ? -1 : 1;
          return String(a.member?.name || "").localeCompare(String(b.member?.name || ""));
        }),
    [enrichedTasks]
  );

  const closedTasks = useMemo(
    () =>
      enrichedTasks
        .filter((t) => !t.is_archived && t.status === CLOSED_STATUS)
        .sort((a, b) => String(a.member?.name || "").localeCompare(String(b.member?.name || ""))),
    [enrichedTasks]
  );

  const archivedTasks = useMemo(
    () =>
      enrichedTasks
        .filter((t) => t.is_archived)
        .sort((a, b) => new Date(b.archived_at || b.created_at) - new Date(a.archived_at || a.created_at)),
    [enrichedTasks]
  );

  function canEditTask(t) {
    if (isCoach) return true;
    const email = String(t.member?.email || "").trim().toLowerCase();
    return Boolean(email && myEmail && email === myEmail);
  }

  async function addTask() {
    if (!newTask.task.trim()) {
      setStatus({ type: "error", message: "Task name is required" });
      return;
    }
    if (newTask.status === CLOSED_STATUS && !newTask.end_date) {
      setStatus({ type: "error", message: "Set an end date before creating a completed task." });
      return;
    }
    const target = isCoach ? memberByKey.get(newTask.memberKey) : selfMember;
    if (!target) {
      setStatus({
        type: "error",
        message: isCoach ? "Choose who this task is for" : "We couldn't match your account to a team member"
      });
      return;
    }
    const { error } = await supabase.from("tasks").insert({
      member_id: target.id,
      member_type: target.type,
      task: newTask.task.trim(),
      hours: newTask.hours === "" ? null : Number(newTask.hours),
      start_date: newTask.start_date || null,
      end_date: newTask.end_date || null,
      status: newTask.status,
      notes: newTask.notes.trim() || null
    });
    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
    } else {
      setNewTask((p) => ({ ...emptyTask, memberKey: isCoach ? "" : p.memberKey }));
      setStatus({ type: "success", message: "Task added!" });
      setShowAddModal(false);
      loadAll();
    }
  }

  async function updateTaskField(id, field, value) {
    const current = tasks.find((task) => task.id === id);
    if (field === "status" && value === CLOSED_STATUS) {
      const today = new Date().toISOString().slice(0, 10);
      setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, status: value, end_date: task.end_date || today } : task)));
      const { error } = await supabase.from("tasks").update({ status: value, end_date: current?.end_date || today }).eq("id", id);
      if (error) {
        setStatus({ type: "error", message: `Save failed: ${error.message}` });
        loadAll();
      }
      return;
    }
    if (field === "status" && value !== CLOSED_STATUS) {
      setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, status: value, end_date: null } : task)));
      const { error } = await supabase.from("tasks").update({ status: value, end_date: null }).eq("id", id);
      if (error) {
        setStatus({ type: "error", message: `Save failed: ${error.message}` });
        loadAll();
      }
      return;
    }
    // optimistic UI update
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
    let payload;
    if (field.endsWith("_date")) {
      payload = { [field]: value || null };
    } else if (field === "hours") {
      payload = { hours: value === "" ? null : Number(value) };
    } else {
      payload = { [field]: value };
    }
    const { error } = await supabase.from("tasks").update(payload).eq("id", id);
    if (error) {
      setStatus({ type: "error", message: `Save failed: ${error.message}` });
      loadAll();
    }
  }

  async function deleteTask(id) {
    if (!confirm("Delete this task? It will be moved to the Archive section.")) return;
    const { error } = await supabase
      .from("tasks")
      .update({ is_archived: true, archived_at: new Date().toISOString(), archived_by: myDisplayName })
      .eq("id", id);
    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
    } else {
      setStatus({ type: "success", message: "Task moved to archive." });
      loadAll();
    }
  }

  const notesTask = enrichedTasks.find((t) => t.id === notesTaskId) || null;
  const notesEditable = Boolean(notesTask);

  function openNotes(t) {
    setNotesTaskId(t.id);
    setNotesDraft(t.notes || "");
  }

  async function saveNotes() {
    if (!notesTask) return;
    await updateTaskField(notesTask.id, "notes", notesDraft);
    setNotesTaskId(null);
  }

  function notesPreview(t) {
    const text = String(t.notes || "").trim();
    if (!text) return "Add note";
    return text.length > 40 ? `${text.slice(0, 40)}…` : text;
  }

  function exportTasksCsv() {
    const rows = enrichedTasks.map((t) => ({
      member_name: t.member?.name || "Unknown",
      member_type: t.member?.typeLabel || "",
      task: t.task,
      hours: t.hours ?? "",
      start_date: t.start_date || "",
      end_date: t.end_date || "",
      status: t.status,
      notes: t.notes || "",
      archived: t.is_archived ? "Yes" : "No",
      archived_by: t.archived_by || ""
    }));
    downloadCsv(`team-tasks-${new Date().toISOString().slice(0, 10)}.csv`, TASK_COLUMNS, rows);
  }

  function renderTaskRow(t, { archived = false } = {}) {
    const editable = !archived && canEditTask(t);
    return (
      <tr key={t.id}>
        <td>
          <div className="task-member-cell">
            <span className="activity-avatar" title={t.member?.name || "Unknown member"}>
              <img src={t.member?.image_url || DEFAULT_AVATAR} alt={t.member?.name || "Member"} />
            </span>
          </div>
        </td>
        <td>
          {editable ? (
            <input
              className="task-input"
              value={t.task}
              onChange={(e) => updateTaskField(t.id, "task", e.target.value)}
            />
          ) : (
            t.task
          )}
        </td>
        <td>
          {editable ? (
            <input
              type="number"
              min="0"
              step="0.25"
              className="task-input"
              value={t.hours ?? ""}
              onChange={(e) => updateTaskField(t.id, "hours", e.target.value)}
            />
          ) : (
            t.hours ?? "—"
          )}
        </td>
        <td>
          {editable ? (
            <input
              type="date"
              className="task-input"
              value={t.start_date || ""}
              onChange={(e) => updateTaskField(t.id, "start_date", e.target.value)}
            />
          ) : (
            t.start_date || "—"
          )}
        </td>
        <td>
          {editable ? (
            <input
              type="date"
              className="task-input"
              aria-label="Task close date"
              value={t.end_date || ""}
              min={t.start_date || undefined}
              onChange={(e) => updateTaskField(t.id, "end_date", e.target.value)}
            />
          ) : (
            t.end_date || "—"
          )}
        </td>
        <td>
          {editable ? (
            <select
              className={`task-input task-status-select ${statusClass(t.status)}`}
              value={t.status}
              onChange={(e) => updateTaskField(t.id, "status", e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          ) : (
            <span className={`task-status-badge ${statusClass(t.status)}`}>{t.status}</span>
          )}
        </td>
        <td>
          <button type="button" className="task-notes-btn" onClick={() => openNotes(t)}>
            {notesPreview(t)}
          </button>
        </td>
        <td>
          {archived ? (
            <span className="task-member-type">
              {t.archived_by ? `Deleted by ${t.archived_by}` : "Deleted"}
              {t.archived_at ? ` · ${new Date(t.archived_at).toLocaleDateString()}` : ""}
            </span>
          ) : (
            editable && (
              <button className="admin-delete-btn" aria-label="Delete task" title="Delete task" onClick={() => deleteTask(t.id)}>
                ×
              </button>
            )
          )}
        </td>
      </tr>
    );
  }

  if (page.loading || loading) {
    return <RouteLoading />;
  }

  const canAddTask = isCoach || Boolean(selfMember);

  return (
    <section className="landing-page">
      <header className="landing-header">
        <h1>{page.title || "Tasks"}</h1>
        <p className="landing-tagline">{page.subtitle || "Track and manage what everyone on the team is working on"}</p>
      </header>

      <div className="landing-container">
        {status.message && (
          <p className={status.type} role="status">{status.message}</p>
        )}

        <div className="task-toolbar">
          {canAddTask && (
            <button
              type="button"
              className="admin-save-btn task-toolbar-btn"
              onClick={() => {
                setNewTask((p) => ({ ...emptyTask, memberKey: isCoach ? "" : p.memberKey }));
                setShowAddModal(true);
              }}
            >
              + Add Task
            </button>
          )}
          <button type="button" className="admin-save-btn task-toolbar-btn" onClick={exportTasksCsv}>
            Export CSV
          </button>
        </div>
        {!canAddTask && (
          <p className="activity-hint">
            Your account isn&apos;t linked to a team member record yet, so you can&apos;t add tasks. Ask a
            coach to add your login email to your team member profile.
          </p>
        )}

        <section className="landing-section">
          <div className="task-section-heading task-section-heading-primary">
            <h2>Open Tasks</h2>
          </div>
          {openTasks.length ? (
            <div className="task-table-wrap">
              <table ref={tableRef} className="task-table task-grid-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Task</th>
                    <th>Hours</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Status</th>
                    <th>Notes</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>{openTasks.map((t) => renderTaskRow(t))}</tbody>
              </table>
            </div>
          ) : (
            <p>No open tasks right now.</p>
          )}
        </section>

        <div className="task-section-heading">
          <h2>Closed Tasks ({closedTasks.length})</h2>
          <button type="button" className="task-collapse-toggle" onClick={() => setShowClosed((v) => !v)}>
            {showClosed ? "Collapse" : "Expand"}
          </button>
        </div>
        {showClosed && (
          closedTasks.length ? (
            <div className="task-table-wrap">
              <table ref={tableRef} className="task-table task-grid-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Task</th>
                    <th>Hours</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Status</th>
                    <th>Notes</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>{closedTasks.map((t) => renderTaskRow(t))}</tbody>
              </table>
            </div>
          ) : (
            <p>No closed tasks yet.</p>
          )
        )}

        <div className="task-section-heading">
          <h2>Archive ({archivedTasks.length})</h2>
          <button type="button" className="task-collapse-toggle" onClick={() => setShowArchive((v) => !v)}>
            {showArchive ? "Collapse" : "Expand"}
          </button>
        </div>
        {showArchive && (
          archivedTasks.length ? (
            <div className="task-table-wrap">
              <table ref={tableRef} className="task-table task-grid-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Task</th>
                    <th>Hours</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Status</th>
                    <th>Notes</th>
                    <th>Audit</th>
                  </tr>
                </thead>
                <tbody>{archivedTasks.map((t) => renderTaskRow(t, { archived: true }))}</tbody>
              </table>
            </div>
          ) : (
            <p>No archived tasks.</p>
          )
        )}
      </div>

      {showAddModal && (
        <div className="task-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="task-modal task-modal-narrow" role="dialog" aria-modal="true">
            <h3>Add a Task</h3>
            {!isCoach && selfMember && (
              <p className="task-add-form-hint">This task will be added under your name, {selfMember.name}.</p>
            )}
            <div className="task-add-grid">
              {isCoach && (
                <select
                  aria-label="Assign to"
                  value={newTask.memberKey}
                  onChange={(e) => setNewTask((p) => ({ ...p, memberKey: e.target.value }))}
                >
                  <option value="">Assign to…</option>
                  {members.map((m) => (
                    <option key={`${m.type}:${m.id}`} value={`${m.type}:${m.id}`}>
                      {m.name} ({m.typeLabel})
                    </option>
                  ))}
                </select>
              )}
              <input
                placeholder="Task description"
                value={newTask.task}
                onChange={(e) => setNewTask((p) => ({ ...p, task: e.target.value }))}
              />
              <input
                type="number"
                min="0"
                step="0.25"
                placeholder="No of hours"
                aria-label="No of hours"
                value={newTask.hours}
                onChange={(e) => setNewTask((p) => ({ ...p, hours: e.target.value }))}
              />
              <input
                type="date"
                aria-label="Start date"
                value={newTask.start_date}
                onChange={(e) => setNewTask((p) => ({ ...p, start_date: e.target.value }))}
              />
              <input
                type="date"
                aria-label="End date"
                value={newTask.end_date}
                onChange={(e) => setNewTask((p) => ({ ...p, end_date: e.target.value }))}
              />
              <select
                aria-label="Status"
                value={newTask.status}
                onChange={(e) => setNewTask((p) => ({ ...p, status: e.target.value, end_date: e.target.value === CLOSED_STATUS ? (p.end_date || new Date().toISOString().slice(0, 10)) : "" }))}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <textarea
              className="task-notes-textarea"
              placeholder="Notes (optional)"
              aria-label="Notes"
              value={newTask.notes}
              onChange={(e) => setNewTask((p) => ({ ...p, notes: e.target.value }))}
            />
            <div className="task-modal-actions">
              <button type="button" className="activity-back" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button type="button" className="admin-save-btn" onClick={addTask}>
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}

      {notesTask && (
        <div className="task-modal-overlay" onClick={(e) => e.target === e.currentTarget && setNotesTaskId(null)}>
          <div className="task-modal" role="dialog" aria-modal="true">
            <h3>Notes — {notesTask.task}</h3>
            <p className="task-add-form-hint">{notesTask.member?.name || "Unknown"}&apos;s task</p>
            {notesEditable ? (
              <textarea
                className="task-notes-textarea task-notes-textarea-large"
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                autoFocus
              />
            ) : (
              <p className="task-notes-readonly">{notesTask.notes || "No notes yet."}</p>
            )}
            <div className="task-modal-actions">
              <button type="button" className="activity-back" onClick={() => setNotesTaskId(null)}>
                {notesEditable ? "Cancel" : "Close"}
              </button>
              {notesEditable && (
                <button type="button" className="admin-save-btn" onClick={saveNotes}>
                  Save
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
