import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const ROLE_OPTIONS = ["member", "coach", "admin"];

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
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [editingId, setEditingId] = useState(null);
  const [editingRole, setEditingRole] = useState("member");

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id,display_name,created_at,is_portal_admin,is_coach")
      .order("created_at", { ascending: false });

    if (error) {
      setStatus({ type: "error", message: `Failed to load users: ${error.message}` });
      setUsers([]);
    } else {
      setUsers(Array.isArray(data) ? data : []);
    }
    setLoading(false);
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
    const { error } = await supabase.from("profiles").update({
      is_portal_admin: editingRole === "admin",
      is_coach: editingRole === "coach",
      updated_at: new Date().toISOString()
    }).eq("user_id", user.user_id);

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
