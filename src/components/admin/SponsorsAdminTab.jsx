import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import ImageUpload from "./ImageUpload";

const emptyForm = { name: "", website_url: "", statement: "", logo_url: "", sort_order: "" };

export default function SponsorsAdminTab() {
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    loadSponsors();
  }, []);

  async function loadSponsors() {
    setLoading(true);
    const { data, error } = await supabase
      .from("sponsors")
      .select("id,name,website_url,statement,logo_url,sort_order")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      setStatus({ type: "error", message: `Failed to load sponsors: ${error.message}` });
      setSponsors([]);
    } else {
      setSponsors(data || []);
    }
    setLoading(false);
  }

  function startEdit(sponsor) {
    setEditingId(sponsor.id);
    setForm({
      name: sponsor.name || "",
      website_url: sponsor.website_url || "",
      statement: sponsor.statement || "",
      logo_url: sponsor.logo_url || "",
      sort_order: sponsor.sort_order ?? ""
    });
    setStatus({ type: "", message: "" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setStatus({ type: "", message: "" });
  }

  async function saveSponsor() {
    if (!form.name.trim()) {
      setStatus({ type: "error", message: "Sponsor name is required" });
      return;
    }
    const payload = {
      name: form.name.trim(),
      website_url: form.website_url.trim() || null,
      statement: form.statement.trim() || null,
      logo_url: form.logo_url || null,
      sort_order: form.sort_order === "" ? 0 : Number(form.sort_order)
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("sponsors").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("sponsors").insert(payload));
    }

    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
    } else {
      setStatus({ type: "success", message: editingId ? "Sponsor updated!" : "Sponsor added!" });
      cancelEdit();
      loadSponsors();
    }
  }

  async function deleteSponsor(id) {
    if (!confirm("Delete this sponsor?")) return;
    const { error } = await supabase.from("sponsors").delete().eq("id", id);
    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
    } else {
      if (editingId === id) cancelEdit();
      setStatus({ type: "success", message: "Sponsor deleted!" });
      loadSponsors();
    }
  }

  if (loading) return <p>Loading sponsors...</p>;

  return (
    <div className="admin-section">
      <h2>Manage Sponsors</h2>
      <p className="analytics-help">
        Sponsors appear on the public Sponsors page in the order set below (lower number shows first).
      </p>
      {status.message && <p className={status.type}>{status.message}</p>}

      <div className="admin-form">
        <h3>{editingId ? "Edit Sponsor" : "Add Sponsor"}</h3>
        <label htmlFor="spnName">Sponsor Name</label>
        <input id="spnName" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />

        <label htmlFor="spnWebsite">Website URL (optional)</label>
        <input id="spnWebsite" placeholder="https://example.com" value={form.website_url} onChange={(e) => setForm((p) => ({ ...p, website_url: e.target.value }))} />

        <label htmlFor="spnStatement">Statement (a nice line about them)</label>
        <textarea id="spnStatement" value={form.statement} onChange={(e) => setForm((p) => ({ ...p, statement: e.target.value }))} />

        <label htmlFor="spnOrder">Display Order</label>
        <input id="spnOrder" type="number" min="0" placeholder="e.g. 1" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))} />

        <label>Logo</label>
        <ImageUpload value={form.logo_url} folder="sponsors" onChange={(url) => setForm((p) => ({ ...p, logo_url: url }))} />

        <div className="admin-form-actions">
          <button className="admin-save-btn" onClick={saveSponsor}>
            {editingId ? "Save Changes" : "Add Sponsor"}
          </button>
          {editingId ? (
            <button className="admin-cancel-btn" onClick={cancelEdit}>Cancel</button>
          ) : null}
        </div>
      </div>

      <div className="members-list">
        <h3>Current Sponsors</h3>
        {sponsors.length ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Logo</th>
                <th>Name</th>
                <th>Statement</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sponsors.map((s) => (
                <tr key={s.id}>
                  <td>{s.sort_order ?? 0}</td>
                  <td>
                    {s.logo_url ? (
                      <img src={s.logo_url} alt={s.name} style={{ height: "32px", width: "auto", borderRadius: "4px" }} />
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>{s.name}</td>
                  <td>{s.statement || "-"}</td>
                  <td>
                    <button className="admin-save-btn" onClick={() => startEdit(s)}>Edit</button>
                    <button className="admin-delete-btn" onClick={() => deleteSponsor(s.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No sponsors yet.</p>
        )}
      </div>
    </div>
  );
}
