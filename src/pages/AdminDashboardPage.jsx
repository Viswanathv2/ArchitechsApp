import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";
import PeopleAdminTab from "../components/admin/PeopleAdminTab";
import EventsAdminTab from "../components/admin/EventsAdminTab";
import VisitAnalyticsTab from "../components/admin/VisitAnalyticsTab";
import FeedbackTab from "../components/admin/FeedbackTab";
import InterestRequestsTab from "../components/admin/InterestRequestsTab";
import AnnouncementsAdminTab from "../components/admin/AnnouncementsAdminTab";
import SponsorsAdminTab from "../components/admin/SponsorsAdminTab";
import UserManagementAdminTab from "../components/admin/UserManagementAdminTab";

export default function AdminDashboardPage() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState("interest");

  // Only coaches and portal admins can access
  if (!user || (!profile.isAdmin && !profile.isCoach && !profile.isPortalAdmin)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <section className="admin-dashboard-page">
      <header className="admin-header">
        <h1>Admin Dashboard</h1>
        <p>Manage requests, announcements, the team story, sponsors, and people</p>
      </header>

      <div className="admin-tabs">
        <button
          className={`admin-tab-btn ${activeTab === "interest" ? "active" : ""}`}
          onClick={() => setActiveTab("interest")}
        >
          Interest Requests
        </button>
        <button
          className={`admin-tab-btn ${activeTab === "announcements" ? "active" : ""}`}
          onClick={() => setActiveTab("announcements")}
        >
          Announcements
        </button>
        <button
          className={`admin-tab-btn ${activeTab === "story" ? "active" : ""}`}
          onClick={() => setActiveTab("story")}
        >
          Team Story
        </button>
        <button
          className={`admin-tab-btn ${activeTab === "sponsors" ? "active" : ""}`}
          onClick={() => setActiveTab("sponsors")}
        >
          Sponsors
        </button>
        {profile.isPortalAdmin && (
          <>
            <button
              className={`admin-tab-btn ${activeTab === "people" ? "active" : ""}`}
              onClick={() => setActiveTab("people")}
            >
              People
            </button>
            <button
              className={`admin-tab-btn ${activeTab === "visits" ? "active" : ""}`}
              onClick={() => setActiveTab("visits")}
            >
              Visit Analytics
            </button>
            <button
              className={`admin-tab-btn ${activeTab === "feedback" ? "active" : ""}`}
              onClick={() => setActiveTab("feedback")}
            >
              Feedback
            </button>
          </>
        )}
        {profile.isAdmin && (
          <button
            className={`admin-tab-btn ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            User Management
          </button>
        )}
      </div>

      <div className="admin-content">
        {activeTab === "interest" && <InterestRequestsTab />}
        {activeTab === "announcements" && <AnnouncementsAdminTab />}
        {activeTab === "story" && <EventsAdminTab />}
        {activeTab === "sponsors" && <SponsorsAdminTab />}
        {activeTab === "people" && profile.isPortalAdmin && <PeopleAdminTab />}
        {activeTab === "visits" && profile.isPortalAdmin && <VisitAnalyticsTab />}
        {activeTab === "feedback" && profile.isPortalAdmin && <FeedbackTab />}
        {activeTab === "users" && profile.isAdmin && <UserManagementAdminTab />}
      </div>
    </section>
  );
}
