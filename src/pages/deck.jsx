import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Moon,
  RefreshCw,
  Shuffle,
  Sun,
} from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getFlashcardDeck, regenerateFlashcardDeck } from "../lib/api";
import { getStoredUsername } from "../lib/identity";
import { useTheme } from "../theme-context.jsx";

export default function Deck() {
  const navigate = useNavigate();
  const location = useLocation();
  const { deckId } = useParams();
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

  const [deck, setDeck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cardIndex, setCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [desiredCardCount, setDesiredCardCount] = useState(() => {
    const stored = Number(sessionStorage.getItem("flashcardsCardCount") || "10");
    if (!Number.isFinite(stored)) return 10;
    return Math.max(1, Math.min(50, Math.floor(stored)));
  });
  const [isRegenerating, setIsRegenerating] = useState(false);

  const cards = useMemo(() => {
    return Array.isArray(deck?.cards) ? deck.cards : [];
  }, [deck]);

  const activeCard =
    cards.length > 0 ? cards[Math.max(0, Math.min(cardIndex, cards.length - 1))] : null;

  async function loadDeck() {
    if (!deckId) return;
    setLoading(true);
    setError("");
    try {
      const payload = await getFlashcardDeck(deckId, username);
      const nextDeck = payload?.deck || null;
      setDeck(nextDeck);
      if (nextDeck?.cardCountTarget) {
        const clamped = Math.max(1, Math.min(50, Number(nextDeck.cardCountTarget)));
        setDesiredCardCount(clamped);
      }
      setCardIndex(0);
      setShowAnswer(false);
    } catch (requestError) {
      setError(requestError.message || "Could not load deck");
      setDeck(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDeck();
  }, [deckId, username]);

  function handleBack() {
    navigate("/flashcards", {
      state: {
        from: location.state?.from || "deck",
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

  function goPrev() {
    if (!cards.length) return;
    setCardIndex((prev) => (prev - 1 + cards.length) % cards.length);
    setShowAnswer(false);
  }

  function goNext() {
    if (!cards.length) return;
    setCardIndex((prev) => (prev + 1) % cards.length);
    setShowAnswer(false);
  }

  function shuffleCards() {
    if (!cards.length) return;
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setDeck((prev) => (prev ? { ...prev, cards: shuffled } : prev));
    setCardIndex(0);
    setShowAnswer(false);
  }

  function updateDesiredCardCount(value) {
    if (value === "") {
      setDesiredCardCount("");
      return;
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    const clamped = Math.max(1, Math.min(50, Math.floor(numeric)));
    setDesiredCardCount(clamped);
    try {
      sessionStorage.setItem("flashcardsCardCount", String(clamped));
    } catch (storageError) {
      // Ignore storage errors.
    }
  }

  async function regenerateDeckCards() {
    if (!deck?.id || isRegenerating) return;
    const numeric = Number(desiredCardCount);
    const clamped = Number.isFinite(numeric)
      ? Math.max(1, Math.min(50, Math.floor(numeric)))
      : 10;

    setError("");
    setIsRegenerating(true);
    try {
      const payload = await regenerateFlashcardDeck(deck.id, {
        username,
        serverName,
        cardCount: clamped,
      });
      if (payload?.deck) {
        setDeck(payload.deck);
        setCardIndex(0);
        setShowAnswer(false);
      }
      try {
        sessionStorage.setItem("flashcardsCardCount", String(clamped));
      } catch (storageError) {
        // Ignore storage errors.
      }
    } catch (requestError) {
      setError(requestError.message || "Could not regenerate deck");
    } finally {
      setIsRegenerating(false);
    }
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
            Back To Flashcards
          </button>
          <button
            onClick={loadDeck}
            className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-primary/35 bg-white px-4 font-card text-lg font-black tracking-tight text-slate-800 transition hover:bg-slate-100"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <section className="rounded-[1.7rem] border-2 border-primary/35 bg-white/80 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-card text-5xl font-black tracking-tight text-slate-900">
                {deck?.title || "Deck"}
              </h1>
              <p className="mt-1 text-lg font-semibold text-slate-700">
                {deck?.prompt || "Your generated flashcards."}
              </p>
            </div>
            <div className="rounded-xl border border-primary/30 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              {serverName}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <label className="text-sm font-semibold text-slate-700">
              Cards for this deck (max 50)
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={desiredCardCount}
              onChange={(event) => updateDesiredCardCount(event.target.value)}
              className="h-10 w-24 rounded-xl border-2 border-primary/35 bg-white/95 px-2 text-center text-base font-bold text-slate-800 outline-none"
            />
            <button
              onClick={regenerateDeckCards}
              disabled={loading || isRegenerating}
              className={`h-10 rounded-xl border-2 px-4 font-card text-base font-black tracking-tight transition ${
                !loading && !isRegenerating
                  ? "border-primary/45 bg-primary text-white hover:bg-accent"
                  : "cursor-not-allowed border-slate-300 bg-slate-200 text-slate-500"
              }`}
            >
              {isRegenerating ? "Updating..." : "Update Cards"}
            </button>
          </div>
        </section>

        <section className="mt-5 rounded-[1.7rem] border-2 border-primary/35 bg-white/80 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-card text-4xl font-black tracking-tight text-slate-900">
                Cards
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                {cards.length === 0 ? "0 total" : `Card ${cardIndex + 1} / ${cards.length}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={goPrev}
                disabled={!cards.length}
                className={`h-11 rounded-xl border-2 px-4 font-card text-lg font-black tracking-tight transition ${
                  cards.length
                    ? "border-primary/35 bg-white text-slate-800 hover:bg-slate-100"
                    : "cursor-not-allowed border-slate-300 bg-slate-200 text-slate-500"
                }`}
              >
                Prev
              </button>
              <button
                onClick={shuffleCards}
                disabled={!cards.length}
                className={`inline-flex h-11 items-center gap-2 rounded-xl border-2 px-4 font-card text-lg font-black tracking-tight transition ${
                  cards.length
                    ? "border-primary/35 bg-white text-slate-800 hover:bg-slate-100"
                    : "cursor-not-allowed border-slate-300 bg-slate-200 text-slate-500"
                }`}
              >
                <Shuffle className="h-4 w-4" />
                Shuffle
              </button>
              <button
                onClick={() => setShowAnswer((prev) => !prev)}
                disabled={!cards.length}
                className={`h-11 rounded-xl border-2 px-4 font-card text-lg font-black tracking-tight transition ${
                  cards.length
                    ? "border-primary/45 bg-primary text-white hover:bg-accent"
                    : "cursor-not-allowed border-slate-300 bg-slate-200 text-slate-500"
                }`}
              >
                Flip
              </button>
              <button
                onClick={goNext}
                disabled={!cards.length}
                className={`h-11 rounded-xl border-2 px-4 font-card text-lg font-black tracking-tight transition ${
                  cards.length
                    ? "border-primary/35 bg-white text-slate-800 hover:bg-slate-100"
                    : "cursor-not-allowed border-slate-300 bg-slate-200 text-slate-500"
                }`}
              >
                Next
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-[1.3rem] border-2 border-primary/30 bg-white/85 p-5">
            {loading && (
              <p className="text-base font-semibold text-slate-700">
                Loading deck...
              </p>
            )}
            {!loading && !error && !activeCard && (
              <p className="text-base font-semibold text-slate-700">
                No cards in this deck yet.
              </p>
            )}
            {!loading && !error && activeCard && (
              <>
                <p className="text-sm font-black uppercase tracking-wide text-slate-600">
                  {showAnswer ? "Answer" : "Question"}
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {showAnswer ? activeCard.answer : activeCard.question}
                </p>
                <p className="mt-4 text-xs font-semibold text-slate-600">
                  Click Flip to switch between question and answer.
                </p>
              </>
            )}
            {!loading && error && (
              <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
