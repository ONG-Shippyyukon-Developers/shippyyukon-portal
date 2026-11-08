import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthContext";

export function SignInPage() {
  const { loginConEmail, loginConGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await loginConEmail(email, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar sesión");
    } finally {
      setEnviando(false);
    }
  }

  async function signInWithGoogle() {
    setError(null);
    setEnviando(true);
    try {
      await loginConGoogle();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar sesión con Google");
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto mt-20 max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Acceso al panel</h1>
      <p className="mt-2 text-sm text-slate-600">Inicia sesión con tu cuenta autorizada.</p>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <label className="block text-sm font-medium text-slate-700">
          Correo
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Contraseña
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button className="w-full rounded-lg bg-brand-600 px-4 py-2 font-medium text-white disabled:opacity-60" disabled={enviando}>
          {enviando ? "Validando…" : "Iniciar sesión"}
        </button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        <span>o</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <button type="button" className="w-full rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 disabled:opacity-60" onClick={() => void signInWithGoogle()} disabled={enviando}>
        Continuar con Google
      </button>
    </main>
  );
}
