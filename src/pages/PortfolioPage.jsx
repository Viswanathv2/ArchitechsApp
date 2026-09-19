import { useEffect, useState } from "react";
import RouteLoading from "../components/RouteLoading";
import { usePortalPage } from "../hooks/usePortalPage";
import { useTrackVisit } from "../hooks/useTrackVisit";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { useResizableTable } from "../hooks/useResizableTable";

const BUCKET = "event-media";
const emptyForm = { document_name: "", notes: "", working_by: "" };

export default function PortfolioPage() {
  const page = usePortalPage("portfolio");
  useTrackVisit("portfolio");
  const { profile } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const tableRef = useResizableTable();
  const [notesDocumentId, setNotesDocumentId] = useState(null);
  const [notesDraft, setNotesDraft] = useState("");

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [docsResp, membersResp] = await Promise.all([
      supabase.from("portfolio_documents").select("*").order("created_at", { ascending: false }),
      supabase.from("team_members").select("id,name").eq("is_active", true).order("name", { ascending: true })
    ]);
    setDocuments(Array.isArray(docsResp.data) ? docsResp.data : []);
    setMembers(Array.isArray(membersResp.data) ? membersResp.data : []);
    setLoading(false);
  }

  async function uploadDocument() {
    if (!file || !form.document_name.trim()) {
      setStatus({ type: "error", message: "Document name and file are required." });
      return;
    }
    const extension = file.name.split(".").pop();
    const path = `portfolio/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
    if (uploadError) {
      setStatus({ type: "error", message: `Upload failed: ${uploadError.message}` });
      return;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const previous = documents.find((document) => document.document_name.toLowerCase() === form.document_name.trim().toLowerCase());
    const { error } = await supabase.from("portfolio_documents").insert({
      document_name: form.document_name.trim(), document_url: data.publicUrl, storage_path: path,
      original_filename: file.name,
      version: previous ? previous.version + 1 : 1, added_by: profile?.displayName || "Team member",
      notes: form.notes.trim() || null, working_by: form.working_by || null
    });
    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
      return;
    }
    setForm(emptyForm); setFile(null); setShowModal(false); setStatus({ type: "success", message: "Portfolio document added." }); loadAll();
  }

  async function saveWorking(document, workingBy) {
    const { error } = await supabase.from("portfolio_documents").update({ working_by: workingBy || null }).eq("id", document.id);
    if (error) setStatus({ type: "error", message: `Save failed: ${error.message}` });
    else loadAll();
  }

  async function saveNotes(document, notes) {
    const { error } = await supabase.from("portfolio_documents").update({ notes: notes || null }).eq("id", document.id);
    if (error) setStatus({ type: "error", message: `Save failed: ${error.message}` });
    else setDocuments((prev) => prev.map((item) => (item.id === document.id ? { ...item, notes } : item)));
  }

  const notesDocument = documents.find((document) => document.id === notesDocumentId) || null;

  function openNotes(document) {
    setNotesDocumentId(document.id);
    setNotesDraft(document.notes || "");
  }

  async function saveNotesPopup() {
    if (!notesDocument) return;
    await saveNotes(notesDocument, notesDraft);
    setNotesDocumentId(null);
  }

  function notesPreview(document) {
    const text = String(document.notes || "").trim();
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

  if (page.loading || loading) return <RouteLoading />;
  return (
    <section className="landing-page"><header className="landing-header"><h1>{page.title}</h1><p className="landing-tagline">{page.subtitle}</p></header><div className="landing-container">
      {status.message && <p className={status.type} role="status">{status.message}</p>}
      <div className="task-toolbar"><button className="admin-save-btn task-toolbar-btn" onClick={() => setShowModal(true)}>+ Add Portfolio</button></div>
      <section className="landing-section"><h2>Portfolio Documents</h2>{documents.length ? <div className="task-table-wrap"><table ref={tableRef} className="task-table portfolio-table"><thead><tr><th>Portfolio Document</th><th>Added By</th><th>Date</th><th>Notes</th><th>Working On It</th><th>Version</th></tr></thead><tbody>{documents.map((document) => <tr key={document.id}><td><a href={document.document_url} target="_blank" rel="noreferrer" download={document.original_filename || document.document_name}>{document.document_name}</a></td><td><span className="portfolio-added-by" title={document.added_by}>{addedByInitials(document.added_by)}</span></td><td>{document.document_date}</td><td><button type="button" className="task-notes-btn" onClick={() => openNotes(document)}>{notesPreview(document)}</button></td><td><select value={document.working_by || ""} onChange={(e) => saveWorking(document, e.target.value)}><option value="">Nobody</option>{members.map((member) => <option key={member.id} value={member.name}>{member.name}</option>)}</select></td><td>v{document.version}</td></tr>)}</tbody></table></div> : <p>No portfolio documents yet.</p>}</section>
      {showModal && <div className="task-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}><div className="task-modal" role="dialog" aria-modal="true"><h3>Add Portfolio Document</h3><input className="task-input" placeholder="Document name" value={form.document_name} onChange={(e) => setForm((p) => ({ ...p, document_name: e.target.value }))} /><input className="task-input" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /><select className="task-input" value={form.working_by} onChange={(e) => setForm((p) => ({ ...p, working_by: e.target.value }))}><option value="">Nobody is working on it</option>{members.map((member) => <option key={member.id} value={member.name}>{member.name}</option>)}</select><textarea className="task-notes-textarea" placeholder="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /><div className="task-modal-actions"><button className="activity-back" onClick={() => setShowModal(false)}>Cancel</button><button className="admin-save-btn" onClick={uploadDocument}>Add Portfolio</button></div></div></div>}
      {notesDocument && <div className="task-modal-overlay" onClick={(e) => e.target === e.currentTarget && setNotesDocumentId(null)}><div className="task-modal" role="dialog" aria-modal="true"><h3>Notes — {notesDocument.document_name}</h3><p className="task-add-form-hint">Portfolio document notes</p><textarea className="task-notes-textarea task-notes-textarea-large" value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} autoFocus /><div className="task-modal-actions"><button className="activity-back" onClick={() => setNotesDocumentId(null)}>Cancel</button><button className="admin-save-btn" onClick={saveNotesPopup}>Save</button></div></div></div>}
    </div></section>
  );
}
