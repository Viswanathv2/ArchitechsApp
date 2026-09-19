import { useEffect, useMemo, useState } from "react";
import RouteLoading from "../components/RouteLoading";
import ImageUpload from "../components/admin/ImageUpload";
import RoleMultiSelect from "../components/admin/RoleMultiSelect";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const emptyForm = { roles: "", grade: "", bio: "", image_url: "" };

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const isManager = Boolean(profile?.isCoach || profile?.isPortalAdmin);
  const myEmail = String(user?.email || "").trim().toLowerCase();

  const [members, setMembers] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [noRecord, setNoRecord] = useState(false);

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMembers() {
    setLoading(true);
    const { data } = await supabase
      .from("team_members")
      .select("id,name,roles,grade,bio,image_url,email")
      .order("name", { ascending: true });

    const list = Array.isArray(data) ? data : [];
    setMembers(list);

    if (isManager) {
      // Default to the manager's own record if it exists, else first member
      const own = list.find((m) => String(m.email || "").trim().toLowerCase() === myEmail);
      const initial = own || list[0] || null;
      if (initial) {
        applyMember(initial);
      } else {
        setNoRecord(true);
      }
    } else {
      const own = list.find((m) => String(m.email || "").trim().toLowerCase() === myEmail);
      if (own) {
        applyMember(own);
      } else {
        setNoRecord(true);
      }
    }
    setLoading(false);
  }

  function applyMember(member) {
    setSelectedId(member.id);
    setFormData({
      roles: member.roles || "",
      grade: member.grade || "",
      bio: member.bio || "",
      image_url: member.image_url || ""
    });
    setNoRecord(false);
    setStatus({ type: "", message: "" });
  }

  function onSelectMember(id) {
    const member = members.find((m) => m.id === id);
    if (member) applyMember(member);
  }

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedId) || null,
    [members, selectedId]
  );

  async function save() {
    if (!selectedId) return;
    setSaving(true);
    setStatus({ type: "", message: "" });
    const { data, error } = await supabase
      .from("team_members")
      .update({
        roles: formData.roles,
        grade: formData.grade,
        bio: formData.bio,
        image_url: formData.image_url
      })
      .eq("id", selectedId)
      .select("id");
    setSaving(false);
    if (error) {
      setStatus({ type: "error", message: `Failed: ${error.message}` });
    } else if (!data || data.length === 0) {
      // RLS allowed the request but matched no rows the user may change.
      setStatus({
        type: "error",
        message:
          "Your changes were not saved. You can only edit the profile linked to your login email. Ask a coach if this looks wrong."
      });
    } else {
      setStatus({ type: "success", message: "Profile saved!" });
      setMembers((prev) => prev.map((m) => (m.id === selectedId ? { ...m, ...formData } : m)));
    }
  }

  if (loading) {
    return <RouteLoading />;
  }

  return (
    <section className="landing-page">
      <header className="landing-header">
        <h1>Change Profile</h1>
        <p className="landing-tagline">
          {isManager ? "Update any team member's profile" : "Update your profile details"}
        </p>
      </header>

      <div className="landing-container">
        <section className="landing-section profile-editor">
          {status.message && <p className={status.type} role="status">{status.message}</p>}

          {isManager && members.length > 0 && (
            <div className="profile-field">
              <label htmlFor="memberSelect">Team Member</label>
              <select
                id="memberSelect"
                value={selectedId}
                onChange={(e) => onSelectMember(e.target.value)}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

          {noRecord ? (
            <p>
              No team member record is linked to your email{myEmail ? ` (${myEmail})` : ""}. Ask your
              coach to add your email to your member profile in the Admin Dashboard.
            </p>
          ) : (
            <>
              {selectedMember && <h2 className="profile-name">{selectedMember.name}</h2>}

              <div className="profile-field">
                <label>Photo</label>
                <ImageUpload
                  value={formData.image_url}
                  folder="team"
                  onChange={(url) => setFormData((p) => ({ ...p, image_url: url }))}
                />
              </div>

              <div className="profile-field">
                <label htmlFor="profileRoles">Role</label>
                <RoleMultiSelect
                  id="profileRoles"
                  value={formData.roles}
                  onChange={(roles) => setFormData((p) => ({ ...p, roles }))}
                />
              </div>

              <div className="profile-field">
                <label htmlFor="profileGrade">Grade</label>
                <input
                  id="profileGrade"
                  value={formData.grade}
                  onChange={(e) => setFormData((p) => ({ ...p, grade: e.target.value }))}
                />
              </div>

              <div className="profile-field">
                <label htmlFor="profileBio">Bio</label>
                <textarea
                  id="profileBio"
                  value={formData.bio}
                  onChange={(e) => setFormData((p) => ({ ...p, bio: e.target.value }))}
                />
              </div>

              <button type="button" className="admin-save-btn" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save Profile"}
              </button>
            </>
          )}
        </section>
      </div>
    </section>
  );
}
