import { useEffect, useMemo, useState } from "react";
import RouteLoading from "../components/RouteLoading";
import Lightbox from "../components/Lightbox";
import { usePortalPage } from "../hooks/usePortalPage";
import { useTrackVisit } from "../hooks/useTrackVisit";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { downloadCsv } from "../lib/exportCsv";
import { useResizableTable } from "../hooks/useResizableTable";

const BUCKET = "event-media";

// Small circular placeholder avatar
const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' fill='%23e5e8f0'/%3E%3Ccircle cx='40' cy='32' r='16' fill='%23a8aec4'/%3E%3Cpath d='M 10 74 Q 10 50 40 50 Q 70 50 70 74 Z' fill='%23a8aec4'/%3E%3C/svg%3E";

const ISSUE_TYPES = ["CAD", "BUILD", "CODE", "PORTFOLIO", "OTHER"];
const STATUS_OPTIONS = ["Open", "In Progress", "Resolved", "Closed"];
const CLOSED_STATUS = "Closed";

function statusClass(status) {
  switch (status) {
    case "Closed":
      return "task-status-completed";
    case "Resolved":
      return "task-status-progress";
    case "In Progress":
      return "task-status-blocked";
    default:
      return "task-status-pending";
  }
}

const emptyIssue = {
  memberKey: "",
  issue_title: "",
  issue_type: ISSUE_TYPES[0],
  status: STATUS_OPTIONS[0],
  opened_date: "",
  closed_date: "",
  notes: "",
  images: []
};

// Closed date may not be earlier than the opened date (same day is fine).
function isClosedDateValid(openedDate, closedDate) {
  if (!closedDate || !openedDate) return true;
  return closedDate >= openedDate;
}

const ISSUE_COLUMNS = [
  { key: "member_name", label: "Member" },
  { key: "member_type", label: "Type" },
  { key: "issue_title", label: "Issue Title" },
  { key: "issue_type", label: "Issue Type" },
  { key: "status", label: "Status" },
  { key: "opened_date", label: "Opened" },
  { key: "closed_date", label: "Closed" },
  { key: "notes", label: "Notes" },
  { key: "archived", label: "Archived" },
  { key: "archived_by", label: "Archived By" }
];

