import { useEffect, useMemo, useState } from "react";
import RouteLoading from "../components/RouteLoading";
import { usePortalPage } from "../hooks/usePortalPage";
import { useTrackVisit } from "../hooks/useTrackVisit";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { downloadCsv } from "../lib/exportCsv";

const EMPTY_EXPENSE = {
  description: "",
  amount: "",
  expense_date: new Date().toISOString().slice(0, 10),
  category: "Other",
  paid_by: "",
  vendor: "",
  receipt_url: "",
  notes: ""
};

function textValue(value) {
  return value === null || value === undefined ? "" : String(value);
}

function normalizeExpense(expense = {}) {
  return {
    ...EMPTY_EXPENSE,
    ...expense,
    description: textValue(expense.description),
    amount: textValue(expense.amount),
    expense_date: textValue(expense.expense_date) || EMPTY_EXPENSE.expense_date,
    category: textValue(expense.category) || EMPTY_EXPENSE.category,
    paid_by: textValue(expense.paid_by),
    vendor: textValue(expense.vendor),
    receipt_url: textValue(expense.receipt_url),
    notes: textValue(expense.notes)
  };
}

const AUDIT_FIELDS = [
  ["description", "Description"],
  ["amount", "Amount"],
  ["expense_date", "Date"],
  ["category", "Category"],
  ["paid_by", "Paid by"],
  ["vendor", "Vendor"],
  ["receipt_url", "Receipt"],
  ["notes", "Notes"]
];

function auditSummary(entry) {
  const data = entry.action === "deleted" ? entry.before_data : entry.after_data;
  return AUDIT_FIELDS
    .filter(([key]) => data?.[key] !== null && data?.[key] !== undefined && data?.[key] !== "")
    .map(([key, label]) => `${label}: ${String(data[key])}`)
    .join(" · ");
}

function auditExpenseName(entry) {
  const data = entry.action === "deleted" ? entry.before_data : entry.after_data;
  return data?.description || entry.entity_id;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "";
}

