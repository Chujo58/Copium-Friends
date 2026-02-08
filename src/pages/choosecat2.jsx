import { useMemo, useState } from "react";
import { useTheme } from "../theme-context.jsx";
import { useLocation, useNavigate } from "react-router-dom";
import CatFlowShell from "../components/CatFlowShell";
import { actionOptions, catOptions } from "./catFlowOptions";

export default function ChooseCat2() {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedCat = location.state?.selectedCat || catOptions[0].id;
  const [selectedAction, setSelectedAction] = useState("");
  const [isExiting, setIsExiting] = useState(false);
  const [exitDirection, setExitDirection] = useState("right");

  const catName = useMemo(() => {
    const found = catOptions.find((cat) => cat.id === selectedCat);
    return found ? found.name : "Your Cat";
  }, [selectedCat]);

  function goNext() {
    if (!selectedAction) return;
    setExitDirection("left");
    setIsExiting(true);
    window.setTimeout(() => {
      navigate("/choosecat3", {
        state: {
          ...location.state,
          selectedCat,
          selectedAction,
        },
      });
    }, 280);
  }

  function goBack() {
    setExitDirection("right");
    setIsExiting(true);
    window.setTimeout(() => {
      navigate("/choosecat1", {
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
      step={2}
      title="Choose Cat 2"
      subtitle={`Pick an action style for ${catName}.`}
      chooseLabel="Choose"
      onChoose={goNext}
      canChoose={Boolean(selectedAction)}
      showBack
      onBack={goBack}
      isExiting={isExiting}
      exitDirection={exitDirection}
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {actionOptions.map((action) => (
          <button
            key={action.id}
            onClick={() => setSelectedAction(action.id)}
            className={`w-full rounded-2xl border-4 p-5 text-left transition ${
              selectedAction === action.id
                ? "border-primary/60 bg-white/85 shadow-lg"
                : "border-primary/30 bg-surface/35 hover:border-primary/60"
            }`}
          >
            <div className="mb-4 flex h-52 items-center justify-center overflow-hidden rounded-xl border border-primary/25 bg-white/70">
              <img
                src={catOptions.find(cat => cat.name === catName)[`${action.id}Image`]}
                alt={`${action.name} icon`}
                className="h-full w-full object-contain"
                draggable={false}
              />
            </div>
            <p className="font-card text-3xl font-black tracking-tight text-slate-900">
              {action.name}
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-700">
              {action.detail}
            </p>
          </button>
        ))}
      </div>
      </CatFlowShell>
    </div>
  );
}
