import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

export default function AnnouncementsAdminTab() {
  const { user, profile } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [form, setForm] = useState({ title: "", body: "" });
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("announcements")
      .select("id,title,body,author_name,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      setStatus({ type: "error", message: `Failed to load: ${error.message}` });
      setAnnouncements([]);
    } else {
      setAnnouncements(data || []);
    }
    setLoading(false);
  }

  async function postAnnouncement() {
    if (!form.title.trim()) {
      setStatus({ type: "error", message: "Announcement title is required" });
      return;
    }
    setPosting(true);
    const { error } = await supabase.from("announcements").insert({
      title: form.title.trim(),
      body: form.body.trim() || null,
      author_id: user?.id || null,
      author_name: profile?.displayName || "Coach"
    });
    setPosting(false);
    if (error) {
      setStatus({ type: "error", message: `Failed to post: ${error.message}` });
    } else {
      setForm({ title: "", body: "" });
      setStatus({ type: "success", message: "Announcement posted!" });
      load();
    }
  }

  async function deleteAnnouncement(id) {
    if (!confirm("Delete this announcement?")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
    } else {
      setStatus({ type: "success", message: "Announcement deleted." });
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    }
  }

  return (
    <div className="admin-section">
      <h2>Announcements</h2>
      <p className="analytics-help">
        Posted announcements appear on the Team Schedule page and notify all logged-in members.
      </p>

      {status.message && (
        <p className={status.type} style={{ marginBottom: "16px" }}>{status.message}</p>
      )}

      <div className="announcement-add" style={{ marginBottom: "24px" }}>
        <h3>Post an Announcement</h3>
        <input
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
        />
        <textarea
          placeholder="Write your announcement…"
          value={form.body}
          onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
        />
        <button
          type="button"
          className="admin-save-btn"
          onClick={postAnnouncement}
          disabled={posting}
        >
          {posting ? "Posting…" : "Post Announcement"}
        </button>
      </div>

      <h3>Posted Announcements</h3>
      {loading ? (
        <p>Loading…</p>
      ) : announcements.length ? (
        <ul className="announcement-list">
          {announcements.map((a) => (
            <li key={a.id} className="announcement-card">
              <div className="announcement-head">
                <h3>{a.title}</h3>
                <button
                  type="button"
                  className="admin-delete-btn"
                  onClick={() => deleteAnnouncement(a.id)}
                >
                  Delete
                </button>
              </div>
              {a.body && <p className="announcement-body">{a.body}</p>}
              <p className="announcement-meta">
                {a.author_name || "Coach"} · {new Date(a.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p>No announcements yet.</p>
      )}
    </div>
  );
}
