import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { RolPlataforma, type ContextoAutorizacion } from "@shippiyyukon/shared";
import { apiRequest } from "../lib/apiClient";
import { authClient, requireAuthClient } from "./neonAuth";

interface AuthState {
  autenticado: boolean;
  autorizado: boolean;
  cargando: boolean;
  rolPlataforma: RolPlataforma | null;
  contexto: ContextoAutorizacion | null;
  loginConEmail: (email: string, password: string) => Promise<void>;
  loginConGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [autenticado, setAutenticado] = useState(false);
  const [autorizado, setAutorizado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [rolPlataforma, setRolPlataforma] = useState<RolPlataforma | null>(null);
  const [contexto, setContexto] = useState<ContextoAutorizacion | null>(null);

  const refreshAuthorization = useCallback(async () => {
    try {
      const result = await apiRequest<ContextoAutorizacion>("/auth/context");
      setContexto(result);
      setRolPlataforma(result.rolPlataforma);
      setAutorizado(true);
    } catch {
      setContexto(null);
      setRolPlataforma(null);
      setAutorizado(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const client = requireAuthClient();
        const result = await client.getSession();
        if (!active) return;
        const signedIn = Boolean(result.data?.session);
        setAutenticado(signedIn);
        if (signedIn) await refreshAuthorization();
      } catch {
        if (active) setAutenticado(false);
      } finally {
        if (active) setCargando(false);
      }
    }
    void restoreSession();
    return () => { active = false; };
  }, [refreshAuthorization]);

  async function loginConEmail(email: string, password: string) {
    const client = requireAuthClient();
    const result = await client.signIn.email({ email: email.trim(), password });
    if (result.error) throw new Error(result.error.message ?? "No se pudo iniciar sesión");
    const session = await client.getSession();
    if (!session.data?.session) throw new Error("Neon no devolvió una sesión válida");
    setAutenticado(true);
    await refreshAuthorization();
  }

  async function loginConGoogle() {
    const client = requireAuthClient();
    const result = await client.signIn.social({
      provider: "google",
      callbackURL: window.location.origin,
    });
    if (result.error) throw new Error(result.error.message ?? "No se pudo iniciar sesión con Google");
  }

  async function logout() {
    if (authClient) await authClient.signOut();
    setAutenticado(false);
    setAutorizado(false);
    setRolPlataforma(null);
    setContexto(null);
  }

  return (
    <AuthContext.Provider value={{ autenticado, autorizado, cargando, rolPlataforma, contexto, loginConEmail, loginConGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
