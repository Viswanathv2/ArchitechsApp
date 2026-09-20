import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { navItems } from "../config/portalPages";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";

export default function Layout() {
  const [dark, setDark] = useState(() => localStorage.getItem("site-theme") !== "light");
  const { user, profile, logout, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [navigationMenuOpen, setNavigationMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const navigationMenuRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark-theme", dark);
    localStorage.setItem("site-theme", dark ? "dark" : "light");
  }, [dark]);

  // Close the user menu on outside click
  useEffect(() => {
    function handleClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
      if (navigationMenuRef.current && !navigationMenuRef.current.contains(e.target)) {
        setNavigationMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close the dropdown whenever the route changes
  useEffect(() => {
    setUserMenuOpen(false);
    setNavigationMenuOpen(false);
  }, [location.pathname]);

  const roleDisplay = profile?.isAdmin ? "Admin" : profile?.isCoach ? "Coach" : "Member";
  const avatarFallback = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' fill='%23e5e8f0'/%3E%3Ccircle cx='40' cy='32' r='16' fill='%23a8aec4'/%3E%3Cpath d='M 10 74 Q 10 50 40 50 Q 70 50 70 74 Z' fill='%23a8aec4'/%3E%3C/svg%3E";

  return (
    <>
      <div className="background-art" aria-hidden="true" />
      <nav className="top-nav" aria-label="Main navigation">
        <ul className="top-nav-list">
          <li className="top-nav-brand-item">
            <NavLink
              to={user ? "/dashboard" : "/"}
              className={() => "top-nav-brand"}
              end
              aria-label="Architechs home"
            >
              <span className="top-nav-brand-title">ARCHITECHS</span>
              <span className="top-nav-brand-sub">#25795</span>
            </NavLink>
          </li>
          <li className="navigation-menu" ref={navigationMenuRef}>
            <button
              type="button"
              className="mobile-nav-toggle"
              onClick={() => setNavigationMenuOpen((open) => !open)}
              aria-haspopup="true"
              aria-expanded={navigationMenuOpen}
              aria-label="Open navigation menu"
              title="Navigation"
            >
              <span aria-hidden="true">☰</span>
            </button>
            {navigationMenuOpen ? (
              <div className="navigation-menu-dropdown" role="menu">
                {navItems.map((item) => {
                  const targetPath = user && item.to === "/" ? "/dashboard" : item.to;
                  const isRootLike = targetPath === "/" || targetPath === "/dashboard";
                  return (
                    <NavLink
                      key={item.to}
                      to={targetPath}
                      role="menuitem"
                      className={({ isActive }) => (isActive ? "active" : undefined)}
                      end={isRootLike}
                    >
                      {item.label}
                    </NavLink>
                  );
                })}
                {!user ? (
                  <NavLink
                    to="/login"
                    role="menuitem"
                    className={({ isActive }) => (isActive ? "active" : undefined)}
                  >
                    {loading ? "Account" : "Login"}
                  </NavLink>
                ) : null}
              </div>
            ) : null}
          </li>
          {user ? (
            <li className="user-menu account-item" ref={userMenuRef}>
              <button
                type="button"
                className="user-menu-toggle"
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-haspopup="true"
                aria-expanded={userMenuOpen}
              >
                <span className="user-menu-avatar">
                  <img src={profile?.avatarUrl || avatarFallback} alt="" />
                </span>
                <span className="user-menu-name">{profile?.displayName || "Member"}</span>
                <span className="member-pill">{roleDisplay}</span>
              </button>
              {/* <button
                type="button"
                className="nav-signout-btn"
                title="Log Out"
                onClick={async () => {
                  await logout();
                  navigate("/");
                }}
              >
                Log Out
              </button> */}
              {userMenuOpen ? (
                <div className="user-menu-dropdown" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => navigate("/profile")}
                  >
                    Change Profile
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="user-menu-logout"
                    onClick={async () => {
                      await logout();
                      navigate("/");
                    }}
                  >
                    Log Out
                  </button>
                </div>
              ) : null}
            </li>
          ) : null}
          <NotificationBell />
          <li className="theme-toggle-item">
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={() => setDark((v) => !v)}
              aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
              title={dark ? "Light mode" : "Dark mode"}
            >
              {dark ? (
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" fill="currentColor" />
                  <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="12" y1="2" x2="12" y2="4" />
                    <line x1="12" y1="20" x2="12" y2="22" />
                    <line x1="2" y1="12" x2="4" y2="12" />
                    <line x1="20" y1="12" x2="22" y2="12" />
                    <line x1="4.9" y1="4.9" x2="6.3" y2="6.3" />
                    <line x1="17.7" y1="17.7" x2="19.1" y2="19.1" />
                    <line x1="4.9" y1="19.1" x2="6.3" y2="17.7" />
                    <line x1="17.7" y1="6.3" x2="19.1" y2="4.9" />
                  </g>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                  />
                </svg>
              )}
            </button>
          </li>
        </ul>
      </nav>
      {user ? (
        <main className="logged-layout">
          <section className="logged-main">
            <div className="route-fade">
              <Outlet />
            </div>
          </section>
        </main>
      ) : (
        <main>
          <div className="route-fade">
            <Outlet />
          </div>
        </main>
      )}
    </>
  );
}
