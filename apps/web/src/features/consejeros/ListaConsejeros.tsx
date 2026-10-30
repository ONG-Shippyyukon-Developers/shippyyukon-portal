import { useEffect, useState } from "react";
import { Consejero } from "@shippiyyukon/shared";
import { apiRequest } from "../../lib/apiClient";

const ESTADO_BADGE: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800",
  APROBADO: "bg-emerald-100 text-emerald-800",
  RECHAZADO: "bg-red-100 text-red-800",
};

/**
 * HU-A7. El alcance (qué filas ve cada rol) NO se decide aquí: lo aplica
 * Row-Level Security en la base de datos (services/api/src/db/schema.sql),
 * a partir del rol y municipio del token autenticado.
 */
export function ListaConsejeros() {
  const [consejeros, setConsejeros] = useState<Consejero[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<Consejero[]>("/consejeros")
      .then(setConsejeros)
      .catch((err) => setError((err as Error).message));
  }, []);

  if (error) return <p className="text-sm text-red-600">Error: {error}</p>;
  if (!consejeros) return <p className="text-sm text-slate-500">Cargando…</p>;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2">Nombre</th>
            <th className="px-4 py-2">Rol</th>
            <th className="px-4 py-2">Municipio</th>
            <th className="px-4 py-2">Código</th>
            <th className="px-4 py-2">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {consejeros.map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-2 font-medium text-slate-900">
                {c.nombres} {c.apellidos}
              </td>
              <td className="px-4 py-2 text-slate-600">{c.rol}</td>
              <td className="px-4 py-2 text-slate-600">{c.municipio}</td>
              <td className="px-4 py-2 font-mono text-xs text-slate-500">
                {c.codigoUnico ?? "—"}
              </td>
              <td className="px-4 py-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    ESTADO_BADGE[c.estadoRegistro]
                  }`}
                >
                  {c.estadoRegistro}
                </span>
              </td>
            </tr>
          ))}
          {consejeros.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                Sin registros en tu alcance todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
