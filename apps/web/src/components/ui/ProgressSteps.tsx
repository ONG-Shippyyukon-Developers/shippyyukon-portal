interface Step {
  label: string;
}

/**
 * Registro "gamificado" (PRD §4, confirmado 24/10/2026): un wizard por pasos
 * con barra de progreso y refuerzo visual de avance, en vez de un formulario
 * largo de una sola pantalla — reduce el abandono del registro en terreno.
 */
export function ProgressSteps({ steps, current }: { steps: Step[]; current: number }) {
  const percent = Math.round((current / (steps.length - 1)) * 100);

  return (
    <div className="mb-8">
      <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-brand-600 transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <ol className="flex justify-between text-xs">
        {steps.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={step.label} className="flex flex-col items-center gap-1">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 font-semibold transition ${
                  done
                    ? "border-brand-600 bg-brand-600 text-white"
                    : active
                    ? "border-brand-600 text-brand-600"
                    : "border-slate-300 text-slate-400"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={active ? "font-medium text-brand-700" : "text-slate-500"}>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
