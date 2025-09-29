import SignupForm from "@/components/auth/SignupForm";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function Signup() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, setLocation]);

  const handleReplitLogin = () => {
    // In development, use dev-login endpoint
    const isDevelopment = import.meta.env.DEV;
    window.location.href = isDevelopment ? "/api/dev-login" : "/api/login";
  };

  // Don't render if already authenticated (prevents flash)
  if (isAuthenticated) {
    return null;
  }

  return <SignupForm onReplitLogin={handleReplitLogin} />;
}