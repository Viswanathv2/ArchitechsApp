import { useEffect, useMemo, useState } from "react";
import RouteLoading from "../components/RouteLoading";
import { usePortalPage } from "../hooks/usePortalPage";
import { useTrackVisit } from "../hooks/useTrackVisit";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { downloadCsv } from "../lib/exportCsv";

const EMPTY_PART = {
  part_name: "",
  description: "",
  quantity: 1,
  is_lent: false,
  lent_to: "",
  is_in_field: false,
  storage_area: "",
  condition: "Good",
  notes: ""
};

function textValue(value) {
  return value === null || value === undefined ? "" : String(value);
}

function normalizePart(part = {}) {
  return {
    ...EMPTY_PART,
    ...part,
    part_name: textValue(part.part_name),
    description: textValue(part.description),
    quantity: part.quantity ?? 0,
    lent_to: textValue(part.lent_to),
    storage_area: textValue(part.storage_area),
    condition: textValue(part.condition) || EMPTY_PART.condition,
    notes: textValue(part.notes)
  };
}

const AUDIT_FIELDS = [
  ["part_name", "Part"],
  ["description", "Description"],
  ["quantity", "Count"],
  ["is_lent", "Lent"],
  ["lent_to", "Lent to"],
  ["is_in_field", "In field"],
  ["storage_area", "Storage"],
  ["condition", "Condition"],
  ["notes", "Notes"]
];

function auditSummary(entry) {
  const data = entry.action === "deleted" ? entry.before_data : entry.after_data;
  return AUDIT_FIELDS
    .filter(([key]) => data?.[key] !== null && data?.[key] !== undefined && data?.[key] !== "")
    .map(([key, label]) => `${label}: ${String(data[key])}`)
    .join(" · ");
}

function auditPartName(entry) {
  const data = entry.action === "deleted" ? entry.before_data : entry.after_data;
  return data?.part_name || entry.entity_id;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "";
}

