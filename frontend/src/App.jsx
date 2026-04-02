import { useState } from "react";
import LoginForm from "./features/auth/LoginForm";
import DashboardPage from "./features/dashboard/DashboardPage";
import {
  clearStoredSession,
  getStoredSession,
  saveStoredSession,
} from "./lib/authStorage";

export default function App() {
  const [session, setSession] = useState(() => getStoredSession());

  const handleLoginSuccess = (loginResponse) => {
    const nextSession = {
      token: loginResponse.token,
      user: loginResponse.user,
    };

    saveStoredSession(nextSession);
    setSession(nextSession);
  };

  const handleLogout = () => {
    clearStoredSession();
    setSession(null);
  };

  return (
    <div className="app-root">
      {session ? (
        <DashboardPage session={session} onLogout={handleLogout} />
      ) : (
        <LoginForm onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}
