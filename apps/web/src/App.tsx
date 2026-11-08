import { BrowserRouter, Routes, Route, Link, NavLink } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { SignInPage } from "./auth/SignInPage";
import { RegistroConsejeroForm } from "./features/consejeros/RegistroConsejeroForm";
import { ListaConsejeros } from "./features/consejeros/ListaConsejeros";

function Shell({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"}`;
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-semibold text-slate-900">redpanel · Red Alianza y Fraternidad</Link>
          <nav className="flex items-center gap-2">
            <NavLink to="/registro" className={linkClass}>Registrar consejero</NavLink>
            <NavLink to="/consejeros" className={linkClass}>Consejeros</NavLink>
            <button className="px-3 py-1.5 text-sm text-slate-600" onClick={() => void logout()}>Cerrar sesión</button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
    </div>
  );
}

function Panel() {
  const { autenticado, autorizado, cargando } = useAuth();
  if (cargando) return <p className="p-8 text-center">Comprobando sesión…</p>;
  if (!autenticado) return <SignInPage />;
  if (!autorizado) {
    return <main className="mx-auto mt-20 max-w-lg rounded-xl bg-white p-8 text-center shadow-sm">
      <h1 className="text-xl font-semibold">Cuenta sin permisos para el panel</h1>
      <p className="mt-2 text-sm text-slate-600">La autenticación fue válida, pero no hay una asignación de acceso activa.</p>
    </main>;
  }
  return <Shell><Routes>
    <Route path="/" element={<ListaConsejeros />} />
    <Route path="/registro" element={<RegistroConsejeroForm />} />
    <Route path="/consejeros" element={<ListaConsejeros />} />
    <Route path="*" element={<ListaConsejeros />} />
  </Routes></Shell>;
}

export default function App() {
  return <AuthProvider><BrowserRouter><Panel /></BrowserRouter></AuthProvider>;
}
