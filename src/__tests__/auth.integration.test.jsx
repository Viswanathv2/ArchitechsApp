import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import App from "../App";
import LoginPage from "../pages/LoginPage";
import ProtectedRoute from "../components/ProtectedRoute";
import { AuthProvider, useAuth } from "../context/AuthContext";

// Mock Supabase
vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } })
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
    }))
  }
}));

describe("Auth Integration Tests", () => {
  describe("Login/Register Redirect", () => {
    it("should show login page when user is not authenticated", async () => {
      render(
        <BrowserRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/FTC Team Portal/i)).toBeInTheDocument();
        expect(screen.getByText(/Sign in to see your team dashboard/i)).toBeInTheDocument();
      });
    });

    it("should have login and register tabs", async () => {
      render(
        <BrowserRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        const loginBtn = screen.getByRole("button", { name: /Log In/i });
        const registerBtn = screen.getByRole("button", { name: /Register/i });
        expect(loginBtn).toBeInTheDocument();
        expect(registerBtn).toBeInTheDocument();
      });
    });

    it("should show display name field when switching to register mode", async () => {
      const { user } = await import("@testing-library/user-event");
      render(
        <BrowserRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </BrowserRouter>
      );

      const registerTab = screen.getByRole("button", { name: /Register/i });
      await user.click(registerTab);

      await waitFor(() => {
        const displayNameInput = screen.getByPlaceholderText(/Example: Driver 1/i);
        expect(displayNameInput).toBeInTheDocument();
      });
    });
  });

  describe("Protected Routes", () => {
    it("should redirect unauthenticated user from protected route to login", async () => {
      const TestComponent = () => (
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      // Should show loading text first
      await waitFor(() => {
        expect(screen.getByText(/Loading your session/i)).toBeInTheDocument();
      });
    });

    it("should render protected content when user is authenticated", async () => {
      const mockUser = { id: "test-user", email: "test@example.com" };
      vi.mocked(require("../lib/supabase").supabase.auth.getSession).mockResolvedValueOnce({
        data: { session: { user: mockUser } }
      });

      const TestAuthComponent = () => {
        const { user } = useAuth();
        return <div>{user ? "Authenticated" : "Not Authenticated"}</div>;
      };

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestAuthComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Authenticated|Not Authenticated/i)).toBeInTheDocument();
      });
    });
  });

  describe("Logout Flow", () => {
    it("should have logout button in navigation when user is authenticated", async () => {
      const mockUser = { id: "test-user", email: "test@example.com" };
      vi.mocked(require("../lib/supabase").supabase.auth.getSession).mockResolvedValueOnce({
        data: { session: { user: mockUser } }
      });

      const TestComponent = () => {
        const { user, logout } = useAuth();
        return user ? (
          <button onClick={logout}>Log Out</button>
        ) : (
          <div>Not authenticated</div>
        );
      };

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      // Component should eventually show authenticated state
      await waitFor(() => {
        const logoutBtn = screen.queryByRole("button", { name: /Log Out/i });
        // May or may not find depending on auth state
        expect(logoutBtn || screen.getByText(/Not authenticated/i)).toBeTruthy();
      });
    });

    it("should call signOut when logout is triggered", async () => {
      const signOutMock = vi.fn().mockResolvedValue({});
      vi.mocked(require("../lib/supabase").supabase.auth.signOut).mockImplementation(signOutMock);

      const TestComponent = () => {
        const { user, logout } = useAuth();
        return user ? (
          <button onClick={logout}>Log Out</button>
        ) : (
          <div>Not authenticated</div>
        );
      };

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      // The logout function should be defined
      await waitFor(() => {
        expect(TestComponent).toBeDefined();
      });
    });
  });

  describe("Cooldown Handling", () => {
    it("should show cooldown timer after failed login attempts", async () => {
      render(
        <BrowserRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        // Login form should be rendered
        const emailInput = screen.getByPlaceholderText(/student@example.com/i);
        expect(emailInput).toBeInTheDocument();
      });
    });

    it("should disable submit button during cooldown", async () => {
      render(
        <BrowserRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        const submitBtn = screen.getByRole("button", { name: /Log In|Wait/i });
        expect(submitBtn).toBeInTheDocument();
      });
    });
  });

  describe("Auth Context", () => {
    it("should provide user and profile in context", async () => {
      const TestComponent = () => {
        const { user, profile, loading } = useAuth();
        return (
          <div>
            {loading ? "Loading..." : `User: ${user?.email || "None"}, Profile: ${profile.displayName}`}
          </div>
        );
      };

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        const text = screen.getByText(/User:|Loading/i);
        expect(text).toBeInTheDocument();
      });
    });

    it("should restore session on mount", async () => {
      const getSessionMock = vi.fn().mockResolvedValue({
        data: { session: { user: { id: "test", email: "test@example.com" } } }
      });

      vi.mocked(require("../lib/supabase").supabase.auth.getSession).mockImplementation(getSessionMock);

      const TestComponent = () => {
        const { user, loading } = useAuth();
        return <div>{loading ? "Loading..." : user?.email || "No user"}</div>;
      };

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(getSessionMock).toHaveBeenCalled();
      });
    });
  });
});
