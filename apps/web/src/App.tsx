import { BrowserRouter, Routes, Route, Link, NavLink } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { RegistroConsejeroForm } from "./features/consejeros/RegistroConsejeroForm";
import { ListaConsejeros } from "./features/consejeros/ListaConsejeros";

function Shell({ children }: { children: React.ReactNode }) {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium ${
      isActive ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-semibold text-slate-900">
            redpanel · Red Alianza y Fraternidad
          </Link>
          <nav className="flex gap-2">
            <NavLink to="/registro" className={linkClass}>
              Registrar consejero
            </NavLink>
            <NavLink to="/consejeros" className={linkClass}>
              Consejeros
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Shell>
          <Routes>
            <Route path="/" element={<ListaConsejeros />} />
            <Route path="/registro" element={<RegistroConsejeroForm />} />
            <Route path="/consejeros" element={<ListaConsejeros />} />
          </Routes>
        </Shell>
      </BrowserRouter>
    </AuthProvider>
  );
}
