import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const ROLE_OPTIONS = ["member", "coach", "admin"];
const ROSTERS = [
  { table: "team_members", label: "Member" },
  { table: "coaches", label: "Coach" },
  { table: "mentors", label: "Mentor" },
  { table: "alumni", label: "Alumni" }
];

function getRoleLabel(role) {
  return role === "admin" ? "Admin" : role === "coach" ? "Coach" : "Member";
}

function userRole(profile) {
  if (profile?.is_portal_admin) return "admin";
  if (profile?.is_coach) return "coach";
  return "member";
}

export default function UserManagementAdminTab() {
  const [users, setUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [editingId, setEditingId] = useState(null);
  const [editingRole, setEditingRole] = useState("member");
  const [memberSelections, setMemberSelections] = useState({});

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    const [usersResponse, ...rosterResponses] = await Promise.all([
      supabase.rpc("list_registered_users"),
      ...ROSTERS.map(({ table }) => (
        supabase.from(table).select("id,name,email").order("name", { ascending: true })
      ))
    ]);

    const rosterError = rosterResponses.find((response) => response.error)?.error;
    if (usersResponse.error || rosterError) {
      const message = usersResponse.error?.message || rosterError?.message;
      setStatus({ type: "error", message: `Failed to load users: ${message}` });
      setUsers([]);
      setMembers([]);
    } else {
      const nextUsers = Array.isArray(usersResponse.data) ? usersResponse.data : [];
      const nextMembers = rosterResponses.flatMap((response, index) => (
        (response.data || []).map((person) => ({
          ...person,
          table: ROSTERS[index].table,
          typeLabel: ROSTERS[index].label,
          key: `${ROSTERS[index].table}:${person.id}`
        }))
      ));
      setUsers(nextUsers);
      setMembers(nextMembers);
      setMemberSelections(Object.fromEntries(nextUsers.map((user) => {
        const email = String(user.email || "").trim().toLowerCase();
        const linked = nextMembers.find(
          (member) => String(member.email || "").trim().toLowerCase() === email
        );
        return [user.user_id, linked?.key || ""];
      })));
    }
    setLoading(false);
  }

  async function linkMember(user) {
    const memberKey = memberSelections[user.user_id];
    if (!memberKey) {
      setStatus({ type: "error", message: "Choose a team profile to link." });
      return;
    }
    const selectedMember = members.find((member) => member.key === memberKey);
    if (!selectedMember) return;

    const duplicate = members.find((member) => (
      member.key !== memberKey
      && String(member.email || "").trim().toLowerCase() === String(user.email || "").trim().toLowerCase()
    ));
    if (duplicate) {
      setStatus({ type: "error", message: `That login email is already linked to ${duplicate.name}.` });
      return;
    }

    const selectedEmail = String(selectedMember?.email || "").trim().toLowerCase();
    const otherUser = selectedEmail
      ? users.find((item) => (
          item.user_id !== user.user_id
          && String(item.email || "").trim().toLowerCase() === selectedEmail
        ))
      : null;
    if (otherUser) {
      setStatus({
        type: "error",
        message: `${selectedMember.name} is already linked to ${otherUser.display_name || otherUser.email}.`
      });
      return;
    }

    const { data, error } = await supabase
      .from(selectedMember.table)
      .update({ email: user.email })
      .eq("id", selectedMember.id)
      .select("id");

    if (error || !data?.length) {
      setStatus({ type: "error", message: `Failed to link profile: ${error?.message || "No row was updated."}` });
      return;
    }

    setStatus({ type: "success", message: "Team profile linked. The user can now edit their profile." });
    loadUsers();
  }

  function startEditRole(user) {
    setEditingId(user.user_id);
    setEditingRole(userRole(user));
    setStatus({ type: "", message: "" });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingRole("member");
  }

  async function saveRole(user) {
    setStatus({ type: "", message: "" });
    const { error } = await supabase.rpc("set_registered_user_role", {
      target_user_id: user.user_id,
      target_role: editingRole
    });

    if (error) {
      setStatus({ type: "error", message: `Failed to update role: ${error.message}` });
    } else {
      setStatus({ type: "success", message: `Role updated to ${getRoleLabel(editingRole)}` });
      cancelEdit();
      loadUsers();
    }
  }

  if (loading) return <p>Loading users...</p>;

  return (
    <div className="admin-section">
      <h2>User Management</h2>
      <p className="analytics-help">
        View all registered users and manage their roles. Default role is Member.
      </p>

      {status.message && (
        <p className={status.type} style={{ marginBottom: "16px" }}>{status.message}</p>
      )}

      {users.length ? (
        <div className="user-management-list">
          {users.map((user) => {
            const currentRole = userRole(user);
            const isEditing = editingId === user.user_id;
            return (
              <div key={user.user_id} className="user-management-card">
                <div className="user-management-info">
                  <div>
                    <h3>{user.display_name || "Unknown User"}</h3>
                    {user.email ? <p className="user-email">{user.email}</p> : null}
                    <p className="user-created">
                      Registered: {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="user-management-role">
                  {isEditing ? (
                    <select
                      value={editingRole}
                      onChange={(e) => setEditingRole(e.target.value)}
                      className="role-select"
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>{getRoleLabel(role)}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`role-badge role-${currentRole}`}>
                      {getRoleLabel(currentRole)}
                    </span>
                  )}
                </div>

                <div className="user-management-link">
                  <select
                    aria-label={`Team profile for ${user.display_name || user.email}`}
                    value={memberSelections[user.user_id] || ""}
                    onChange={(e) => setMemberSelections((current) => ({
                      ...current,
                      [user.user_id]: e.target.value
                    }))}
                  >
                    <option value="">Select team profile</option>
                    {members.map((member) => (
                      <option key={member.key} value={member.key}>
                        {member.name} ({member.typeLabel})
                      </option>
                    ))}
                  </select>
                  <button type="button" className="admin-edit-btn" onClick={() => linkMember(user)}>
                    Link Profile
                  </button>
                </div>

                <div className="user-management-actions">
                  {isEditing ? (
                    <>
                      <button
                        className="admin-save-btn"
                        onClick={() => saveRole(user)}
                      >
                        Save
                      </button>
                      <button
                        className="admin-cancel-btn"
                        onClick={cancelEdit}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      className="admin-edit-btn"
                      onClick={() => startEditRole(user)}
                    >
                      Edit Role
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p>No users registered yet.</p>
      )}
    </div>
  );
}
