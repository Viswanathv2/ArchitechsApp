import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import ImageUpload from "./ImageUpload";

const TYPES = {
  coach: { table: "coaches", singular: "Coach", plural: "Coaches" },
  mentor: { table: "mentors", singular: "Mentor", plural: "Mentors" }
};

export default function StaffAdminTab() {
  const [type, setType] = useState("coach");
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [formData, setFormData] = useState({ name: "", role: "", bio: "", image_url: "", email: "" });
  const [editingId, setEditingId] = useState(null);

  const config = TYPES[type];

  useEffect(() => {
    loadPeople();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  async function loadPeople() {
    setLoading(true);
    const { data, error } = await supabase.from(config.table).select("id,name,role,bio,image_url,email").order("name", { ascending: true });
    if (!error && data) {
      setPeople(data);
    } else {
      setPeople([]);
    }
    setLoading(false);
  }

  function startEdit(person) {
    setEditingId(person.id);
    setFormData({
      name: person.name || "",
      role: person.role || "",
      bio: person.bio || "",
      image_url: person.image_url || "",
      email: person.email || ""
    });
    setStatus({ type: "", message: "" });
  }

  function cancelEdit() {
    setEditingId(null);
    setFormData({ name: "", role: "", bio: "", image_url: "", email: "" });
    setStatus({ type: "", message: "" });
  }

  async function savePerson() {
    if (!formData.name.trim()) {
      setStatus({ type: "error", message: "Name is required" });
      return;
    }
    let error;
    if (editingId) {
      ({ error } = await supabase.from(config.table).update(formData).eq("id", editingId));
    } else {
      ({ error } = await supabase.from(config.table).insert({ ...formData, is_active: true }));
    }
    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
    } else {
      setStatus({ type: "success", message: editingId ? `${config.singular} updated!` : `${config.singular} added!` });
      setEditingId(null);
      setFormData({ name: "", role: "", bio: "", image_url: "", email: "" });
      loadPeople();
    }
  }

  async function deletePerson(id) {
    if (!confirm(`Delete this ${config.singular.toLowerCase()}?`)) return;
    const { error } = await supabase.from(config.table).delete().eq("id", id);
    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
    } else {
      if (editingId === id) cancelEdit();
      setStatus({ type: "success", message: `${config.singular} deleted!` });
      loadPeople();
    }
  }

  function changeType(value) {
    setType(value);
    setEditingId(null);
    setFormData({ name: "", role: "", bio: "", image_url: "", email: "" });
    setStatus({ type: "", message: "" });
  }

  return (
    <div className="admin-section">
      <h2>Manage Coaches &amp; Mentors</h2>

      <div className="admin-form">
        <label htmlFor="staffType">Type</label>
        <select id="staffType" value={type} onChange={(e) => changeType(e.target.value)}>
          <option value="coach">Coach</option>
          <option value="mentor">Mentor</option>
        </select>
      </div>

      {status.message && <p className={status.type}>{status.message}</p>}

      <div className="admin-form">
        <h3>{editingId ? `Edit ${config.singular}` : `Add ${config.singular}`}</h3>
        <label htmlFor="staffName">Name</label>
        <input id="staffName" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} />
        <label htmlFor="staffRole">Role (comma-separated)</label>
        <input id="staffRole" value={formData.role} onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value }))} />
        <label htmlFor="staffEmail">Login Email</label>
        <input id="staffEmail" type="email" placeholder="person@example.com" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} />
        <label htmlFor="staffBio">Bio</label>
        <textarea id="staffBio" value={formData.bio} onChange={(e) => setFormData((p) => ({ ...p, bio: e.target.value }))} />
        <label>Photo</label>
        <ImageUpload value={formData.image_url} folder={type} onChange={(url) => setFormData((p) => ({ ...p, image_url: url }))} />
        <div className="admin-form-actions">
          <button className="admin-save-btn" onClick={savePerson}>
            {editingId ? "Save Changes" : `Add ${config.singular}`}
          </button>
          {editingId ? (
            <button className="admin-cancel-btn" onClick={cancelEdit}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <div className="members-list">
        <h3>Current {config.plural}</h3>
        {loading ? (
          <p>Loading {config.plural.toLowerCase()}...</p>
        ) : people.length ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Name</th>
                <th>Role</th>
                <th>Email</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.id}>
                  <td>
                    {person.image_url ? (
                      <img className="admin-thumb" src={person.image_url} alt={person.name} />
                    ) : (
                      <span className="admin-thumb admin-thumb-empty">—</span>
                    )}
                  </td>
                  <td>{person.name}</td>
                  <td>{person.role || "-"}</td>
                  <td>{person.email || "-"}</td>
                  <td>
                    <button className="admin-edit-btn" onClick={() => startEdit(person)}>
                      Edit
                    </button>
                    <button className="admin-delete-btn" onClick={() => deletePerson(person.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No {config.plural.toLowerCase()} yet.</p>
        )}
      </div>
    </div>
  );
}
