import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Label } from "../components/ui/label";
import { AuthShell } from "../components/AuthShell";
import { PasswordInput } from "../components/PasswordInput";
import { useAuth } from "../components/AuthProvider";
import { useI18n } from "../components/LocaleProvider";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ApiClientError, api } from "../lib/api";
import type { AuthStatus } from "../types/api";

export function Setup() {
  const { login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError(t("setup.passwordMismatch"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await api.post<{ token: string }>("/auth/bootstrap", { username, password });
      if (data.token) {
        queryClient.setQueryData<AuthStatus>(["auth-status"], {
          initialized: true,
          setupRequired: false,
        });
        login(data.token);
        return;
      }
      throw new Error(t("setup.invalidToken"));
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 409 && err.data?.setupRequired === false) {
        navigate("/login", { replace: true });
        return;
      }
      setError(err instanceof ApiClientError ? err.message : (err as Error).message || t("setup.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title={t("setup.title")} description={t("setup.description")} error={error}>
      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="setup-username">{t("setup.username")}</Label>
          <Input
            id="setup-username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="setup-password">{t("setup.password")}</Label>
          <PasswordInput
            id="setup-password"
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="setup-confirm-password">{t("setup.confirmPassword")}</Label>
          <PasswordInput
            id="setup-confirm-password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <Button type="submit" size="lg" className="mt-2 w-full" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : null}
          {loading ? t("setup.initializing") : t("setup.submit")}
        </Button>
      </form>
    </AuthShell>
  );
}
