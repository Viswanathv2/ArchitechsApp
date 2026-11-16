import { useEffect, useRef, useState } from "react";
import RouteLoading from "../components/RouteLoading";
import { usePortalPage } from "../hooks/usePortalPage";
import { useTrackVisit } from "../hooks/useTrackVisit";
import { supabase } from "../lib/supabase";
import { exportExcelWorkbook, importExcelRows } from "../lib/excelWorkbook";

const TEAM_FIELDS = "id,team_number,team_name,description,season_name,created_at";
const emptyTeam = { team_number: "", team_name: "", description: "", season_name: "" };
const TEAM_EXCEL_COLUMNS = [
  { key: "team_number", header: "Team Number", width: 16 },
  { key: "team_name", header: "Team Name", width: 28 },
  { key: "description", header: "Description", width: 48 },
  { key: "season_name", header: "Season Name", width: 24 }
];

async function fetchTeamDirectory() {
  return Promise.all([
    supabase.from("ftc_teams").select(TEAM_FIELDS).order("team_number", { ascending: true }),
    supabase.from("ftc_seasons").select("id,season_name").order("season_name", { ascending: true })
  ]);
}

function RowActionIcon({ checked = false }) {
  return checked ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 4 4L19 6" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </svg>
  );
}

function sortTeams(items) {
  return [...items].sort((a, b) => a.team_number.localeCompare(b.team_number, undefined, { numeric: true }));
}

function sortSeasons(items) {
  return [...items].sort((a, b) => a.season_name.localeCompare(b.season_name, undefined, { sensitivity: "base" }));
}

