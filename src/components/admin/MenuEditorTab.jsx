import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const DEFAULT_NAV_ITEMS = [
  { id: "announcements", title: "Announcements", content: "Coach notes, meeting reminders, and tournament updates go here." },
  { id: "schedule", title: "Tasks", content: "Track and manage what everyone on the team is working on" },
  { id: "resources", title: "Learning Resources", content: "Put links to tutorial videos, docs, and checklists here." },
  { id: "checklist", title: "Competition Checklist", content: "List what to pack before leaving: battery charger, spare parts, and notebook." }
];

export default function MenuEditorTab({ isCoach }) {
  const [items, setItems] = useState(DEFAULT_NAV_ITEMS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    loadMenuItems();
  }, []);

  async function loadMenuItems() {
    setLoading(true);
    const { data, error } = await supabase.from("menu_items").select("id,title,content");
    if (!error && data) {
      const merged = DEFAULT_NAV_ITEMS.map((def) => {
        const found = data.find((d) => d.id === def.id);
        return found ? { id: def.id, title: found.title, content: found.content } : def;
      });
      setItems(merged);
    }
    setLoading(false);
  }

  async function saveMenuItems() {
    setSaving(true);
    setStatus({ type: "", message: "" });
    const { error } = await supabase.from("menu_items").upsert(
      items.map((item) => ({ id: item.id, title: item.title, content: item.content })),
      { onConflict: "id" }
    );
    setSaving(false);
    if (error) {
      setStatus({ type: "error", message: `Save failed: ${error.message}` });
    } else {
      setStatus({ type: "success", message: "Menu items saved!" });
    }
  }

  function updateItem(id, field, value) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  if (loading) return <p>Loading menu items...</p>;
  if (!isCoach) return <p>Coaches only.</p>;

  return (
    <div className="admin-section">
      <h2>Edit Menu Items</h2>
      {status.message && <p className={status.type}>{status.message}</p>}
      <div className="admin-form">
        {items.map((item) => (
          <div key={item.id} className="menu-item-editor">
            <label htmlFor={`title-${item.id}`}>Title</label>
            <input
              id={`title-${item.id}`}
              value={item.title}
              onChange={(e) => updateItem(item.id, "title", e.target.value)}
            />
            <label htmlFor={`content-${item.id}`}>Content</label>
            <textarea
              id={`content-${item.id}`}
              value={item.content}
              onChange={(e) => updateItem(item.id, "content", e.target.value)}
            />
          </div>
        ))}
        <button className="admin-save-btn" onClick={saveMenuItems} disabled={saving}>
          {saving ? "Saving..." : "Save Menu Items"}
        </button>
      </div>
    </div>
  );
}