export default function IssuesPage() {
  const page = usePortalPage("issues");
  useTrackVisit("issues");
  const { user, profile } = useAuth();

  const [members, setMembers] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [memberFilter, setMemberFilter] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newIssue, setNewIssue] = useState(emptyIssue);
  const [creating, setCreating] = useState(false);

  const [showClosed, setShowClosed] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  const [notesIssueId, setNotesIssueId] = useState(null);
  const [notesDraft, setNotesDraft] = useState("");

  const [photosIssueId, setPhotosIssueId] = useState(null);
  const [photosUploading, setPhotosUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const tableRef = useResizableTable();

  const isCoach = Boolean(profile?.isCoach || profile?.isPortalAdmin);
  const myEmail = String(user?.email || "").trim().toLowerCase();
  const myDisplayName = profile?.displayName || user?.email || "Someone";

  useEffect(() => {
    loadAll();
  }, []);

  // Close whichever popup is open on Escape.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== "Escape") return;
      setShowCreateModal(false);
      setNotesIssueId(null);
      setPhotosIssueId(null);
      setLightboxIndex(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  async function loadAll() {
    setLoading(true);
    const [membersResp, coachesResp, mentorsResp, issuesResp] = await Promise.all([
      supabase
        .from("team_members")
        .select("id,name,roles,image_url,email")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase
        .from("coaches")
        .select("id,name,role,image_url,email")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase
        .from("mentors")
        .select("id,name,role,image_url,email")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase
        .from("issues")
        .select("id,member_id,member_type,issue_title,issue_type,notes,status,opened_date,closed_date,images,is_archived,archived_at,archived_by,created_at")
        .order("created_at", { ascending: true })
    ]);

    const teamMembers = (Array.isArray(membersResp.data) ? membersResp.data : []).map((m) => ({
      ...m,
      type: "team_member",
      typeLabel: "Member"
    }));
    const coaches = (Array.isArray(coachesResp.data) ? coachesResp.data : []).map((m) => ({
      ...m,
      type: "coach",
      typeLabel: "Coach"
    }));
    const mentors = (Array.isArray(mentorsResp.data) ? mentorsResp.data : []).map((m) => ({
      ...m,
      type: "mentor",
      typeLabel: "Mentor"
    }));

    setMembers([...teamMembers, ...coaches, ...mentors]);
    setIssues(Array.isArray(issuesResp.data) ? issuesResp.data : []);
    setLoading(false);
  }

  // The member record (team member, coach, or mentor) matching the signed-in
  // user's email, if any. Non-coaches can only create issues under this record.
  const selfMember = useMemo(
    () => members.find((m) => String(m.email || "").trim().toLowerCase() === myEmail) || null,
    [members, myEmail]
  );

  useEffect(() => {
    if (!isCoach && selfMember) {
      setNewIssue((p) => (p.memberKey ? p : { ...p, memberKey: `${selfMember.type}:${selfMember.id}` }));
    }
  }, [isCoach, selfMember]);

  const memberByKey = useMemo(() => {
    const map = new Map();
    for (const m of members) {
      map.set(`${m.type}:${m.id}`, m);
    }
    return map;
  }, [members]);

  const enrichedIssues = useMemo(
    () =>
      issues.map((i) => ({
        ...i,
        member: memberByKey.get(`${i.member_type}:${i.member_id}`) || null
      })),
    [issues, memberByKey]
  );

  const filteredIssues = useMemo(() => {
    const term = memberFilter.trim().toLowerCase();
    if (!term) return enrichedIssues;
    return enrichedIssues.filter((i) => String(i.member?.name || "").toLowerCase().includes(term));
  }, [enrichedIssues, memberFilter]);

  const activeIssues = useMemo(() => filteredIssues.filter((i) => !i.is_archived), [filteredIssues]);
  const archivedIssues = useMemo(
    () =>
      filteredIssues
        .filter((i) => i.is_archived)
        .sort((a, b) => new Date(b.archived_at || b.created_at) - new Date(a.archived_at || a.created_at)),
    [filteredIssues]
  );

  const openIssues = useMemo(
    () =>
      activeIssues
        .filter((i) => i.status !== CLOSED_STATUS)
        .sort((a, b) => {
          const aDate = a.opened_date || "9999-12-31";
          const bDate = b.opened_date || "9999-12-31";
          if (aDate !== bDate) return aDate < bDate ? -1 : 1;
          return String(a.member?.name || "").localeCompare(String(b.member?.name || ""));
        }),
    [activeIssues]
  );

  const closedIssues = useMemo(
    () =>
      activeIssues
        .filter((i) => i.status === CLOSED_STATUS)
        .sort((a, b) => String(a.member?.name || "").localeCompare(String(b.member?.name || ""))),
    [activeIssues]
  );

  function canEditIssue(i) {
    if (isCoach) return true;
    const email = String(i.member?.email || "").trim().toLowerCase();
    return Boolean(email && myEmail && email === myEmail);
  }

  async function uploadOneImage(file) {
    const ext = file.name.split(".").pop();
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const path = `issues/${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, path };
  }

  async function addNewIssueImages(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setCreating(true);
    try {
      const uploaded = [];
      for (const file of files) {
        uploaded.push(await uploadOneImage(file));
      }
      setNewIssue((p) => ({ ...p, images: [...p.images, ...uploaded] }));
    } catch (err) {
      setStatus({ type: "error", message: `Upload failed: ${err.message}` });
    }
    setCreating(false);
  }

  function removeNewIssueImage(index) {
    setNewIssue((p) => ({ ...p, images: p.images.filter((_, idx) => idx !== index) }));
  }

  async function createIssue() {
    if (!newIssue.issue_title.trim()) {
      setStatus({ type: "error", message: "Issue title is required" });
      return;
    }
    if (!isClosedDateValid(newIssue.opened_date, newIssue.closed_date)) {
      setStatus({ type: "error", message: "Closed date can't be earlier than the opened date." });
      return;
    }
    if (newIssue.status === "Closed" && !newIssue.closed_date) {
      setStatus({ type: "error", message: "Set a closed date before creating a closed issue." });
      return;
    }
    const target = isCoach ? memberByKey.get(newIssue.memberKey) : selfMember;
    if (!target) {
      setStatus({
        type: "error",
        message: isCoach ? "Choose who this issue is for" : "We couldn't match your account to a team member"
      });
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("issues").insert({
      member_id: target.id,
      member_type: target.type,
      issue_title: newIssue.issue_title.trim(),
      issue_type: newIssue.issue_type,
      status: newIssue.status,
      opened_date: newIssue.opened_date || null,
      closed_date: newIssue.closed_date || null,
      notes: newIssue.notes.trim() || null,
      images: newIssue.images
    });
    setCreating(false);
    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
    } else {
      setNewIssue((p) => ({ ...emptyIssue, memberKey: isCoach ? "" : p.memberKey }));
      setStatus({ type: "success", message: "Issue created!" });
      setShowCreateModal(false);
      loadAll();
    }
  }

  async function updateIssueField(id, field, value) {
    const current = issues.find((issue) => issue.id === id);
    if (field === "status" && value === "Closed") {
      const today = new Date().toISOString().slice(0, 10);
      setIssues((prev) => prev.map((issue) => (issue.id === id ? { ...issue, status: value, closed_date: issue.closed_date || today } : issue)));
      const { error } = await supabase.from("issues").update({ status: value, closed_date: current?.closed_date || today }).eq("id", id);
      if (error) {
        setStatus({ type: "error", message: `Save failed: ${error.message}` });
        loadAll();
      }
      return;
    }
    if (field === "closed_date" && current?.status === "Closed" && !value) {
      setStatus({ type: "error", message: "A closed issue must have a closed date." });
      return;
    }
    if (field === "status" && value !== "Closed") {
      setIssues((prev) => prev.map((issue) => (issue.id === id ? { ...issue, status: value, closed_date: null } : issue)));
      const { error } = await supabase.from("issues").update({ status: value, closed_date: null }).eq("id", id);
      if (error) {
        setStatus({ type: "error", message: `Save failed: ${error.message}` });
        loadAll();
      }
      return;
    }
    if (field === "opened_date" || field === "closed_date") {
      const current = issues.find((i) => i.id === id);
      const nextOpened = field === "opened_date" ? value : current?.opened_date;
      const nextClosed = field === "closed_date" ? value : current?.closed_date;
      if (!isClosedDateValid(nextOpened, nextClosed)) {
        setStatus({ type: "error", message: "Closed date can't be earlier than the opened date." });
        return;
      }
    }
    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
    const payload = field.endsWith("_date") ? { [field]: value || null } : { [field]: value };
    const { error } = await supabase.from("issues").update(payload).eq("id", id);
    if (error) {
      setStatus({ type: "error", message: `Save failed: ${error.message}` });
      loadAll();
    }
  }

  async function archiveIssue(id) {
    if (!confirm("Delete this issue? It will be moved to the Archive section.")) return;
    const { error } = await supabase
      .from("issues")
      .update({ is_archived: true, archived_at: new Date().toISOString(), archived_by: myDisplayName })
      .eq("id", id);
    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
    } else {
      setStatus({ type: "success", message: "Issue moved to archive." });
      loadAll();
    }
  }


  const notesIssue = enrichedIssues.find((i) => i.id === notesIssueId) || null;
  const notesEditable = Boolean(notesIssue);

  function openNotes(i) {
    setNotesIssueId(i.id);
    setNotesDraft(i.notes || "");
  }

  async function saveNotes() {
    if (!notesIssue) return;
    await updateIssueField(notesIssue.id, "notes", notesDraft);
    setNotesIssueId(null);
  }

  function notesPreview(i) {
    const text = String(i.notes || "").trim();
    if (!text) return "Add note";
    return text.length > 40 ? `${text.slice(0, 40)}…` : text;
  }

  const photosIssue = enrichedIssues.find((i) => i.id === photosIssueId) || null;
  const photosEditable = Boolean(photosIssue && canEditIssue(photosIssue));

  async function addPhotos(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length || !photosIssue) return;
    setPhotosUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        uploaded.push(await uploadOneImage(file));
      }
      const nextImages = [...(photosIssue.images || []), ...uploaded];
      await updateIssueField(photosIssue.id, "images", nextImages);
    } catch (err) {
      setStatus({ type: "error", message: `Upload failed: ${err.message}` });
    }
    setPhotosUploading(false);
  }

  async function removePhoto(index) {
    if (!photosIssue) return;
    const image = photosIssue.images[index];
    if (image?.path) {
      await supabase.storage.from(BUCKET).remove([image.path]);
    }
    const nextImages = photosIssue.images.filter((_, idx) => idx !== index);
    await updateIssueField(photosIssue.id, "images", nextImages);
  }

  function photosLabel(i) {
    const count = Array.isArray(i.images) ? i.images.length : 0;
    return count ? `${count} photo${count === 1 ? "" : "s"}` : "Add photo";
  }

  function exportIssuesCsv() {
    const rows = filteredIssues.map((i) => ({
      member_name: i.member?.name || "Unknown",
      member_type: i.member?.typeLabel || "",
      issue_title: i.issue_title,
      issue_type: i.issue_type,
      status: i.status,
      opened_date: i.opened_date || "",
      closed_date: i.closed_date || "",
      notes: i.notes || "",
      archived: i.is_archived ? "Yes" : "No",
      archived_by: i.archived_by || ""
    }));
    downloadCsv(`issues-${new Date().toISOString().slice(0, 10)}.csv`, ISSUE_COLUMNS, rows);
  }

  function renderIssueRow(i, { archived = false } = {}) {
    const editable = !archived && canEditIssue(i);
    return (
      <tr key={i.id}>
        <td>
          <div className="task-member-cell">
            <span className="activity-avatar" title={i.member?.name || "Unknown member"}>
              <img src={i.member?.image_url || DEFAULT_AVATAR} alt={i.member?.name || "Member"} />
            </span>
          </div>
        </td>
        <td>
          {editable ? (
            <input
              className="task-input"
              value={i.issue_title}
              onChange={(e) => updateIssueField(i.id, "issue_title", e.target.value)}
            />
          ) : (
            i.issue_title
          )}
        </td>
        <td>
          {editable ? (
            <select
              className="task-input"
              value={i.issue_type}
              onChange={(e) => updateIssueField(i.id, "issue_type", e.target.value)}
            >
              {ISSUE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          ) : (
            i.issue_type
          )}
        </td>
        <td>
          <button type="button" className="task-notes-btn" onClick={() => openNotes(i)}>
            {notesPreview(i)}
          </button>
        </td>
        <td>
          {editable ? (
            <select
              className={`task-input task-status-select ${statusClass(i.status)}`}
              value={i.status}
              onChange={(e) => updateIssueField(i.id, "status", e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          ) : (
            <span className={`task-status-badge ${statusClass(i.status)}`}>{i.status}</span>
          )}
        </td>
        <td>
          {editable ? (
            <input
              type="date"
              className="task-input"
              value={i.opened_date || ""}
              onChange={(e) => updateIssueField(i.id, "opened_date", e.target.value)}
            />
          ) : (
            i.opened_date || "—"
          )}
        </td>
        <td>
          {editable ? (
            <input
              type="date"
              className="task-input"
              aria-label="Issue closed date"
              value={i.closed_date || ""}
              min={i.opened_date || undefined}
              onChange={(e) => updateIssueField(i.id, "closed_date", e.target.value)}
            />
          ) : (
            i.closed_date || "—"
          )}
        </td>
        <td>
          <button type="button" className="task-notes-btn" onClick={() => { setPhotosIssueId(i.id); setLightboxIndex(null); }}>
            {photosLabel(i)}
          </button>
        </td>
        <td>
          {archived ? (
            <span className="task-member-type">
              {i.archived_by ? `Deleted by ${i.archived_by}` : "Deleted"}
              {i.archived_at ? ` · ${new Date(i.archived_at).toLocaleDateString()}` : ""}
            </span>
          ) : (
            editable && (
              <button className="admin-delete-btn" aria-label="Delete issue" title="Delete issue" onClick={() => archiveIssue(i.id)}>
                ×
              </button>
            )
          )}
        </td>
      </tr>
    );
  }

  if (page.loading || loading) {
    return <RouteLoading />;
  }

  const canCreateIssue = isCoach || Boolean(selfMember);

  return (
    <section className="landing-page">
      <header className="landing-header">
        <h1>{page.title || "Issues"}</h1>
        <p className="landing-tagline">{page.subtitle || "Track CAD, Build, Code, and Portfolio issues"}</p>
      </header>

      <div className="landing-container">
        {status.message && (
          <p className={status.type} role="status">{status.message}</p>
        )}

        <div className="task-toolbar">
          {canCreateIssue && (
            <button
              type="button"
              className="admin-save-btn task-toolbar-btn"
              onClick={() => {
                setNewIssue((p) => ({ ...emptyIssue, memberKey: isCoach ? "" : p.memberKey }));
                setShowCreateModal(true);
              }}
            >
              + Create Issue
            </button>
          )}
          <button type="button" className="admin-save-btn task-toolbar-btn" onClick={exportIssuesCsv}>
            Export Issues
          </button>
          <input
            className="task-input issue-member-filter"
            placeholder="Filter by member…"
            aria-label="Filter by member"
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
          />
        </div>
        {!canCreateIssue && (
          <p className="activity-hint">
            Your account isn&apos;t linked to a team member record yet, so you can&apos;t create issues. Ask
            a coach to add your login email to your team member profile.
          </p>
        )}

        <section className="landing-section">
          <h2>Open Issues</h2>
          {openIssues.length ? (
            <div className="task-table-wrap">
              <table ref={tableRef} className="task-table issue-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Issue Title</th>
                    <th>Issue Type</th>
                    <th>Notes</th>
                    <th>Status</th>
                    <th>Opened</th>
                    <th>Closed</th>
                    <th>Photos</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>{openIssues.map((i) => renderIssueRow(i))}</tbody>
              </table>
            </div>
          ) : (
            <p>No open issues right now.</p>
          )}
        </section>

        <div className="task-section-heading">
          <h2>Closed Issues ({closedIssues.length})</h2>
          <button type="button" className="task-collapse-toggle" onClick={() => setShowClosed((v) => !v)}>
            {showClosed ? "Collapse" : "Expand"}
          </button>
        </div>
        {showClosed && (
          closedIssues.length ? (
            <div className="task-table-wrap">
              <table ref={tableRef} className="task-table issue-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Issue Title</th>
                    <th>Issue Type</th>
                    <th>Notes</th>
                    <th>Status</th>
                    <th>Opened</th>
                    <th>Closed</th>
                    <th>Photos</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>{closedIssues.map((i) => renderIssueRow(i))}</tbody>
              </table>
            </div>
          ) : (
            <p>No closed issues yet.</p>
          )
        )}

        <div className="task-section-heading">
          <h2>Archive ({archivedIssues.length})</h2>
          <button type="button" className="task-collapse-toggle" onClick={() => setShowArchive((v) => !v)}>
            {showArchive ? "Collapse" : "Expand"}
          </button>
        </div>
        {showArchive && (
          archivedIssues.length ? (
            <div className="task-table-wrap">
              <table ref={tableRef} className="task-table issue-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Issue Title</th>
                    <th>Issue Type</th>
                    <th>Notes</th>
                    <th>Status</th>
                    <th>Opened</th>
                    <th>Closed</th>
                    <th>Photos</th>
                    <th>Audit</th>
                  </tr>
                </thead>
                <tbody>{archivedIssues.map((i) => renderIssueRow(i, { archived: true }))}</tbody>
              </table>
            </div>
          ) : (
            <p>No archived issues.</p>
          )
        )}
      </div>

      {showCreateModal && (
        <div className="task-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}>
          <div className="task-modal" role="dialog" aria-modal="true">
            <h3>Create Issue</h3>
            {!isCoach && selfMember && (
              <p className="task-add-form-hint">This issue will be created under your name, {selfMember.name}.</p>
            )}
            <div className="task-add-grid">
              {isCoach && (
                <select
                  aria-label="Assign to"
                  value={newIssue.memberKey}
                  onChange={(e) => setNewIssue((p) => ({ ...p, memberKey: e.target.value }))}
                >
                  <option value="">Assign to…</option>
                  {members.map((m) => (
                    <option key={`${m.type}:${m.id}`} value={`${m.type}:${m.id}`}>
                      {m.name} ({m.typeLabel})
                    </option>
                  ))}
                </select>
              )}
              <input
                placeholder="Issue title"
                value={newIssue.issue_title}
                onChange={(e) => setNewIssue((p) => ({ ...p, issue_title: e.target.value }))}
              />
              <select
                aria-label="Issue type"
                value={newIssue.issue_type}
                onChange={(e) => setNewIssue((p) => ({ ...p, issue_type: e.target.value }))}
              >
                {ISSUE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select
                aria-label="Status"
                value={newIssue.status}
                onChange={(e) => setNewIssue((p) => ({ ...p, status: e.target.value, closed_date: e.target.value === "Closed" ? (p.closed_date || new Date().toISOString().slice(0, 10)) : "" }))}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input
                type="date"
                aria-label="Opened date"
                value={newIssue.opened_date}
                onChange={(e) => setNewIssue((p) => ({ ...p, opened_date: e.target.value }))}
              />
              <input
                type="date"
                aria-label="Closed date"
                value={newIssue.closed_date}
                min={newIssue.opened_date || undefined}
                onChange={(e) => setNewIssue((p) => ({ ...p, closed_date: e.target.value }))}
              />
            </div>
            <textarea
              className="task-notes-textarea"
              placeholder="Notes (optional)"
              aria-label="Notes"
              value={newIssue.notes}
              onChange={(e) => setNewIssue((p) => ({ ...p, notes: e.target.value }))}
            />
            <label className="issue-photos-label">Photos</label>
            <div className="issue-photos-grid">
              {newIssue.images.map((img, index) => (
                <div className="issue-photo-thumb" key={img.path || index}>
                  <img src={img.url} alt="" onClick={() => setLightboxIndex(index)} role="button" />
                  <button type="button" onClick={() => removeNewIssueImage(index)} aria-label="Remove photo">×</button>
                </div>
              ))}
              <label className="issue-photo-add">
                +
                <input type="file" accept="image/*" multiple onChange={addNewIssueImages} disabled={creating} />
              </label>
            </div>
            <div className="task-modal-actions">
              <button type="button" className="activity-back" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button type="button" className="admin-save-btn" onClick={createIssue} disabled={creating}>
                {creating ? "Saving…" : "Create Issue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {notesIssue && (
        <div className="task-modal-overlay" onClick={(e) => e.target === e.currentTarget && setNotesIssueId(null)}>
          <div className="task-modal" role="dialog" aria-modal="true">
            <h3>Notes — {notesIssue.issue_title}</h3>
            <p className="task-add-form-hint">{notesIssue.member?.name || "Unknown"}&apos;s issue</p>
            {notesEditable ? (
              <textarea
                className="task-notes-textarea task-notes-textarea-large"
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                autoFocus
              />
            ) : (
              <p className="task-notes-readonly">{notesIssue.notes || "No notes yet."}</p>
            )}
            <div className="task-modal-actions">
              <button type="button" className="activity-back" onClick={() => setNotesIssueId(null)}>
                {notesEditable ? "Cancel" : "Close"}
              </button>
              {notesEditable && (
                <button type="button" className="admin-save-btn" onClick={saveNotes}>
                  Save
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {photosIssue && (
        <div
          className="task-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPhotosIssueId(null);
              setLightboxIndex(null);
            }
          }}
        >
          <div className="task-modal" role="dialog" aria-modal="true">
            <h3>Photos — {photosIssue.issue_title}</h3>
            <p className="task-add-form-hint">{photosIssue.member?.name || "Unknown"}&apos;s issue</p>
            <div className="issue-photos-grid">
              {(photosIssue.images || []).map((img, index) => (
                <div className="issue-photo-thumb" key={img.path || index}>
                  <img src={img.url} alt="" onClick={() => setLightboxIndex(index)} role="button" />
                  {photosEditable && (
                    <button type="button" onClick={() => removePhoto(index)} aria-label="Remove photo">×</button>
                  )}
                </div>
              ))}
              {!photosIssue.images?.length && !photosEditable && <p>No photos yet.</p>}
              {photosEditable && (
                <label className="issue-photo-add">
                  +
                  <input type="file" accept="image/*" multiple onChange={addPhotos} disabled={photosUploading} />
                </label>
              )}
            </div>
            <div className="task-modal-actions">
              <button type="button" className="activity-back" onClick={() => { setPhotosIssueId(null); setLightboxIndex(null); }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {photosIssue && lightboxIndex !== null && (
        <Lightbox
          items={(photosIssue.images || []).map((img) => ({ url: img.url, type: "image" }))}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndex={setLightboxIndex}
        />
      )}
    </section>
  );
}
