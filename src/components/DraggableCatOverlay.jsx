import { useEffect, useMemo, useRef, useState } from "react";
import { catOptions } from "../pages/catFlowOptions";

const CAT_SIZE = 110;
const LABEL_HEIGHT = 22;
const OVERLAY_HEIGHT = CAT_SIZE + LABEL_HEIGHT;
const DEFAULT_MARGIN = 24;

function clampPosition(next) {
  const maxX = Math.max(0, window.innerWidth - CAT_SIZE);
  const maxY = Math.max(0, window.innerHeight - OVERLAY_HEIGHT);
  return {
    x: Math.max(0, Math.min(next.x, maxX)),
    y: Math.max(0, Math.min(next.y, maxY)),
  };
}

function getDefaultPosition() {
  if (typeof window === "undefined") {
    return { x: 0, y: 0 };
  }
  return {
    x: Math.max(0, window.innerWidth - CAT_SIZE - DEFAULT_MARGIN),
    y: Math.max(0, window.innerHeight - OVERLAY_HEIGHT - DEFAULT_MARGIN),
  };
}

export default function DraggableCatOverlay({
  selectedCatId,
  username,
  storageKey = "floatingCatOverlayPosition",
}) {
  const [position, setPosition] = useState(() => getDefaultPosition());
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({
    dragging: false,
    offsetX: 0,
    offsetY: 0,
  });

  const cat = useMemo(() => {
    if (selectedCatId) {
      const found = catOptions.find((item) => item.id === selectedCatId);
      if (found) return found;
    }
    return catOptions[0];
  }, [selectedCatId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (!stored) {
        setPosition(getDefaultPosition());
        return;
      }
      const parsed = JSON.parse(stored);
      if (!Number.isFinite(parsed?.x) || !Number.isFinite(parsed?.y)) {
        setPosition(getDefaultPosition());
        return;
      }
      setPosition(clampPosition({ x: parsed.x, y: parsed.y }));
    } catch (_error) {
      setPosition(getDefaultPosition());
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(position));
    } catch (_error) {
      // Ignore storage errors.
    }
  }, [position, storageKey]);

  useEffect(() => {
    function onResize() {
      setPosition((prev) => clampPosition(prev));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    function handlePointerMove(event) {
      if (!dragRef.current.dragging) return;
      const next = {
        x: event.clientX - dragRef.current.offsetX,
        y: event.clientY - dragRef.current.offsetY,
      };
      setPosition(clampPosition(next));
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
  }, []);

  function startDrag(event) {
    event.preventDefault();
    dragRef.current.dragging = true;
    dragRef.current.offsetX = event.clientX - position.x;
    dragRef.current.offsetY = event.clientY - position.y;
    setIsDragging(true);
  }

  return (
    <div
      className="pointer-events-none fixed z-[80]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${CAT_SIZE}px`,
        height: `${OVERLAY_HEIGHT}px`,
      }}
    >
      <img
        src={cat.gif}
        alt={`${cat.name} overlay`}
        onPointerDown={startDrag}
        className={`pointer-events-auto select-none bg-transparent object-contain ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{
          width: `${CAT_SIZE}px`,
          height: `${CAT_SIZE}px`,
          touchAction: "none",
        }}
        draggable={false}
      />
      <p className="mx-auto mt-0.5 w-fit rounded-full bg-white/80 px-2 py-0.5 text-center text-xs font-black text-slate-900">
        {username || "You"}
      </p>
    </div>
  );
}
