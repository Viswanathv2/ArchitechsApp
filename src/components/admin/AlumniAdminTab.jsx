import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import RoleMultiSelect from "./RoleMultiSelect";
import ImageUpload from "./ImageUpload";

export default function AlumniAdminTab() {
  const [alumni, setAlumni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [formData, setFormData] = useState({ name: "", role: "", year: "", bio: "", image_url: "", email: "" });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    loadAlumni();
  }, []);

  async function loadAlumni() {
    setLoading(true);
    const { data, error } = await supabase.from("alumni").select("id,name,role,year,bio,image_url,email").order("name", { ascending: true });
    if (!error && data) {
      setAlumni(data);
    }
    setLoading(false);
  }

  function startEdit(member) {
    setEditingId(member.id);
    setFormData({
      name: member.name || "",
      role: member.role || "",
      year: member.year || "",
      bio: member.bio || "",
      image_url: member.image_url || "",
      email: member.email || ""
    });
    setStatus({ type: "", message: "" });
  }

  function cancelEdit() {
    setEditingId(null);
    setFormData({ name: "", role: "", year: "", bio: "", image_url: "", email: "" });
    setStatus({ type: "", message: "" });
  }

  async function saveAlumnus() {
    if (!formData.name.trim()) {
      setStatus({ type: "error", message: "Name is required" });
      return;
    }
    let error;
    if (editingId) {
      ({ error } = await supabase.from("alumni").update(formData).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("alumni").insert({ ...formData, is_active: true }));
    }
    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
    } else {
      setStatus({ type: "success", message: editingId ? "Alumni member updated!" : "Alumni member added!" });
      setEditingId(null);
      setFormData({ name: "", role: "", year: "", bio: "", image_url: "", email: "" });
      loadAlumni();
    }
  }

  async function deleteAlumnus(id) {
    if (!confirm("Delete this alumni member?")) return;
    const { error } = await supabase.from("alumni").delete().eq("id", id);
    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
    } else {
      if (editingId === id) cancelEdit();
      setStatus({ type: "success", message: "Alumni member deleted!" });
      loadAlumni();
    }
  }

  if (loading) return <p>Loading alumni...</p>;

  return (
    <div className="admin-section">
      <h2>Manage Alumni</h2>
      {status.message && <p className={status.type}>{status.message}</p>}

      <div className="admin-form">
        <h3>{editingId ? "Edit Alumni Member" : "Add Alumni Member"}</h3>
        <label htmlFor="alumniName">Name</label>
        <input id="alumniName" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} />
        <label htmlFor="alumniRole">Roles</label>
        <RoleMultiSelect id="alumniRole" value={formData.role} onChange={(role) => setFormData((p) => ({ ...p, role }))} />
        <label htmlFor="alumniYear">Year</label>
        <input id="alumniYear" value={formData.year} onChange={(e) => setFormData((p) => ({ ...p, year: e.target.value }))} />
        <label htmlFor="alumniEmail">Login Email</label>
        <input id="alumniEmail" type="email" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} />
        <label htmlFor="alumniBio">Bio</label>
        <textarea id="alumniBio" value={formData.bio} onChange={(e) => setFormData((p) => ({ ...p, bio: e.target.value }))} />
        <label>Photo</label>
        <ImageUpload value={formData.image_url} folder="alumni" onChange={(url) => setFormData((p) => ({ ...p, image_url: url }))} />
        <div className="admin-form-actions">
          <button className="admin-save-btn" onClick={saveAlumnus}>
            {editingId ? "Save Changes" : "Add Alumni Member"}
          </button>
          {editingId ? (
            <button className="admin-cancel-btn" onClick={cancelEdit}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <div className="alumni-list">
        <h3>Current Alumni</h3>
        {alumni.length ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Name</th>
                <th>Role</th>
                <th>Year</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {alumni.map((member) => (
                <tr key={member.id}>
                  <td>
                    {member.image_url ? (
                      <img className="admin-thumb" src={member.image_url} alt={member.name} />
                    ) : (
                      <span className="admin-thumb admin-thumb-empty">—</span>
                    )}
                  </td>
                  <td>{member.name}</td>
                  <td>{member.role || "-"}</td>
                  <td>{member.year || "-"}</td>
                  <td>
                    <button className="admin-edit-btn" onClick={() => startEdit(member)}>
                      Edit
                    </button>
                    <button className="admin-delete-btn" onClick={() => deleteAlumnus(member.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No alumni yet.</p>
        )}
      </div>
    </div>
  );
}
