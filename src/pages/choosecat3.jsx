import { useMemo, useState } from "react";
import { useTheme } from "../theme-context.jsx";
import { Sun, Moon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import CatFlowShell from "../components/CatFlowShell";
import { actionOptions, catOptions } from "./catFlowOptions";

export default function ChooseCat3() {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedCat = location.state?.selectedCat || catOptions[0].id;
  const selectedAction = location.state?.selectedAction || actionOptions[0].id;
  const [isExiting, setIsExiting] = useState(false);
  const [exitDirection, setExitDirection] = useState("right");

  const finalCat = useMemo(() => {
    return catOptions.find((cat) => cat.id === selectedCat) || catOptions[0];
  }, [selectedCat]);

  const actionName = useMemo(() => {
    const found = actionOptions.find((action) => action.id === selectedAction);
    return found ? found.name : actionOptions[0].name;
  }, [selectedAction]);

  function goBack() {
    setExitDirection("right");
    setIsExiting(true);
    window.setTimeout(() => {
      navigate("/choosecat2", {
        state: {
          ...location.state,
          selectedCat,
          selectedAction,
        },
      });
    }, 280);
  }

  function goReady() {
    setExitDirection("left");
    setIsExiting(true);
    window.setTimeout(() => {
      navigate("/session", {
        state: {
          ...location.state,
          selectedCat,
          selectedAction,
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
      step={3}
      title="Choose Cat 3"
      subtitle="Your final cat is ready."
      chooseLabel="Ready"
      onChoose={goReady}
      showBack
      onBack={goBack}
      isExiting={isExiting}
      exitDirection={exitDirection}
    >
      <div className="mx-auto max-w-xl rounded-3xl border-4 border-primary/40 bg-white/70 p-5">
        <img
          src={catOptions.find(cat => cat.name === finalCat.name)?.[`${selectedAction}Image`] || finalCat.idleImage}
          alt={`Final cat ${finalCat.name}`}
          className="h-72 w-full rounded-2xl object-cover"
        />
        <p className="mt-4 text-center font-card text-4xl font-black tracking-tight text-slate-900">
          {finalCat.name}
        </p>
        <p className="mt-2 text-center text-lg font-semibold text-slate-700">
          Mode: {actionName}
        </p>
      </div>
      </CatFlowShell>
    </div>
  );
}
