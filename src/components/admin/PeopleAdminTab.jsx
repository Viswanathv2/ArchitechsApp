import { useState } from "react";
import TeamMembersAdminTab from "./TeamMembersAdminTab";
import StaffAdminTab from "./StaffAdminTab";
import AlumniAdminTab from "./AlumniAdminTab";

// Combined "People" admin tab. A dropdown switches between managing
// active team members, coaches & mentors, and alumni — all in one place.
const SECTIONS = [
  { value: "members", label: "Team Members" },
  { value: "staff", label: "Coaches & Mentors" },
  { value: "alumni", label: "Alumni" }
];

export default function PeopleAdminTab() {
  const [section, setSection] = useState("members");

  return (
    <div className="admin-section">
      <div className="people-admin-switcher">
        <label htmlFor="peopleSection">Manage</label>
        <select
          id="peopleSection"
          value={section}
          onChange={(e) => setSection(e.target.value)}
        >
          {SECTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {section === "members" && <TeamMembersAdminTab />}
      {section === "staff" && <StaffAdminTab />}
      {section === "alumni" && <AlumniAdminTab />}
    </div>
  );
}
