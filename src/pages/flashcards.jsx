import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Moon, RefreshCw, Sun, Trash2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  createFlashcardDeck,
  deleteFlashcardDeck,
  listFlashcardDecks,
} from "../lib/api";
import { getStoredUsername } from "../lib/identity";
import DraggableCatOverlay from "../components/DraggableCatOverlay";
import { getPomodoroStorageKey } from "../lib/pomodoro";
import { useTheme } from "../theme-context.jsx";

function formatDate(timestamp) {
  if (!Number.isFinite(timestamp)) return "-";
  return new Date(timestamp).toLocaleDateString();
}

export default function Flashcards() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDay, toggleMode } = useTheme();

  const username =
    location.state?.username?.trim() || getStoredUsername() || "Guest";
  const serverName =
    location.state?.serverName?.trim() ||
    sessionStorage.getItem("activeServerName") ||
    "My Server";
  const selectedCat =
    location.state?.selectedCat ||
    sessionStorage.getItem("activeSelectedCat") ||
    sessionStorage.getItem("selectedCatId") ||
    "";
  const selectedAction =
    location.state?.selectedAction ||
    sessionStorage.getItem("activeSelectedAction") ||
    "";

  const [deckTitle, setDeckTitle] = useState("");
  const [deckPrompt, setDeckPrompt] = useState("");
  const [searchText, setSearchText] = useState("");
  const [decks, setDecks] = useState([]);
  const [loadingDecks, setLoadingDecks] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingDeckId, setDeletingDeckId] = useState("");
  const [error, setError] = useState("");

  const filteredDecks = useMemo(() => {
    const value = searchText.trim().toLowerCase();
    if (!value) return decks;
    return decks.filter((deck) => {
      const haystack = [
        deck.title,
        deck.prompt,
        ...(Array.isArray(deck.cards)
          ? deck.cards.flatMap((card) => [card.question, card.answer])
          : []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(value);
    });
  }, [decks, searchText]);

  async function loadDecks(showLoading = true) {
    if (showLoading) setLoadingDecks(true);
    setError("");
    try {
      const payload = await listFlashcardDecks(username);
      setDecks(Array.isArray(payload.decks) ? payload.decks : []);
    } catch (requestError) {
      setError(requestError.message || "Could not load decks");
    } finally {
      if (showLoading) setLoadingDecks(false);
    }
  }

  useEffect(() => {
    loadDecks(true);
  }, []);

  async function handleCreateDeck() {
    if (!deckPrompt.trim() || isCreating) return;
    setError("");
    setIsCreating(true);
    try {
      const preferredCardCount = Number(
        sessionStorage.getItem("flashcardsCardCount") || "10",
      );
      const payload = await createFlashcardDeck({
        username,
        serverName,
        title: deckTitle.trim(),
        prompt: deckPrompt.trim(),
        cardCount: Number.isFinite(preferredCardCount)
          ? Math.max(1, Math.min(50, Math.floor(preferredCardCount)))
          : 10,
      });
      const nextDeck = payload?.deck;
      if (nextDeck) {
        setDecks((prev) => [nextDeck, ...prev]);
        navigate(`/deck/${nextDeck.id}`, {
          state: {
            from: location.state?.from || "flashcards",
            username,
            serverName,
            serverId: location.state?.serverId || "",
            serverCode: location.state?.serverCode || "",
            memberId: location.state?.memberId || "",
            selectedCat,
            selectedAction,
          },
        });
      } else {
        await loadDecks(false);
      }
      setDeckTitle("");
      setDeckPrompt("");
    } catch (requestError) {
      setError(requestError.message || "Could not create deck");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteDeck(deckId) {
    if (!deckId || deletingDeckId) return;
    setError("");
    setDeletingDeckId(deckId);
    try {
      await deleteFlashcardDeck(deckId, username);
      setDecks((prev) => prev.filter((deck) => deck.id !== deckId));
    } catch (requestError) {
      setError(requestError.message || "Could not delete deck");
    } finally {
      setDeletingDeckId("");
    }
  }

  function openDeck(deckId) {
    if (!deckId) return;
    navigate(`/deck/${deckId}`, {
      state: {
        from: location.state?.from || "flashcards",
        username,
        serverName,
        serverId: location.state?.serverId || "",
        serverCode: location.state?.serverCode || "",
        memberId: location.state?.memberId || "",
        selectedCat,
        selectedAction,
      },
    });
  }

  function handleBack() {
    if (location.state?.from === "session") {
      navigate("/session", {
        state: {
          serverId: location.state?.serverId || "",
          serverName,
          serverCode: location.state?.serverCode || "",
          memberId: location.state?.memberId || "",
          selectedCat,
          selectedAction,
        },
      });
      return;
    }
    navigate("/dashboard", { state: { username } });
  }

  return (
    <div
      className={`relative min-h-screen overflow-hidden px-4 py-8 transition-all duration-[2000ms] md:px-8 ${
        isDay
          ? "bg-gradient-to-t from-[#88A7BE] via-[#A6C0D2] to-[#C8D8E3]"
          : "bg-gradient-to-t from-[#0F172A] via-[#1E293B] to-[#334155]"
      }`}
    >
      <button
        onClick={toggleMode}
        aria-label="Toggle light/dark mode"
        className={`group absolute right-12 top-12 z-20 flex h-16 w-16 items-center justify-center rounded-full transition-all duration-[2000ms] ${
          isDay
            ? "bg-yellow-100 shadow-[0_0_80px_rgba(253,224,71,0.4)] hover:shadow-[0_0_100px_rgba(253,224,71,0.6)]"
            : "bg-slate-100 shadow-[0_0_50px_rgba(255,255,255,0.2)] hover:shadow-[0_0_70px_rgba(255,255,255,0.4)]"
        }`}
      >
        <div className="transition-transform duration-700 group-hover:rotate-12 group-active:scale-90">
          {isDay ? (
            <Sun className="h-8 w-8 text-yellow-400/60" />
          ) : (
            <Moon className="h-7 w-7 fill-slate-400/10 text-slate-400/60" />
          )}
        </div>
      </button>

      <div className="absolute -top-24 -left-20 h-80 w-80 rounded-full bg-white/30 blur-2xl" />
      <div className="absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-primary/25 blur-2xl" />

      <div className="relative mx-auto max-w-6xl rounded-[2.5rem] border-4 border-primary/40 bg-surface/40 p-5 shadow-2xl backdrop-blur-xl md:p-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleBack}
            className="inline-flex h-12 items-center gap-2 rounded-xl border-2 border-primary/45 bg-primary px-4 font-card text-xl font-black tracking-tight text-white transition hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-primary/35 bg-white/80 px-3 py-1 text-sm font-bold text-slate-800">
              {username}
            </span>
            <span className="rounded-full border border-primary/35 bg-white/80 px-3 py-1 text-sm font-bold text-slate-800">
              {serverName}
            </span>
          </div>
        </div>

        <section className="mb-5 rounded-[1.7rem] border-2 border-primary/35 bg-white/70 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-card text-5xl font-black tracking-tight text-slate-900">
                Flashcards
              </h1>
            </div>
            <div className="text-right text-sm font-semibold text-slate-700">
              <p>{decks.length} decks</p>
              <p>{decks.reduce((sum, deck) => sum + (deck.cardsCount || 0), 0)} cards total</p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-[1.7rem] border-2 border-primary/35 bg-white/80 p-5">
            <h2 className="font-card text-4xl font-black tracking-tight text-slate-900">
              Create A Deck
            </h2>
            <input
              value={deckTitle}
              onChange={(event) => setDeckTitle(event.target.value)}
              placeholder="Deck name (optional)"
              maxLength={80}
              className="mt-4 h-12 w-full rounded-xl border-2 border-primary/35 bg-white/95 px-3 text-lg font-semibold text-slate-800 outline-none"
            />
            <textarea
              value={deckPrompt}
              onChange={(event) => setDeckPrompt(event.target.value)}
              placeholder="Describe what to study, topic, chapter, or exam focus..."
              rows={7}
              maxLength={1200}
              className="mt-3 w-full rounded-xl border-2 border-primary/35 bg-white/95 p-3 text-lg font-semibold text-slate-800 outline-none"
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleCreateDeck}
                disabled={!deckPrompt.trim() || isCreating}
                className={`h-12 rounded-xl border-2 px-6 font-card text-xl font-black tracking-tight transition ${
                  deckPrompt.trim() && !isCreating
                    ? "border-primary/45 bg-primary text-white hover:bg-accent"
                    : "cursor-not-allowed border-slate-300 bg-slate-200 text-slate-500"
                }`}
              >
                {isCreating ? "Creating..." : "Create Deck"}
              </button>
              <button
                onClick={() => {
                  setDeckTitle("");
                  setDeckPrompt("");
                }}
                className="h-12 rounded-xl border-2 border-primary/35 bg-white px-6 font-card text-xl font-black tracking-tight text-slate-800 transition hover:bg-slate-100"
              >
                Clear
              </button>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-600">
              Tip: include specific keywords to generate stronger cards.
            </p>
          </div>

          <div className="rounded-[1.7rem] border-2 border-primary/35 bg-white/80 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-card text-4xl font-black tracking-tight text-slate-900">
                Your Decks
              </h2>
              <button
                onClick={() => loadDecks(false)}
                className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-primary/35 bg-white px-4 font-card text-lg font-black tracking-tight text-slate-800 transition hover:bg-slate-100"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>

            <div className="mt-3 flex gap-2">
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search decks (name, prompt)..."
                className="h-11 flex-1 rounded-xl border-2 border-primary/35 bg-white/95 px-3 text-base font-semibold text-slate-800 outline-none"
              />
              <button
                onClick={() => setSearchText("")}
                className="h-11 rounded-xl border-2 border-primary/35 bg-white px-4 font-card text-lg font-black tracking-tight text-slate-800 transition hover:bg-slate-100"
              >
                Clear
              </button>
            </div>

            <p className="mt-2 text-sm font-semibold text-slate-600">
              Showing {filteredDecks.length} of {decks.length}
            </p>

            <div className="mt-3 max-h-[60vh] space-y-3 overflow-auto pr-1">
              {loadingDecks && (
                <p className="rounded-xl border border-primary/30 bg-white/70 px-3 py-3 text-sm font-semibold text-slate-700">
                  Loading decks...
                </p>
              )}
              {!loadingDecks && filteredDecks.length === 0 && (
                <p className="rounded-xl border border-primary/30 bg-white/70 px-3 py-3 text-sm font-semibold text-slate-700">
                  No decks yet. Create your first one on the left.
                </p>
              )}

              {filteredDecks.map((deck) => (
                <article
                  key={deck.id}
                  className="cursor-pointer rounded-xl border-2 border-primary/25 bg-white/85 p-3 transition hover:bg-white"
                  onClick={() => openDeck(deck.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-card text-3xl font-black tracking-tight text-slate-900">
                        {deck.title}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        {deck.prompt}
                      </p>
                    </div>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteDeck(deck.id);
                      }}
                      disabled={deletingDeckId === deck.id}
                      className={`inline-flex h-10 items-center gap-1 rounded-xl border-2 px-3 font-card text-base font-black tracking-tight transition ${
                        deletingDeckId === deck.id
                          ? "cursor-not-allowed border-slate-300 bg-slate-200 text-slate-500"
                          : "border-primary/35 bg-white text-slate-800 hover:bg-slate-100"
                      }`}
                    >
                      <Trash2 className="h-4 w-4" />
                      {deletingDeckId === deck.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
                    <span className="rounded-full border border-primary/30 bg-white px-2 py-1">
                      {deck.cardsCount || 0} cards
                    </span>
                    <span className="rounded-full border border-primary/30 bg-white px-2 py-1">
                      {formatDate(deck.createdAt)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {error && (
          <p className="mt-4 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
      </div>

      <DraggableCatOverlay
        selectedCatId={selectedCat}
        selectedAction={selectedAction}
        username={username}
        pomodoroStorageKey={getPomodoroStorageKey()}
      />
    </div>
  );
}
