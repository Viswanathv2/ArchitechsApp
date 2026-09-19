import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const STATUS_OPTIONS = ["New", "Planning to reach", "Reached", "Closed"];

function statusClass(status) {
  switch (status) {
    case "Reached":
      return "task-status-completed";
    case "Planning to reach":
      return "task-status-progress";
    case "Closed":
      return "task-status-blocked";
    default:
      return "task-status-pending";
  }
}

export default function InterestRequestsTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("interest_submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      setStatus({ type: "error", message: `Failed to load requests: ${error.message}` });
      setItems([]);
    } else {
      setItems((data || []).map((row) => ({ ...row, status: row.status || "New" })));
    }
    setLoading(false);
  }

  function updateField(id, field, value) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
  }

  async function saveRow(item) {
    setSavingId(item.id);
    setStatus({ type: "", message: "" });
    const { error } = await supabase
      .from("interest_submissions")
      .update({ status: item.status || "New", coach_note: item.coach_note || null })
      .eq("id", item.id);
    setSavingId("");
    if (error) {
      setStatus({ type: "error", message: `Failed to save: ${error.message}` });
    } else {
      setStatus({ type: "success", message: "Saved!" });
    }
  }

  async function deleteRow(id) {
    if (!confirm("Delete this request? This cannot be undone.")) return;
    const { error } = await supabase.from("interest_submissions").delete().eq("id", id);
    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
    } else {
      setStatus({ type: "success", message: "Request deleted." });
      setItems((prev) => prev.filter((it) => it.id !== id));
    }
  }

  if (loading) return <p>Loading interest requests…</p>;

  return (
    <div className="admin-section">
      <h2>Interest Requests</h2>
      <p className="analytics-help">
        Submissions from Join, Onboard New Team, and Sponsorship forms. Update status and add
        notes about whether you have reached out.
      </p>

      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <button className="admin-save-btn" onClick={load}>Refresh</button>
      </div>

      {status.message && (
        <p className={status.type} style={{ marginBottom: "16px" }}>{status.message}</p>
      )}

      {items.length ? (
        <div className="interest-admin-list">
          {items.map((item) => (
            <div key={item.id} className="interest-admin-card">
              <div className="interest-admin-head">
                <span
                  className={`interest-kind-badge ${
                    item.kind === "join" ? "join" : item.kind === "sponsor" ? "sponsor" : "onboard"
                  }`}
                >
                  {item.kind === "join"
                    ? "Join request"
                    : item.kind === "sponsor"
                      ? "Sponsor request"
                      : "Onboard new team"}
                </span>
                <span className={`task-status-badge ${statusClass(item.status)}`}>
                  {item.status}
                </span>
                <span className="interest-admin-date">
                  {new Date(item.created_at).toLocaleString()}
                </span>
              </div>

              {item.kind === "join" ? (
                <dl className="interest-admin-fields">
                  <div><dt>Name</dt><dd>{item.full_name || "—"}</dd></div>
                  <div><dt>Grade</dt><dd>{item.grade || "—"}</dd></div>
                  <div>
                    <dt>Email</dt>
                    <dd>{item.email ? <a href={`mailto:${item.email}`}>{item.email}</a> : "—"}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{item.phone ? <a href={`tel:${item.phone}`}>{item.phone}</a> : "—"}</dd>
                  </div>
                  <div><dt>Heard via</dt><dd>{item.heard_about || "—"}</dd></div>
                  <div className="interest-admin-wide"><dt>Intro</dt><dd>{item.intro || "—"}</dd></div>
                </dl>
              ) : item.kind === "sponsor" ? (
                <dl className="interest-admin-fields">
                  <div><dt>Name</dt><dd>{item.full_name || "—"}</dd></div>
                  <div>
                    <dt>Email</dt>
                    <dd>{item.email ? <a href={`mailto:${item.email}`}>{item.email}</a> : "—"}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{item.phone ? <a href={`tel:${item.phone}`}>{item.phone}</a> : "—"}</dd>
                  </div>
                  <div><dt>Organization</dt><dd>{item.team_location || "—"}</dd></div>
                  <div><dt>Sponsorship level</dt><dd>{item.student_count || "Not sure yet"}</dd></div>
                  <div className="interest-admin-wide">
                    <dt>Message</dt><dd>{item.additional_info || "—"}</dd>
                  </div>
                </dl>
              ) : (
                <dl className="interest-admin-fields">
                  <div><dt>Name</dt><dd>{item.full_name || "—"}</dd></div>
                  <div><dt>Location</dt><dd>{item.team_location || "—"}</dd></div>
                  <div><dt>Students</dt><dd>{item.student_count || "—"}</dd></div>
                  <div><dt>Needs members</dt><dd>{item.needs_member_support || "—"}</dd></div>
                  <div><dt>Needs onboarding</dt><dd>{item.needs_onboarding_help || "—"}</dd></div>
                  <div className="interest-admin-wide">
                    <dt>Additional info</dt><dd>{item.additional_info || "—"}</dd>
                  </div>
                </dl>
              )}

              <div className="interest-admin-controls">
                <label>
                  Status
                  <select
                    value={item.status}
                    onChange={(e) => updateField(item.id, "status", e.target.value)}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="interest-admin-note">
                  Notes (have you reached / planning to reach?)
                  <textarea
                    value={item.coach_note || ""}
                    onChange={(e) => updateField(item.id, "coach_note", e.target.value)}
                    placeholder="e.g. Emailed on 6/24, waiting to hear back."
                  />
                </label>
                <div className="interest-admin-actions">
                  <button
                    className="admin-save-btn"
                    onClick={() => saveRow(item)}
                    disabled={savingId === item.id}
                  >
                    {savingId === item.id ? "Saving…" : "Save"}
                  </button>
                  <button className="admin-delete-btn" onClick={() => deleteRow(item.id)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p>No interest requests yet.</p>
      )}
    </div>
  );
}
