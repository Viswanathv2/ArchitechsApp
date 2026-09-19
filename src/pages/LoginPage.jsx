import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const AUTH_REGISTER_COOLDOWN_SECONDS = 45;
const AUTH_LOGIN_COOLDOWN_SECONDS = 10;

function isRateLimitError(error) {
  const status = Number(error?.status || 0);
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  return (
    status === 429 ||
    code.includes("rate_limit") ||
    message.includes("email rate limit") ||
    message.includes("rate limit exceeded")
  );
}

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ displayName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownMode, setCooldownMode] = useState("login");
  const [clock, setClock] = useState(Date.now());

  const isRegister = mode === "register";
  const now = clock;
  const remaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const inCooldown = remaining > 0 && cooldownMode === mode;

  const submitText = useMemo(() => {
    if (inCooldown) {
      return `Wait ${remaining}s`;
    }
    return isRegister ? "Create Account" : "Log In";
  }, [inCooldown, remaining, isRegister]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setSuccess("");
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (inCooldown || busy) {
      return;
    }

    const email = form.email.trim();
    const password = form.password;
    const displayName = form.displayName.trim();

    setBusy(true);

    try {
      if (isRegister) {
        await register(email, password, displayName || "Member");
        setSuccess("Account created. Now log in with the same email and password.");
        setForm((v) => ({ ...v, password: "" }));
        switchMode("login");
      } else {
        await login(email, password);
        const destination = location.state?.from || "/dashboard";
        navigate(destination, { replace: true });
      }
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again.");

      if (isRateLimitError(err)) {
        const waitSeconds = isRegister ? AUTH_REGISTER_COOLDOWN_SECONDS : AUTH_LOGIN_COOLDOWN_SECONDS;
        setCooldownMode(mode);
        setCooldownUntil(Date.now() + waitSeconds * 1000);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="landing-page center-shell">
      <div className="landing-container">
        <section className="landing-section login-card">
          <header className="landing-header">
            <h1>FTC Team Portal</h1>
            <p className="landing-tagline">Sign in to see your team dashboard.</p>
          </header>

          <div className="auth-switch" role="tablist" aria-label="Choose authentication mode">
            <button
              type="button"
              className={`auth-tab ${!isRegister ? "active" : ""}`}
              onClick={() => switchMode("login")}
            >
              Log In
            </button>
            <button
              type="button"
              className={`auth-tab ${isRegister ? "active" : ""}`}
              onClick={() => switchMode("register")}
            >
              Register
            </button>
          </div>

          <form className="admin-form login-form" onSubmit={onSubmit}>
            {isRegister ? (
              <>
                <label htmlFor="displayName">Display Name</label>
                <input
                  id="displayName"
                  value={form.displayName}
                  onChange={(e) => setForm((v) => ({ ...v, displayName: e.target.value }))}
                  placeholder="Example: Driver 1"
                  required
                />
              </>
            ) : null}

            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
              placeholder="student@example.com"
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))}
              placeholder="Enter your password"
              required
            />

            <button type="submit" className="admin-save-btn" disabled={busy || inCooldown}>
              {submitText}
            </button>
            <p className="error">{error}</p>
            <p className="success">{success}</p>
          </form>
        </section>
      </div>
    </section>
  );
}
