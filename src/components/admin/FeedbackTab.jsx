import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function FeedbackTab() {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    loadFeedback();
  }, []);

  async function loadFeedback() {
    setLoading(true);
    const { data, error } = await supabase
      .from("feedback")
      .select("id, page_slug, name, email, comment, created_at, is_approved")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      setStatus({ type: "error", message: `Failed to load feedback: ${error.message}` });
      setFeedback([]);
    } else {
      setFeedback(data || []);
    }
    setLoading(false);
  }

  async function deleteFeedback(id) {
    if (!confirm("Delete this feedback?")) return;
    const { error } = await supabase.from("feedback").delete().eq("id", id);
    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
    } else {
      setStatus({ type: "success", message: "Feedback deleted!" });
      loadFeedback();
    }
  }

  async function toggleApproval(item) {
    const next = !item.is_approved;
    setFeedback((prev) => prev.map((f) => (f.id === item.id ? { ...f, is_approved: next } : f)));
    const { error } = await supabase.from("feedback").update({ is_approved: next }).eq("id", item.id);
    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
      loadFeedback();
    } else {
      setStatus({
        type: "success",
        message: next ? "Comment approved \u2014 now visible publicly." : "Comment hidden from public."
      });
    }
  }

  function exportToCSV() {
    if (!feedback.length) {
      setStatus({ type: "error", message: "No feedback to export" });
      return;
    }

    const headers = ["Page", "Name", "Email", "Comment", "Date"];
    const rows = feedback.map((item) => [
      item.page_slug || "unknown",
      item.name || "Anonymous",
      item.email || "-",
      `"${(item.comment || "").replaceAll('"', '""')}"`,
      new Date(item.created_at).toLocaleString()
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `portal-feedback-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    setStatus({ type: "success", message: "Feedback exported to CSV!" });
  }

  if (loading) return <p>Loading feedback...</p>;

  return (
    <div className="admin-section">
      <h2>Visitor Feedback</h2>
      <p className="analytics-help">Latest feedback from portal visitors (max 100). Only approved comments appear publicly.</p>

      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <button className="admin-save-btn" onClick={loadFeedback}>
          Refresh
        </button>
        <button className="admin-save-btn" onClick={exportToCSV}>
          Export to CSV
        </button>
      </div>

      {status.message && <p className={status.type} style={{ marginBottom: "16px" }}>{status.message}</p>}

      {feedback.length ? (
        <div className="feedback-list">
          {feedback.map((item) => (
            <div key={item.id} className="feedback-card">
              <div className="feedback-header">
                <strong>{item.name || "Anonymous"}</strong>
                <span className="feedback-page">{item.page_slug}</span>
              </div>
              {item.email && <div className="feedback-email">{item.email}</div>}
              <div className="feedback-comment">{item.comment}</div>
              <div className="feedback-footer">
                <span className="feedback-date">{new Date(item.created_at).toLocaleString()}</span>
                <span className={item.is_approved ? "success" : ""} style={{ fontSize: "0.85rem" }}>
                  {item.is_approved ? "\u2713 Public" : "Hidden"}
                </span>
                <button className="admin-save-btn" onClick={() => toggleApproval(item)}>
                  {item.is_approved ? "Unapprove" : "Approve"}
                </button>
                <button className="admin-delete-btn" onClick={() => deleteFeedback(item.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p>No feedback yet.</p>
      )}
    </div>
  );
}
