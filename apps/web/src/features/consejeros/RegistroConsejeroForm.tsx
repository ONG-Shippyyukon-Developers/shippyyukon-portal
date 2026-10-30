import { useState } from "react";
import {
  ConsejeroInput,
  RolConsejero,
  SubEstadoSuplencia,
  ViaIngreso,
} from "@shippiyyukon/shared";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ProgressSteps } from "../../components/ui/ProgressSteps";
import { apiRequest } from "../../lib/apiClient";

const STEPS = [
  { label: "Datos" },
  { label: "Rol" },
  { label: "Nombramiento" },
  { label: "Confirmar" },
];

const ROL_LABELS: Record<RolConsejero, string> = {
  [RolConsejero.COORDINADOR_NACIONAL]: "Coordinador Nacional",
  [RolConsejero.COORDINADOR_ESTADAL]: "Coordinador Estadal",
  [RolConsejero.COORDINADOR_MUNICIPAL]: "Coordinador Municipal",
  [RolConsejero.CONSEJERO_PRINCIPAL]: "Miembro de la Red (Consejero Principal)",
  [RolConsejero.CONSEJERO_SUPLENTE]: "Miembro de la Red (Consejero Suplente)",
};

const SUB_ESTADO_LABELS: Record<SubEstadoSuplencia, string> = {
  [SubEstadoSuplencia.PERMANENTE_FIJO]: "Suplente Permanente / Fijo",
  [SubEstadoSuplencia.SUPLENCIA_TEMPORAL]: "En funciones de suplencia temporal",
  [SubEstadoSuplencia.LISTADO_SUPLENTE]: "En listado de Suplente",
};

type FormState = Partial<ConsejeroInput>;

export function RegistroConsejeroForm() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({});
  const [submitting, setSubmitting] = useState(false);
  const [resultado, setResultado] = useState<"ok" | "error" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const esSuplente = form.rol === RolConsejero.CONSEJERO_SUPLENTE;

  function puedeAvanzar(): boolean {
    switch (step) {
      case 0:
        return Boolean(
          form.nombres && form.apellidos && form.genero && form.cedulaUltimos2?.length === 2
        );
      case 1:
        return Boolean(form.rol && (!esSuplente || form.subEstadoSuplencia));
      case 2:
        return Boolean(
          form.numeroResolucion && form.fechaIngreso && form.viaIngreso && form.estado && form.municipio
        );
      default:
        return true;
    }
  }

  async function enviar() {
    setSubmitting(true);
    setErrorMsg("");
    try {
      await apiRequest("/consejeros", { method: "POST", body: form });
      setResultado("ok");
    } catch (err) {
      setResultado("error");
      setErrorMsg((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (resultado === "ok") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <p className="text-3xl">🎉</p>
        <h2 className="mt-2 text-lg font-semibold text-emerald-800">
          ¡Registro enviado!
        </h2>
        <p className="mt-1 text-sm text-emerald-700">
          Quedó en estado <strong>Pendiente</strong>. Tu Coordinador o Shippiyyukon lo
          revisará y, al aprobarlo, se generará tu código único de consejero (HU-A5/A6).
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="mb-1 text-lg font-semibold text-slate-900">
        Registro de Consejero — Red Alianza y Fraternidad
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        4 pasos rápidos. Puedes retroceder en cualquier momento sin perder lo escrito.
      </p>

      <ProgressSteps steps={STEPS} current={step} />

      {step === 0 && (
        <div className="space-y-4">
          <Input
            label="Nombres"
            value={form.nombres ?? ""}
            onChange={(e) => update("nombres", e.target.value)}
          />
          <Input
            label="Apellidos"
            value={form.apellidos ?? ""}
            onChange={(e) => update("apellidos", e.target.value)}
          />
          <Select
            label="Género"
            value={form.genero ?? ""}
            onChange={(e) => update("genero", e.target.value as "M" | "F")}
          >
            <option value="">Selecciona…</option>
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
          </Select>
          <Input
            label="Últimos 2 dígitos de cédula (uso interno — nunca se publica)"
            maxLength={2}
            value={form.cedulaUltimos2 ?? ""}
            onChange={(e) => update("cedulaUltimos2", e.target.value.replace(/\D/g, ""))}
          />
          <Input
            label="Teléfono (opcional)"
            value={form.telefono ?? ""}
            onChange={(e) => update("telefono", e.target.value)}
          />
          <Input
            label="Correo (opcional)"
            type="email"
            value={form.correo ?? ""}
            onChange={(e) => update("correo", e.target.value)}
          />
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <Select
            label="Rol en la Red"
            value={form.rol ?? ""}
            onChange={(e) => update("rol", e.target.value as RolConsejero)}
          >
            <option value="">Selecciona…</option>
            {Object.entries(ROL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

          {esSuplente && (
            <Select
              label="Condición de suplencia"
              value={form.subEstadoSuplencia ?? ""}
              onChange={(e) => update("subEstadoSuplencia", e.target.value as SubEstadoSuplencia)}
            >
              <option value="">Selecciona…</option>
              {Object.entries(SUB_ESTADO_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Input
            label="Número de resolución de nombramiento"
            value={form.numeroResolucion ?? ""}
            onChange={(e) => update("numeroResolucion", e.target.value)}
          />
          <Input
            label="Fecha de ingreso"
            type="date"
            value={form.fechaIngreso ?? ""}
            onChange={(e) => update("fechaIngreso", e.target.value)}
          />
          <Select
            label="Vía de ingreso"
            value={form.viaIngreso ?? ""}
            onChange={(e) => update("viaIngreso", e.target.value as ViaIngreso)}
          >
            <option value="">Selecciona…</option>
            <option value={ViaIngreso.CONCURSO_OPOSICION}>Concurso de oposición</option>
            <option value={ViaIngreso.DESIGNACION_DIRECTA}>Designación directa (alcalde)</option>
          </Select>
          <Input
            label="Estado"
            value={form.estado ?? ""}
            onChange={(e) => update("estado", e.target.value)}
          />
          <Input
            label="Municipio"
            value={form.municipio ?? ""}
            onChange={(e) => update("municipio", e.target.value)}
          />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3 text-sm">
          <p className="text-slate-600">Revisa antes de enviar:</p>
          <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {[
              ["Nombre", `${form.nombres ?? ""} ${form.apellidos ?? ""}`],
              ["Rol", form.rol ? ROL_LABELS[form.rol] : "—"],
              ["Municipio", `${form.municipio ?? "—"}, ${form.estado ?? "—"}`],
              ["Vía de ingreso", form.viaIngreso ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between px-3 py-2">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-medium text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
          {resultado === "error" && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{errorMsg}</p>
          )}
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <Button
          variant="secondary"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Atrás
        </Button>
        {step < STEPS.length - 1 ? (
          <Button disabled={!puedeAvanzar()} onClick={() => setStep((s) => s + 1)}>
            Continuar
          </Button>
        ) : (
          <Button disabled={submitting} onClick={enviar}>
            {submitting ? "Enviando…" : "Enviar registro"}
          </Button>
        )}
      </div>
    </div>
  );
}
