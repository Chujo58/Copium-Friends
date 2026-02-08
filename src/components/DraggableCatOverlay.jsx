import { useEffect, useMemo, useRef, useState } from "react";
import { catOptions } from "../pages/catFlowOptions";
import PomodoroTimer from "./PomodoroTimer";

const CAT_SIZE = 110;
const LABEL_HEIGHT = 22;
const POMODORO_HEIGHT = 70;
const DEFAULT_MARGIN = 24;

function getOverlayHeight(showPomodoro, showUsername) {
  return CAT_SIZE + (showPomodoro ? POMODORO_HEIGHT : 0) + (showUsername ? LABEL_HEIGHT : 0);
}

function clampPosition(next, bounds, overlayHeight) {
  const maxX = Math.max(0, bounds.width - CAT_SIZE);
  const maxY = Math.max(0, bounds.height - overlayHeight);
  return {
    x: Math.max(0, Math.min(next.x, maxX)),
    y: Math.max(0, Math.min(next.y, maxY)),
  };
}

function getDefaultPosition(bounds, overlayHeight) {
  if (!bounds) {
    return { x: 0, y: 0 };
  }
  return {
    x: Math.max(0, bounds.width - CAT_SIZE - DEFAULT_MARGIN),
    y: Math.max(0, bounds.height - overlayHeight - DEFAULT_MARGIN),
  };
}

export default function DraggableCatOverlay({
  selectedCatId,
  selectedAction,
  username,
  boundsRef = null,
  pomodoroStorageKey = "pomodoro:me",
  storageKey = "floatingCatOverlayPosition",
  draggable = true,
  fixedPosition = null,
  onPointerDown = null,
  pomodoroState = null,
  pomodoroReadOnly = false,
  onPomodoroStateChange = null,
  pomodoroEmitOnTick = true,
  showPomodoro = true,
  showUsername = true,
}) {
  const overlayHeight = getOverlayHeight(showPomodoro, showUsername);
  const [position, setPosition] = useState(() =>
    getDefaultPosition(
      typeof window === "undefined"
        ? null
        : { width: window.innerWidth, height: window.innerHeight },
      overlayHeight,
    ),
  );
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({
    dragging: false,
    offsetX: 0,
    offsetY: 0,
  });
  const isBounded = Boolean(boundsRef);

  function getBounds() {
    if (boundsRef?.current) {
      const rect = boundsRef.current.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    }
    if (typeof window === "undefined") {
      return { left: 0, top: 0, width: 0, height: 0 };
    }
    return {
      left: 0,
      top: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  const cat = useMemo(() => {
    if (selectedCatId) {
      const found = catOptions.find((item) => item.id === selectedCatId);
      if (found) return found;
    }
    return catOptions[0];
  }, [selectedCatId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (fixedPosition) return;
    const bounds = getBounds();
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (!stored) {
        setPosition(getDefaultPosition(bounds, overlayHeight));
        return;
      }
      const parsed = JSON.parse(stored);
      if (!Number.isFinite(parsed?.x) || !Number.isFinite(parsed?.y)) {
        setPosition(getDefaultPosition(bounds, overlayHeight));
        return;
      }
      setPosition(clampPosition({ x: parsed.x, y: parsed.y }, bounds, overlayHeight));
    } catch (_error) {
      setPosition(getDefaultPosition(bounds, overlayHeight));
    }
  }, [fixedPosition, overlayHeight, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (fixedPosition) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(position));
    } catch (_error) {
      // Ignore storage errors.
    }
  }, [fixedPosition, position, storageKey]);

  useEffect(() => {
    if (fixedPosition) return;
    function onResize() {
      const bounds = getBounds();
      setPosition((prev) => clampPosition(prev, bounds, overlayHeight));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fixedPosition, overlayHeight]);

  useEffect(() => {
    function handlePointerMove(event) {
      if (!dragRef.current.dragging) return;
      const bounds = getBounds();
      const next = {
        x: event.clientX - bounds.left - dragRef.current.offsetX,
        y: event.clientY - bounds.top - dragRef.current.offsetY,
      };
      setPosition(clampPosition(next, bounds, overlayHeight));
    }

    function stopDrag() {
      if (!dragRef.current.dragging) return;
      dragRef.current.dragging = false;
      setIsDragging(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
    };
  }, [overlayHeight]);

  function startDrag(event) {
    if (!draggable) return;
    event.preventDefault();
    const bounds = getBounds();
    dragRef.current.dragging = true;
    dragRef.current.offsetX = event.clientX - bounds.left - position.x;
    dragRef.current.offsetY = event.clientY - bounds.top - position.y;
    setIsDragging(true);
  }

  function handlePointerDown(event) {
    if (onPointerDown) {
      onPointerDown(event);
    }
    if (draggable) {
      startDrag(event);
    }
  }

  // Pick the correct image for the action, fallback to gif
  const actionImage = selectedAction && cat[`${selectedAction}Image`];
  const grabImage = cat.grabImage;
  const displayImage = isDragging && grabImage ? grabImage : (actionImage || cat.gif);
  const resolvedPosition = fixedPosition
    ? clampPosition(fixedPosition, getBounds(), overlayHeight)
    : position;

  return (
    <div
      className={`pointer-events-none ${isBounded ? "absolute z-[40]" : "fixed z-[80]"}`}
      style={{
        left: `${resolvedPosition.x}px`,
        top: `${resolvedPosition.y}px`,
        width: `${CAT_SIZE}px`,
        height: `${overlayHeight}px`,
      }}
    >
      <img
        src={displayImage}
        alt={`${cat.name} overlay`}
        onPointerDown={draggable || onPointerDown ? handlePointerDown : undefined}
        className={`pointer-events-auto select-none bg-transparent object-contain ${
          draggable || onPointerDown
            ? isDragging
              ? "cursor-grabbing"
              : "cursor-grab"
            : "cursor-default"
        }`}
        style={{
          width: `${CAT_SIZE}px`,
          height: `${CAT_SIZE}px`,
          touchAction: "none",
        }}
        draggable={false}
      />
      {showPomodoro && (
        <div
          className="pointer-events-auto mx-auto mt-1 flex flex-col items-center gap-1"
          style={{ width: `${CAT_SIZE}px` }}
        >
          <PomodoroTimer
            storageKey={pomodoroStorageKey}
            externalState={pomodoroState}
            readOnly={pomodoroReadOnly}
            onStateChange={onPomodoroStateChange}
            emitOnTick={pomodoroEmitOnTick}
          />
        </div>
      )}
      {showUsername && (
        <p className="mx-auto mt-0.5 w-fit rounded-full bg-white/80 px-2 py-0.5 text-center text-xs font-black text-slate-900">
          {username || "You"}
        </p>
      )}
    </div>
  );
}
