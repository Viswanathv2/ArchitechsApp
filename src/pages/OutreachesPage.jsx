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

const OUTREACH_TYPES = ["TECH", "STEM", "OTHER"];

const emptyOutreach = {
  memberKey: "",
  outreach_name: "",
  outreach_type: OUTREACH_TYPES[0],
  outreach_date: "",
  hours: "",
  notes: "",
  images: []
};

const OUTREACH_COLUMNS = [
  { key: "member_name", label: "Member" },
  { key: "member_type", label: "Type" },
  { key: "outreach_name", label: "Outreach Name" },
  { key: "outreach_type", label: "Outreach Type" },
  { key: "outreach_date", label: "Date" },
  { key: "hours", label: "Outreach Hours" },
  { key: "notes", label: "Notes" },
  { key: "archived", label: "Archived" },
  { key: "archived_by", label: "Archived By" }
];

export default function OutreachesPage() {
  const page = usePortalPage("outreaches");
  useTrackVisit("outreaches");
  const { user, profile } = useAuth();

  const [members, setMembers] = useState([]);
  const [outreaches, setOutreaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [memberFilter, setMemberFilter] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOutreach, setNewOutreach] = useState(emptyOutreach);
  const [creating, setCreating] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  const [notesOutreachId, setNotesOutreachId] = useState(null);
  const [notesDraft, setNotesDraft] = useState("");

  const [photosOutreachId, setPhotosOutreachId] = useState(null);
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
      setNotesOutreachId(null);
      setPhotosOutreachId(null);
      setLightboxIndex(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  async function loadAll() {
    setLoading(true);
    const [membersResp, coachesResp, mentorsResp, outreachesResp] = await Promise.all([
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
        .from("outreaches")
        .select("id,member_id,member_type,outreach_name,outreach_type,outreach_date,hours,notes,images,is_archived,archived_at,archived_by,created_at")
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
    setOutreaches(Array.isArray(outreachesResp.data) ? outreachesResp.data : []);
    setLoading(false);
  }

  // The member record (team member, coach, or mentor) matching the signed-in
  // user's email, if any. Non-coaches can only log outreaches under this record.
  const selfMember = useMemo(
    () => members.find((m) => String(m.email || "").trim().toLowerCase() === myEmail) || null,
    [members, myEmail]
  );

  useEffect(() => {
    if (!isCoach && selfMember) {
      setNewOutreach((p) => (p.memberKey ? p : { ...p, memberKey: `${selfMember.type}:${selfMember.id}` }));
    }
  }, [isCoach, selfMember]);

  const memberByKey = useMemo(() => {
    const map = new Map();
    for (const m of members) {
      map.set(`${m.type}:${m.id}`, m);
    }
    return map;
  }, [members]);

  const enrichedOutreaches = useMemo(
    () =>
      outreaches.map((o) => ({
        ...o,
        member: memberByKey.get(`${o.member_type}:${o.member_id}`) || null
      })),
    [outreaches, memberByKey]
  );

  const filteredOutreaches = useMemo(() => {
    const term = memberFilter.trim().toLowerCase();
    if (!term) return enrichedOutreaches;
    return enrichedOutreaches.filter((o) => String(o.member?.name || "").toLowerCase().includes(term));
  }, [enrichedOutreaches, memberFilter]);

  const activeOutreaches = useMemo(
    () =>
      filteredOutreaches
        .filter((o) => !o.is_archived)
        .sort((a, b) => {
          const aDate = a.outreach_date || "9999-12-31";
          const bDate = b.outreach_date || "9999-12-31";
          if (aDate !== bDate) return aDate < bDate ? 1 : -1;
          return String(a.member?.name || "").localeCompare(String(b.member?.name || ""));
        }),
    [filteredOutreaches]
  );

  const archivedOutreaches = useMemo(
    () =>
      filteredOutreaches
        .filter((o) => o.is_archived)
        .sort((a, b) => new Date(b.archived_at || b.created_at) - new Date(a.archived_at || a.created_at)),
    [filteredOutreaches]
  );

  function canEditOutreach(o) {
    if (isCoach) return true;
    const email = String(o.member?.email || "").trim().toLowerCase();
    return Boolean(email && myEmail && email === myEmail);
  }

  async function uploadOneImage(file) {
    const ext = file.name.split(".").pop();
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const path = `outreaches/${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, path };
  }

  async function addNewOutreachImages(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setCreating(true);
    try {
      const uploaded = [];
      for (const file of files) {
        uploaded.push(await uploadOneImage(file));
      }
      setNewOutreach((p) => ({ ...p, images: [...p.images, ...uploaded] }));
    } catch (err) {
      setStatus({ type: "error", message: `Upload failed: ${err.message}` });
    }
    setCreating(false);
  }

  function removeNewOutreachImage(index) {
    setNewOutreach((p) => ({ ...p, images: p.images.filter((_, idx) => idx !== index) }));
  }

  async function createOutreach() {
    if (!newOutreach.outreach_name.trim()) {
      setStatus({ type: "error", message: "Outreach name is required" });
      return;
    }
    const target = isCoach ? memberByKey.get(newOutreach.memberKey) : selfMember;
    if (!target) {
      setStatus({
        type: "error",
        message: isCoach ? "Choose who this outreach is for" : "We couldn't match your account to a team member"
      });
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("outreaches").insert({
      member_id: target.id,
      member_type: target.type,
      outreach_name: newOutreach.outreach_name.trim(),
      outreach_type: newOutreach.outreach_type,
      outreach_date: newOutreach.outreach_date || null,
      hours: newOutreach.hours === "" ? null : Number(newOutreach.hours),
      notes: newOutreach.notes.trim() || null,
      images: newOutreach.images
    });
    setCreating(false);
    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
    } else {
      setNewOutreach((p) => ({ ...emptyOutreach, memberKey: isCoach ? "" : p.memberKey }));
      setStatus({ type: "success", message: "Outreach created!" });
      setShowCreateModal(false);
      loadAll();
    }
  }

  async function updateOutreachField(id, field, value) {
    setOutreaches((prev) => prev.map((o) => (o.id === id ? { ...o, [field]: value } : o)));
    let payload;
    if (field === "outreach_date") {
      payload = { outreach_date: value || null };
    } else if (field === "hours") {
      payload = { hours: value === "" ? null : Number(value) };
    } else {
      payload = { [field]: value };
    }
    const { error } = await supabase.from("outreaches").update(payload).eq("id", id);
    if (error) {
      setStatus({ type: "error", message: `Save failed: ${error.message}` });
      loadAll();
    }
  }

  async function archiveOutreach(id) {
    if (!confirm("Delete this outreach? It will be moved to the Archive section.")) return;
    const { error } = await supabase
      .from("outreaches")
      .update({ is_archived: true, archived_at: new Date().toISOString(), archived_by: myDisplayName })
      .eq("id", id);
    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
    } else {
      setStatus({ type: "success", message: "Outreach moved to archive." });
      loadAll();
    }
  }

  const notesOutreach = enrichedOutreaches.find((o) => o.id === notesOutreachId) || null;
  const notesEditable = Boolean(notesOutreach);

  function openNotes(o) {
    setNotesOutreachId(o.id);
    setNotesDraft(o.notes || "");
  }

  async function saveNotes() {
    if (!notesOutreach) return;
    await updateOutreachField(notesOutreach.id, "notes", notesDraft);
    setNotesOutreachId(null);
  }

  function notesPreview(o) {
    const text = String(o.notes || "").trim();
    if (!text) return "Add note";
    return text.length > 40 ? `${text.slice(0, 40)}…` : text;
  }

  const photosOutreach = enrichedOutreaches.find((o) => o.id === photosOutreachId) || null;
  const photosEditable = Boolean(photosOutreach && canEditOutreach(photosOutreach));

  async function addPhotos(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length || !photosOutreach) return;
    setPhotosUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        uploaded.push(await uploadOneImage(file));
      }
      const nextImages = [...(photosOutreach.images || []), ...uploaded];
      await updateOutreachField(photosOutreach.id, "images", nextImages);
    } catch (err) {
      setStatus({ type: "error", message: `Upload failed: ${err.message}` });
    }
    setPhotosUploading(false);
  }

  async function removePhoto(index) {
    if (!photosOutreach) return;
    const image = photosOutreach.images[index];
    if (image?.path) {
      await supabase.storage.from(BUCKET).remove([image.path]);
    }
    const nextImages = photosOutreach.images.filter((_, idx) => idx !== index);
    await updateOutreachField(photosOutreach.id, "images", nextImages);
  }

  function photosLabel(o) {
    const count = Array.isArray(o.images) ? o.images.length : 0;
    return count ? `${count} photo${count === 1 ? "" : "s"}` : "Add photo";
  }

  function exportOutreachesCsv() {
    const rows = filteredOutreaches.map((o) => ({
      member_name: o.member?.name || "Unknown",
      member_type: o.member?.typeLabel || "",
      outreach_name: o.outreach_name,
      outreach_type: o.outreach_type,
      outreach_date: o.outreach_date || "",
      hours: o.hours ?? "",
      notes: o.notes || "",
      archived: o.is_archived ? "Yes" : "No",
      archived_by: o.archived_by || ""
    }));
    downloadCsv(`outreaches-${new Date().toISOString().slice(0, 10)}.csv`, OUTREACH_COLUMNS, rows);
  }

  function renderOutreachRow(o, { archived = false } = {}) {
    const editable = !archived && canEditOutreach(o);
    return (
      <tr key={o.id}>
        <td>
          <div className="task-member-cell">
            <span className="activity-avatar" title={o.member?.name || "Unknown member"}>
              <img src={o.member?.image_url || DEFAULT_AVATAR} alt={o.member?.name || "Member"} />
            </span>
          </div>
        </td>
        <td>
          {editable ? (
            <input
              className="task-input"
              value={o.outreach_name}
              onChange={(e) => updateOutreachField(o.id, "outreach_name", e.target.value)}
            />
          ) : (
            o.outreach_name
          )}
        </td>
        <td>
          {editable ? (
            <select
              className="task-input"
              value={o.outreach_type}
              onChange={(e) => updateOutreachField(o.id, "outreach_type", e.target.value)}
            >
              {OUTREACH_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          ) : (
            o.outreach_type
          )}
        </td>
        <td>
          {editable ? (
            <input
              type="date"
              className="task-input"
              value={o.outreach_date || ""}
              onChange={(e) => updateOutreachField(o.id, "outreach_date", e.target.value)}
            />
          ) : (
            o.outreach_date || "—"
          )}
        </td>
        <td>
          {editable ? (
            <input
              type="number"
              min="0"
              step="0.25"
              className="task-input"
              value={o.hours ?? ""}
              onChange={(e) => updateOutreachField(o.id, "hours", e.target.value)}
            />
          ) : (
            o.hours ?? "—"
          )}
        </td>
        <td>
          <button type="button" className="task-notes-btn" onClick={() => openNotes(o)}>
            {notesPreview(o)}
          </button>
        </td>
        <td>
          <button
            type="button"
            className="task-notes-btn"
            onClick={() => { setPhotosOutreachId(o.id); setLightboxIndex(null); }}
          >
            {photosLabel(o)}
          </button>
        </td>
        <td>
          {archived ? (
            <span className="task-member-type">
              {o.archived_by ? `Deleted by ${o.archived_by}` : "Deleted"}
              {o.archived_at ? ` · ${new Date(o.archived_at).toLocaleDateString()}` : ""}
            </span>
          ) : (
            editable && (
              <button className="admin-delete-btn" aria-label="Delete outreach" title="Delete outreach" onClick={() => archiveOutreach(o.id)}>
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

  const canCreateOutreach = isCoach || Boolean(selfMember);

  return (
    <section className="landing-page">
      <header className="landing-header">
        <h1>{page.title || "Outreaches"}</h1>
        <p className="landing-tagline">{page.subtitle || "Log Tech and STEM outreach hours"}</p>
      </header>

      <div className="landing-container">
        {status.message && (
          <p className={status.type} role="status">{status.message}</p>
        )}

        <div className="task-toolbar">
          {canCreateOutreach && (
            <button
              type="button"
              className="admin-save-btn task-toolbar-btn"
              onClick={() => {
                setNewOutreach((p) => ({ ...emptyOutreach, memberKey: isCoach ? "" : p.memberKey }));
                setShowCreateModal(true);
              }}
            >
              + Create Outreach
            </button>
          )}
          <button type="button" className="admin-save-btn task-toolbar-btn" onClick={exportOutreachesCsv}>
            Export Outreaches
          </button>
          <input
            className="task-input issue-member-filter"
            placeholder="Filter by member…"
            aria-label="Filter by member"
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
          />
        </div>
        {!canCreateOutreach && (
          <p className="activity-hint">
            Your account isn&apos;t linked to a team member record yet, so you can&apos;t log outreaches. Ask
            a coach to add your login email to your team member profile.
          </p>
        )}

        <section className="landing-section">
          <h2>Outreach Log</h2>
          {activeOutreaches.length ? (
            <div className="task-table-wrap">
              <table ref={tableRef} className="task-table outreach-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Outreach Name</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Hours</th>
                    <th>Notes</th>
                    <th>Photos</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>{activeOutreaches.map((o) => renderOutreachRow(o))}</tbody>
              </table>
            </div>
          ) : (
            <p>No outreaches logged yet.</p>
          )}
        </section>

        <div className="task-section-heading">
          <h2>Archive ({archivedOutreaches.length})</h2>
          <button type="button" className="task-collapse-toggle" onClick={() => setShowArchive((v) => !v)}>
            {showArchive ? "Collapse" : "Expand"}
          </button>
        </div>
        {showArchive && (
          archivedOutreaches.length ? (
            <div className="task-table-wrap">
              <table ref={tableRef} className="task-table outreach-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Outreach Name</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Hours</th>
                    <th>Notes</th>
                    <th>Photos</th>
                    <th>Audit</th>
                  </tr>
                </thead>
                <tbody>{archivedOutreaches.map((o) => renderOutreachRow(o, { archived: true }))}</tbody>
              </table>
            </div>
          ) : (
            <p>No archived outreaches.</p>
          )
        )}
      </div>

      {showCreateModal && (
        <div
          className="task-modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}
        >
          <div className="task-modal" role="dialog" aria-modal="true">
            <h3>Create Outreach</h3>
            {!isCoach && selfMember && (
              <p className="task-add-form-hint">This outreach will be created under your name, {selfMember.name}.</p>
            )}
            <div className="task-add-grid">
              {isCoach && (
                <select
                  aria-label="Assign to"
                  value={newOutreach.memberKey}
                  onChange={(e) => setNewOutreach((p) => ({ ...p, memberKey: e.target.value }))}
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
                placeholder="Outreach name"
                value={newOutreach.outreach_name}
                onChange={(e) => setNewOutreach((p) => ({ ...p, outreach_name: e.target.value }))}
              />
              <select
                aria-label="Outreach type"
                value={newOutreach.outreach_type}
                onChange={(e) => setNewOutreach((p) => ({ ...p, outreach_type: e.target.value }))}
              >
                {OUTREACH_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input
                type="date"
                aria-label="Outreach date"
                value={newOutreach.outreach_date}
                onChange={(e) => setNewOutreach((p) => ({ ...p, outreach_date: e.target.value }))}
              />
              <input
                type="number"
                min="0"
                step="0.25"
                placeholder="Outreach hours"
                aria-label="Outreach hours"
                value={newOutreach.hours}
                onChange={(e) => setNewOutreach((p) => ({ ...p, hours: e.target.value }))}
              />
            </div>
            <textarea
              className="task-notes-textarea"
              placeholder="Notes (optional)"
              aria-label="Notes"
              value={newOutreach.notes}
              onChange={(e) => setNewOutreach((p) => ({ ...p, notes: e.target.value }))}
            />
            <label className="issue-photos-label">Photos</label>
            <div className="issue-photos-grid">
              {newOutreach.images.map((img, index) => (
                <div className="issue-photo-thumb" key={img.path || index}>
                  <img src={img.url} alt="" onClick={() => setLightboxIndex(index)} role="button" />
                  <button type="button" onClick={() => removeNewOutreachImage(index)} aria-label="Remove photo">×</button>
                </div>
              ))}
              <label className="issue-photo-add">
                +
                <input type="file" accept="image/*" multiple onChange={addNewOutreachImages} disabled={creating} />
              </label>
            </div>
            <div className="task-modal-actions">
              <button type="button" className="activity-back" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button type="button" className="admin-save-btn" onClick={createOutreach} disabled={creating}>
                {creating ? "Saving…" : "Create Outreach"}
              </button>
            </div>
          </div>
        </div>
      )}

      {notesOutreach && (
        <div
          className="task-modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setNotesOutreachId(null)}
        >
          <div className="task-modal" role="dialog" aria-modal="true">
            <h3>Notes — {notesOutreach.outreach_name}</h3>
            <p className="task-add-form-hint">{notesOutreach.member?.name || "Unknown"}&apos;s outreach</p>
            {notesEditable ? (
              <textarea
                className="task-notes-textarea task-notes-textarea-large"
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                autoFocus
              />
            ) : (
              <p className="task-notes-readonly">{notesOutreach.notes || "No notes yet."}</p>
            )}
            <div className="task-modal-actions">
              <button type="button" className="activity-back" onClick={() => setNotesOutreachId(null)}>
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

      {photosOutreach && (
        <div
          className="task-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPhotosOutreachId(null);
              setLightboxIndex(null);
            }
          }}
        >
          <div className="task-modal" role="dialog" aria-modal="true">
            <h3>Photos — {photosOutreach.outreach_name}</h3>
            <p className="task-add-form-hint">{photosOutreach.member?.name || "Unknown"}&apos;s outreach</p>
            <div className="issue-photos-grid">
              {(photosOutreach.images || []).map((img, index) => (
                <div className="issue-photo-thumb" key={img.path || index}>
                  <img src={img.url} alt="" onClick={() => setLightboxIndex(index)} role="button" />
                  {photosEditable && (
                    <button type="button" onClick={() => removePhoto(index)} aria-label="Remove photo">×</button>
                  )}
                </div>
              ))}
              {!photosOutreach.images?.length && !photosEditable && <p>No photos yet.</p>}
              {photosEditable && (
                <label className="issue-photo-add">
                  +
                  <input type="file" accept="image/*" multiple onChange={addPhotos} disabled={photosUploading} />
                </label>
              )}
            </div>
            <div className="task-modal-actions">
              <button
                type="button"
                className="activity-back"
                onClick={() => { setPhotosOutreachId(null); setLightboxIndex(null); }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {photosOutreach && lightboxIndex !== null && (
        <Lightbox
          items={(photosOutreach.images || []).map((img) => ({ url: img.url, type: "image" }))}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndex={setLightboxIndex}
        />
      )}
    </section>
  );
}
