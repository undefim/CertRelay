import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../components/AuthProvider";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Loader2 } from "lucide-react";
import { Label } from "../components/ui/label";
import { AuthShell } from "../components/AuthShell";
import { PasswordInput } from "../components/PasswordInput";
import { useI18n } from "../components/LocaleProvider";
import { ApiClientError, api } from "../lib/api";

export function Login() {
  const { login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await api.post<{ token: string }>("/auth/login", { username, password });
      if (data.token) {
        login(data.token);
      } else {
        throw new Error(t("login.invalidToken"));
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 409 && err.data?.setupRequired === true) {
        navigate("/setup", { replace: true });
        return;
      }
      if (err instanceof ApiClientError && err.status === 401) {
        setError(t("login.invalidCredentials"));
      } else {
        setError(err instanceof ApiClientError ? err.message : (err as Error).message || t("login.failed"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title={t("app.name")} description={t("login.description")} error={error}>
      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="username">{t("login.username")}</Label>
          <Input
            id="username"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">{t("login.password")}</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" size="lg" className="mt-2 w-full" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : null}
          {loading ? t("login.signingIn") : t("login.signIn")}
        </Button>
      </form>
    </AuthShell>
  );
}
