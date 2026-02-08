import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Moon, RefreshCw, Sun } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getQuiz, submitQuiz } from "../lib/api";
import { getStoredUsername } from "../lib/identity";
import { useTheme } from "../theme-context.jsx";

function normalizeQuizType(value) {
  const text = String(value || "").toLowerCase();
  if (text === "mcq" || text === "short" || text === "long") return text;
  return "mcq";
}

function formatQuizType(value) {
  const type = normalizeQuizType(value);
  if (type === "mcq") return "QCM";
  if (type === "short") return "Short Answer";
  return "Long Answer";
}

function toResultMap(results) {
  const map = new Map();
  if (!Array.isArray(results)) return map;
  results.forEach((item) => {
    if (!item?.questionId) return;
    map.set(item.questionId, item);
  });
  return map;
}

export default function Quiz() {
  const navigate = useNavigate();
  const location = useLocation();
  const { quizId } = useParams();
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

  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const quizType = normalizeQuizType(quiz?.type);
  const resultMap = useMemo(
    () => toResultMap(submission?.results),
    [submission?.results],
  );

  async function loadQuiz() {
    if (!quizId) return;
    setLoading(true);
    setError("");
    try {
      const payload = await getQuiz(quizId, username);
      const nextQuiz = payload?.quiz || null;
      setQuiz(nextQuiz);
      setAnswers({});
      setSubmission(null);
    } catch (requestError) {
      setError(requestError.message || "Could not load quiz");
      setQuiz(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuiz();
  }, [quizId, username]);

  function handleBack() {
    navigate("/quizzes", {
      state: {
        from: location.state?.from || "quiz",
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

  function updateMcqAnswer(questionId, optionIndex) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: String(optionIndex),
    }));
  }

  function updateTextAnswer(questionId, value) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!quiz || isSubmitting) return;
    setError("");
    setIsSubmitting(true);
    try {
      const payload = await submitQuiz(quiz.id, {
        username,
        answers,
      });
      setSubmission(payload);
    } catch (requestError) {
      setError(requestError.message || "Could not submit quiz");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleRedo() {
    setAnswers({});
    setSubmission(null);
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
            Back To Quizzes
          </button>
          <button
            onClick={loadQuiz}
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
                {quiz?.title || "Quiz"}
              </h1>
              <p className="mt-1 text-lg font-semibold text-slate-700">
                {quiz?.prompt || "Answer all questions, then submit."}
              </p>
            </div>
            <div className="rounded-xl border border-primary/30 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              {serverName}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide text-slate-700">
            <span className="rounded-full border border-primary/30 bg-surface/35 px-2 py-0.5">
              {formatQuizType(quizType)}
            </span>
            <span className="rounded-full border border-primary/30 bg-surface/35 px-2 py-0.5">
              {Array.isArray(quiz?.questions) ? quiz.questions.length : 0} questions
            </span>
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="mt-5 rounded-[1.7rem] border-2 border-primary/35 bg-white/80 p-5"
        >
          {loading && (
            <p className="rounded-xl border border-primary/30 bg-white/70 px-3 py-3 text-sm font-semibold text-slate-700">
              Loading quiz...
            </p>
          )}

          {!loading && !error && !quiz && (
            <p className="rounded-xl border border-primary/30 bg-white/70 px-3 py-3 text-sm font-semibold text-slate-700">
              Quiz not found.
            </p>
          )}

          {!loading &&
            !error &&
            Array.isArray(quiz?.questions) &&
            quiz.questions.map((question, index) => {
              const questionResult = resultMap.get(question.id);
              const answerValue = answers[question.id] ?? "";
              return (
                <article
                  key={question.id}
                  className="mb-4 rounded-2xl border-2 border-primary/30 bg-white/90 p-4 last:mb-0"
                >
                  <p className="text-xs font-black uppercase tracking-wide text-slate-600">
                    Question {index + 1}
                  </p>
                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {question.prompt}
                  </p>

                  {quizType === "mcq" ? (
                    <div className="mt-3 space-y-2">
                      {(question.options || []).map((option, optionIndex) => {
                        const isSelected =
                          String(answerValue) === String(optionIndex);
                        return (
                          <label
                            key={`${question.id}-${optionIndex}`}
                            className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2 transition ${
                              isSelected
                                ? "border-primary/60 bg-primary/10"
                                : "border-primary/25 bg-white hover:bg-slate-50"
                            }`}
                          >
                            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-white text-xs font-black text-slate-700">
                              {String.fromCharCode(65 + optionIndex)}
                            </span>
                            <span className="flex-1 text-sm font-semibold leading-snug text-slate-800">
                              {option}
                            </span>
                            <input
                              type="radio"
                              name={`question-${question.id}`}
                              checked={isSelected}
                              onChange={() =>
                                updateMcqAnswer(question.id, optionIndex)
                              }
                              className="h-4 w-4 accent-primary"
                            />
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <textarea
                      value={String(answerValue)}
                      onChange={(event) =>
                        updateTextAnswer(question.id, event.target.value)
                      }
                      rows={quizType === "long" ? 5 : 3}
                      maxLength={quizType === "long" ? 2200 : 1000}
                      placeholder={
                        quizType === "long"
                          ? "Write a detailed answer..."
                          : "Write a short answer..."
                      }
                      className="mt-3 w-full rounded-xl border-2 border-primary/30 bg-white/95 p-3 text-base font-semibold text-slate-800 outline-none"
                    />
                  )}

                  {questionResult && (
                    <div
                      className={`mt-3 rounded-xl border px-3 py-2 text-sm font-semibold ${
                        questionResult.isCorrect
                          ? "border-green-300 bg-green-50 text-green-800"
                          : questionResult.isAlmostCorrect
                            ? "border-yellow-300 bg-yellow-50 text-yellow-800"
                            : "border-red-300 bg-red-50 text-red-800"
                      }`}
                    >
                      <p className="font-black uppercase tracking-wide">
                        {questionResult.isCorrect
                          ? "Correct"
                          : questionResult.isAlmostCorrect
                            ? "Almost Correct"
                            : "Needs Review"}
                      </p>
                      <p className="mt-1">{questionResult.feedback}</p>
                      {questionResult.correctAnswer && (
                        <p className="mt-1">
                          Correct answer: {questionResult.correctAnswer}
                        </p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}

          {!loading && quiz && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`h-12 rounded-xl border-2 px-6 font-card text-xl font-black tracking-tight transition ${
                  !isSubmitting
                    ? "border-primary/45 bg-primary text-white hover:bg-accent"
                    : "cursor-not-allowed border-slate-300 bg-slate-200 text-slate-500"
                }`}
              >
                {isSubmitting ? "Submitting..." : "Submit Answers"}
              </button>

              <button
                type="button"
                onClick={handleRedo}
                className="h-12 rounded-xl border-2 border-primary/35 bg-white px-6 font-card text-xl font-black tracking-tight text-slate-800 transition hover:bg-slate-100"
              >
                Redo
              </button>
            </div>
          )}

          {submission?.score && (
            <div className="mt-4 rounded-xl border border-primary/35 bg-white px-4 py-3 text-sm font-semibold text-slate-800">
              Score: {submission.score.earned}/{submission.score.max} (
              {submission.score.percent}%) · {submission.score.label}
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
