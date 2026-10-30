/**
 * Landing institucional — shippiyyukon.com (DAT §1, "Topología de sitios").
 * Texto base tomado de PROPUESTAS_PARA_LA_PAGINA_SHIPPIYYUKON (sección
 * "Presentación para Donantes"), ajustado el 24/10/2026: CAIRUS y Ángeles
 * Sin Fronteras quedaron fuera de alcance, así que el texto ya no las
 * presenta como consorcio — Shippiyyukon aparece como ejecutor único.
 */
export default function App() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <span className="text-lg font-bold text-slate-900">Shippiyyukon</span>
          <a
            href="https://red.shippiyyukon.com"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Red Alianza y Fraternidad →
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
          Fortalecimiento del Sistema de Protección: nuestra apuesta por la infancia
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-slate-600">
          En Shippiyyukon entendemos que la protección de la niñez requiere más que
          buenas intenciones: requiere un sistema público administrativo robusto,
          técnico y eficiente. Proveemos la infraestructura tecnológica, metodológica
          y doctrinaria que permite a los Consejeros y Consejeras de Protección,
          desplegados en todo el territorio nacional, ejercer su función con
          celeridad y rigor legal.
        </p>
      </section>

      <section className="border-t border-slate-100 bg-slate-50 py-16">
        <div className="mx-auto grid max-w-4xl gap-8 px-6 sm:grid-cols-3">
          {[
            { k: "Soporte técnico", v: "Plataforma digital para la Red Nacional de consejeros" },
            { k: "Rigor legal", v: "Procesos alineados a la LOPNNA" },
            { k: "Protección de datos", v: "Cifrado y minimización desde el diseño" },
          ].map((item) => (
            <div key={item.k} className="text-center">
              <p className="font-semibold text-slate-900">{item.k}</p>
              <p className="mt-1 text-sm text-slate-500">{item.v}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="px-6 py-8 text-center text-xs text-slate-400">
        ONG Los Shippiyyukon — J-40719782-7
      </footer>
    </div>
  );
}
