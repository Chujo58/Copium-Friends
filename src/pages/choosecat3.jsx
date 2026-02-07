import { useMemo, useState } from "react";
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

  return (
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
          src={finalCat.gif}
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
  );
}
