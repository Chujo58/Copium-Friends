import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();
  const [started, setStarted] = useState(false);
  const [username, setUsername] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (started) {
      inputRef.current?.focus();
    }
  }, [started]);

  function goToDashboard() {
    if (!username.trim()) return;
    navigate("/dashboard", { state: { username: username.trim() } });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-[#88A7BE] via-[#A6C0D2] to-[#C8D8E3] px-4">
      <div className="absolute -top-20 -left-24 h-72 w-72 rounded-full bg-[#EAA695]/40 blur-2xl" />
      <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-[#AFCD7A]/30 blur-2xl" />

      <div className="z-10 w-full max-w-3xl rounded-[36px] border-4 border-rose-plum/70 bg-[#F8F0E3]/90 p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.2)] backdrop-blur-sm">
        <h1 className="font-card text-4xl font-bold uppercase tracking-wide text-rose-plum md:text-5xl">
          Study Alone, Feel Together
        </h1>
        <p className="mt-4 text-xl text-rose-copper md:text-2xl">
          Co-study place that turns presence into motivation.
        </p>

        <div className="mt-10 flex justify-center">
          <div
            className={`flex h-16 items-center rounded-full border-4 border-rose-plum/80 bg-white/90 p-2 shadow-lg transition-all duration-500 ${
              started ? "w-full max-w-xl" : "w-48"
            }`}
          >
            {!started ? (
              <button
                onClick={() => setStarted(true)}
                className="h-full w-full rounded-full bg-[#E78270] font-card text-2xl font-bold uppercase text-white transition hover:bg-[#D96C59]"
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
                  className="h-full min-w-0 flex-1 rounded-full px-5 text-lg font-medium text-rose-plum outline-none placeholder:text-rose-dusty/80"
                />
                <button
                  onClick={goToDashboard}
                  className="ml-2 h-full rounded-full bg-[#A8CC73] px-8 font-card text-xl font-bold uppercase text-rose-plum transition hover:bg-[#97BC64]"
                >
                  Go
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
