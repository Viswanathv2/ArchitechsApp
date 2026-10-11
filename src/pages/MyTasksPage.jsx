import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import Lightbox from "../components/Lightbox";
import RouteLoading from "../components/RouteLoading";
import { supabase } from "../lib/supabase";

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' fill='%23e5e8f0'/%3E%3Ccircle cx='40' cy='32' r='16' fill='%23a8aec4'/%3E%3Cpath d='M 10 74 Q 10 50 40 50 Q 70 50 70 74 Z' fill='%23a8aec4'/%3E%3C/svg%3E";
const ROSTERS = [
  { table: "team_members", type: "team_member" },
  { table: "coaches", type: "coach" },
  { table: "mentors", type: "mentor" }
];

function formatDate(value) {
  if (!value) return "Not set";
  return new Date(`${value}T00:00:00`).toLocaleDateString();
}

function statusClass(status) {
  if (status === "Completed") return "task-status-completed";
  if (status === "In Progress") return "task-status-progress";
  if (status === "Blocked") return "task-status-blocked";
  return "task-status-pending";
}

export default function MyTasksPage() {
  const { user, profile } = useAuth();
  const [member, setMember] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [hoursDrafts, setHoursDrafts] = useState({});
  const [savingTaskId, setSavingTaskId] = useState(null);
  const [pendingOpen, setPendingOpen] = useState(true);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [lightbox, setLightbox] = useState({ taskId: null, index: null });

  const myEmail = String(user?.email || "").trim().toLowerCase();

  useEffect(() => {
    let active = true;

    async function loadMyTasks() {
      try {
        const rosterResults = await Promise.all(myEmail ? ROSTERS.map(async ({ table, type }) => {
          const { data, error } = await supabase
            .from(table)
            .select("id,name,image_url,email")
            .ilike("email", myEmail)
            .limit(1)
            .maybeSingle();
          return { data: data ? { ...data, type } : null, error };
        }) : []);
        if (!active) return;
        setStatus({ type: "", message: "" });

        const rosterError = rosterResults.find((result) => result.error)?.error;
        if (rosterError) {
          setStatus({ type: "error", message: `Couldn't load your team profile: ${rosterError.message}` });
          setMember(null);
          setTasks([]);
          return;
        }

        const matchingMember = rosterResults.find((result) => result.data)?.data || null;
        setMember(matchingMember);
        if (!matchingMember) {
          setTasks([]);
          return;
        }

        const { data, error } = await supabase
          .from("tasks")
          .select("id,task,hours,notes,images,start_date,end_date,status,is_archived,created_at")
          .eq("member_id", matchingMember.id)
          .eq("member_type", matchingMember.type)
          .order("created_at", { ascending: false });
        if (!active) return;

        if (error) {
          setStatus({ type: "error", message: `Couldn't load your tasks: ${error.message}` });
          setTasks([]);
        } else {
          setTasks((data || []).filter((task) => !task.is_archived));
        }
      } catch (error) {
        if (active) setStatus({ type: "error", message: `Couldn't load your tasks: ${error.message}` });
      } finally {
        if (active) setLoading(false);
      }
    }

    loadMyTasks();
    return () => { active = false; };
  }, [myEmail]);

  const lightboxTask = useMemo(
    () => tasks.find((task) => task.id === lightbox.taskId) || null,
    [tasks, lightbox.taskId]
  );

  function currentHours(task) {
    return Object.hasOwn(hoursDrafts, task.id) ? hoursDrafts[task.id] : String(task.hours ?? 0);
  }

  function hasHoursChange(task) {
    const rawValue = currentHours(task).trim();
    if (!rawValue) return Number(task.hours ?? 0) !== 0;
    const hours = Number(rawValue);
    return !Number.isFinite(hours) || hours !== Number(task.hours ?? 0);
  }

  async function saveHours(task) {
    const rawValue = currentHours(task).trim();
    const hours = rawValue === "" ? null : Number(rawValue);
    if (hours !== null && (!Number.isFinite(hours) || hours < 0)) {
      setStatus({ type: "error", message: "Hours must be a non-negative number." });
      return;
    }
    if ((hours ?? 0) === Number(task.hours ?? 0)) return;

    setSavingTaskId(task.id);
    setStatus({ type: "", message: "" });
    try {
      const { error } = await supabase.from("tasks").update({ hours }).eq("id", task.id);
      if (error) throw error;
      setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, hours } : item)));
      setHoursDrafts((current) => {
        const next = { ...current };
        delete next[task.id];
        return next;
      });
      setStatus({ type: "success", message: "Hours saved." });
    } catch (error) {
      setStatus({ type: "error", message: `Couldn't save hours: ${error.message}` });
    } finally {
      setSavingTaskId(null);
    }
  }

  function adjustHours(task, amount) {
    const current = Number(currentHours(task));
    const base = Number.isFinite(current) ? current : Number(task.hours ?? 0);
    setHoursDrafts((drafts) => ({ ...drafts, [task.id]: String(Math.max(0, base + amount)) }));
  }

  function renderTaskCards(taskList, emptyMessage) {
    if (!taskList.length) return <p className="my-tasks-empty">{emptyMessage}</p>;

    return (
      <div className="my-tasks-list">
        {taskList.map((task) => {
          const images = Array.isArray(task.images) ? task.images : [];
          const isSavingHours = savingTaskId === task.id;
          return (
            <article className="my-task" key={task.id}>
              <header className="my-task-heading">
                <div>
                  <h2>{task.task}</h2>
                  <span className={`task-status-badge ${statusClass(task.status)}`}>{task.status || "Not Started"}</span>
                </div>
                <div className="my-task-hours" aria-label="Task hours">
                  <button
                    type="button"
                    className="my-task-hour-button my-task-hour-up"
                    onClick={() => adjustHours(task, 1)}
                    disabled={isSavingHours}
                    aria-label="Add one hour"
                    title="Add one hour"
                  ><span className="my-task-arrow my-task-arrow-up" aria-hidden="true" /></button>
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    inputMode="decimal"
                    value={currentHours(task)}
                    onChange={(event) => setHoursDrafts((current) => ({ ...current, [task.id]: event.target.value }))}
                    disabled={isSavingHours}
                    aria-label={`Hours for ${task.task}`}
                  />
                  <button
                    type="button"
                    className="my-task-hour-button my-task-hour-down"
                    onClick={() => adjustHours(task, -1)}
                    disabled={isSavingHours}
                    aria-label="Subtract one hour"
                    title="Subtract one hour"
                  ><span className="my-task-arrow my-task-arrow-down" aria-hidden="true" /></button>
                  <span>hours</span>
                  {hasHoursChange(task) && (
                    <button
                      type="button"
                      className="my-task-save-btn"
                      onClick={() => saveHours(task)}
                      disabled={isSavingHours}
                    >
                      {isSavingHours ? "Saving…" : "Save"}
                    </button>
                  )}
                </div>
              </header>

              <dl className="my-task-dates">
                <div><dt>Start</dt><dd>{formatDate(task.start_date)}</dd></div>
                <div><dt>Due / completed</dt><dd>{formatDate(task.end_date)}</dd></div>
                <div><dt>Created</dt><dd>{task.created_at ? new Date(task.created_at).toLocaleDateString() : "Unknown"}</dd></div>
              </dl>

              <section className="my-task-detail">
                <h3>Notes</h3>
                <p className="my-task-notes">{task.notes?.trim() || "No notes for this task."}</p>
              </section>

              <section className="my-task-detail">
                <h3>Photos <span>{images.length}</span></h3>
                {images.length ? (
                  <div className="my-task-photos">
                    {images.map((image, index) => (
                      <button
                        type="button"
                        className="my-task-photo"
                        key={image.path || image.url || index}
                        onClick={() => setLightbox({ taskId: task.id, index })}
                        aria-label={`View task photo ${index + 1}`}
                      >
                        <img src={image.url} alt={`Task photo ${index + 1}`} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="my-task-no-photos">No photos attached.</p>
                )}
              </section>
            </article>
          );
        })}
      </div>
    );
  }

  const pendingTasks = tasks.filter((task) => task.status !== "Completed");
  const completedTasks = tasks.filter((task) => task.status === "Completed");

  if (loading) return <RouteLoading />;

  return (
    <section className="my-tasks-page">
      <header className="my-tasks-header">
        <div>
          <p className="my-tasks-eyebrow">Personal task list</p>
          <h1>My Tasks</h1>
          <p className="my-tasks-subtitle">Your assignments, notes, photos, and logged hours.</p>
        </div>
        <div className="my-tasks-person">
          <span>{member?.name || profile?.displayName || "Member"}</span>
          <img src={member?.image_url || profile?.avatarUrl || DEFAULT_AVATAR} alt={member?.name || "Your profile"} />
        </div>
      </header>

      {status.message && <p className={status.type} role="status">{status.message}</p>}

      {!member ? (
        <p className="my-tasks-empty">Your login email is not linked to a team profile yet.</p>
      ) : (
        <>
          <section className="my-tasks-group">
            <button
              type="button"
              className="my-tasks-group-toggle"
              onClick={() => setPendingOpen((open) => !open)}
              aria-expanded={pendingOpen}
            >
              <span>Pending / Not Started ({pendingTasks.length})</span>
              <span className={`my-tasks-chevron${pendingOpen ? " is-open" : ""}`} aria-hidden="true" />
            </button>
            {pendingOpen && (pendingTasks.length === 0 ? (
              <div className="my-tasks-empty-cheer" role="status">
                <h2>Great Job! You have no tasks!</h2>
              </div>
            ) : renderTaskCards(pendingTasks, "No pending tasks."))}
          </section>

          <section className="my-tasks-group">
            <button
              type="button"
              className="my-tasks-group-toggle"
              onClick={() => setCompletedOpen((open) => !open)}
              aria-expanded={completedOpen}
            >
              <span>Completed Tasks ({completedTasks.length})</span>
              <span className={`my-tasks-chevron${completedOpen ? " is-open" : ""}`} aria-hidden="true" />
            </button>
            {completedOpen && renderTaskCards(completedTasks, "No completed tasks yet.")}
          </section>
        </>
      )}

      {lightboxTask && lightbox.index !== null && (
        <Lightbox
          items={(Array.isArray(lightboxTask.images) ? lightboxTask.images : []).map((image) => ({ url: image.url, type: "image" }))}
          index={lightbox.index}
          onClose={() => setLightbox({ taskId: null, index: null })}
          onIndex={(index) => setLightbox((current) => ({ ...current, index }))}
        />
      )}
    </section>
  );
}