import { useEffect, useMemo, useState } from "react";
import RouteLoading from "../components/RouteLoading";
import MemberModal from "../components/MemberModal";
import { usePortalPage } from "../hooks/usePortalPage";
import { useTrackVisit } from "../hooks/useTrackVisit";
import { supabase } from "../lib/supabase";

// Default placeholder image (portrait user icon SVG, 3:4 ratio)
const DEFAULT_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 90 120'%3E%3Crect width='90' height='120' fill='%23e5e8f0'/%3E%3Ccircle cx='45' cy='44' r='20' fill='%23a8aec4'/%3E%3Cpath d='M 12 110 Q 12 78 45 78 Q 78 78 78 110 L 78 120 L 12 120 Z' fill='%23a8aec4'/%3E%3C/svg%3E";

function rolesToText(value) {
  const items = String(value || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (!items.length) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function rolesToList(value) {
  return String(value || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function roleClass(role) {
  const key = role.toLowerCase();
  if (key.includes("captain") || key.includes("lead")) return "role-captain";
  if (key.includes("cod") || key.includes("program") || key.includes("software")) return "role-coder";
  if (key.includes("build") || key.includes("mech") || key.includes("hardware")) return "role-build";
  if (key.includes("cad") || key.includes("design")) return "role-cad";
  return "role-default";
}

function RoleBadges({ value }) {
  const roles = rolesToList(value);
  if (!roles.length) return null;
  return (
    <div className="role-badges">
      {roles.map((role) => (
        <span key={role} className={`role-badge ${roleClass(role)}`}>{role}</span>
      ))}
    </div>
  );
}

export default function TeamPage() {
  const page = usePortalPage("team");
  useTrackVisit("team");
  const [members, setMembers] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [alumni, setAlumni] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [teamTab, setTeamTab] = useState("active");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const [membersResp, coachesResp, mentorsResp, alumniResp] = await Promise.all([
        supabase
          .from("team_members")
          .select("id,name,roles,grade,image_url,bio")
          .eq("is_active", true)
          .order("name", { ascending: true }),
        supabase
          .from("coaches")
          .select("id,name,role,image_url,bio")
          .eq("is_active", true)
          .order("name", { ascending: true }),
        supabase
          .from("mentors")
          .select("id,name,role,image_url,bio")
          .eq("is_active", true)
          .order("name", { ascending: true }),
        supabase
          .from("alumni")
          .select("id,name,role,year,image_url,bio")
          .eq("is_active", true)
          .order("name", { ascending: true })
      ]);

      if (!isMounted) {
        return;
      }

      setMembers(Array.isArray(membersResp.data) ? membersResp.data : []);
      setCoaches(Array.isArray(coachesResp.data) ? coachesResp.data : []);
      setMentors(Array.isArray(mentorsResp.data) ? mentorsResp.data : []);
      setAlumni(Array.isArray(alumniResp.data) ? alumniResp.data : []);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const subtitle = useMemo(() => page.subtitle, [page.subtitle]);

  function renderGrid(items, { roleField, subLabel, emptyText }) {
    if (!items.length) {
      return <p>{emptyText}</p>;
    }
    return (
      <div className="team-grid">
        {items.map((item) => {
          const roleValue = roleField === "roles" ? item.roles : item.role;
          return (
            <article
              key={item.id}
              className="team-member-card clickable"
              onClick={() => setSelectedMember({
                name: item.name,
                role: roleField === "roles" ? rolesToText(item.roles) : item.role,
                grade: item.grade,
                year: item.year,
                bio: item.bio,
                image: item.image_url
              })}
            >
              <div className="member-photo">
                <img src={item.image_url || DEFAULT_IMAGE} alt={item.name} />
              </div>
              <div className="member-info">
                <h3>{item.name}</h3>
                {subLabel ? subLabel(item) : null}
                <RoleBadges value={roleValue} />
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  if (page.loading) {
    return <RouteLoading />;
  }

  const TABS = [
    { key: "active", label: "Active Members" },
    { key: "coaches", label: "Coaches" },
    { key: "mentors", label: "Mentors" },
    { key: "alumni", label: "Alumni" }
  ];

  return (
    <section className="landing-page">
      <header className="landing-header">
        <h1>{page.title}</h1>
        <p className="landing-tagline">{subtitle}</p>
      </header>
      <div className="landing-container">
        <section className="landing-section">
          <div className="team-section-head">
            <h2>Meet the Team</h2>
            <div className="team-tabs" role="tablist">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  className={`team-tab${teamTab === tab.key ? " active" : ""}`}
                  aria-selected={teamTab === tab.key}
                  onClick={() => setTeamTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {teamTab === "active" && renderGrid(members, {
            roleField: "roles",
            subLabel: (m) => (m.grade ? <span className="member-grade">{m.grade}</span> : null),
            emptyText: "No team members yet."
          })}

          {teamTab === "coaches" && renderGrid(coaches, {
            roleField: "role",
            subLabel: null,
            emptyText: "No coaches yet."
          })}

          {teamTab === "mentors" && renderGrid(mentors, {
            roleField: "role",
            subLabel: null,
            emptyText: "No mentors yet."
          })}

          {teamTab === "alumni" && renderGrid(alumni, {
            roleField: "role",
            subLabel: (m) => (m.year ? <span className="member-grade">Class of {m.year}</span> : null),
            emptyText: "No alumni yet."
          })}
        </section>
      </div>
      <MemberModal 
        isOpen={!!selectedMember} 
        member={selectedMember} 
        onClose={() => setSelectedMember(null)} 
      />
    </section>
  );
}
