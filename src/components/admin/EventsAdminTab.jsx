import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const EVENT_TYPES = [
  { value: "game", label: "Match" },
  { value: "party", label: "Team Fun" },
  { value: "outreach", label: "Outreach" },
  { value: "workout", label: "Brainstorming" },
  { value: "design", label: "Design" },
  { value: "other", label: "Other" }
];

const BUCKET = "event-media";
const emptyMedia = { title: "", event_type: "game", event_date: "", caption: "" };
const emptyAchv = {
  season: "",
  event_name: "",
  event_date: "",
  location: "",
  result: "",
  matches_played: "",
  matches_won: "",
  highest_score: "",
  overall_rank: "",
  media: []
};

// Older achievements may only have the single media_url columns. Normalize
// both shapes into one array of { url, type, path } objects.
function toMediaArray(a) {
  if (Array.isArray(a?.media) && a.media.length) return a.media;
  if (a?.media_url) {
    return [{ url: a.media_url, type: a.media_type || "image", path: a.storage_path || "" }];
  }
  return [];
}

export default function EventsAdminTab() {
  const [section, setSection] = useState("media");

  // ---- Event media state --------------------------------------------------
  const [mediaList, setMediaList] = useState([]);
  const [mediaForm, setMediaForm] = useState(emptyMedia);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  // ---- Achievements state -------------------------------------------------
  const [achievements, setAchievements] = useState([]);
  const [achvForm, setAchvForm] = useState(emptyAchv);
  const [editingAchvId, setEditingAchvId] = useState(null);
  const [achvUploading, setAchvUploading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [mediaResp, achvResp] = await Promise.all([
      supabase.from("event_media").select("*").order("event_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("achievements").select("*").order("season", { ascending: false }).order("sort_order", { ascending: true })
    ]);
    setMediaList(Array.isArray(mediaResp.data) ? mediaResp.data : []);
    setAchievements(Array.isArray(achvResp.data) ? achvResp.data : []);
    setLoading(false);
  }

  // ---- Media upload -------------------------------------------------------
  async function uploadMedia() {
    if (!mediaForm.title.trim()) {
      setStatus({ type: "error", message: "Title is required" });
      return;
    }
    if (!files.length) {
      setStatus({ type: "error", message: "Please choose one or more photos/videos" });
      return;
    }

    setUploading(true);
    setStatus({ type: "", message: "" });

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const ext = file.name.split(".").pop();
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const path = `${mediaForm.event_type}/${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        setStatus({ type: "error", message: `Upload failed: ${uploadError.message}` });
        setUploading(false);
        return;
      }

      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const mediaType = file.type.startsWith("video") ? "video" : "image";
      const itemTitle = files.length > 1 ? `${mediaForm.title} (${i + 1})` : mediaForm.title;

      const { error: insertError } = await supabase.from("event_media").insert({
        title: itemTitle,
        event_type: mediaForm.event_type,
        event_date: mediaForm.event_date || null,
        caption: mediaForm.caption,
        media_url: publicData.publicUrl,
        media_type: mediaType,
        storage_path: path
      });

      if (insertError) {
        setStatus({ type: "error", message: `Saved file but DB insert failed: ${insertError.message}` });
        setUploading(false);
        return;
      }
    }

    {
      setMediaForm(emptyMedia);
      setFiles([]);
      setStatus({ type: "success", message: `Uploaded ${files.length} media file(s)!` });
      loadAll();
    }
    setUploading(false);
  }

  async function deleteMedia(item) {
    if (!confirm("Delete this media?")) return;
    if (item.storage_path) {
      await supabase.storage.from(BUCKET).remove([item.storage_path]);
    }
    const { error } = await supabase.from("event_media").delete().eq("id", item.id);
    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
    } else {
      setStatus({ type: "success", message: "Media deleted!" });
      loadAll();
    }
  }

  // ---- Achievements -------------------------------------------------------
  async function uploadOneFile(file) {
    const ext = file.name.split(".").pop();
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const path = `achievements/${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;
    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const type = file.type.startsWith("video") ? "video" : "image";
    return { url: publicData.publicUrl, type, path };
  }

  // Upload the chosen files immediately and append them to the form's media list.
  async function addAchvMediaFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setAchvUploading(true);
    setStatus({ type: "", message: "" });
    try {
      const uploaded = [];
      for (const file of files) {
        uploaded.push(await uploadOneFile(file));
      }
      setAchvForm((p) => ({ ...p, media: [...p.media, ...uploaded] }));
    } catch (err) {
      setStatus({ type: "error", message: `Upload failed: ${err.message}` });
    }
    setAchvUploading(false);
  }

  async function removeAchvMediaItem(index) {
    const item = achvForm.media[index];
    if (item?.path) {
      await supabase.storage.from(BUCKET).remove([item.path]);
    }
    setAchvForm((p) => ({ ...p, media: p.media.filter((_, i) => i !== index) }));
  }

  function startEditAchievement(a) {
    setEditingAchvId(a.id);
    setAchvForm({
      season: a.season || "",
      event_name: a.event_name || "",
      event_date: a.event_date || "",
      location: a.location || "",
      result: a.result || "",
      matches_played: a.matches_played ?? "",
      matches_won: a.matches_won ?? "",
      highest_score: a.highest_score || "",
      overall_rank: a.overall_rank || "",
      media: toMediaArray(a)
    });
    setStatus({ type: "", message: "" });
  }

  function cancelEditAchievement() {
    setEditingAchvId(null);
    setAchvForm(emptyAchv);
  }

  async function saveAchievement() {
    if (!achvForm.season.trim() || !achvForm.event_name.trim()) {
      setStatus({ type: "error", message: "Season and event name are required" });
      return;
    }
    setAchvUploading(true);
    setStatus({ type: "", message: "" });

    const media = achvForm.media;
    const first = media[0] || null;
    const payload = {
      season: achvForm.season,
      event_name: achvForm.event_name,
      event_date: achvForm.event_date || null,
      location: achvForm.location || null,
      result: achvForm.result || null,
      matches_played: achvForm.matches_played === "" ? null : Number(achvForm.matches_played),
      matches_won: achvForm.matches_won === "" ? null : Number(achvForm.matches_won),
      highest_score: achvForm.highest_score.trim() || null,
      overall_rank: achvForm.overall_rank.trim() || null,
      media,
      // keep the single columns in sync (first item) for backward compatibility
      media_url: first ? first.url : null,
      media_type: first ? first.type : null,
      storage_path: first ? first.path : null
    };

    let error;
    if (editingAchvId) {
      ({ error } = await supabase.from("achievements").update(payload).eq("id", editingAchvId));
    } else {
      ({ error } = await supabase.from("achievements").insert(payload));
    }

    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
    } else {
      setStatus({ type: "success", message: editingAchvId ? "Achievement updated!" : "Achievement added!" });
      cancelEditAchievement();
      loadAll();
    }
    setAchvUploading(false);
  }

  async function deleteAchievement(item) {
    if (!confirm("Delete this achievement?")) return;
    const paths = toMediaArray(item).map((m) => m.path).filter(Boolean);
    if (paths.length) {
      await supabase.storage.from(BUCKET).remove(paths);
    }
    const { error } = await supabase.from("achievements").delete().eq("id", item.id);
    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
    } else {
      if (editingAchvId === item.id) cancelEditAchievement();
      setStatus({ type: "success", message: "Achievement deleted!" });
      loadAll();
    }
  }

  return (
    <div className="admin-section">
      <h2>Team Story — Events &amp; Achievements</h2>

      <div className="admin-form">
        <label htmlFor="storySection">Section</label>
        <select id="storySection" value={section} onChange={(e) => setSection(e.target.value)}>
          <option value="media">Event Photos &amp; Videos</option>
          <option value="achievements">Season Achievements</option>
        </select>
      </div>

      {status.message && <p className={status.type}>{status.message}</p>}

      {section === "media" ? (
        <>
          <div className="admin-form">
            <h3>Upload Photo / Video</h3>
            <label htmlFor="mediaTitle">Title</label>
            <input id="mediaTitle" value={mediaForm.title} onChange={(e) => setMediaForm((p) => ({ ...p, title: e.target.value }))} />

            <label htmlFor="mediaType">Event Type</label>
            <select id="mediaType" value={mediaForm.event_type} onChange={(e) => setMediaForm((p) => ({ ...p, event_type: e.target.value }))}>
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            <label htmlFor="mediaDate">Event Date</label>
            <input id="mediaDate" type="date" value={mediaForm.event_date} onChange={(e) => setMediaForm((p) => ({ ...p, event_date: e.target.value }))} />

            <label htmlFor="mediaCaption">Caption</label>
            <textarea id="mediaCaption" value={mediaForm.caption} onChange={(e) => setMediaForm((p) => ({ ...p, caption: e.target.value }))} />

            <label htmlFor="mediaFile">Photo / Video files (you can upload more than one)</label>
            <input
              id="mediaFile"
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />

            <button className="admin-save-btn" onClick={uploadMedia} disabled={uploading}>
              {uploading ? "Uploading…" : "Upload Media"}
            </button>
          </div>

          <div className="members-list">
            <h3>Uploaded Media</h3>
            {loading ? (
              <p>Loading…</p>
            ) : mediaList.length ? (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Media</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {mediaList.map((item) => (
                    <tr key={item.id}>
                      <td>{item.title}</td>
                      <td>{item.event_type}</td>
                      <td>{item.event_date || "-"}</td>
                      <td>
                        <a href={item.media_url} target="_blank" rel="noopener noreferrer">
                          {item.media_type === "video" ? "▶ View" : "🖼 View"}
                        </a>
                      </td>
                      <td>
                        <button className="admin-delete-btn" onClick={() => deleteMedia(item)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No media uploaded yet.</p>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="admin-form">
            <h3>{editingAchvId ? "Edit Achievement" : "Add Achievement"}</h3>
            <label htmlFor="achvSeason">Season</label>
            <input id="achvSeason" placeholder="e.g. 2024-25" value={achvForm.season} onChange={(e) => setAchvForm((p) => ({ ...p, season: e.target.value }))} />

            <label htmlFor="achvEvent">Event Name</label>
            <input id="achvEvent" value={achvForm.event_name} onChange={(e) => setAchvForm((p) => ({ ...p, event_name: e.target.value }))} />

            <label htmlFor="achvDate">Date</label>
            <input id="achvDate" type="date" value={achvForm.event_date} onChange={(e) => setAchvForm((p) => ({ ...p, event_date: e.target.value }))} />

            <label htmlFor="achvLocation">Location</label>
            <input id="achvLocation" value={achvForm.location} onChange={(e) => setAchvForm((p) => ({ ...p, location: e.target.value }))} />

            <label htmlFor="achvResult">Result / Award</label>
            <input id="achvResult" placeholder="e.g. 2nd Place / Inspire Award" value={achvForm.result} onChange={(e) => setAchvForm((p) => ({ ...p, result: e.target.value }))} />

            <label htmlFor="achvMatchesPlayed">Matches Played (optional)</label>
            <input id="achvMatchesPlayed" type="number" min="0" placeholder="e.g. 10" value={achvForm.matches_played} onChange={(e) => setAchvForm((p) => ({ ...p, matches_played: e.target.value }))} />

            <label htmlFor="achvMatchesWon">Matches Won (optional)</label>
            <input id="achvMatchesWon" type="number" min="0" placeholder="e.g. 7" value={achvForm.matches_won} onChange={(e) => setAchvForm((p) => ({ ...p, matches_won: e.target.value }))} />

            <label htmlFor="achvHighestScore">Highest Score (optional)</label>
            <input id="achvHighestScore" placeholder="e.g. 220 pts" value={achvForm.highest_score} onChange={(e) => setAchvForm((p) => ({ ...p, highest_score: e.target.value }))} />

            <label htmlFor="achvOverallRank">Overall Rank (optional)</label>
            <input id="achvOverallRank" placeholder="e.g. 3rd of 24" value={achvForm.overall_rank} onChange={(e) => setAchvForm((p) => ({ ...p, overall_rank: e.target.value }))} />

            <label htmlFor="achvMedia">Photos / Videos (optional &mdash; add as many as you like; they show on hover)</label>
            {achvForm.media.length ? (
              <div className="achv-media-thumbs">
                {achvForm.media.map((m, i) => (
                  <div key={`${m.url}-${i}`} className="achv-media-thumb">
                    {m.type === "video" ? (
                      <video src={m.url} muted />
                    ) : (
                      <img src={m.url} alt={`media ${i + 1}`} />
                    )}
                    <button
                      type="button"
                      className="achv-media-thumb-remove"
                      onClick={() => removeAchvMediaItem(i)}
                      aria-label="Remove"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <input
              id="achvMedia"
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={addAchvMediaFiles}
              disabled={achvUploading}
            />

            <div className="admin-form-actions">
              <button className="admin-save-btn" onClick={saveAchievement} disabled={achvUploading}>
                {achvUploading ? "Saving\u2026" : editingAchvId ? "Save Changes" : "Add Achievement"}
              </button>
              {editingAchvId ? (
                <button className="admin-cancel-btn" onClick={cancelEditAchievement}>Cancel</button>
              ) : null}
            </div>
          </div>

          <div className="members-list">
            <h3>Achievements</h3>
            {loading ? (
              <p>Loading…</p>
            ) : achievements.length ? (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Season</th>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Result</th>
                    <th>Matches (W/P)</th>
                    <th>High</th>
                    <th>Rank</th>
                    <th>Media</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {achievements.map((a) => (
                    <tr key={a.id}>
                      <td>{a.season}</td>
                      <td>{a.event_name}</td>
                      <td>{a.event_date || "-"}</td>
                      <td>{a.result || "-"}</td>
                      <td>
                        {a.matches_won != null || a.matches_played != null
                          ? `${a.matches_won ?? "-"}/${a.matches_played ?? "-"}`
                          : "-"}
                      </td>
                      <td>{a.highest_score || "-"}</td>
                      <td>{a.overall_rank || "-"}</td>
                      <td>
                        {toMediaArray(a).length ? `${toMediaArray(a).length} file(s)` : "-"}
                      </td>
                      <td>
                        <button className="admin-save-btn" onClick={() => startEditAchievement(a)}>Edit</button>
                        <button className="admin-delete-btn" onClick={() => deleteAchievement(a)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No achievements yet.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
