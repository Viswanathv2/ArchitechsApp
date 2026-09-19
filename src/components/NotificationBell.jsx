import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const RECENT_WINDOW_DAYS = 7;

function cutoffTime() {
  return Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

function recentOnly(row) {
  const createdAt = new Date(row.created_at || 0).getTime();
  return Number.isFinite(createdAt) && createdAt >= cutoffTime();
}

function storageKey(userId) {
  return `portal_notification_dismissed_${userId}`;
}

function readDismissed(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function writeDismissed(userId, dismissed) {
  localStorage.setItem(storageKey(userId), JSON.stringify(Array.from(dismissed)));
}

function taskSnapshotKey(userId) {
  return `portal_task_snapshot_${userId}`;
}

function readTaskSnapshot(userId) {
  try {
    const raw = localStorage.getItem(taskSnapshotKey(userId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeTaskSnapshot(userId, snapshot) {
  localStorage.setItem(taskSnapshotKey(userId), JSON.stringify(snapshot));
}

function notificationKey(notification) {
  if (notification.type === "schedule") {
    return `${notification.type}:${notification.id}:${notification.signature || ""}`;
  }
  return `${notification.type}:${notification.id}`;
}

export default function NotificationBell() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const isManager = Boolean(profile?.isAdmin || profile?.isCoach || profile?.isPortalAdmin);

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }

    let active = true;

    async function load() {
      const [annResp, resourceResp, eventResp, interestResp, memberResp, taskResp] = await Promise.all([
        supabase
          .from("announcements")
          .select("id,title,created_at")
          .order("created_at", { ascending: false })
          .limit(25),
        supabase
          .from("learning_resources")
          .select("id,title,uploader_id,created_at")
          .order("created_at", { ascending: false })
          .limit(25),
        supabase
          .from("event_media")
          .select("id,title,created_at")
          .order("created_at", { ascending: false })
          .limit(25),
        isManager
          ? supabase
              .from("interest_submissions")
              .select("id,kind,full_name,team_location,created_at")
              .order("created_at", { ascending: false })
              .limit(25)
          : Promise.resolve({ data: [] }),
        isManager
          ? supabase
              .from("team_members")
              .select("id,name,created_at")
              .order("created_at", { ascending: false })
              .limit(25)
          : Promise.resolve({ data: [] }),
        isManager
          ? supabase
              .from("tasks")
              .select("id,task,status,start_date,end_date,member_type,member_id,created_at")
            .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] })
      ]);

      if (!active) {
        return;
      }

      const dismissed = readDismissed(user.id);
      const announcements = (annResp.data || [])
        .filter(recentOnly)
        .map((row) => ({
          id: row.id,
          type: "announcement",
          title: `New announcement: ${row.title || "Update"}`,
          created_at: row.created_at,
          to: "/dashboard"
        }));

      const resources = (resourceResp.data || [])
        .filter((row) => row.uploader_id !== user.id)
        .filter(recentOnly)
        .map((row) => ({
          id: row.id,
          type: "resource",
          title: `New learning resource: ${row.title || "Resource"}`,
          created_at: row.created_at,
          to: "/learning"
        }));

      const events = (eventResp.data || [])
        .filter(recentOnly)
        .map((row) => ({
          id: row.id,
          type: "event",
          title: `New team event: ${row.title || "Event"}`,
          created_at: row.created_at,
          to: "/about"
        }));

      const interests = (interestResp.data || [])
        .filter(recentOnly)
        .map((row) => ({
          id: row.id,
          type: row.kind === "sponsor" ? "sponsor" : "interest",
          title:
            row.kind === "sponsor"
              ? `Sponsor inquiry: ${row.full_name || row.team_location || "Someone"}`
              : row.kind === "onboard"
                ? `New team onboarding: ${row.team_location || "New team"}`
                : `New team interest: ${row.full_name || "Someone"}`,
          created_at: row.created_at,
          to: "/admin"
        }));

      const members = (memberResp.data || [])
        .filter(recentOnly)
        .map((row) => ({
          id: row.id,
          type: "member",
          title: `New team member: ${row.name || "Member"}`,
          created_at: row.created_at,
          to: "/admin"
        }));

      let schedule = [];
      if (isManager) {
        const previousSnapshot = readTaskSnapshot(user.id);
        const hasPrevious = Object.keys(previousSnapshot).length > 0;
        const nextSnapshot = {};

        for (const row of taskResp.data || []) {
          const signature = `${row.task || ""}|${row.status || ""}|${row.start_date || ""}|${row.end_date || ""}`;
          nextSnapshot[row.id] = signature;

          if (!hasPrevious) {
            continue;
          }

          const prevSignature = previousSnapshot[row.id];
          const changed = prevSignature && prevSignature !== signature;
          const newlyAdded = !prevSignature;
          if (!changed && !newlyAdded) {
            continue;
          }

          schedule.push({
            id: row.id,
            type: "schedule",
            title: `Team schedule updated: ${row.task || "Task"} (${row.status || "Not Started"})`,
            created_at: changed ? new Date().toISOString() : row.created_at,
            signature,
            to: "/schedule"
          });
        }

        writeTaskSnapshot(user.id, nextSnapshot);
      }

      const merged = [...announcements, ...resources, ...events, ...interests, ...members, ...schedule]
        .filter((item) => !dismissed.has(notificationKey(item)))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setItems(merged);
    }

    load();
    const timer = window.setInterval(load, 30000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [isManager, user?.id]);

  async function clearOne(notification) {
    const next = readDismissed(user.id);
    next.add(notificationKey(notification));
    writeDismissed(user.id, next);
    setItems((prev) => prev.filter((item) => notificationKey(item) !== notificationKey(notification)));
  }

  async function clearAll() {
    const next = readDismissed(user.id);
    items.forEach((notification) => next.add(notificationKey(notification)));
    writeDismissed(user.id, next);
    setItems([]);
  }

  if (!user) return null;

  const count = items.length;

  return (
    <li className="notif-item" ref={ref}>
      <button
        type="button"
        className="notif-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Notifications${count ? ` (${count} new)` : ""}`}
        title="Notifications"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm6-6v-5a6 6 0 0 0-4.5-5.8V4a1.5 1.5 0 0 0-3 0v1.2A6 6 0 0 0 6 11v5l-1.7 1.7a1 1 0 0 0 .7 1.3h14a1 1 0 0 0 .7-1.3L18 16z"
          />
        </svg>
        {count > 0 && <span className="notif-badge">{count > 9 ? "9+" : count}</span>}
      </button>

      {open && (
        <div className="notif-dropdown" role="menu">
          <div className="notif-dropdown-head">
            <strong>Notifications</strong>
            {count > 0 && (
              <button type="button" className="notif-clear-all" onClick={clearAll}>
                Clear all
              </button>
            )}
          </div>
          {count === 0 ? (
            <p className="notif-empty">You&apos;re all caught up.</p>
          ) : (
            <ul className="notif-list">
              {items.map((notification) => (
                <li key={`${notification.type}:${notification.id}`} className="notif-row">
                  <button
                    type="button"
                    className="notif-row-main"
                    onClick={() => {
                      setOpen(false);
                      navigate(notification.to);
                    }}
                  >
                    <span className="notif-row-title">{notification.title}</span>
                    <span className="notif-row-time">
                      {new Date(notification.created_at).toLocaleString()}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="notif-row-clear"
                    onClick={() => clearOne(notification)}
                    aria-label="Clear notification"
                    title="Clear"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
