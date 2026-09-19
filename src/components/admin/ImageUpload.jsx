import { useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

const BUCKET = "event-media";

// Reusable image picker that uploads to Supabase Storage and returns a public URL.
// Reuses the public "event-media" bucket (folders keep member photos organized).
export default function ImageUpload({ value, onChange, folder = "team" }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image")) {
      setError("Please choose an image file");
      return;
    }

    setUploading(true);
    setError("");

    const ext = file.name.split(".").pop();
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const path = `${folder}/${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
  }

  return (
    <div className="image-upload">
      <div className="image-upload-preview" aria-hidden={!value}>
        {value ? <img src={value} alt="Selected" /> : <span>No photo</span>}
      </div>
      <div className="image-upload-actions">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          style={{ display: "none" }}
        />
        <button
          type="button"
          className="admin-save-btn image-upload-btn"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading…" : value ? "Change Photo" : "Upload Photo"}
        </button>
        {value ? (
          <button type="button" className="admin-delete-btn" onClick={() => onChange("")}>
            Remove
          </button>
        ) : null}
      </div>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
