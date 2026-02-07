import { useState } from "react";
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

  return (
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {catOptions.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCat(cat.id)}
            className={`rounded-2xl border-4 p-5 text-left transition ${
              selectedCat === cat.id
                ? "border-primary/60 bg-white/85 shadow-lg"
                : "border-primary/30 bg-surface/35 hover:border-primary/60"
            }`}
          >
            <div
              className="mb-3 h-24 rounded-xl"
              style={{
                background: `linear-gradient(135deg, ${cat.accent}, #f8f0e3)`,
              }}
            />
            <p className="font-card text-3xl font-black tracking-tight text-slate-900">
              {cat.name}
            </p>
          </button>
        ))}
      </div>
    </CatFlowShell>
  );
}
