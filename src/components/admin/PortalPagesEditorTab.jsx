import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const PORTAL_PAGE_DEFS = [
  { slug: "home", label: "Home", defaultTitle: "FTC Team Portal", defaultSubtitle: "Welcome to Team 25795 - Architechs", defaultBody: "We are Team 25795 Architechs from Mechanicsburg, Pennsylvania." },
  { slug: "about", label: "Team Story", defaultTitle: "Our Journey", defaultSubtitle: "How Architechs grew through robotics", defaultBody: "Share your team story and milestones here." },
  { slug: "team", label: "Meet the Team", defaultTitle: "Team Members", defaultSubtitle: "Team 25795 - Architechs", defaultBody: "Introduce your team members here." },
  { slug: "schedule", label: "Schedule", defaultTitle: "Tasks", defaultSubtitle: "Upcoming plans for Team 25795", defaultBody: "Add your meeting schedule, competitions, and build sessions." },
  { slug: "resources", label: "Resources", defaultTitle: "Latest Updates", defaultSubtitle: "Helpful materials for our team and visitors", defaultBody: "Post announcements and learning resources here." },
  { slug: "sponsorship", label: "Sponsorship Needed", defaultBody: "Architechs is actively seeking sponsorship from local businesses and community organizations.", defaultContactEmail: "ftc25795@gmail.com" }
];

export default function PortalPagesEditorTab() {
  const [pages, setPages] = useState(PORTAL_PAGE_DEFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    loadPages();
  }, []);

  async function loadPages() {
    setLoading(true);
    const { data, error } = await supabase.from("portal_pages").select("slug,title,subtitle,body,contact_email");
    if (!error && data) {
      const bySlug = new Map(data.map((row) => [row.slug, row]));
      const merged = PORTAL_PAGE_DEFS.map((def) => {
        const row = bySlug.get(def.slug) || {};
        return {
          slug: def.slug,
          label: def.label,
          title: row.title || def.defaultTitle || "",
          subtitle: row.subtitle || def.defaultSubtitle || "",
          body: row.body || def.defaultBody || "",
          contactEmail: row.contact_email || def.defaultContactEmail || ""
        };
      });
      setPages(merged);
    }
    setLoading(false);
  }

  async function savePages() {
    setSaving(true);
    setStatus({ type: "", message: "" });
    const payload = pages.map((page) => ({
      slug: page.slug,
      title: page.title,
      subtitle: page.subtitle,
      body: page.body,
      contact_email: page.contactEmail || null
    }));
    const { error } = await supabase.from("portal_pages").upsert(payload, { onConflict: "slug" });
    setSaving(false);
    if (error) {
      setStatus({ type: "error", message: `Save failed: ${error.message}` });
    } else {
      setStatus({ type: "success", message: "Pages saved!" });
    }
  }

  function updatePage(slug, field, value) {
    setPages((prev) => prev.map((page) => (page.slug === slug ? { ...page, [field]: value } : page)));
  }

  if (loading) return <p>Loading pages...</p>;

  return (
    <div className="admin-section">
      <h2>Edit Portal Pages</h2>
      {status.message && <p className={status.type}>{status.message}</p>}
      <div className="admin-form">
        {pages.map((page) => (
          <div key={page.slug} className="portal-page-editor">
            <h3>{page.label}</h3>
            <label htmlFor={`title-${page.slug}`}>Title</label>
            <input id={`title-${page.slug}`} value={page.title} onChange={(e) => updatePage(page.slug, "title", e.target.value)} />
            <label htmlFor={`subtitle-${page.slug}`}>Subtitle</label>
            <input id={`subtitle-${page.slug}`} value={page.subtitle} onChange={(e) => updatePage(page.slug, "subtitle", e.target.value)} />
            <label htmlFor={`body-${page.slug}`}>Body</label>
            <textarea id={`body-${page.slug}`} value={page.body} onChange={(e) => updatePage(page.slug, "body", e.target.value)} />
            {page.slug === "sponsorship" && (
              <>
                <label htmlFor={`email-${page.slug}`}>Contact Email</label>
                <input id={`email-${page.slug}`} type="email" value={page.contactEmail} onChange={(e) => updatePage(page.slug, "contactEmail", e.target.value)} />
              </>
            )}
          </div>
        ))}
        <button className="admin-save-btn" onClick={savePages} disabled={saving}>
          {saving ? "Saving..." : "Save All Pages"}
        </button>
      </div>
    </div>
  );
}
