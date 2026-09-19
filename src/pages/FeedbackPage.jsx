import { useEffect, useState } from "react";
import { usePortalPage } from "../hooks/usePortalPage";
import { useTrackVisit } from "../hooks/useTrackVisit";
import { supabase } from "../lib/supabase";
import RouteLoading from "../components/RouteLoading";

export default function FeedbackPage() {
  const page = usePortalPage("feedback");
  useTrackVisit("feedback");
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState("success");
  const [list, setList] = useState([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [form, setForm] = useState({ page: "general", name: "", email: "", comment: "" });

  async function loadFeedback() {
    const { data } = await supabase
      .from("feedback")
      .select("id,page_slug,name,email,comment,created_at")
      .eq("is_approved", true)
      .order("created_at", { ascending: false })
      .limit(20);

    setList(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    loadFeedback();
  }, []);

  async function onSubmit(event) {
    event.preventDefault();

    if (!form.name.trim() || !form.comment.trim()) {
      setStatusType("error");
      setStatus("Please enter your name and feedback.");
      return;
    }

    const { error } = await supabase.from("feedback").insert({
      page_slug: form.page,
      name: form.name.trim(),
      email: form.email.trim() || null,
      comment: form.comment.trim(),
      created_at: new Date().toISOString()
    });

    if (error) {
      setStatusType("error");
      setStatus(`Could not save feedback: ${error.message}`);
      return;
    }

    setStatusType("success");
    setStatus("Thank you! Your feedback has been submitted.");
    setForm({ page: "general", name: "", email: "", comment: "" });
    loadFeedback();
  }

  if (page.loading) {
    return <RouteLoading />;
  }

  return (
    <section className="landing-page">
      <header className="landing-header">
        <h1>{page.title || "Feedback"}</h1>
        <p className="landing-tagline">{page.subtitle}</p>
      </header>
      <div className="landing-container">
        <section className="landing-section">
          <h2>Send Us Feedback</h2>
          <form className="admin-form" onSubmit={onSubmit}>
            <label htmlFor="fbPage">Which page is this about?</label>
            <select id="fbPage" value={form.page} onChange={(e) => setForm((v) => ({ ...v, page: e.target.value }))}>
              <option value="general">General / All Pages</option>
              <option value="home">Home</option>
              <option value="about">Team Story</option>
              <option value="team">Meet the Team</option>
              {/* <option value="schedule">Schedule</option> */}
              <option value="sponsors">Sponsors</option>
              <option value="resources">Resources</option>
            </select>
            <label htmlFor="fbName">Your Name</label>
            <input id="fbName" value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} />
            <label htmlFor="fbEmail">Email (optional)</label>
            <input id="fbEmail" type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} />
            <label htmlFor="fbComment">Your Feedback</label>
            <textarea id="fbComment" value={form.comment} onChange={(e) => setForm((v) => ({ ...v, comment: e.target.value }))} />
            <button type="submit" className="admin-save-btn">Send Feedback</button>
            <p className={statusType}>{status}</p>
          </form>
        </section>
        <section className="landing-section">
          <button
            type="button"
            className="announcements-toggle"
            onClick={() => setCommentsOpen((v) => !v)}
            aria-expanded={commentsOpen}
          >
            <span className="announcements-caret">{commentsOpen ? "\u25BE" : "\u25B8"}</span>
            Recent Comments
            {list.length ? <span className="announcements-count">{list.length}</span> : null}
          </button>
          {commentsOpen && (
            <div>
              {list.length ? list.map((item) => (
                <article className="feedback-item" key={item.id}>
                  <p><strong>{item.name || "Guest"}</strong> - <em>{item.page_slug || "general"}</em></p>
                  <p>{item.comment || ""}</p>
                </article>
              )) : <p>No feedback yet.</p>}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
