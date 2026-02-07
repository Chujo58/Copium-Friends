export default function CatFlowShell({
  step,
  title,
  subtitle,
  children,
  chooseLabel = "Choose",
  onChoose,
  canChoose = true,
  showBack = false,
  onBack = null,
  isExiting = false,
  exitDirection = "right",
}) {
  const animationClass = isExiting
    ? exitDirection === "left"
      ? "cat-page-exit-left"
      : "cat-page-exit-right"
    : "cat-page-enter";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8">
      <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-white/25 blur-2xl" />
      <div className="absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-primary/25 blur-2xl" />

      <main
        className={`relative w-full max-w-4xl rounded-[2.5rem] border-4 border-primary/40 bg-surface/40 p-6 shadow-2xl backdrop-blur-xl md:p-8 ${animationClass}`}
      >
        {showBack && (
          <button
            onClick={onBack}
            className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-primary/50 bg-white/75 text-2xl font-bold text-slate-800 transition hover:bg-white"
            aria-label="Go back"
          >
            &larr;
          </button>
        )}

        <h1 className="font-card text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
          {title}
        </h1>
        <p className="mt-2 text-lg font-semibold text-slate-700">{subtitle}</p>

        <section className="mt-8">{children}</section>

        <div className="mt-10 flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            {[1, 2, 3].map((dot) => (
              <span
                key={dot}
                className={`rounded-full transition-all ${
                  dot === step ? "h-4 w-4 bg-primary" : "h-3 w-3 bg-primary/35"
                }`}
              />
            ))}
          </div>
          <button
            onClick={onChoose}
            disabled={!canChoose || isExiting}
            className={`h-14 w-full max-w-sm rounded-2xl border-4 border-primary/50 font-card text-2xl font-bold uppercase transition ${
              canChoose && !isExiting
                ? "bg-primary text-white hover:bg-accent"
                : "cursor-not-allowed bg-[#D9D9D9] text-[#767676]"
            }`}
          >
            {chooseLabel}
          </button>
        </div>
      </main>
    </div>
  );
}
