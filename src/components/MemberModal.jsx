import { useEffect, useState } from "react";
import Lightbox from "./Lightbox";
import "./MemberModal.css";

function roleClass(role) {
  const key = role.toLowerCase();
  if (key.includes("captain") || key.includes("lead")) return "role-captain";
  if (key.includes("cod") || key.includes("program") || key.includes("software")) return "role-coder";
  if (key.includes("build") || key.includes("mech") || key.includes("hardware")) return "role-build";
  if (key.includes("cad") || key.includes("design")) return "role-cad";
  return "role-default";
}

function rolesToList(value) {
  return String(value || "")
    .split(/,| and /i)
    .map((x) => x.trim())
    .filter(Boolean);
}

// Default placeholder image (portrait user icon SVG, 3:4 ratio) — matches TeamPage
const DEFAULT_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 90 120'%3E%3Crect width='90' height='120' fill='%23e5e8f0'/%3E%3Ccircle cx='45' cy='44' r='20' fill='%23a8aec4'/%3E%3Cpath d='M 12 110 Q 12 78 45 78 Q 78 78 78 110 L 78 120 L 12 120 Z' fill='%23a8aec4'/%3E%3C/svg%3E";

export default function MemberModal({ isOpen, member, onClose }) {
  const [showPhoto, setShowPhoto] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    function handleEscapeKey(e) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    function handleBackdropClick(e) {
      if (e.target.classList.contains("member-modal-overlay")) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscapeKey);
    document.addEventListener("click", handleBackdropClick);

    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
      document.removeEventListener("click", handleBackdropClick);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !member) {
    return null;
  }

  return (
    <div className="member-modal-overlay">
      <div className="member-modal" role="dialog" aria-modal="true">
        <div className="member-media">
          <img
            src={member.image || DEFAULT_IMAGE}
            alt={member.name}
            onError={(e) => (e.target.src = DEFAULT_IMAGE)}
            onClick={() => member.image && setShowPhoto(true)}
            style={member.image ? { cursor: "zoom-in" } : undefined}
          />
        </div>
        <div className="member-body">
          <h3>{member.name}</h3>
          {rolesToList(member.role).length > 0 && (
            <div className="role-badges">
              {rolesToList(member.role).map((role) => (
                <span key={role} className={`role-badge ${roleClass(role)}`}>{role}</span>
              ))}
            </div>
          )}
          <div className="meta">
            {member.grade && <span>Grade: {member.grade}</span>}
            {member.year && <span>Class of {member.year}</span>}
          </div>
          {member.bio && <div className="bio">{member.bio}</div>}
          <div className="modal-actions">
            <button className="modal-close-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
      {showPhoto ? (
        <Lightbox
          items={[{ url: member.image, type: "image", title: member.name, caption: member.role }]}
          index={0}
          onClose={() => setShowPhoto(false)}
          onIndex={() => {}}
        />
      ) : null}
    </div>
  );
}
