import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Send, Sun, Moon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { talkWithCat } from "../lib/api";
import { getStoredUsername } from "../lib/identity";
import { catOptions } from "./catFlowOptions";
import DraggableCatOverlay from "../components/DraggableCatOverlay";
import { useTheme } from "../theme-context.jsx";
import { getPomodoroStorageKey } from "../lib/pomodoro";

function toHistory(messages) {
  return messages
    .slice(-12)
    .map((item) => ({ role: item.role === "user" ? "user" : "cat", text: item.text }))
    .filter((item) => item.text);
}

export default function Chatbot() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDay, toggleMode } = useTheme();
  const scrollRef = useRef(null);

  const selectedCatId =
    location.state?.selectedCat ||
    sessionStorage.getItem("activeSelectedCat") ||
    sessionStorage.getItem("selectedCatId") ||
    catOptions[0].id;
  const selectedAction =
    location.state?.selectedAction ||
    sessionStorage.getItem("activeSelectedAction") ||
    "work";
  const serverName =
    location.state?.serverName ||
    sessionStorage.getItem("activeServerName") ||
    "My Server";
  const serverId =
    location.state?.serverId || sessionStorage.getItem("activeServerId") || "";
  const memberId =
    location.state?.memberId || sessionStorage.getItem("activeMemberId") || "";
  const serverCode =
    location.state?.serverCode || sessionStorage.getItem("activeServerCode") || "";
  const username = getStoredUsername() || "Guest";

  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState(() => [
    {
      id: `assistant-welcome-${Date.now()}`,
      role: "assistant",
      text: `Hi ${username}. I can help you study for ${serverName}. Ask me anything.`,
    },
  ]);

  const selectedCat = useMemo(
    () => catOptions.find((item) => item.id === selectedCatId) || catOptions[0],
    [selectedCatId],
  );

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  async function sendMessage(event) {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text || isSending) return;

    const userMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: "user",
      text,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setChatInput("");
    setError("");
    setIsSending(true);

    try {
      const payload = await talkWithCat({
        message: text,
        history: toHistory(nextMessages),
        serverName,
        username,
        catName: "AI Assistant",
      });

      const reply = String(payload?.reply || "").trim();
      if (!reply) {
        throw new Error("No response from AI");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: "assistant",
          text: reply,
        },
      ]);
    } catch (requestError) {
      setError(requestError.message || "Could not send message");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div
      className={`relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 transition-all duration-[2000ms] ${
        isDay
          ? "bg-gradient-to-t from-[#88A7BE] via-[#A6C0D2] to-[#C8D8E3]"
          : "bg-gradient-to-t from-[#0F172A] via-[#1E293B] to-[#334155]"
      }`}
    >
      <button
        onClick={toggleMode}
        aria-label="Toggle light/dark mode"
        className={`group fixed right-12 top-12 z-50 flex h-16 w-16 cursor-pointer items-center justify-center rounded-full outline-none transition-all duration-[2000ms] ${
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

      <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-white/30 blur-2xl" />
      <div className="absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-primary/25 blur-2xl" />

      <div className="relative mx-auto flex h-[84vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2.5rem] border-4 border-primary/40 bg-surface/40 p-6 shadow-2xl backdrop-blur-xl md:p-9">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() =>
              navigate("/session", {
                state: {
                  serverId,
                  serverName,
                  serverCode,
                  memberId,
                  selectedCat: selectedCatId,
                  selectedAction,
                },
              })
            }
            className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-primary/45 bg-primary px-4 font-card text-lg font-black tracking-tight text-white transition hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </button>

          <div className="rounded-xl border-2 border-primary/35 bg-white/80 px-3 py-2 text-right">
            <p className="font-card text-xl font-black tracking-tight text-slate-900">AI Chatbot</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              {serverName}
            </p>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-2 border-primary/35 bg-white/85 p-5">
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-xl border-2 border-primary/30 bg-white/70 p-4"
          >
            {messages.map((message) => {
              const mine = message.role === "user";
              return (
                <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-lg border px-3 py-2 ${
                      mine
                        ? "border-primary/40 bg-primary/15"
                        : "border-slate-300 bg-white/90"
                    }`}
                  >
                    <p className="text-xs font-black uppercase tracking-wide text-slate-600">
                      {mine ? username : "AI"}
                    </p>
                    <p className="break-words text-sm font-semibold text-slate-900">
                      {message.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={sendMessage} className="mt-4 flex shrink-0 items-end gap-2">
            <textarea
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              maxLength={1000}
              placeholder="Type your message..."
              rows={6}
              className="h-40 max-h-[34vh] flex-1 resize-none overflow-y-auto rounded-xl border-2 border-primary/35 bg-white/95 px-4 py-3 text-base font-medium text-slate-800 outline-none"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || isSending}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border-2 transition ${
                chatInput.trim() && !isSending
                  ? "border-primary/45 bg-primary text-white hover:bg-accent"
                  : "cursor-not-allowed border-slate-300 bg-slate-200 text-slate-500"
              }`}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

          {error && (
            <p className="mt-2 rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
              {error}
            </p>
          )}
        </div>
      </div>

      <DraggableCatOverlay
        selectedCatId={selectedCat.id}
        selectedAction={selectedAction}
        username={username}
        storageKey="chatbotOverlayPosition"
        showPomodoro={true}
        showUsername={false}
        pomodoroStorageKey={getPomodoroStorageKey()}
      />
    </div>
  );
}
