import { useEffect, useMemo, useState } from "react";
import RouteLoading from "../components/RouteLoading";
import { usePortalPage } from "../hooks/usePortalPage";
import { useTrackVisit } from "../hooks/useTrackVisit";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { downloadCsv } from "../lib/exportCsv";
import { useResizableTable } from "../hooks/useResizableTable";

const EVENT_TYPES = ["Competition", "Other"];
const emptyEvent = { event_name: "", event_type: "Competition", address: "", event_date: "", notes: "", member_ids: [] };
const EVENT_COLUMNS = [
  { key: "event_name", label: "Event Name" },
  { key: "event_type", label: "Type" },
  { key: "address", label: "Address" },
  { key: "event_date", label: "Event Date" },
  { key: "notes", label: "Notes" },
  { key: "added_by", label: "Added By" },
  { key: "members", label: "Team Members" }
];

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

export default function EventsPage() {
  const page = usePortalPage("events");
  useTrackVisit("events");
  const { profile } = useAuth();
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyEvent);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [notesEventId, setNotesEventId] = useState(null);
  const [notesDraft, setNotesDraft] = useState("");
  const tableRef = useResizableTable();

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [eventsResp, membersResp] = await Promise.all([
      supabase.from("events").select("*").order("event_date", { ascending: true }),
      supabase.from("team_members").select("id,name").eq("is_active", true).order("name", { ascending: true })
    ]);
    setEvents(Array.isArray(eventsResp.data) ? eventsResp.data : []);
    setMembers(Array.isArray(membersResp.data) ? membersResp.data : []);
    setLoading(false);
  }

  const upcoming = useMemo(() => events.filter((event) => event.event_date >= isoToday()), [events]);
  const completed = useMemo(() => events.filter((event) => event.event_date < isoToday()).sort((a, b) => b.event_date.localeCompare(a.event_date)), [events]);
  const memberNames = (ids) => members.filter((member) => (ids || []).includes(member.id)).map((member) => member.name).join(", ") || "None";

  async function createEvent() {
    if (!form.event_name.trim() || !form.event_date) {
      setStatus({ type: "error", message: "Event name and date are required." });
      return;
    }
    const { error } = await supabase.from("events").insert({
      ...form,
      event_name: form.event_name.trim(),
      added_by: profile?.displayName || "Team member"
    });
    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
      return;
    }
    setForm(emptyEvent);
    setShowModal(false);
    setStatus({ type: "success", message: "Event created." });
    loadAll();
  }

  async function saveNotes(event, notes) {
    const { error } = await supabase.from("events").update({ notes: notes || null }).eq("id", event.id);
    if (error) setStatus({ type: "error", message: `Save failed: ${error.message}` });
    else setEvents((prev) => prev.map((item) => (item.id === event.id ? { ...item, notes } : item)));
  }

  const notesEvent = events.find((event) => event.id === notesEventId) || null;

  function openNotes(event) {
    setNotesEventId(event.id);
    setNotesDraft(event.notes || "");
  }

  async function saveNotesPopup() {
    if (!notesEvent) return;
    await saveNotes(notesEvent, notesDraft);
    setNotesEventId(null);
  }

  function notesPreview(event) {
    const text = String(event.notes || "").trim();
    if (!text) return "Add note";
    return text.length > 40 ? `${text.slice(0, 40)}…` : text;
  }

  function addedByInitials(name) {
    return String(name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("");
  }

  function exportEvents() {
    downloadCsv(`events-${isoToday()}.csv`, EVENT_COLUMNS, events.map((event) => ({ ...event, members: memberNames(event.member_ids) })));
  }

  function renderGrid(items, title) {
    return (
      <section className="landing-section">
        <h2>{title}</h2>
        {items.length ? (
          <div className="task-table-wrap"><table ref={tableRef} className="task-table event-table"><thead><tr>
            <th>Event Name</th><th>Type</th><th>Address</th><th>Event Date</th><th>Notes</th><th>Added By</th><th>Team Members</th>
          </tr></thead><tbody>{items.map((event) => (
            <tr key={event.id}><td>{event.event_name}</td><td>{event.event_type}</td><td>{event.address || "-"}</td><td>{event.event_date}</td><td><button type="button" className="task-notes-btn" onClick={() => openNotes(event)}>{notesPreview(event)}</button></td><td><span className="portfolio-added-by" title={event.added_by}>{addedByInitials(event.added_by)}</span></td><td>{memberNames(event.member_ids)}</td></tr>
          ))}</tbody></table></div>
        ) : <p>No {title.toLowerCase()}.</p>}
      </section>
    );
  }

  if (page.loading || loading) return <RouteLoading />;
  return (
    <section className="landing-page"><header className="landing-header"><h1>{page.title}</h1><p className="landing-tagline">{page.subtitle}</p></header><div className="landing-container">
      {status.message && <p className={status.type} role="status">{status.message}</p>}
      <div className="task-toolbar"><button className="admin-save-btn task-toolbar-btn" onClick={() => setShowModal(true)}>+ Create Event</button><button className="admin-save-btn task-toolbar-btn" onClick={exportEvents}>Export Events</button></div>
      {renderGrid(upcoming, "Upcoming Events")}
      {renderGrid(completed, "Completed Events")}
      {showModal && <div className="task-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}><div className="task-modal" role="dialog" aria-modal="true"><h3>Create Event</h3><div className="task-add-grid">
        <input placeholder="Event name" value={form.event_name} onChange={(e) => setForm((p) => ({ ...p, event_name: e.target.value }))} />
        <select value={form.event_type} onChange={(e) => setForm((p) => ({ ...p, event_type: e.target.value }))}>{EVENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
        <input placeholder="Address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
        <input type="date" value={form.event_date} onChange={(e) => setForm((p) => ({ ...p, event_date: e.target.value }))} />
        <select multiple value={form.member_ids} onChange={(e) => setForm((p) => ({ ...p, member_ids: Array.from(e.target.selectedOptions, (option) => option.value) }))}>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>
      </div><textarea className="task-notes-textarea" placeholder="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /><div className="task-modal-actions"><button className="activity-back" onClick={() => setShowModal(false)}>Cancel</button><button className="admin-save-btn" onClick={createEvent}>Create Event</button></div></div></div>}
      {notesEvent && <div className="task-modal-overlay" onClick={(e) => e.target === e.currentTarget && setNotesEventId(null)}><div className="task-modal" role="dialog" aria-modal="true"><h3>Notes — {notesEvent.event_name}</h3><p className="task-add-form-hint">Event notes</p><textarea className="task-notes-textarea task-notes-textarea-large" value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} autoFocus /><div className="task-modal-actions"><button className="activity-back" onClick={() => setNotesEventId(null)}>Cancel</button><button className="admin-save-btn" onClick={saveNotesPopup}>Save</button></div></div></div>}
    </div></section>
  );
}