function normalizeSeasonName(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

function SeasonPicker({ value, seasons, onChange, onAdd, disabled = false }) {
  return (
    <div className="ftc-season-picker">
      <select
        className="task-input"
        aria-label="Season name"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select season…</option>
        {seasons.map((season) => (
          <option key={season.id} value={season.season_name}>{season.season_name}</option>
        ))}
      </select>
      <button
        type="button"
        className="ftc-season-add-btn"
        aria-label="Add season name"
        title="Add season name"
        disabled={disabled}
        onClick={onAdd}
      >
        +
      </button>
    </div>
  );
}

export default function FtcTeamsPage() {
  const page = usePortalPage("ftcTeams");
  useTrackVisit("ftc-teams");

  const [teams, setTeams] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSeasonForm, setShowSeasonForm] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState("");
  const [newTeam, setNewTeam] = useState(emptyTeam);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const importFileRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function loadTeams() {
      try {
        const [teamsResponse, seasonsResponse] = await fetchTeamDirectory();
        if (!active) return;
        const failedResponse = [teamsResponse, seasonsResponse].find((response) => response.error);
        if (failedResponse) {
          setStatus({ type: "error", message: `Couldn't load FTC teams: ${failedResponse.error.message}` });
        } else {
          setTeams(sortTeams(teamsResponse.data || []));
          setSeasons(sortSeasons(seasonsResponse.data || []));
        }
      } catch (error) {
        if (active) setStatus({ type: "error", message: `Couldn't load FTC teams: ${error.message}` });
      } finally {
        if (active) setLoading(false);
      }
    }

    loadTeams();
    return () => { active = false; };
  }, []);

  async function refreshDirectory() {
    const [teamsResponse, seasonsResponse] = await fetchTeamDirectory();
    const failedResponse = [teamsResponse, seasonsResponse].find((response) => response.error);
    if (failedResponse) {
      setStatus({ type: "error", message: `Couldn't refresh FTC teams: ${failedResponse.error.message}` });
      return false;
    }
    setTeams(sortTeams(teamsResponse.data || []));
    setSeasons(sortSeasons(seasonsResponse.data || []));
    return true;
  }

  function validateTeam(team) {
    if (!team.team_number.trim() || !team.team_name.trim()) {
      setStatus({ type: "error", message: "Team number and team name are required." });
      return false;
    }
    return true;
  }

  async function addTeam() {
    if (!validateTeam(newTeam)) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("ftc_teams")
      .insert({
        team_number: newTeam.team_number.trim(),
        team_name: newTeam.team_name.trim(),
        description: newTeam.description.trim(),
        season_name: newTeam.season_name.trim()
      })
      .select(TEAM_FIELDS)
      .single();
    setSaving(false);
    if (error) {
      setStatus({ type: "error", message: `Couldn't add team: ${error.message}` });
      return;
    }
    setTeams((current) => sortTeams([...current, data]));
    setNewTeam(emptyTeam);
    setShowAddForm(false);
    setStatus({ type: "success", message: "FTC team added." });
  }

  async function addSeason() {
    const seasonName = newSeasonName.trim();
    if (!seasonName) {
      setStatus({ type: "error", message: "Enter a season name." });
      return;
    }
    if (seasons.some((season) => normalizeSeasonName(season.season_name) === normalizeSeasonName(seasonName))) {
      setStatus({ type: "error", message: "That season is already available in the list." });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("ftc_seasons")
        .insert({ season_name: seasonName })
        .select("id,season_name")
        .single();
      if (error) {
        setStatus({ type: "error", message: `Couldn't add season: ${error.message}` });
        return;
      }
      setSeasons((current) => sortSeasons([...current, data]));
      setNewSeasonName("");
      setShowSeasonForm(false);
      setStatus({ type: "success", message: "Season added to the dropdown list." });
    } catch (error) {
      setStatus({ type: "error", message: `Couldn't add season: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  async function exportTeamsExcel() {
    try {
      await exportExcelWorkbook({
        fileName: `ftc-teams-${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheetName: "FTC Teams",
        columns: TEAM_EXCEL_COLUMNS,
        rows: teams.map((team) => ({
          team_number: team.team_number,
          team_name: team.team_name,
          description: team.description || "",
          season_name: team.season_name || ""
        }))
      });
      setStatus({ type: "success", message: "FTC Teams exported to Excel." });
    } catch (error) {
      setStatus({ type: "error", message: `Couldn't export FTC Teams: ${error.message}` });
    }
  }

  async function importTeamsExcel(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file || importing) return;

    setImporting(true);
    try {
      const rows = await importExcelRows(
        file,
        ["team_number", "team_name", "description", "season_name"],
        ["team_number", "team_name"]
      );
      const validRows = [];
      const seenNumbers = new Set();
      for (const row of rows) {
        const teamNumber = String(row.team_number || "").trim();
        const teamName = String(row.team_name || "").trim();
        if (!teamNumber || !teamName || seenNumbers.has(teamNumber.toLocaleLowerCase())) continue;
        seenNumbers.add(teamNumber.toLocaleLowerCase());
        validRows.push({
          team_number: teamNumber,
          team_name: teamName,
          description: String(row.description || "").trim(),
          season_name: String(row.season_name || "").trim()
        });
      }

      const seasonNames = new Map(seasons.map((season) => [
        normalizeSeasonName(season.season_name),
        season.season_name
      ]));
      const newSeasons = new Map();
      for (const row of validRows) {
        const normalizedName = normalizeSeasonName(row.season_name);
        if (!normalizedName) continue;
        if (seasonNames.has(normalizedName)) {
          row.season_name = seasonNames.get(normalizedName);
        } else {
          const canonicalName = newSeasons.get(normalizedName) || row.season_name;
          newSeasons.set(normalizedName, canonicalName);
          row.season_name = canonicalName;
        }
      }
      const seasonRowsToInsert = [...newSeasons.values()].map((season_name) => ({ season_name }));
      if (seasonRowsToInsert.length) {
        const { error } = await supabase
          .from("ftc_seasons")
          .upsert(seasonRowsToInsert, { onConflict: "season_name", ignoreDuplicates: true });
        if (error) {
          setStatus({ type: "error", message: `Couldn't import season names: ${error.message}` });
          return;
        }
      }

      const existingNumbers = new Set(teams.map((team) => team.team_number.trim().toLocaleLowerCase()));
      const teamsToInsert = validRows
        .filter((team) => !existingNumbers.has(team.team_number.toLocaleLowerCase()))
        .map((team) => ({ ...team }));
      let importedTeams = [];
      if (teamsToInsert.length) {
        const { data, error } = await supabase
          .from("ftc_teams")
          .upsert(teamsToInsert, { onConflict: "team_number", ignoreDuplicates: true })
          .select(TEAM_FIELDS);
        if (error) {
          setStatus({ type: "error", message: `Couldn't import FTC Teams: ${error.message}` });
          return;
        }
        importedTeams = data || [];
      }

      if (!(await refreshDirectory())) return;
      const skippedCount = rows.length - importedTeams.length;
      setStatus({
        type: "success",
        message: `Imported ${importedTeams.length} new team${importedTeams.length === 1 ? "" : "s"}; ${skippedCount} existing, duplicate, or incomplete row${skippedCount === 1 ? "" : "s"} skipped.`
      });
    } catch (error) {
      setStatus({ type: "error", message: `Excel import failed: ${error.message}` });
    } finally {
      setImporting(false);
    }
  }

  function startEditing(team) {
    setEditingId(team.id);
    setDraft({
      team_number: team.team_number || "",
      team_name: team.team_name || "",
      description: team.description || "",
      season_name: team.season_name || ""
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setDraft(null);
  }

  async function saveTeam(id) {
    if (!draft || saving) return;
    if (!validateTeam(draft)) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("ftc_teams")
      .update({
        team_number: draft.team_number.trim(),
        team_name: draft.team_name.trim(),
        description: draft.description.trim(),
        season_name: draft.season_name.trim()
      })
      .eq("id", id)
      .select(TEAM_FIELDS)
      .maybeSingle();
    setSaving(false);
    if (error || !data) {
      setStatus({
        type: "error",
        message: error ? `Couldn't save team: ${error.message}` : "Couldn't save team: no record was updated."
      });
      return;
    }
    setTeams((current) => sortTeams(current.map((team) => (team.id === id ? data : team))));
    cancelEditing();
    setStatus({ type: "success", message: "FTC team updated." });
  }

  async function deleteTeam(team) {
    if (!confirm(`Delete FTC Team ${team.team_number} — ${team.team_name}?`)) return;
    setDeletingId(team.id);
    const { data, error } = await supabase
      .from("ftc_teams")
      .delete()
      .eq("id", team.id)
      .select("id")
      .maybeSingle();
    setDeletingId(null);
    if (error || !data) {
      setStatus({
        type: "error",
        message: error ? `Couldn't delete team: ${error.message}` : "Couldn't delete team: no record was removed."
      });
      return;
    }
    setTeams((current) => current.filter((item) => item.id !== team.id));
    setStatus({ type: "success", message: "FTC team deleted." });
  }

  if (page.loading || loading) return <RouteLoading />;

  return (
    <section className="landing-page">
      <header className="landing-header">
        <h1>{page.title || "FTC Teams"}</h1>
        <p className="landing-tagline">{page.subtitle || "Maintain the teams and seasons used for scouting"}</p>
      </header>

      <div className="landing-container">
        {status.message && <p className={status.type} role="status">{status.message}</p>}

        <div className="task-toolbar ftc-team-toolbar">
          <button
            type="button"
            className="admin-save-btn task-toolbar-btn"
            disabled={saving || importing}
            onClick={() => {
              setNewTeam(emptyTeam);
              setShowAddForm(true);
            }}
          >
            + Add FTC Team
          </button>
          <button type="button" className="admin-save-btn task-toolbar-btn" disabled={saving || importing} onClick={exportTeamsExcel}>
            Export Teams (Excel)
          </button>
          <button type="button" className="admin-save-btn task-toolbar-btn" disabled={saving || importing} onClick={() => importFileRef.current?.click()}>
            {importing ? "Importing…" : "Import Teams (Excel)"}
          </button>
          <input
            ref={importFileRef}
            className="ftc-team-import-input"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            aria-label="Import FTC Teams from Excel"
            onChange={importTeamsExcel}
          />
          <button type="button" className="activity-back ftc-season-toolbar-btn" disabled={saving || importing} onClick={() => { setNewSeasonName(""); setShowSeasonForm(true); }}>
            + Add Season
          </button>
        </div>

        <section className="landing-section">
          <h2>FTC Team List ({teams.length})</h2>
          {teams.length ? (
            <div className="task-table-wrap">
              <table className="task-table ftc-teams-table">
                <thead>
                  <tr>
                    <th>Team Number</th>
                    <th>Team Name</th>
                    <th>Description</th>
                    <th>Season Name</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team) => {
                    const editing = editingId === team.id;
                    const anotherRowEditing = Boolean(editingId && editingId !== team.id);
                    return (
                      <tr key={team.id} className={editing ? "is-editing" : ""}>
                        {["team_number", "team_name", "description", "season_name"].map((field) => (
                          <td key={field}>
                            {editing ? (
                              field === "season_name" ? (
                                <SeasonPicker
                                  value={draft.season_name}
                                  seasons={seasons}
                                  disabled={saving || importing}
                                  onChange={(season_name) => setDraft((current) => ({ ...current, season_name }))}
                                  onAdd={() => { setNewSeasonName(""); setShowSeasonForm(true); }}
                                />
                              ) : field === "description" ? (
                                <textarea
                                  className="task-input ftc-team-description-input"
                                  aria-label="Team description"
                                  value={draft[field]}
                                  disabled={saving}
                                  onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))}
                                />
                              ) : (
                                <input
                                  className="task-input"
                                  aria-label={field === "team_number" ? "Team number" : field === "team_name" ? "Team name" : "Season name"}
                                  value={draft[field]}
                                  disabled={saving}
                                  onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))}
                                />
                              )
                            ) : (
                              team[field] || "—"
                            )}
                          </td>
                        ))}
                        <td>
                          <div className="ftc-team-row-actions">
                            {editing ? (
                              <>
                                <button
                                  type="button"
                                  className="outreach-edit-btn outreach-save-row-btn"
                                  aria-label="Save team"
                                  title="Save team"
                                  disabled={saving || importing}
                                  onClick={() => saveTeam(team.id)}
                                >
                                  <RowActionIcon checked />
                                </button>
                                <button
                                  type="button"
                                  className="outreach-cancel-row-btn"
                                  aria-label="Cancel editing"
                                  disabled={saving || importing}
                                  onClick={cancelEditing}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="outreach-edit-btn"
                                aria-label="Edit team"
                                title="Edit team"
                                disabled={anotherRowEditing || saving || importing || deletingId === team.id}
                                onClick={() => startEditing(team)}
                              >
                                <RowActionIcon />
                              </button>
                            )}
                            <button
                              type="button"
                              className="admin-delete-btn"
                              aria-label="Delete team"
                              title="Delete team"
                              disabled={saving || importing || Boolean(editingId) || deletingId === team.id}
                              onClick={() => deleteTeam(team)}
                            >
                              ×
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No FTC teams have been added yet.</p>
          )}
        </section>
      </div>

      {showAddForm && (
        <div className="task-modal-overlay" onClick={(event) => event.target === event.currentTarget && setShowAddForm(false)}>
          <div className="task-modal" role="dialog" aria-modal="true" aria-labelledby="add-ftc-team-title">
            <h2 id="add-ftc-team-title">Add FTC Team</h2>
            <div className="task-add-grid">
              <input
                aria-label="Team number"
                placeholder="Team number"
                value={newTeam.team_number}
                disabled={saving}
                onChange={(event) => setNewTeam((current) => ({ ...current, team_number: event.target.value }))}
              />
              <input
                aria-label="Team name"
                placeholder="Team name"
                value={newTeam.team_name}
                disabled={saving}
                onChange={(event) => setNewTeam((current) => ({ ...current, team_name: event.target.value }))}
              />
            </div>
            <label className="scouting-form-field ftc-team-season-label">
              <span>Season name</span>
              <SeasonPicker
                value={newTeam.season_name}
                seasons={seasons}
                disabled={saving}
                onChange={(season_name) => setNewTeam((current) => ({ ...current, season_name }))}
                onAdd={() => { setNewSeasonName(""); setShowSeasonForm(true); }}
              />
            </label>
            <textarea
              className="task-notes-textarea"
              aria-label="Team description"
              placeholder="Team description"
              value={newTeam.description}
              disabled={saving}
              onChange={(event) => setNewTeam((current) => ({ ...current, description: event.target.value }))}
            />
            <div className="task-modal-actions">
              <button type="button" className="activity-back" disabled={saving} onClick={() => setShowAddForm(false)}>
                Cancel
              </button>
              <button type="button" className="admin-save-btn" disabled={saving} onClick={addTeam}>
                {saving ? "Saving…" : "Add Team"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSeasonForm && (
        <div className="task-modal-overlay" onClick={(event) => event.target === event.currentTarget && !saving && setShowSeasonForm(false)}>
          <div className="task-modal task-modal-narrow" role="dialog" aria-modal="true" aria-labelledby="add-season-title">
            <h2 id="add-season-title">Add Season</h2>
            <input
              className="task-input"
              aria-label="New season name"
              placeholder="Season name"
              value={newSeasonName}
              disabled={saving}
              onChange={(event) => setNewSeasonName(event.target.value)}
            />
            <div className="task-modal-actions">
              <button type="button" className="activity-back" disabled={saving} onClick={() => setShowSeasonForm(false)}>
                Cancel
              </button>
              <button type="button" className="admin-save-btn" disabled={saving} onClick={addSeason}>
                {saving ? "Saving…" : "Add Season"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
