import { useState } from "react";
import { useTheme } from "../theme-context.jsx";
import { Sun, Moon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import CatFlowShell from "../components/CatFlowShell";
import { catOptions } from "./catFlowOptions";

export default function ChooseCat1() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedCat, setSelectedCat] = useState("");
  const [isExiting, setIsExiting] = useState(false);

  function goNext() {
    if (!selectedCat) return;
    setIsExiting(true);
    window.setTimeout(() => {
      navigate("/choosecat2", {
        state: {
          ...location.state,
          selectedCat,
        },
      });
    }, 280);
  }

  const { isDay, toggleMode } = useTheme();
  return (
    <div className={isDay ? "bg-gradient-to-t from-[#88A7BE] via-[#A6C0D2] to-[#C8D8E3] min-h-screen" : "bg-gradient-to-t from-[#0F172A] via-[#1E293B] to-[#334155] min-h-screen"}>
      <button
        onClick={toggleMode}
        aria-label="Toggle light/dark mode"
        className={`group fixed right-12 top-12 z-50 flex h-16 w-16 cursor-pointer items-center justify-center rounded-full outline-none transition-all duration-[2000ms] ${
          isDay
            ? "bg-yellow-100 shadow-[0_0_80px_rgba(253,224,71,0.4)] hover:shadow-[0_0_100px_rgba(253,224,71,0.6)]"
            : "bg-slate-100 shadow-[0_0_50px_rgba(255,255,255,0.2)] hover:shadow-[0_0_70px_rgba(255,255,255,0.4)]"
        }`}
      >
        <div className="transition-transform duration-700 group-hover:rotate-12 group-active:scale-90">
          {isDay ? (
            <Sun className="h-8 w-8 text-yellow-400/60" />
          ) : (
            <Moon className="h-7 w-7 fill-slate-400/10 text-slate-400/60" />
          )}
        </div>
      </button>
      <CatFlowShell
      step={1}
      title="Choose Your Cat"
      subtitle="Choose your character"
      chooseLabel="Choose"
      onChoose={goNext}
      canChoose={Boolean(selectedCat)}
      isExiting={isExiting}
      exitDirection="left"
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {catOptions.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCat(cat.id)}
            className={`rounded-2xl border-4 p-6 text-left transition md:min-h-[390px] ${
              selectedCat === cat.id
                ? "border-primary/60 bg-white/85 shadow-lg"
                : "border-primary/30 bg-surface/35 hover:border-primary/60"
            }`}
          >
            <div className="mb-4 flex h-52 items-center justify-center overflow-hidden rounded-xl border border-primary/25 bg-white/70 md:h-64">
              <img
                src={cat.idleImage}
                alt={`${cat.name} idle`}
                className="h-full w-full object-contain"
                draggable={false}
              />
            </div>
            <p className="font-card text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
              {cat.name}
            </p>
          </button>
        ))}
      </div>
      </CatFlowShell>
    </div>
  );
}
