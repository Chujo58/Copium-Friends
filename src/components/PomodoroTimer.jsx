import { useEffect, useMemo, useState } from "react";
import { Pause, Play, Trash2 } from "lucide-react";

const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

function advanceTimer(currentPhase, currentSecondsLeft, elapsedSeconds) {
  let phase = currentPhase;
  let secondsLeft = currentSecondsLeft;
  let remainingElapsed = elapsedSeconds;

  while (remainingElapsed > 0) {
    if (remainingElapsed < secondsLeft) {
      secondsLeft -= remainingElapsed;
      remainingElapsed = 0;
      break;
    }
    remainingElapsed -= secondsLeft;
    phase = phase === "focus" ? "break" : "focus";
    secondsLeft = phase === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;
  }

  return { phase, secondsLeft };
}

function deriveStateFromExternal(externalState, now = Date.now()) {
  if (!externalState) return null;
  const parsedPhase = externalState.phase === "break" ? "break" : "focus";
  const parsedSeconds = Number.isFinite(externalState.secondsLeft)
    ? Math.max(1, Math.floor(externalState.secondsLeft))
    : FOCUS_SECONDS;
  const parsedRunning = Boolean(externalState.isRunning);
  const parsedUpdatedAt = Number.isFinite(externalState.updatedAt)
    ? externalState.updatedAt
    : now;

  if (!parsedRunning) {
    return {
      phase: parsedPhase,
      isRunning: false,
      secondsLeft: parsedSeconds,
    };
  }

  const elapsedSeconds = Math.max(0, Math.floor((now - parsedUpdatedAt) / 1000));
  const next = advanceTimer(parsedPhase, parsedSeconds, elapsedSeconds);
  return { phase: next.phase, isRunning: true, secondsLeft: next.secondsLeft };
}

export default function PomodoroTimer({
  className = "",
  storageKey = "",
  readOnly = false,
  externalState = null,
  onStateChange = null,
  emitOnTick = true,
}) {
  const shouldPersist = Boolean(storageKey);
  const derivedExternal = useMemo(
    () => deriveStateFromExternal(externalState),
    [externalState],
  );
  const initialState = useMemo(() => {
    if (derivedExternal) {
      return derivedExternal;
    }
    if (typeof window === "undefined" || !shouldPersist) {
      return { phase: "focus", isRunning: false, secondsLeft: FOCUS_SECONDS };
    }
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) {
        return { phase: "focus", isRunning: false, secondsLeft: FOCUS_SECONDS };
      }
      const parsed = JSON.parse(stored);
      const parsedPhase = parsed?.phase === "break" ? "break" : "focus";
      const parsedSeconds = Number.isFinite(parsed?.secondsLeft)
        ? Math.max(1, Math.floor(parsed.secondsLeft))
        : FOCUS_SECONDS;
      const parsedRunning = Boolean(parsed?.isRunning);
      const parsedUpdatedAt = Number.isFinite(parsed?.updatedAt)
        ? parsed.updatedAt
        : Date.now();

      if (!parsedRunning) {
        return {
          phase: parsedPhase,
          isRunning: false,
          secondsLeft: parsedSeconds,
        };
      }

      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - parsedUpdatedAt) / 1000));
      const next = advanceTimer(parsedPhase, parsedSeconds, elapsedSeconds);
      return { phase: next.phase, isRunning: true, secondsLeft: next.secondsLeft };
    } catch (_error) {
      return { phase: "focus", isRunning: false, secondsLeft: FOCUS_SECONDS };
    }
  }, [derivedExternal, shouldPersist, storageKey]);

  const [phase, setPhase] = useState(initialState.phase);
  const [isRunning, setIsRunning] = useState(initialState.isRunning);
  const [secondsLeft, setSecondsLeft] = useState(initialState.secondsLeft);

  useEffect(() => {
    if (!derivedExternal) return;
    setPhase(derivedExternal.phase);
    setIsRunning(derivedExternal.isRunning);
    setSecondsLeft(derivedExternal.secondsLeft);
  }, [derivedExternal]);

  useEffect(() => {
    if (!readOnly || !externalState) return;
    if (!externalState.isRunning) return;
    const interval = window.setInterval(() => {
      const next = deriveStateFromExternal(externalState, Date.now());
      if (!next) return;
      setPhase(next.phase);
      setIsRunning(next.isRunning);
      setSecondsLeft(next.secondsLeft);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [externalState, readOnly]);

  useEffect(() => {
    if (!isRunning || readOnly) return;
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          const nextPhase = phase === "focus" ? "break" : "focus";
          setPhase(nextPhase);
          return nextPhase === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isRunning, phase, readOnly]);

  function formatTimer(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function emitState(next) {
    if (!onStateChange || readOnly) return;
    onStateChange({
      phase: next.phase,
      isRunning: next.isRunning,
      secondsLeft: next.secondsLeft,
      updatedAt: Date.now(),
    });
  }

  function handleToggleTimer() {
    setIsRunning((prev) => {
      const nextRunning = !prev;
      if (!emitOnTick) {
        emitState({ phase, isRunning: nextRunning, secondsLeft });
      }
      return nextRunning;
    });
  }

  function handleResetTimer() {
    setIsRunning(false);
    setPhase("focus");
    setSecondsLeft(FOCUS_SECONDS);
    if (!emitOnTick) {
      emitState({
        phase: "focus",
        isRunning: false,
        secondsLeft: FOCUS_SECONDS,
      });
    }
  }

  useEffect(() => {
    if (typeof window === "undefined" || !shouldPersist) return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          phase,
          isRunning,
          secondsLeft,
          updatedAt: Date.now(),
        }),
      );
    } catch (_error) {
      // Ignore storage errors.
    }
  }, [phase, isRunning, secondsLeft, shouldPersist, storageKey]);

  useEffect(() => {
    if (!onStateChange || readOnly || !emitOnTick) return;
    onStateChange({
      phase,
      isRunning,
      secondsLeft,
      updatedAt: Date.now(),
    });
  }, [emitOnTick, onStateChange, phase, isRunning, readOnly, secondsLeft]);

  const timerButtonClass = isRunning
    ? phase === "break"
      ? "bg-emerald-500 text-white"
      : "bg-rose-500 text-white"
    : "bg-slate-400 text-white";

  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-xl px-2 py-1 ${
        timerButtonClass
      } ${className}`}
    >
      <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-slate-800 tabular-nums">
        {formatTimer(secondsLeft)}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={handleToggleTimer}
          disabled={readOnly}
          className={`flex h-6 w-6 items-center justify-center rounded-full bg-white/20 transition hover:bg-white/30 ${
            readOnly ? "cursor-not-allowed opacity-70" : ""
          }`}
          aria-label={isRunning ? "Pause pomodoro" : "Start pomodoro"}
        >
          {isRunning ? <Pause size={12} /> : <Play size={12} />}
        </button>
        <button
          onClick={handleResetTimer}
          disabled={readOnly}
          className={`flex h-6 w-6 items-center justify-center rounded-full bg-white/20 transition hover:bg-white/30 ${
            readOnly ? "cursor-not-allowed opacity-70" : ""
          }`}
          aria-label="Reset pomodoro"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
