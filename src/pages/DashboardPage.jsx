import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { defaultNavItems } from "../config/dashboardDefaults";
import { useAuth } from "../context/AuthContext";

function mergeMenuItems(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [...defaultNavItems];
  }

  const byId = new Map(rows.map((row) => [row.id, row]));
  return defaultNavItems.map((defaultItem) => {
    const dbItem = byId.get(defaultItem.id);
    if (!dbItem) {
      return defaultItem;
    }

    return {
      id: defaultItem.id,
      title: dbItem.title || defaultItem.title,
      content: dbItem.content || defaultItem.content
    };
  });
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState(defaultNavItems);
  const [selectedId, setSelectedId] = useState(defaultNavItems[0].id);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const [menuResp, announcementResp] = await Promise.all([
        supabase.from("menu_items").select("id,title,content"),
        supabase
          .from("announcements")
          .select("id,title,body,author_name,created_at")
          .order("created_at", { ascending: false })
          .limit(20)
      ]);
      if (!active) return;

      if (menuResp.error) {
        setItems(defaultNavItems);
      } else {
        setItems(mergeMenuItems(menuResp.data));
      }

      setAnnouncements(Array.isArray(announcementResp.data) ? announcementResp.data : []);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) || items[0] || defaultNavItems[0],
    [items, selectedId]
  );

  if (loading) {
    return <p>Loading dashboard...</p>;
  }

  return (
    <section className="app-shell-page">
      <section className="content">
        <header>
          <h1>Welcome, {profile.displayName}</h1>
        </header>

        <article className="content-card">
          <button
            type="button"
            className="announcements-toggle"
            onClick={() => setAnnouncementsOpen((v) => !v)}
            aria-expanded={announcementsOpen}
          >
            <span className="announcements-caret" aria-hidden="true">
              {announcementsOpen ? "▾" : "▸"}
            </span>
            Announcements
            {announcements.length > 0 ? (
              <span className="announcements-count">{announcements.length}</span>
            ) : null}
          </button>

          {announcementsOpen ? (
            announcements.length ? (
              <ul className="announcement-list">
                {announcements.map((a) => (
                  <li key={a.id} className="announcement-card">
                    <div className="announcement-head">
                      <h3>{a.title}</h3>
                    </div>
                    {a.body ? <p className="announcement-body">{a.body}</p> : null}
                    <p className="announcement-meta">
                      {a.author_name || "Coach"} · {new Date(a.created_at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="announcement-empty">No announcements yet.</p>
            )
          ) : null}
        </article>

        <article className="content-card">
          <h3>{selectedItem.title}</h3>
          <p>{selectedItem.content}</p>
          {(profile.isCoach || profile.isPortalAdmin) ? (
            <p className="success">Coach/Portal Admin tools migration is next. Your role is detected.</p>
          ) : null}
        </article>
      </section>
    </section>
  );
}
