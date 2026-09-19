import { useEffect, useRef, useState } from "react";

export const ROLE_OPTIONS = ["Drive Team","Programmer","Builder","3D Designer","Outreach Management","Engineering Portfolio Crew","Custom"];

function parseRoles(value) {
  return String(value || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * Multi-select dropdown with checkboxes for team roles.
 * Stores the selection as a comma-separated string via onChange,
 * keeping the existing data format unchanged.
 */
export default function RoleMultiSelect({ id, value, onChange, options = ROLE_OPTIONS }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const selected = parseRoles(value);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleRole(role) {
    const next = selected.includes(role)
      ? selected.filter((r) => r !== role)
      : [...selected, role];
    onChange(next.join(", "));
  }

  return (
    <div className="role-multiselect" ref={wrapperRef}>
      <button
        type="button"
        id={id}
        className="role-multiselect-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className={selected.length ? "" : "role-multiselect-placeholder"}>
          {selected.length ? selected.join(", ") : "Select roles…"}
        </span>
        <span className="role-multiselect-caret">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="role-multiselect-menu" role="listbox">
          {options.map((role) => (
            <label key={role} className="role-multiselect-option">
              <input
                type="checkbox"
                checked={selected.includes(role)}
                onChange={() => toggleRole(role)}
              />
              <span>{role}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
