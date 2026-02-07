import React, { useEffect, useRef, useState } from "react";
import { Cloud, Moon, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";

const CLOUDS = [
  {
    top: "5%",
    scale: 1.8,
    opacity: "opacity-40",
    duration: "53s",
    delay: "-10s",
    z: "z-30",
  },
  {
    top: "12%",
    scale: 1.1,
    opacity: "opacity-20",
    duration: "71s",
    delay: "-40s",
    z: "z-10",
  },
  {
    top: "18%",
    scale: 1.4,
    opacity: "opacity-30",
    duration: "67s",
    delay: "-20s",
    z: "z-20",
  },
  {
    top: "26%",
    scale: 0.9,
    opacity: "opacity-15",
    duration: "89s",
    delay: "-60s",
    z: "z-10",
  },
  {
    top: "33%",
    scale: 1.5,
    opacity: "opacity-35",
    duration: "47s",
    delay: "-5s",
    z: "z-30",
  },
  {
    top: "42%",
    scale: 1.2,
    opacity: "opacity-25",
    duration: "101s",
    delay: "-80s",
    z: "z-10",
  },
  {
    top: "8%",
    scale: 1.0,
    opacity: "opacity-20",
    duration: "79s",
    delay: "-15s",
    z: "z-10",
  },
  {
    top: "22%",
    scale: 1.7,
    opacity: "opacity-30",
    duration: "61s",
    delay: "-30s",
    z: "z-20",
  },
];

const STARS = [...Array(40)].map(() => ({
  top: `${Math.random() * 60}%`,
  left: `${Math.random() * 100}%`,
  size: Math.random() * 2 + 1,
  delay: `${Math.random() * 5}s`,
}));

export default function Landing() {
  const navigate = useNavigate();
  const [isDay, setIsDay] = useState(true);
  const [manualMode, setManualMode] = useState(false);
  const [started, setStarted] = useState(false);
  const [username, setUsername] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!manualMode) {
      const checkTime = () => {
        const hour = new Date().getHours();
        setIsDay(hour >= 6 && hour < 18);
      };
      checkTime();
      const timer = setInterval(checkTime, 60000);
      return () => clearInterval(timer);
    }
  }, [manualMode]);

  useEffect(() => {
    if (started) {
      inputRef.current?.focus();
    }
  }, [started]);

  const toggleMode = () => {
    setManualMode(true);
    setIsDay(!isDay);
  };

  const goToDashboard = () => {
    if (!username.trim()) return;
    navigate("/dashboard", { state: { username: username.trim() }, viewTransition: true });
  };

  return (
    <div
      className={`relative flex min-h-screen flex-col items-center justify-center gap-4 overflow-hidden transition-all duration-[2000ms] ${
        isDay
          ? "bg-gradient-to-t from-[#88A7BE] via-[#A6C0D2] to-[#C8D8E3]"
          : "bg-gradient-to-t from-[#0F172A] via-[#1E293B] to-[#334155]"
      }`}
    >
      {!isDay && (
        <div className="absolute inset-0 z-0">
          {STARS.map((star, i) => (
            <div
              key={i}
              className="absolute animate-pulse rounded-full bg-white"
              style={{
                top: star.top,
                left: star.left,
                width: star.size,
                height: star.size,
                animationDelay: star.delay,
                opacity: 0.3,
              }}
            />
          ))}
        </div>
      )}

      <button
        onClick={toggleMode}
        aria-label="Toggle light/dark mode"
        className={`group absolute right-12 top-12 z-20 flex h-24 w-24 cursor-pointer items-center justify-center rounded-full outline-none transition-all duration-[2000ms] ${
          isDay
            ? "bg-yellow-100 shadow-[0_0_80px_rgba(253,224,71,0.4)] hover:shadow-[0_0_100px_rgba(253,224,71,0.6)]"
            : "bg-slate-100 shadow-[0_0_50px_rgba(255,255,255,0.2)] hover:shadow-[0_0_70px_rgba(255,255,255,0.4)]"
        }`}
      >
        <div className="transition-transform duration-700 group-hover:rotate-12 group-active:scale-90">
          {isDay ? (
            <Sun className="h-12 w-12 text-yellow-400/60" />
          ) : (
            <Moon className="h-10 w-10 fill-slate-400/10 text-slate-400/60" />
          )}
        </div>
      </button>

      <div className="pointer-events-none absolute inset-0">
        {CLOUDS.map((cloud, i) => (
          <div
            key={i}
            className={`animate-drift absolute blur-[0.5px] ${cloud.opacity} ${cloud.z}`}
            style={{
              top: cloud.top,
              animationDuration: cloud.duration,
              animationDelay: cloud.delay,
            }}
          >
            <div style={{ transform: `scale(${cloud.scale})` }} className="relative">
              <Cloud className="h-32 w-32 fill-white text-white" />
              <Cloud className="absolute -left-8 -top-6 h-20 w-20 fill-white text-white opacity-70" />
            </div>
          </div>
        ))}
      </div>

      <div className="z-50 mx-4 flex w-fit max-w-2xl flex-col items-center gap-8 rounded-[2.5rem] border-4 border-primary/40 bg-surface/40 p-12 text-center shadow-2xl backdrop-blur-xl transition-all duration-1000">
        <h1
          className={`text-6xl font-black leading-tight tracking-tight transition-colors duration-1000 ${
            isDay ? "text-slate-900" : "text-white"
          }`}
        >
          Study alone, <br />
          <span
            className={isDay ? "text-primary drop-shadow-sm" : "text-surface drop-shadow-lg"}
          >
            feel together.
          </span>
        </h1>

        <p
          className={`max-w-sm text-xl font-medium transition-colors duration-1000 ${
            isDay ? "text-slate-800" : "text-slate-300"
          }`}
        >
          A co-study sanctuary that turns collective presence into deep motivation.
        </p>

        <div
          className={`mt-2 flex h-16 items-center rounded-full border-2 p-2 shadow-lg transition-all duration-500 ${
            started ? "w-full max-w-xl" : "w-25"
          } ${isDay ? "border-primary/50 bg-white/85" : "border-slate-100/40 bg-slate-900/40"}`}
        >
          {!started ? (
            <button
              onClick={() => setStarted(true)}
              className={`h-full w-full rounded-full px-10 py-2 text-lg font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-95 ${
                isDay
                  ? "bg-primary text-white shadow-primary/30 hover:bg-accent"
                  : "bg-surface text-slate-900 shadow-surface/40 hover:bg-accent"
              }`}
            >
              Start
            </button>
          ) : (
            <>
              <input
                ref={inputRef}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") goToDashboard();
                }}
                placeholder="Type your username"
                className={`h-full min-w-0 flex-1 rounded-full bg-transparent px-4 text-base font-semibold outline-none ${
                  isDay
                    ? "text-slate-900 placeholder:text-slate-500"
                    : "text-slate-100 placeholder:text-slate-400"
                }`}
              />
              <button
                onClick={goToDashboard}
                className={`ml-2 h-full rounded-full px-8 text-base font-bold transition ${
                  isDay
                    ? "bg-primary text-white hover:bg-accent"
                    : "bg-surface text-slate-900 hover:bg-accent"
                }`}
              >
                Go
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes drift {
          0% { transform: translateX(-30vw); }
          100% { transform: translateX(120vw); }
        }
        .animate-drift {
          animation: drift linear infinite;
          left: 0;
        }
      `}</style>
    </div>
  );
}
