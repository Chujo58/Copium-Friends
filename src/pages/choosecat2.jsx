import { useMemo, useState } from "react";
import { useTheme } from "../theme-context.jsx";
import { Sun, Moon } from "lucide-react";
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
