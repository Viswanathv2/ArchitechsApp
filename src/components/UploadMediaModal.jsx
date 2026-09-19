import { useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const BUCKET = "event-media";

const CATEGORIES = [
  { value: "game", label: "Matches" },
  { value: "party", label: "Team Fun" },
  { value: "outreach", label: "Outreach" },
  { value: "workout", label: "Brainstorming" },
  { value: "design", label: "Design" },
  { value: "other", label: "Other" }
];

// Upload modal for logged-in members: drag-and-drop zone, live preview,
// caption + title fields, and a category selector. On success it returns the
// freshly-inserted row so the gallery can show it instantly with a NEW badge.
export default function UploadMediaModal({ onClose, onUploaded }) {
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [form, setForm] = useState({ title: "", caption: "", event_type: "game" });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  function chooseFiles(nextFiles) {
    const picked = Array.from(nextFiles || []);
    if (!picked.length) return;
    const invalid = picked.find((f) => !f.type.startsWith("image") && !f.type.startsWith("video"));
    if (invalid) {
      setError("Please choose an image or video file.");
      return;
    }
    setError("");
    setFiles((prev) => [...prev, ...picked]);
    setPreviews((prev) => [
      ...prev,
      ...picked.map((f) => ({ url: URL.createObjectURL(f), isVideo: f.type.startsWith("video") }))
    ]);
    if (!form.title) {
      setForm((p) => ({ ...p, title: picked[0].name.replace(/\.[^.]+$/, "") }));
    }
  }

  function removePicked(index) {
    const preview = previews[index];
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    chooseFiles(e.dataTransfer.files);
  }

  async function submit(e) {
    e.preventDefault();
    if (!files.length) {
      setError("Please choose one or more photos/videos first.");
      return;
    }
    if (!form.title.trim()) {
      setError("Please add a short title.");
      return;
    }
    setUploading(true);
    setError("");
    const inserted = [];
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const ext = file.name.split(".").pop();
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const path = `${form.event_type}/${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`);
        setUploading(false);
        return;
      }

      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const mediaType = file.type.startsWith("video") ? "video" : "image";
      const itemTitle = files.length > 1 ? `${form.title.trim()} (${i + 1})` : form.title.trim();

      const { data, error: insertError } = await supabase
        .from("event_media")
        .insert({
          title: itemTitle,
          event_type: form.event_type,
          caption: form.caption.trim() || null,
          media_url: publicData.publicUrl,
          media_type: mediaType,
          storage_path: path
        })
        .select("id,title,event_type,event_date,caption,media_url,media_type,created_at")
        .single();

      if (insertError) {
        setError(`Saved file but could not add to gallery: ${insertError.message}`);
        setUploading(false);
        return;
      }
      inserted.push(data);
    }

    onUploaded(inserted);
  }

  return (
    <div
      className="upload-modal-overlay"
      onClick={(e) => {
        if (e.target.classList.contains("upload-modal-overlay")) onClose();
      }}
    >
      <div className="upload-modal" role="dialog" aria-modal="true">
        <div className="upload-modal-head">
          <h3>Upload Media</h3>
          <button type="button" className="upload-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <form className="upload-modal-form" onSubmit={submit}>
          <div
            className={`upload-dropzone${dragging ? " dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            {previews.length ? (
              <div className="upload-preview-grid">
                {previews.map((p, i) => (
                  <div key={`${p.url}-${i}`} className="upload-preview-item">
                    {p.isVideo ? (
                      <video src={p.url} muted />
                    ) : (
                      <img src={p.url} alt={`Preview ${i + 1}`} />
                    )}
                    <button type="button" className="upload-preview-remove" onClick={() => removePicked(i)}>×</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="upload-dropzone-hint">
                <span className="upload-dropzone-icon">⬆</span>
                <span>Drag &amp; drop photos/videos here, or click to browse</span>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => chooseFiles(e.target.files)}
            />
          </div>

          <label className="upload-label" htmlFor="upTitle">Title</label>
          <input
            id="upTitle"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="What is this?"
          />

          <label className="upload-label" htmlFor="upCategory">Category</label>
          <select
            id="upCategory"
            value={form.event_type}
            onChange={(e) => setForm((p) => ({ ...p, event_type: e.target.value }))}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          <label className="upload-label" htmlFor="upCaption">Caption (optional)</label>
          <textarea
            id="upCaption"
            value={form.caption}
            onChange={(e) => setForm((p) => ({ ...p, caption: e.target.value }))}
            placeholder="Add a short description"
          />

          {error ? <p className="upload-error">{error}</p> : null}

          <div className="upload-modal-actions">
            <button type="button" className="admin-cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="admin-save-btn" disabled={uploading}>
              {uploading ? "Uploading…" : "Add to Gallery"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
