import { useEffect, useMemo, useRef, useState } from "react";
import RouteLoading from "../components/RouteLoading";
import { useTrackVisit } from "../hooks/useTrackVisit";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const BUCKET = "event-media";

const emptyForm = { title: "", description: "", url: "" };

export default function LearningResourcesPage({ embedded = false }) {
  useTrackVisit("learning");
  const { user, profile } = useAuth();
  const isManager = Boolean(profile?.isCoach || profile?.isPortalAdmin);

  const [resources, setResources] = useState([]);
  const [likes, setLikes] = useState([]); // {resource_id, user_id}
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });

  const [form, setForm] = useState(emptyForm);
  const [resourceType, setResourceType] = useState("link");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState(emptyForm);
  const fileRef = useRef(null);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    setLoading(true);
    const [resResp, likeResp] = await Promise.all([
      supabase
        .from("learning_resources")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("resource_likes").select("resource_id,user_id")
    ]);
    setResources(Array.isArray(resResp.data) ? resResp.data : []);
    setLikes(Array.isArray(likeResp.data) ? likeResp.data : []);
    setLoading(false);
  }

  const likesByResource = useMemo(() => {
    const map = {};
    for (const l of likes) {
      if (!map[l.resource_id]) map[l.resource_id] = { count: 0, mine: false };
      map[l.resource_id].count += 1;
      if (l.user_id === user?.id) map[l.resource_id].mine = true;
    }
    return map;
  }, [likes, user?.id]);

  function canManage(resource) {
    return isManager || resource.uploader_id === user?.id;
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setStatus({ type: "", message: "" });

    const ext = file.name.split(".").pop();
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const path = `resources/${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      setStatus({ type: "error", message: `Upload failed: ${uploadError.message}` });
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    setForm((p) => ({ ...p, url: data.publicUrl }));
    setResourceType(file.type.startsWith("video") ? "video" : "document");
    setUploading(false);
  }

  async function addResource() {
    if (!form.title.trim()) {
      setStatus({ type: "error", message: "Resource name is required" });
      return;
    }
    if (!form.url.trim()) {
      setStatus({ type: "error", message: "Upload a file or paste a link first" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("learning_resources").insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      url: form.url.trim(),
      resource_type: resourceType,
      uploader_id: user?.id || null,
      uploader_name: profile?.displayName || "Member",
      uploader_email: user?.email || null
    });
    setSaving(false);
    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
    } else {
      setForm(emptyForm);
      setResourceType("link");
      if (fileRef.current) fileRef.current.value = "";
      setShowAddForm(false);
      setStatus({ type: "success", message: "Resource added!" });
      loadAll();
    }
  }

  function cancelAdd() {
    setForm(emptyForm);
    setResourceType("link");
    if (fileRef.current) fileRef.current.value = "";
    setShowAddForm(false);
    setStatus({ type: "", message: "" });
  }

  function startEdit(resource) {
    setEditingId(resource.id);
    setEditForm({
      title: resource.title || "",
      description: resource.description || "",
      url: resource.url || ""
    });
  }

  function cancelEdit() {
    setEditingId("");
    setEditForm(emptyForm);
  }

  async function saveEdit(id) {
    if (!editForm.title.trim()) {
      setStatus({ type: "error", message: "Resource name is required" });
      return;
    }
    const { error } = await supabase
      .from("learning_resources")
      .update({
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        url: editForm.url.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);
    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
    } else {
      setStatus({ type: "success", message: "Resource updated!" });
      cancelEdit();
      loadAll();
    }
  }

  async function deleteResource(id) {
    if (!confirm("Delete this resource?")) return;
    const { error } = await supabase.from("learning_resources").delete().eq("id", id);
    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
    } else {
      setStatus({ type: "success", message: "Resource deleted." });
      setResources((prev) => prev.filter((r) => r.id !== id));
    }
  }

  async function toggleLike(resourceId) {
    if (!user) return;
    const current = likesByResource[resourceId];
    if (current?.mine) {
      // optimistic remove
      setLikes((prev) =>
        prev.filter((l) => !(l.resource_id === resourceId && l.user_id === user.id))
      );
      await supabase
        .from("resource_likes")
        .delete()
        .eq("resource_id", resourceId)
        .eq("user_id", user.id);
    } else {
      setLikes((prev) => [...prev, { resource_id: resourceId, user_id: user.id }]);
      await supabase
        .from("resource_likes")
        .upsert(
          { resource_id: resourceId, user_id: user.id },
          { onConflict: "resource_id,user_id" }
        );
    }
  }

  if (loading) {
    return embedded ? <p>Loading resources…</p> : <RouteLoading />;
  }

  const resourcesContent = (
    <section className={embedded ? "dashboard-learning-content" : "landing-section"}>
          {status.message && (
            <p className={status.type} role="status">{status.message}</p>
          )}

          <div className="resource-table-wrap">
            <table className="resource-table">
              <thead>
                <tr>
                  <th>Resource Name</th>
                  <th>Description</th>
                  <th>Uploaded By</th>
                  <th>Uploaded Date</th>
                  <th>Likes</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {resources.length ? (
                  resources.map((r) => {
                    const like = likesByResource[r.id] || { count: 0, mine: false };
                    const editing = editingId === r.id;
                    return (
                      <tr key={r.id}>
                        <td>
                          {editing ? (
                            <input
                              className="task-input"
                              value={editForm.title}
                              onChange={(e) =>
                                setEditForm((p) => ({ ...p, title: e.target.value }))
                              }
                            />
                          ) : (
                            <a href={r.url} target="_blank" rel="noopener noreferrer">
                              {r.title}
                            </a>
                          )}
                        </td>
                        <td>
                          {editing ? (
                            <input
                              className="task-input"
                              value={editForm.description}
                              onChange={(e) =>
                                setEditForm((p) => ({ ...p, description: e.target.value }))
                              }
                            />
                          ) : (
                            r.description || "—"
                          )}
                        </td>
                        <td>{r.uploader_name || "Member"}</td>
                        <td>{new Date(r.created_at).toLocaleDateString()}</td>
                        <td>
                          <button
                            type="button"
                            className={`like-btn${like.mine ? " liked" : ""}`}
                            onClick={() => toggleLike(r.id)}
                            aria-pressed={like.mine}
                            title={like.mine ? "Unlike" : "Like"}
                          >
                            <span aria-hidden="true">{like.mine ? "♥" : "♡"}</span> {like.count}
                          </button>
                        </td>
                        <td>
                          {editing ? (
                            <div className="resource-actions">
                              <button className="admin-save-btn" onClick={() => saveEdit(r.id)}>
                                Save
                              </button>
                              <button className="admin-cancel-btn" onClick={cancelEdit}>
                                Cancel
                              </button>
                            </div>
                          ) : canManage(r) ? (
                            <div className="resource-actions">
                              <button className="admin-edit-btn" onClick={() => startEdit(r)}>
                                Edit
                              </button>
                              <button
                                className="admin-delete-btn"
                                onClick={() => deleteResource(r.id)}
                              >
                                Delete
                              </button>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6}>No resources yet. Add the first one below.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="resource-add-area">
            {!showAddForm ? (
              <button
                type="button"
                className="resource-add-toggle"
                onClick={() => {
                  setStatus({ type: "", message: "" });
                  setShowAddForm(true);
                }}
              >
                + Add Resource
              </button>
            ) : (
              <div className="resource-add-form">
                <h3>Add a Resource</h3>
                <div className="resource-add-grid">
                  <label>
                    Resource Name
                    <input
                      value={form.title}
                      onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                      placeholder="e.g. Build Season Checklist"
                    />
                  </label>
                  <label>
                    Description
                    <input
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="What is this resource about?"
                    />
                  </label>
                  <label>
                    Link (or upload a file)
                    <input
                      value={form.url}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, url: e.target.value }));
                        setResourceType("link");
                      }}
                      placeholder="https://… (e.g. a YouTube video or doc link)"
                    />
                  </label>
                  <div className="resource-upload-row">
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,image/*,video/*"
                      onChange={handleFile}
                      style={{ display: "none" }}
                    />
                    <button
                      type="button"
                      className="admin-cancel-btn"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? "Uploading…" : "Upload Document / Video"}
                    </button>
                    {form.url && resourceType !== "link" && (
                      <span className="resource-upload-ok">File ready ✓</span>
                    )}
                    <button
                      type="button"
                      className="admin-save-btn"
                      onClick={addResource}
                      disabled={saving || uploading}
                    >
                      {saving ? "Adding…" : "Add Resource"}
                    </button>
                    <button type="button" className="admin-cancel-btn" onClick={cancelAdd}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
    </section>
  );

  if (embedded) {
    return resourcesContent;
  }

  return (
    <section className="landing-page">
      <header className="landing-header">
        <h1>Learning Resources</h1>
        <p className="landing-tagline">
          Documents, videos, and links shared by the team
        </p>
      </header>

      <div className="landing-container">{resourcesContent}</div>
    </section>
  );
}
