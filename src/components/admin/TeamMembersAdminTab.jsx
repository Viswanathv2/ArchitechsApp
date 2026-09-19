import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import RoleMultiSelect from "./RoleMultiSelect";
import ImageUpload from "./ImageUpload";

const emptyForm = { name: "", roles: "", grade: "", bio: "", image_url: "", email: "" };

export default function TeamMembersAdminTab() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    setLoading(true);
    const { data, error } = await supabase.from("team_members").select("id,name,roles,grade,bio,image_url,email").order("name", { ascending: true });
    if (!error && data) {
      setMembers(data);
    }
    setLoading(false);
  }

  function startEdit(member) {
    setEditingId(member.id);
    setFormData({
      name: member.name || "",
      roles: member.roles || "",
      grade: member.grade || "",
      bio: member.bio || "",
      image_url: member.image_url || "",
      email: member.email || ""
    });
    setStatus({ type: "", message: "" });
  }

  function cancelEdit() {
    setEditingId(null);
    setFormData(emptyForm);
    setStatus({ type: "", message: "" });
  }

  async function saveMember() {
    if (!formData.name.trim()) {
      setStatus({ type: "error", message: "Name is required" });
      return;
    }
    let error;
    if (editingId) {
      ({ error } = await supabase.from("team_members").update(formData).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("team_members").insert({ ...formData, is_active: true }));
    }
    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
    } else {
      setStatus({ type: "success", message: editingId ? "Member updated!" : "Member added!" });
      setEditingId(null);
      setFormData(emptyForm);
      loadMembers();
    }
  }

  async function deleteMember(id) {
    if (!confirm("Delete this member?")) return;
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
    } else {
      if (editingId === id) cancelEdit();
      setStatus({ type: "success", message: "Member deleted!" });
      loadMembers();
    }
  }

  if (loading) return <p>Loading team members...</p>;

  return (
    <div className="admin-section">
      <h2>Manage Team Members</h2>
      {status.message && <p className={status.type}>{status.message}</p>}

      <div className="admin-form">
        <h3>{editingId ? "Edit Team Member" : "Add Team Member"}</h3>
        <label htmlFor="memberName">Name</label>
        <input id="memberName" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} />
        <label htmlFor="memberRoles">Roles</label>
        <RoleMultiSelect id="memberRoles" value={formData.roles} onChange={(roles) => setFormData((p) => ({ ...p, roles }))} />
        <label htmlFor="memberGrade">Grade</label>
        <input id="memberGrade" value={formData.grade} onChange={(e) => setFormData((p) => ({ ...p, grade: e.target.value }))} />
        <label htmlFor="memberEmail">Login Email</label>
        <input id="memberEmail" type="email" placeholder="member@example.com" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} />
        <label htmlFor="memberBio">Bio</label>
        <textarea id="memberBio" value={formData.bio} onChange={(e) => setFormData((p) => ({ ...p, bio: e.target.value }))} />
        <label>Photo</label>
        <ImageUpload value={formData.image_url} folder="team" onChange={(url) => setFormData((p) => ({ ...p, image_url: url }))} />
        <div className="admin-form-actions">
          <button className="admin-save-btn" onClick={saveMember}>
            {editingId ? "Save Changes" : "Add Member"}
          </button>
          {editingId ? (
            <button className="admin-cancel-btn" onClick={cancelEdit}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <div className="members-list">
        <h3>Current Members</h3>
        {members.length ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Name</th>
                <th>Roles</th>
                <th>Grade</th>
                <th>Email</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>
                    {member.image_url ? (
                      <img className="admin-thumb" src={member.image_url} alt={member.name} />
                    ) : (
                      <span className="admin-thumb admin-thumb-empty">—</span>
                    )}
                  </td>
                  <td>{member.name}</td>
                  <td>{member.roles || "-"}</td>
                  <td>{member.grade || "-"}</td>
                  <td>{member.email || "-"}</td>
                  <td>
                    <button className="admin-edit-btn" onClick={() => startEdit(member)}>
                      Edit
                    </button>
                    <button className="admin-delete-btn" onClick={() => deleteMember(member.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No team members yet.</p>
        )}
      </div>
    </div>
  );
}
