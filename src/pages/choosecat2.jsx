import { useMemo, useState } from "react";
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
    setExitDirection("right");
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
    setExitDirection("left");
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

  return (
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
      <div className="space-y-4">
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
  );
}
