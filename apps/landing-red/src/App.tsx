/**
 * Landing de la Red — red.shippiyyukon.com (DAT §1). Punto de entrada al
 * registro gamificado de consejeros (PRD §4): el CTA lleva a
 * redpanel.shippiyyukon.com/registro, donde vive el wizard real
 * (apps/web/src/features/consejeros/RegistroConsejeroForm.tsx).
 */
const PANEL_REGISTRO_URL =
  import.meta.env.VITE_PANEL_URL?.concat("/registro") ??
  "https://redpanel.shippiyyukon.com/registro";

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-brand-50 to-white text-slate-800">
      <header className="mx-auto w-full max-w-5xl px-6 py-6">
        <span className="text-lg font-bold text-slate-900">
          Red Nacional "Alianza y Fraternidad"
        </span>
      </header>

      <main className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
          Consejeros y Consejeras de Protección de Niños, Niñas y Adolescentes
        </h1>
        <p className="mt-5 text-lg text-slate-600">
          Si ejerces como Consejero o Coordinador en algún municipio de la Red,
          regístrate aquí. El proceso toma unos minutos y queda pendiente de
          aprobación por tu Coordinador.
        </p>
        <a
          href={PANEL_REGISTRO_URL}
          className="mt-8 rounded-xl bg-brand-600 px-8 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          Iniciar mi registro →
        </a>
        <p className="mt-4 text-xs text-slate-400">
          El registro no solicita datos de niños, niñas ni adolescentes — solo tus
          datos como consejero/a.
        </p>
      </main>

      <footer className="px-6 py-8 text-center text-xs text-slate-400">
        Un proyecto de infraestructura digital de Shippiyyukon
      </footer>
    </div>
  );
}
