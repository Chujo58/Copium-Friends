import React, { useEffect, useState } from "react";
import { Cloud, Moon, Sun } from "lucide-react";

// The "Lane" System: Each cloud has a unique vertical lane to prevent stacking.
const CLOUDS = [
  { top: "5%", scale: 1.8, opacity: "opacity-40", duration: "53s", delay: "-10s", z: "z-30" },
  { top: "12%", scale: 1.1, opacity: "opacity-20", duration: "71s", delay: "-40s", z: "z-10" },
  { top: "18%", scale: 1.4, opacity: "opacity-30", duration: "67s", delay: "-20s", z: "z-20" },
  { top: "26%", scale: 0.9, opacity: "opacity-15", duration: "89s", delay: "-60s", z: "z-10" },
  { top: "33%", scale: 1.5, opacity: "opacity-35", duration: "47s", delay: "-5s", z: "z-30" },
  { top: "42%", scale: 1.2, opacity: "opacity-25", duration: "101s", delay: "-80s", z: "z-10" },
  { top: "8%", scale: 1.0, opacity: "opacity-20", duration: "79s", delay: "-15s", z: "z-10" },
  { top: "22%", scale: 1.7, opacity: "opacity-30", duration: "61s", delay: "-30s", z: "z-20" },
];

const STARS = [...Array(40)].map((_, i) => ({
  top: `${Math.random() * 60}%`,
  left: `${Math.random() * 100}%`,
  size: Math.random() * 2 + 1,
  delay: `${Math.random() * 5}s`,
}));

export default function Landing() {
  const [isDay, setIsDay] = useState(true);
  const [manualMode, setManualMode] = useState(false);

  // Sync with real time initially
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

  const toggleMode = () => {
    setManualMode(true);
    setIsDay(!isDay);
  };

  return (
    <div className={`relative flex flex-col items-center justify-center min-h-screen gap-4 overflow-hidden transition-all duration-[2000ms] ${
      isDay 
        ? "bg-gradient-to-t from-[#88A7BE] via-[#A6C0D2] to-[#C8D8E3]" 
        : "bg-gradient-to-t from-[#0F172A] via-[#1E293B] to-[#334155]"
    }`}>
      
      {/* Night Sky: Stars */}
      {!isDay && (
        <div className="absolute inset-0 z-0">
          {STARS.map((star, i) => (
            <div
              key={i}
              className="absolute bg-white rounded-full animate-pulse"
              style={{
                top: star.top,
                left: star.left,
                width: star.size,
                height: star.size,
                animationDelay: star.delay,
                opacity: 0.3
              }}
            />
          ))}
        </div>
      )}

      {/* Sun or Moon - Clickable Toggle */}
      <button 
        onClick={toggleMode}
        aria-label="Toggle light/dark mode"
        className={`absolute top-12 right-12 w-24 h-24 rounded-full transition-all duration-[2000ms] flex items-center justify-center z-20 cursor-pointer outline-none group ${
        isDay 
          ? "bg-yellow-100 shadow-[0_0_80px_rgba(253,224,71,0.4)] hover:shadow-[0_0_100px_rgba(253,224,71,0.6)]" 
          : "bg-slate-100 shadow-[0_0_50px_rgba(255,255,255,0.2)] hover:shadow-[0_0_70px_rgba(255,255,255,0.4)]"
      }`}>
        <div className="transition-transform duration-700 group-hover:rotate-12 group-active:scale-90">
          {isDay ? (
            <Sun className="text-yellow-400/60 w-12 h-12" />
          ) : (
            <Moon className="text-slate-400/60 fill-slate-400/10 w-10 h-10" />
          )}
        </div>
      </button>

      {/* Cloud Layers - Always White */}
      <div className="absolute inset-0 pointer-events-none">
        {CLOUDS.map((cloud, i) => (
          <div
            key={i}
            className={`absolute ${cloud.opacity} ${cloud.z} animate-drift blur-[0.5px]`}
            style={{
              top: cloud.top,
              animationDuration: cloud.duration,
              animationDelay: cloud.delay,
            }}
          >
            <div style={{ transform: `scale(${cloud.scale})` }} className="relative">
              {/* Force text-white to keep clouds bright at night */}
              <Cloud className="w-32 h-32 fill-white text-white" />
              <Cloud className="w-20 h-20 fill-white text-white absolute -top-6 -left-8 opacity-70" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="z-50 w-fit p-12 bg-surface/40 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border-4 border-primary/40 flex flex-col items-center gap-8 text-center mx-4 max-w-2xl transition-all duration-1000">
        <h1 className={`text-6xl font-black tracking-tight leading-tight transition-colors duration-1000 ${
          isDay ? "text-slate-900" : "text-white"
        }`}>
          Study alone, <br />
          <span className={isDay ? "text-primary drop-shadow-sm" : "text-surface drop-shadow-lg"}>
            feel together.
          </span>
        </h1>
        
        <p className={`text-xl font-medium max-w-sm transition-colors duration-1000 ${
          isDay ? "text-slate-800" : "text-slate-300"
        }`}>
          A co-study sanctuary that turns collective presence into deep motivation.
        </p>

        <button className={`mt-2 px-10 py-4 text-lg font-bold rounded-full shadow-lg transition-all hover:scale-105 active:scale-95 ${
          isDay 
            ? "bg-primary text-white hover:bg-accent shadow-primary/30" 
            : "bg-surface text-white hover:bg-accent shadow-surface/40"
        }`}>
            <p className={isDay ? "text-white" : "text-black"}>Join the Room</p>
        </button>
      </div>

      <style jsx global>{`
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