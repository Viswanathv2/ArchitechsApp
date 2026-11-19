import { useEffect, useMemo, useState } from "react";
import RouteLoading from "../components/RouteLoading";
import { useAuth } from "../context/AuthContext";
import { usePortalPage } from "../hooks/usePortalPage";
import { useTrackVisit } from "../hooks/useTrackVisit";
import { supabase } from "../lib/supabase";
import { exportExcelWorkbook } from "../lib/excelWorkbook";

const TEAM_FIELDS = "id,team_number,team_name,description,season_name";
const SCOUTING_FIELDS = [
  { key: "start_position_preference", label: "Start position preference", type: "select", options: ["Yes", "No"] },
  { key: "preferred_start_position", label: "Preferred starting position", type: "text" },
  { key: "has_autonomous", label: "Has autonomous", type: "select", options: ["Yes", "No"] },
  { key: "autonomous_artifact_count", label: "Artifacts scored in autonomous", type: "number" },
  { key: "artifact_pickup_method", label: "Artifact pickup method", type: "select", options: ["Floor", "Human Player"] },
  { key: "shooting_ability", label: "Can shoot artifacts", type: "select", options: ["Yes", "No (push only)"] },
  { key: "shooting_range", label: "Shooting launch zone", type: "select", options: ["Far launch zone", "Close launch zone", "Both"] },
  { key: "motif_priority", label: "Motif pattern is a priority", type: "select", options: ["Yes", "No"] },
  { key: "can_play_defense", label: "Can play defense", type: "select", options: ["Yes", "No"] },
  { key: "defense_explanation", label: "Defense explanation", type: "textarea" },
  { key: "bonus_park", label: "Can do bonus park", type: "select", options: ["Yes", "No"] },
  { key: "robot_notes", label: "Other robot details", type: "textarea" },
  { key: "distinct_robot_part", label: "Distinct part of the robot", type: "textarea" },
  { key: "total_points", label: "Total points", type: "number" },
  { key: "total_auto_points", label: "Total autonomous points", type: "number" },
  { key: "total_ranking_points", label: "Total ranking points", type: "number" },
  { key: "alliance_penalty_total", label: "Alliance penalty total", type: "number" },
  { key: "place_finished", label: "Place finished", type: "text" },
  { key: "played_well", label: "Did you play well?", type: "select", options: ["Yes", "No"] }
];

const NUMERIC_FIELDS = SCOUTING_FIELDS.filter((field) => field.type === "number").map((field) => field.key);
const SCOUTING_EXCEL_COLUMNS = [
  { key: "team_number", header: "Team Number", width: 16 },
  { key: "team_name", header: "Team Name", width: 28 },
  ...SCOUTING_FIELDS.map((field) => ({ key: field.key, header: field.label, width: 28 })),
  { key: "scouted_by", header: "Scouted By", width: 24 },
  { key: "created_at", header: "Submitted", width: 24 }
];
const emptyScouting = {
  team_number: "",
  team_name: "",
  ...Object.fromEntries(SCOUTING_FIELDS.map((field) => [field.key, ""]))
};

function sortTeams(items) {
  return [...items].sort((a, b) => a.team_number.localeCompare(b.team_number, undefined, { numeric: true }));
}

