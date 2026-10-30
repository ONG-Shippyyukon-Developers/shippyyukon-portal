import { createContext, useContext, useState, ReactNode } from "react";
import { RolPlataforma } from "@shippiyyukon/shared";

interface AuthState {
  autenticado: boolean;
  rolPlataforma: RolPlataforma | null;
  municipio?: string;
  loginConPasskey: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * STUB — HU-00.2. El login real se hace contra el User Pool de Cognito
 * (infrastructure/lib/constructs/auth-construct.ts) usando el SDK de Amplify
 * o amazon-cognito-identity-js con el flujo USER_AUTH + WebAuthn (passkey).
 * Este stub solo modela la forma del estado para que el resto de la UI
 * (RegistroConsejeroForm, ListaConsejeros) ya pueda integrarse contra él.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [autenticado, setAutenticado] = useState(false);
  const [rolPlataforma, setRolPlataforma] = useState<RolPlataforma | null>(null);

  async function loginConPasskey() {
    // TODO: reemplazar por el flujo real de Amplify Auth con WebAuthn.
    // Al completarse, guardar el access token en sessionStorage bajo la
    // clave que lee apiClient.ts ("shippiyyukon_access_token").
    throw new Error("Integración de passkey pendiente — ver auth-construct.ts");
  }

  function logout() {
    sessionStorage.removeItem("shippiyyukon_access_token");
    setAutenticado(false);
    setRolPlataforma(null);
  }

  return (
    <AuthContext.Provider
      value={{ autenticado, rolPlataforma, loginConPasskey, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