export default function PartsInventoryPage() {
  const page = usePortalPage("parts-inventory");
  useTrackVisit("parts-inventory");
  const { user } = useAuth();
  const [parts, setParts] = useState([]);
  const [audit, setAudit] = useState([]);
  const [form, setForm] = useState(EMPTY_PART);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });

  async function loadData() {
    setLoading(true);
    const [partsResp, auditResp] = await Promise.all([
      supabase
        .from("parts_inventory")
        .select("id,part_name,description,quantity,is_lent,lent_to,is_in_field,storage_area,condition,notes,created_by,created_at,updated_at")
        .order("part_name", { ascending: true }),
      supabase
        .from("team_audit_log")
        .select("id,entity_id,action,actor_id,actor_name,before_data,after_data,changed_at")
        .eq("entity_type", "parts_inventory")
        .order("changed_at", { ascending: false })
    ]);
    if (partsResp.error || auditResp.error) {
      setStatus({ type: "error", message: partsResp.error?.message || auditResp.error?.message || "Unable to load inventory." });
    }
    setParts(partsResp.data || []);
    setAudit(auditResp.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const auditByPart = useMemo(() => {
    const grouped = new Map();
    audit.forEach((entry) => {
      if (!grouped.has(entry.entity_id)) grouped.set(entry.entity_id, []);
      grouped.get(entry.entity_id).push(entry);
    });
    return grouped;
  }, [audit]);

  function updateField(field, value) {
    setForm((current) => {
      if (field === "is_lent" && value) {
        return { ...current, is_lent: true, is_in_field: false };
      }
      if (field === "is_in_field" && value) {
        return { ...current, is_in_field: true, is_lent: false, lent_to: "" };
      }
      return { ...current, [field]: value };
    });
  }

  function startEdit(part) {
    setEditingId(part.id);
    setForm(normalizePart(part));
    setStatus({ type: "", message: "" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_PART);
  }

  async function savePart(event) {
    event.preventDefault();
    const partName = textValue(form.part_name).trim();
    if (!partName) {
      setStatus({ type: "error", message: "Part name is required." });
      return;
    }
    const payload = {
      part_name: partName,
      description: textValue(form.description).trim() || null,
      quantity: Math.max(0, Number(form.quantity) || 0),
      is_lent: Boolean(form.is_lent && !form.is_in_field),
      lent_to: form.is_lent && !form.is_in_field ? textValue(form.lent_to).trim() || null : null,
      is_in_field: Boolean(form.is_in_field && !form.is_lent),
      storage_area: textValue(form.storage_area).trim() || null,
      condition: textValue(form.condition).trim() || null,
      notes: textValue(form.notes).trim() || null
    };
    const query = editingId
      ? supabase.from("parts_inventory").update(payload).eq("id", editingId)
      : supabase.from("parts_inventory").insert({ ...payload, created_by: user.id });
    const { data, error } = await query.select("id").maybeSingle();
    if (error) {
      setStatus({ type: "error", message: `Save failed: ${error.message}` });
      return;
    }
    if (!data) {
      setStatus({ type: "error", message: "Save failed: no inventory record was changed. Please refresh and try again." });
      return;
    }
    setStatus({ type: "success", message: editingId ? "Part updated and logged." : "Part added and logged." });
    resetForm();
    await loadData();
  }

  async function deletePart(id) {
    if (!window.confirm("Remove this part from inventory? This change will remain in the audit history.")) return;
    const { data, error } = await supabase.from("parts_inventory").delete().eq("id", id).select("id").maybeSingle();
    if (error) {
      setStatus({ type: "error", message: `Delete failed: ${error.message}` });
      return;
    }
    if (!data) {
      setStatus({ type: "error", message: "Remove failed: no inventory record was changed. Please refresh and try again." });
      return;
    }
    setStatus({ type: "success", message: "Part removed and logged." });
    if (editingId === id) resetForm();
    await loadData();
  }

  if (page.loading || loading) return <RouteLoading />;

  return (
    <section className="landing-page records-page">
      <header className="landing-header">
        <h1>{page.title || "Parts Inventory"}</h1>
        <p className="landing-tagline">{page.subtitle || "Track every part, where it is, and who has it."}</p>
      </header>
      <div className="landing-container">
        {status.message ? <p className={status.type} role="status">{status.message}</p> : null}
        <section className="landing-section">
          <div className="records-section-heading">
            <div><h2>{editingId ? "Edit part" : "Add a part"}</h2><p>All team members can maintain the shared inventory.</p></div>
            {editingId ? <button type="button" className="admin-edit-btn" onClick={resetForm}>Cancel edit</button> : null}
          </div>
          <form className="records-form" onSubmit={savePart}>
            <label>Part name<input value={form.part_name} onChange={(e) => updateField("part_name", e.target.value)} required /></label>
            <label>Description<textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} /></label>
            <label>Count<input type="number" min="0" value={form.quantity} onChange={(e) => updateField("quantity", e.target.value)} required /></label>
            <label>Storage area<input value={form.storage_area} onChange={(e) => updateField("storage_area", e.target.value)} placeholder="Bin, shelf, or room" /></label>
            <label>Condition<select value={form.condition} onChange={(e) => updateField("condition", e.target.value)}><option>New</option><option>Good</option><option>Needs repair</option><option>Retired</option></select></label>
            <label>Notes<textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} /></label>
            <label className="records-checkbox"><input type="checkbox" checked={form.is_lent} onChange={(e) => updateField("is_lent", e.target.checked)} /> Lent to someone</label>
            {form.is_lent ? <label>Lent to<input value={form.lent_to} onChange={(e) => updateField("lent_to", e.target.value)} required /></label> : null}
            <label className="records-checkbox"><input type="checkbox" checked={form.is_in_field} onChange={(e) => updateField("is_in_field", e.target.checked)} /> Currently in the field</label>
            <div className="records-form-actions"><button type="submit" className="admin-save-btn">{editingId ? "Save changes" : "Add part"}</button></div>
          </form>
        </section>

        <section className="landing-section">
          <div className="records-section-heading"><div><h2>Inventory list</h2><p>{parts.length} tracked part{parts.length === 1 ? "" : "s"}.</p></div><button type="button" className="admin-save-btn records-export-btn" onClick={() => downloadCsv(`parts-inventory-${new Date().toISOString().slice(0, 10)}.csv`, INVENTORY_COLUMNS, parts)}>Export spreadsheet</button></div>
          {parts.length ? <div className="records-list">{parts.map((part) => (
            <article className="record-card" key={part.id}>
              <div className="record-card-main">
                <div className="record-card-title-row"><h3>{part.part_name}</h3><span className="record-count">{part.quantity}</span></div>
                {part.description ? <p>{part.description}</p> : null}
                <div className="record-tags"><span>{part.condition || "Unspecified condition"}</span><span>{part.is_in_field ? "In field" : part.storage_area || "Storage not set"}</span>{part.is_lent ? <span>Lent to {part.lent_to}</span> : <span>Available</span>}</div>
                {part.notes ? <p className="record-note">{part.notes}</p> : null}
              </div>
              <div className="record-card-actions"><button type="button" className="admin-edit-btn" onClick={() => startEdit(part)}>Edit</button><button type="button" className="admin-delete-btn" onClick={() => deletePart(part.id)}>Remove</button></div>
              <details className="record-audit"><summary>Audit history ({auditByPart.get(part.id)?.length || 0})</summary><AuditEntries entries={auditByPart.get(part.id) || []} /></details>
            </article>
          ))}</div> : <p>No parts have been added yet.</p>}
        </section>
        <section className="landing-section">
          <div className="records-section-heading"><div><h2>Recent changes</h2><p>Complete history, including removed parts.</p></div></div>
          <div className="audit-list">{audit.length ? audit.map((entry) => <div className="audit-entry" key={entry.id}><strong>{entry.action}</strong><span>{auditPartName(entry)} · {entry.actor_name} · {formatDate(entry.changed_at)}</span><p>{auditSummary(entry)}</p></div>) : <p>No changes recorded.</p>}</div>
        </section>
      </div>
    </section>
  );
}

const INVENTORY_COLUMNS = [
  { key: "part_name", label: "Part name" },
  { key: "description", label: "Description" },
  { key: "quantity", label: "Count" },
  { key: "is_lent", label: "Lent" },
  { key: "lent_to", label: "Lent to" },
  { key: "is_in_field", label: "In field" },
  { key: "storage_area", label: "Storage area" },
  { key: "condition", label: "Condition" },
  { key: "notes", label: "Notes" },
  { key: "created_at", label: "Created at" },
  { key: "updated_at", label: "Updated at" }
];

function AuditEntries({ entries }) {
  return entries.length ? <div className="audit-list">{entries.map((entry) => <div className="audit-entry" key={entry.id}><strong>{entry.action}</strong><span>{entry.actor_name} · {formatDate(entry.changed_at)}</span><p>{auditSummary(entry)}</p></div>)}</div> : <p>No changes recorded.</p>;
}
