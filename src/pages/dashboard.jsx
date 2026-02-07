import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const demoServers = [
  {
    name: "Personal Day, Focusing On Self",
    players: "1/16",
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [serverCode, setServerCode] = useState("");
  const [filterText, setFilterText] = useState("");
  const [serverType, setServerType] = useState("Public");
  const [playerCount, setPlayerCount] = useState("8");
  const username = location.state?.username || "Guest";

  const filteredServers = useMemo(() => {
    const value = filterText.trim().toLowerCase();
    if (!value) return demoServers;
    return demoServers.filter((server) =>
      server.name.toLowerCase().includes(value),
    );
  }, [filterText]);

  function handlePlayerCountChange(value) {
    if (value === "") {
      setPlayerCount("");
      return;
    }
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return;
    setPlayerCount(String(Math.min(12, Math.max(1, numeric))));
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#7BA3BC] via-[#88AFC7] to-[#B4CAD7] px-4 py-8 md:px-8">
      <div className="absolute -top-24 -left-20 h-80 w-80 rounded-full bg-[#E9A594]/30 blur-2xl" />
      <div className="absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-[#AFCB79]/30 blur-2xl" />

      <div className="relative mx-auto max-w-6xl rounded-[34px] border-4 border-rose-plum/70 bg-[#F8F0E3]/95 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)] md:p-8">
        <p className="mb-5 text-lg font-semibold text-rose-plum">
          Welcome, {username}
        </p>

        <section>
          <div className="inline-block rounded-t-[18px] border-4 border-b-0 border-rose-plum/70 bg-[#E78270] px-8 py-3 font-card text-3xl font-bold uppercase text-rose-plum">
            Create Server
          </div>
          <div className="rounded-r-[24px] rounded-bl-[24px] border-4 border-rose-plum/70 p-5">
            <div className="mb-4 flex gap-3">
              <input
                placeholder="Server Name"
                className="h-14 flex-1 rounded-2xl border-4 border-rose-plum/70 bg-white/80 px-4 text-xl font-semibold text-rose-plum placeholder:text-rose-dusty outline-none"
              />
              <button className="h-14 rounded-2xl border-4 border-rose-plum/70 bg-[#F0E7D8] px-8 font-card text-2xl font-bold uppercase text-rose-plum transition hover:bg-[#E9DEC9]">
                Create
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-7 gap-y-3 text-lg font-semibold text-rose-plum">
              <div className="flex items-center gap-3">
                <span>Type:</span>
                <div className="inline-flex rounded-xl border-2 border-rose-plum/70 bg-[#F0E7D8] p-1">
                  <button
                    onClick={() => setServerType("Public")}
                    className={`rounded-lg px-4 py-1 font-bold transition ${
                      serverType === "Public"
                        ? "bg-[#B3D27A] text-rose-plum"
                        : "text-rose-plum/70 hover:bg-[#E4D8C9]"
                    }`}
                  >
                    Public
                  </button>
                  <button
                    onClick={() => setServerType("Private")}
                    className={`rounded-lg px-4 py-1 font-bold transition ${
                      serverType === "Private"
                        ? "bg-[#E78270] text-white"
                        : "text-rose-plum/70 hover:bg-[#E4D8C9]"
                    }`}
                  >
                    Private
                  </button>
                </div>
              </div>

              <label className="inline-flex items-center gap-2">
                <span>Players:</span>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={playerCount}
                  onChange={(event) =>
                    handlePlayerCountChange(event.target.value)
                  }
                  placeholder="1-12"
                  className="h-10 w-24 rounded-xl border-2 border-rose-plum/70 bg-[#F0E7D8] px-3 text-center text-base font-bold text-rose-plum outline-none"
                />
              </label>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="inline-block rounded-t-[18px] border-4 border-b-0 border-rose-plum/70 bg-[#B3D27A] px-8 py-3 font-card text-3xl font-bold uppercase text-rose-plum">
            Join Server
          </div>
          <div className="rounded-r-[24px] rounded-bl-[24px] border-4 border-rose-plum/70 p-5">
            <div className="mb-4 flex gap-3">
              <input
                value={serverCode}
                onChange={(event) => setServerCode(event.target.value)}
                placeholder="Join Server by Code"
                className="h-14 flex-1 rounded-2xl border-4 border-rose-plum/70 bg-white/80 px-4 text-xl font-semibold text-rose-plum placeholder:text-rose-dusty outline-none"
              />
              <button className="h-14 rounded-2xl border-4 border-rose-plum/70 bg-[#B3D27A] px-10 font-card text-2xl font-bold uppercase text-rose-plum transition hover:bg-[#A2C16B]">
                Join
              </button>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-3 border-t-2 border-[#D7C6AF] pt-4">
              <input
                value={filterText}
                onChange={(event) => setFilterText(event.target.value)}
                placeholder="Filter server names"
                className="h-12 min-w-[220px] flex-1 rounded-xl border-2 border-rose-plum/70 bg-[#F0E7D8] px-4 text-lg text-rose-plum outline-none"
              />
              <button className="h-12 rounded-xl border-4 border-rose-plum/70 bg-[#B3D27A] px-8 font-card text-xl font-bold uppercase text-rose-plum transition hover:bg-[#A2C16B]">
                Filter
              </button>
            </div>

            <div className="max-h-[340px] space-y-3 overflow-auto pr-2">
              {filteredServers.map((server) => (
                <article
                  key={server.name}
                  className="flex items-center gap-3 rounded-2xl border-4 border-rose-plum/70 bg-[#FDF8EF] p-3"
                >
                  <div className="min-w-0 flex-1 py-1">
                    <p className="truncate text-xl font-semibold text-rose-plum">
                      {server.name}
                    </p>
                  </div>
                  <p className="w-20 text-center text-xl font-bold text-rose-plum">
                    {server.players}
                  </p>
                  <button className="h-12 rounded-xl border-4 border-rose-plum/70 bg-[#B3D27A] px-8 font-card text-xl font-bold uppercase text-rose-plum transition hover:bg-[#A2C16B]">
                    Join
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-7 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="h-14 w-44 rounded-2xl border-4 border-rose-plum/70 bg-[#E78270] font-card text-2xl font-bold uppercase text-white transition hover:bg-[#D96C59]"
          >
            Back
          </button>
          <button className="h-14 w-56 rounded-2xl border-4 border-rose-plum/70 bg-[#B3D27A] font-card text-2xl font-bold uppercase text-rose-plum transition hover:bg-[#A2C16B]">
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
