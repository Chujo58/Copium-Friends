import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { actionOptions, catOptions } from "./catFlowOptions";

export default function Session() {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedCat = location.state?.selectedCat || catOptions[0].id;
  const selectedAction = location.state?.selectedAction || actionOptions[0].id;
  const [showNewTabForm, setShowNewTabForm] = useState(false);
  const [newTabName, setNewTabName] = useState("");
  const [newTabUrl, setNewTabUrl] = useState("");
  const [customTabs, setCustomTabs] = useState([]);

  const finalCat = useMemo(() => {
    return catOptions.find((cat) => cat.id === selectedCat) || catOptions[0];
  }, [selectedCat]);

  const actionName = useMemo(() => {
    const found = actionOptions.find((action) => action.id === selectedAction);
    return found ? found.name : actionOptions[0].name;
  }, [selectedAction]);

  const menuItems = [
    { id: "flashcards", label: "Flashcards", icon: "🗂️" },
    { id: "quizzes", label: "Quizzes", icon: "📝" },
    { id: "chatbot", label: "Chatbot", icon: "🤖" },
    { id: "friends", label: "Friends", icon: "👥" },
  ];

  function normalizeUrl(rawUrl) {
    const trimmed = rawUrl.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    return `https://${trimmed}`;
  }

  function addNewTab() {
    const name = newTabName.trim();
    const url = normalizeUrl(newTabUrl);
    if (!name || !url) return;

    try {
      new URL(url);
      setCustomTabs((prev) => [...prev, { id: Date.now(), name, url }]);
      setNewTabName("");
      setNewTabUrl("");
      setShowNewTabForm(false);
    } catch (error) {
      // Ignore invalid URLs and keep the form open for correction.
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-t from-[#88A7BE] via-[#A6C0D2] to-[#C8D8E3] px-4 py-8">
      <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-white/30 blur-2xl" />
      <div className="absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-primary/25 blur-2xl" />

      <div className="relative flex w-full max-w-7xl flex-col gap-5 lg:flex-row">
        <aside className="flex w-full flex-col rounded-[2.5rem] border-4 border-primary/40 bg-surface/40 p-5 shadow-2xl backdrop-blur-xl lg:w-72 lg:shrink-0">
          <h2 className="font-card text-3xl font-black tracking-tight text-slate-900">
            Menu
          </h2>

          <nav className="mt-5 space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                className="flex w-full items-center gap-3 rounded-xl border-2 border-primary/40 bg-white/80 px-3 py-2 text-left text-lg font-bold text-slate-800 transition hover:bg-white"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface text-lg">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto border-t-2 border-primary/25 pt-4">
            {customTabs.length > 0 && (
              <div className="mb-3 space-y-2">
                {customTabs.map((tab) => (
                  <a
                    key={tab.id}
                    href={tab.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate rounded-lg border-2 border-primary/35 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-white"
                    title={tab.url}
                  >
                    {tab.name}
                  </a>
                ))}
              </div>
            )}

            {showNewTabForm && (
              <div className="mb-3 space-y-2">
                <input
                  value={newTabName}
                  onChange={(event) => setNewTabName(event.target.value)}
                  placeholder="Tab name"
                  className="h-10 w-full rounded-lg border-2 border-primary/35 bg-white/90 px-3 text-sm font-medium text-slate-800 outline-none"
                />
                <input
                  value={newTabUrl}
                  onChange={(event) => setNewTabUrl(event.target.value)}
                  placeholder="Website URL"
                  className="h-10 w-full rounded-lg border-2 border-primary/35 bg-white/90 px-3 text-sm font-medium text-slate-800 outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={addNewTab}
                    className="h-9 flex-1 rounded-lg bg-primary text-sm font-bold uppercase text-white transition hover:bg-accent"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowNewTabForm(false);
                      setNewTabName("");
                      setNewTabUrl("");
                    }}
                    className="h-9 flex-1 rounded-lg bg-white text-sm font-bold uppercase text-slate-800 transition hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowNewTabForm((prev) => !prev)}
              className="h-11 w-full rounded-xl border-2 border-primary/40 bg-white/90 font-card text-xl font-black tracking-tight text-slate-800 transition hover:bg-white"
            >
              + New Tab
            </button>
          </div>
        </aside>

        <main className="flex-1 rounded-[2.5rem] border-4 border-primary/40 bg-surface/40 p-8 text-center shadow-2xl backdrop-blur-xl">
          <h1 className="font-card text-5xl font-black tracking-tight text-slate-900">
            Session
          </h1>
          <p className="mt-3 text-xl font-semibold text-slate-700">
            {finalCat.name} is ready in {actionName}.
          </p>

          <img
            src={finalCat.gif}
            alt={`Session cat ${finalCat.name}`}
            className="mx-auto mt-7 h-64 w-full max-w-lg rounded-2xl border-2 border-primary/40 object-cover"
          />

          <button
            onClick={() => navigate("/dashboard")}
            className="mt-8 h-14 w-full max-w-sm rounded-2xl border-2 border-primary/40 bg-primary font-card text-2xl font-black tracking-tight text-white transition hover:bg-accent"
          >
            Back To Dashboard
          </button>
        </main>
      </div>
    </div>
  );
}