function normalizeTeamName(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

export default function ScoutingPage() {
  const page = usePortalPage("scouting");
  useTrackVisit("scouting");
  const { user, profile } = useAuth();

  const [teams, setTeams] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [editingEntry, setEditingEntry] = useState(false);
  const [editDraft, setEditDraft] = useState(null);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [newScouting, setNewScouting] = useState(emptyScouting);

  useEffect(() => {
    let active = true;

    async function loadScouting() {
      try {
        const [teamsResponse, entriesResponse] = await Promise.all([
          supabase.from("ftc_teams").select(TEAM_FIELDS).order("team_number", { ascending: true }),
          supabase.from("ftc_scouting_entries").select("*").order("created_at", { ascending: false })
        ]);
        if (!active) return;
        const failedResponse = [teamsResponse, entriesResponse].find((response) => response.error);
        if (failedResponse) {
          setStatus({ type: "error", message: `Couldn't load scouting: ${failedResponse.error.message}` });
          return;
        }
        setTeams(sortTeams(teamsResponse.data || []));
        setEntries(entriesResponse.data || []);
      } catch (error) {
        if (active) setStatus({ type: "error", message: `Couldn't load scouting: ${error.message}` });
      } finally {
        if (active) setLoading(false);
      }
    }

    loadScouting();
    return () => { active = false; };
  }, []);

  const teamById = useMemo(
    () => new Map(teams.map((team) => [team.id, team])),
    [teams]
  );
  const enrichedEntries = useMemo(
    () => entries.map((entry) => ({ ...entry, team: teamById.get(entry.team_id) || null })),
    [entries, teamById]
  );

  function changeTeamNumber(value) {
    const previousSelection = teams.find((team) =>
      team.team_number.trim() === newScouting.team_number.trim() &&
      normalizeTeamName(team.team_name) === normalizeTeamName(newScouting.team_name)
    );
    const match = teams.find((team) => team.team_number.trim() === value.trim());
    setNewScouting((current) => ({
      ...current,
      team_number: value,
      team_name: match?.team_name || (previousSelection ? "" : current.team_name)
    }));
  }

  function changeTeamName(value) {
    const previousSelection = teams.find((team) =>
      team.team_number.trim() === newScouting.team_number.trim() &&
      normalizeTeamName(team.team_name) === normalizeTeamName(newScouting.team_name)
    );
    const match = teams.find((team) => normalizeTeamName(team.team_name) === normalizeTeamName(value));
    setNewScouting((current) => ({
      ...current,
      team_name: value,
      team_number: match?.team_number || (previousSelection ? "" : current.team_number)
    }));
  }

  function changeField(key, value) {
    setNewScouting((current) => ({ ...current, [key]: value }));
  }

  function getOrCreateTeam() {
    const teamNumber = newScouting.team_number.trim();
    const teamName = newScouting.team_name.trim();
    if (!teamNumber || !teamName) {
      setStatus({ type: "error", message: "Choose or enter both a team number and team name." });
      return null;
    }

    const teamByNumber = teams.find((team) => team.team_number.trim() === teamNumber);
    const teamByName = teams.find((team) => normalizeTeamName(team.team_name) === normalizeTeamName(teamName));
    if (teamByNumber && normalizeTeamName(teamByNumber.team_name) !== normalizeTeamName(teamName)) {
      setStatus({
        type: "error",
        message: `Team number ${teamNumber} is already assigned to ${teamByNumber.team_name}.`
      });
      return null;
    }
    if (teamByName && teamByName.team_number.trim() !== teamNumber) {
      setStatus({
        type: "error",
        message: `${teamName} is already listed as team ${teamByName.team_number}.`
      });
      return null;
    }
    return teamByNumber || teamByName || {
      team_number: teamNumber,
      team_name: teamName,
      isNew: true
    };
  }

  async function submitScouting() {
    if (!user || saving) return;
    const selectedTeam = getOrCreateTeam();
    if (!selectedTeam) return;

    for (const field of NUMERIC_FIELDS) {
      const value = newScouting[field];
      if (value !== "" && (!Number.isInteger(Number(value)) || Number(value) < 0)) {
        setStatus({ type: "error", message: `${SCOUTING_FIELDS.find((item) => item.key === field).label} must be a non-negative whole number.` });
        return;
      }
    }

    setSaving(true);
    let team = selectedTeam;
    if (selectedTeam.isNew) {
      const { data, error } = await supabase
        .from("ftc_teams")
        .insert({
          team_number: selectedTeam.team_number,
          team_name: selectedTeam.team_name,
          description: "",
          season_name: ""
        })
        .select(TEAM_FIELDS)
        .single();
      if (error) {
        const { data: existingTeam, error: lookupError } = await supabase
          .from("ftc_teams")
          .select(TEAM_FIELDS)
          .eq("team_number", selectedTeam.team_number)
          .maybeSingle();
        if (
          lookupError ||
          !existingTeam ||
          normalizeTeamName(existingTeam.team_name) !== normalizeTeamName(selectedTeam.team_name)
        ) {
          setSaving(false);
          setStatus({ type: "error", message: `Couldn't add team to the FTC Team list: ${error.message}` });
          return;
        }
        team = existingTeam;
        setTeams((current) => sortTeams([...current.filter((item) => item.id !== existingTeam.id), existingTeam]));
      } else {
        team = data;
        setTeams((current) => sortTeams([...current, data]));
      }
    }

    const scoutingValues = Object.fromEntries(SCOUTING_FIELDS.map((field) => {
      const value = newScouting[field.key];
      return [field.key, NUMERIC_FIELDS.includes(field.key) ? (value === "" ? null : Number(value)) : (value.trim() || null)];
    }));
    const { data, error } = await supabase
      .from("ftc_scouting_entries")
      .insert({
        ...scoutingValues,
        team_id: team.id,
        scouted_by_id: user.id,
        scouted_by: profile?.displayName || user.email || "Team member"
      })
      .select("*")
      .single();
    setSaving(false);
    if (error) {
      setStatus({
        type: "error",
        message: selectedTeam.isNew
          ? `Team ${team.team_number} is in the FTC Team list, but the scouting report couldn't be saved: ${error.message}`
          : `Couldn't save scouting report: ${error.message}`
      });
      return;
    }

    setEntries((current) => [data, ...current]);
    setNewScouting(emptyScouting);
    setShowForm(false);
    setStatus({ type: "success", message: "Scouting report saved." });
  }

  function openEntry(entry) {
    setSelectedEntry(entry);
    setEditingEntry(false);
    setEditDraft(null);
    setStatus({ type: "", message: "" });
  }

  function startEditingEntry() {
    setEditDraft(Object.fromEntries(SCOUTING_FIELDS.map((field) => [
      field.key,
      selectedEntry[field.key] === null || selectedEntry[field.key] === undefined
        ? ""
        : String(selectedEntry[field.key])
    ])));
    setEditingEntry(true);
  }

  function changeEditField(key, value) {
    setEditDraft((current) => ({ ...current, [key]: value }));
  }

  async function saveScoutingEdit() {
    if (!selectedEntry || !editDraft || saving) return;
    for (const field of NUMERIC_FIELDS) {
      const value = editDraft[field];
      if (value !== "" && (!Number.isInteger(Number(value)) || Number(value) < 0)) {
        setStatus({ type: "error", message: `${SCOUTING_FIELDS.find((item) => item.key === field).label} must be a non-negative whole number.` });
        return;
      }
    }

    const values = Object.fromEntries(SCOUTING_FIELDS.map((field) => {
      const value = editDraft[field.key];
      return [field.key, NUMERIC_FIELDS.includes(field.key) ? (value === "" ? null : Number(value)) : (value.trim() || null)];
    }));
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("ftc_scouting_entries")
        .update(values)
        .eq("id", selectedEntry.id)
        .select("*")
        .maybeSingle();
      if (error || !data) {
        setStatus({
          type: "error",
          message: error ? `Couldn't update scouting report: ${error.message}` : "Couldn't update scouting report: no record was changed."
        });
        return;
      }

      const updatedEntry = { ...data, team: selectedEntry.team };
      setEntries((current) => current.map((entry) => (entry.id === data.id ? data : entry)));
      setSelectedEntry(updatedEntry);
      setEditingEntry(false);
      setEditDraft(null);
      setStatus({ type: "success", message: "Scouting report updated." });
    } catch (error) {
      setStatus({
        type: "error",
        message: `Couldn't update scouting report: ${error.message}`
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteScoutingReport(entry = selectedEntry) {
    if (!entry || deletingId || saving) return;
    const teamNumber = entry.team?.team_number || "unknown";
    if (!window.confirm(`Delete the scouting report for FTC team ${teamNumber}? This cannot be undone.`)) return;

    setDeletingId(entry.id);
    try {
      const { data, error } = await supabase
        .from("ftc_scouting_entries")
        .delete()
        .eq("id", entry.id)
        .select("id")
        .maybeSingle();
      if (error || !data) {
        setStatus({
          type: "error",
          message: error ? `Couldn't delete scouting report: ${error.message}` : "Couldn't delete scouting report: no record was removed."
        });
        return;
      }

      setEntries((current) => current.filter((currentEntry) => currentEntry.id !== entry.id));
      if (selectedEntry?.id === entry.id) {
        setSelectedEntry(null);
        setEditingEntry(false);
        setEditDraft(null);
      }
      setStatus({ type: "success", message: `Scouting report for team ${teamNumber} deleted.` });
    } catch (error) {
      setStatus({ type: "error", message: `Couldn't delete scouting report: ${error.message}` });
    } finally {
      setDeletingId(null);
    }
  }

  async function exportScoutingExcel() {
    try {
      await exportExcelWorkbook({
        fileName: `ftc-scouting-${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheetName: "Scouting Reports",
        columns: SCOUTING_EXCEL_COLUMNS,
        rows: enrichedEntries.map((entry) => ({
          team_number: entry.team?.team_number || "",
          team_name: entry.team?.team_name || "",
          ...Object.fromEntries(SCOUTING_FIELDS.map((field) => [field.key, entry[field.key] ?? ""])),
          scouted_by: entry.scouted_by || "",
          created_at: entry.created_at ? new Date(entry.created_at).toLocaleString() : ""
        }))
      });
      setStatus({ type: "success", message: "All scouting reports exported to Excel." });
    } catch (error) {
      setStatus({ type: "error", message: `Couldn't export scouting reports: ${error.message}` });
    }
  }

  function renderField(field, values = newScouting, onChange = changeField, disabled = saving, prefix = "scouting") {
    const commonProps = {
      id: `${prefix}-${field.key}`,
      value: values[field.key],
      disabled,
      onChange: (event) => onChange(field.key, event.target.value)
    };
    let control;
    if (field.type === "select") {
      control = (
        <select {...commonProps}>
          <option value="">Select…</option>
          {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      );
    } else if (field.type === "textarea") {
      control = <textarea {...commonProps} rows="2" />;
    } else {
      control = (
        <input
          {...commonProps}
          type={field.type}
          min={field.type === "number" ? "0" : undefined}
          step={field.type === "number" ? "1" : undefined}
        />
      );
    }

    return (
      <label className="scouting-form-field" htmlFor={commonProps.id} key={field.key}>
        <span>{field.label}</span>
        {control}
      </label>
    );
  }

  if (page.loading || loading) return <RouteLoading />;

  return (
    <section className="landing-page">
      <header className="landing-header">
        <h1>{page.title || "Scouting"}</h1>
        <p className="landing-tagline">{page.subtitle || "Record robot capabilities and match performance"}</p>
      </header>

      <div className="landing-container">
        {status.message && <p className={status.type} role="status">{status.message}</p>}

        <div className="task-toolbar">
          <button
            type="button"
            className="admin-save-btn task-toolbar-btn"
            onClick={() => {
              setNewScouting(emptyScouting);
              setShowForm(true);
            }}
          >
            + Add Scouting Report
          </button>
          <button type="button" className="admin-save-btn task-toolbar-btn" onClick={exportScoutingExcel}>
            Export Scouting (Excel)
          </button>
        </div>

        <section className="landing-section">
          <h2>Scouting Reports ({enrichedEntries.length})</h2>
          {enrichedEntries.length ? (
            <div className="task-table-wrap scouting-table-wrap">
              <table className="task-table scouting-table">
                <thead>
                  <tr>
                    <th>Team Number</th>
                    <th>Team Name</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {enrichedEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <button
                          type="button"
                          className="scouting-team-number-link"
                          onClick={() => openEntry(entry)}
                          aria-label={`View scouting details for team ${entry.team?.team_number || "unknown"}`}
                        >
                          {entry.team?.team_number || "—"}
                        </button>
                      </td>
                      <td>{entry.team?.team_name || "—"}</td>
                      <td className="scouting-grid-actions">
                        <button
                          type="button"
                          className="admin-delete-btn scouting-grid-delete-btn"
                          aria-label={`Delete scouting report for team ${entry.team?.team_number || "unknown"}`}
                          title="Delete scouting report"
                          disabled={saving || Boolean(deletingId)}
                          onClick={() => deleteScoutingReport(entry)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No scouting reports have been submitted yet.</p>
          )}
        </section>
      </div>

      {showForm && (
        <div className="task-modal-overlay" onClick={(event) => event.target === event.currentTarget && !saving && setShowForm(false)}>
          <div className="task-modal scouting-modal" role="dialog" aria-modal="true" aria-labelledby="scouting-form-title">
            <h2 id="scouting-form-title">FTC Scouting Sheet</h2>
            <p className="task-add-form-hint">Submitted by {profile?.displayName || user?.email || "team member"}.</p>

            <div className="scouting-team-fields">
              <label className="scouting-form-field" htmlFor="scouting-team-number">
                <span>Team number</span>
                <input
                  id="scouting-team-number"
                  list="scouting-team-numbers"
                  value={newScouting.team_number}
                  disabled={saving}
                  onChange={(event) => changeTeamNumber(event.target.value)}
                />
                <datalist id="scouting-team-numbers">
                  {teams.map((team) => <option key={team.id} value={team.team_number} label={team.team_name} />)}
                </datalist>
              </label>
              <label className="scouting-form-field" htmlFor="scouting-team-name">
                <span>Team name</span>
                <input
                  id="scouting-team-name"
                  list="scouting-team-names"
                  value={newScouting.team_name}
                  disabled={saving}
                  onChange={(event) => changeTeamName(event.target.value)}
                />
                <datalist id="scouting-team-names">
                  {teams.map((team) => <option key={team.id} value={team.team_name} label={team.team_number} />)}
                </datalist>
              </label>
            </div>

            <div className="scouting-form-grid">
              {SCOUTING_FIELDS.map((field) => renderField(field))}
            </div>

            <div className="task-modal-actions">
              <button type="button" className="activity-back" disabled={saving} onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="button" className="admin-save-btn" disabled={saving} onClick={submitScouting}>
                {saving ? "Saving…" : "Save Scouting Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedEntry && (
        <div
          className="task-modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget && !saving && !deletingId) {
              setSelectedEntry(null);
              setEditingEntry(false);
            }
          }}
        >
          <div className="task-modal scouting-modal scouting-details-modal" role="dialog" aria-modal="true" aria-labelledby="scouting-details-title">
            <h2 id="scouting-details-title">Scouting Report Details</h2>
            {status.type === "error" && status.message && <p className="error" role="alert">{status.message}</p>}
            <div className="scouting-team-fields scouting-details-team">
              <div><span>Team number</span><strong>{selectedEntry.team?.team_number || "—"}</strong></div>
              <div><span>Team name</span><strong>{selectedEntry.team?.team_name || "—"}</strong></div>
            </div>
            {editingEntry ? (
              <div className="scouting-form-grid">
                {SCOUTING_FIELDS.map((field) => renderField(field, editDraft, changeEditField, saving, "scouting-edit"))}
              </div>
            ) : (
              <dl className="scouting-details-grid">
                {SCOUTING_FIELDS.map((field) => (
                  <div className="scouting-detail-item" key={field.key}>
                    <dt>{field.label}</dt>
                    <dd>{selectedEntry[field.key] ?? "—"}</dd>
                  </div>
                ))}
                <div className="scouting-detail-item">
                  <dt>Scouted by</dt>
                  <dd>{selectedEntry.scouted_by || "—"}</dd>
                </div>
                <div className="scouting-detail-item">
                  <dt>Submitted</dt>
                  <dd>{selectedEntry.created_at ? new Date(selectedEntry.created_at).toLocaleString() : "—"}</dd>
                </div>
              </dl>
            )}
            <div className="task-modal-actions">
              {editingEntry ? (
                <>
                  <button type="button" className="activity-back" disabled={saving} onClick={() => { setEditingEntry(false); setEditDraft(null); }}>
                    Cancel
                  </button>
                  <button type="button" className="admin-save-btn" disabled={saving} onClick={saveScoutingEdit}>
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="activity-back" disabled={Boolean(deletingId)} onClick={() => setSelectedEntry(null)}>
                    Close
                  </button>
                  <button
                    type="button"
                    className="admin-delete-btn"
                    disabled={saving || Boolean(deletingId)}
                    onClick={deleteScoutingReport}
                  >
                    {deletingId === selectedEntry.id ? "Deleting…" : "Delete Report"}
                  </button>
                  <button type="button" className="admin-save-btn" disabled={saving || Boolean(deletingId)} onClick={startEditingEntry}>
                    Edit Report
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