export default function ExpensesPage() {
  const page = usePortalPage("expenses");
  useTrackVisit("expenses");
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [audit, setAudit] = useState([]);
  const [form, setForm] = useState(EMPTY_EXPENSE);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });

  async function loadData() {
    setLoading(true);
    const [expensesResp, auditResp] = await Promise.all([
      supabase
        .from("team_expenses")
        .select("id,description,amount,expense_date,category,paid_by,vendor,receipt_url,notes,created_by,created_at,updated_at")
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("team_audit_log")
        .select("id,entity_id,action,actor_id,actor_name,before_data,after_data,changed_at")
        .eq("entity_type", "team_expenses")
        .order("changed_at", { ascending: false })
    ]);
    if (expensesResp.error || auditResp.error) {
      setStatus({ type: "error", message: expensesResp.error?.message || auditResp.error?.message || "Unable to load expenses." });
    }
    setExpenses(expensesResp.data || []);
    setAudit(auditResp.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const auditByExpense = useMemo(() => {
    const grouped = new Map();
    audit.forEach((entry) => {
      if (!grouped.has(entry.entity_id)) grouped.set(entry.entity_id, []);
      grouped.get(entry.entity_id).push(entry);
    });
    return grouped;
  }, [audit]);

  const total = useMemo(() => expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0), [expenses]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startEdit(expense) {
    setEditingId(expense.id);
    setForm(normalizeExpense(expense));
    setStatus({ type: "", message: "" });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_EXPENSE, expense_date: new Date().toISOString().slice(0, 10) });
  }

  async function saveExpense(event) {
    event.preventDefault();
    const description = textValue(form.description).trim();
    const amount = Number(form.amount);
    if (!description || !Number.isFinite(amount) || amount < 0) {
      setStatus({ type: "error", message: "Add a description and a valid non-negative amount." });
      return;
    }
    const payload = {
      description,
      amount: amount.toFixed(2),
      expense_date: textValue(form.expense_date) || EMPTY_EXPENSE.expense_date,
      category: textValue(form.category) || EMPTY_EXPENSE.category,
      paid_by: textValue(form.paid_by).trim() || null,
      vendor: textValue(form.vendor).trim() || null,
      receipt_url: textValue(form.receipt_url).trim() || null,
      notes: textValue(form.notes).trim() || null
    };
    const query = editingId
      ? supabase.from("team_expenses").update(payload).eq("id", editingId)
      : supabase.from("team_expenses").insert({ ...payload, created_by: user.id });
    const { data, error } = await query.select("id").maybeSingle();
    if (error) {
      setStatus({ type: "error", message: `Save failed: ${error.message}` });
      return;
    }
    if (!data) {
      setStatus({ type: "error", message: "Save failed: no expense record was changed. Please refresh and try again." });
      return;
    }
    setStatus({ type: "success", message: editingId ? "Expense updated and logged." : "Expense added and logged." });
    resetForm();
    await loadData();
  }

  async function deleteExpense(id) {
    if (!window.confirm("Remove this expense? This change will remain in the audit history.")) return;
    const { data, error } = await supabase.from("team_expenses").delete().eq("id", id).select("id").maybeSingle();
    if (error) {
      setStatus({ type: "error", message: `Delete failed: ${error.message}` });
      return;
    }
    if (!data) {
      setStatus({ type: "error", message: "Remove failed: no expense record was changed. Please refresh and try again." });
      return;
    }
    setStatus({ type: "success", message: "Expense removed and logged." });
    if (editingId === id) resetForm();
    await loadData();
  }

  if (page.loading || loading) return <RouteLoading />;

  return (
    <section className="landing-page records-page">
      <header className="landing-header">
        <h1>{page.title || "Team Expenses"}</h1>
        <p className="landing-tagline">{page.subtitle || "Keep team spending visible, current, and accountable."}</p>
      </header>
      <div className="landing-container">
        {status.message ? <p className={status.type} role="status">{status.message}</p> : null}
        <section className="landing-section">
          <div className="records-section-heading">
            <div><h2>{editingId ? "Edit expense" : "Add an expense"}</h2><p>Every change is recorded with the member and timestamp.</p></div>
            {editingId ? <button type="button" className="admin-edit-btn" onClick={resetForm}>Cancel edit</button> : null}
          </div>
          <form className="records-form" onSubmit={saveExpense}>
            <label>Description<input value={form.description} onChange={(e) => updateField("description", e.target.value)} placeholder="What was purchased?" required /></label>
            <label>Amount<input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => updateField("amount", e.target.value)} placeholder="0.00" required /></label>
            <label>Date<input type="date" value={form.expense_date} onChange={(e) => updateField("expense_date", e.target.value)} required /></label>
            <label>Category<select value={form.category} onChange={(e) => updateField("category", e.target.value)}><option>Parts</option><option>Registration</option><option>Travel</option><option>Outreach</option><option>Food</option><option>Fundraising</option><option>Other</option></select></label>
            <label>Paid by<input value={form.paid_by} onChange={(e) => updateField("paid_by", e.target.value)} placeholder="Member or team account" /></label>
            <label>Vendor<input value={form.vendor} onChange={(e) => updateField("vendor", e.target.value)} /></label>
            <label>Receipt link<input type="url" value={form.receipt_url} onChange={(e) => updateField("receipt_url", e.target.value)} placeholder="https://..." /></label>
            <label>Notes<textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} /></label>
            <div className="records-form-actions"><button type="submit" className="admin-save-btn">{editingId ? "Save changes" : "Add expense"}</button></div>
          </form>
        </section>

        <section className="landing-section">
          <div className="records-section-heading"><div><h2>Expense ledger</h2><p>{expenses.length} expense{expenses.length === 1 ? "" : "s"} · Total ${total.toFixed(2)}</p></div><button type="button" className="admin-save-btn records-export-btn" onClick={() => downloadCsv(`team-expenses-${new Date().toISOString().slice(0, 10)}.csv`, EXPENSE_COLUMNS, expenses)}>Export spreadsheet</button></div>
          {expenses.length ? <div className="records-list">{expenses.map((expense) => (
            <article className="record-card" key={expense.id}>
              <div className="record-card-main">
                <div className="record-card-title-row"><h3>{expense.description}</h3><strong className="record-amount">${Number(expense.amount).toFixed(2)}</strong></div>
                <div className="record-tags"><span>{expense.category}</span><span>{expense.expense_date}</span>{expense.paid_by ? <span>Paid by {expense.paid_by}</span> : null}{expense.vendor ? <span>{expense.vendor}</span> : null}</div>
                {expense.notes ? <p className="record-note">{expense.notes}</p> : null}
                {expense.receipt_url ? <a className="record-receipt" href={expense.receipt_url} target="_blank" rel="noreferrer">Open receipt</a> : null}
              </div>
              <div className="record-card-actions"><button type="button" className="admin-edit-btn" onClick={() => startEdit(expense)}>Edit</button><button type="button" className="admin-delete-btn" onClick={() => deleteExpense(expense.id)}>Remove</button></div>
              <details className="record-audit"><summary>Audit history ({auditByExpense.get(expense.id)?.length || 0})</summary><AuditEntries entries={auditByExpense.get(expense.id) || []} /></details>
            </article>
          ))}</div> : <p>No expenses have been added yet.</p>}
        </section>
        <section className="landing-section">
          <div className="records-section-heading"><div><h2>Recent changes</h2><p>Complete history, including removed expenses.</p></div></div>
          <div className="audit-list">{audit.length ? audit.map((entry) => <div className="audit-entry" key={entry.id}><strong>{entry.action}</strong><span>{auditExpenseName(entry)} · {entry.actor_name} · {formatDate(entry.changed_at)}</span><p>{auditSummary(entry)}</p></div>) : <p>No changes recorded.</p>}</div>
        </section>
      </div>
    </section>
  );
}

const EXPENSE_COLUMNS = [
  { key: "description", label: "Description" },
  { key: "amount", label: "Amount" },
  { key: "expense_date", label: "Date" },
  { key: "category", label: "Category" },
  { key: "paid_by", label: "Paid by" },
  { key: "vendor", label: "Vendor" },
  { key: "receipt_url", label: "Receipt URL" },
  { key: "notes", label: "Notes" },
  { key: "created_at", label: "Created at" },
  { key: "updated_at", label: "Updated at" }
];

function AuditEntries({ entries }) {
  return entries.length ? <div className="audit-list">{entries.map((entry) => <div className="audit-entry" key={entry.id}><strong>{entry.action}</strong><span>{entry.actor_name} · {formatDate(entry.changed_at)}</span><p>{auditSummary(entry)}</p></div>)}</div> : <p>No changes recorded.</p>;
}
