import { useState } from "react";
import { useTheme } from "../theme-context.jsx";
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

  const { isDay } = useTheme();
  return (
    <div className={isDay ? "bg-gradient-to-t from-[#88A7BE] via-[#A6C0D2] to-[#C8D8E3] min-h-screen" : "bg-gradient-to-t from-[#0F172A] via-[#1E293B] to-[#334155] min-h-screen"}>
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
