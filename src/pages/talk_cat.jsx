import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Mic, Square, Volume2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { catOptions } from "./catFlowOptions";
import { talkCatStt, talkCatTts, talkWithCat } from "../lib/api";
import { getStoredUsername } from "../lib/identity";
import { useTheme } from "../theme-context.jsx";

const MAX_RECORDING_MS = 15000;

function toHistory(messages) {
  return messages
    .slice(-12)
    .map((item) => ({ role: item.role, text: item.text }))
    .filter((item) => item.text);
}

export default function TalkCat() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDay } = useTheme();
  const scrollRef = useRef(null);
  const audioRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const talkingVisualDelayRef = useRef(null);
  const talkingVisualLoopRef = useRef(null);

  const selectedCatId =
    location.state?.selectedCat || sessionStorage.getItem("selectedCatId") || catOptions[0].id;
  const serverName =
    location.state?.serverName ||
    sessionStorage.getItem("activeServerName") ||
    "My Server";
  const username = getStoredUsername() || "Guest";

  const cat = useMemo(
    () => catOptions.find((item) => item.id === selectedCatId) || catOptions[0],
    [selectedCatId],
  );

  const [messages, setMessages] = useState(() => [
    {
      id: `cat-welcome-${Date.now()}`,
      role: "cat",
      text: `Hi ${username}, I'm ${cat.name}. Tell me what you want to study in ${serverName}.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isCatTalkingVisual, setIsCatTalkingVisual] = useState(false);
  const [idleTalkCatFrame, setIdleTalkCatFrame] = useState("");
  const [talkGifRunId, setTalkGifRunId] = useState(0);
  const [textScroll, setTextScroll] = useState(100);

  useEffect(() => {
    try {
      sessionStorage.setItem("selectedCatId", cat.id);
    } catch (storageError) {
      // Ignore storage errors.
    }
  }, [cat.id]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
    setTextScroll(100);
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.src = "/talking_cat.gif";
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 256;
        canvas.height = img.naturalHeight || 256;
        const context = canvas.getContext("2d");
        if (!context) return;
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        setIdleTalkCatFrame(canvas.toDataURL("image/png"));
      } catch (_error) {
        // If frame capture fails, fallback rendering below still works.
      }
    };
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      if (recordingTimerRef.current) {
        window.clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (talkingVisualDelayRef.current) {
        window.clearTimeout(talkingVisualDelayRef.current);
        talkingVisualDelayRef.current = null;
      }
      if (talkingVisualLoopRef.current) {
        window.clearInterval(talkingVisualLoopRef.current);
        talkingVisualLoopRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  async function speakText(text) {
    if (!text) return;

    const stopTalkingVisual = () => {
      if (talkingVisualDelayRef.current) {
        window.clearTimeout(talkingVisualDelayRef.current);
        talkingVisualDelayRef.current = null;
      }
      if (talkingVisualLoopRef.current) {
        window.clearInterval(talkingVisualLoopRef.current);
        talkingVisualLoopRef.current = null;
      }
      setIsCatTalkingVisual(false);
    };

    const startTalkingVisual = () => {
      if (talkingVisualDelayRef.current) {
        window.clearTimeout(talkingVisualDelayRef.current);
      }
      if (talkingVisualLoopRef.current) {
        window.clearInterval(talkingVisualLoopRef.current);
      }

      talkingVisualDelayRef.current = null;
      setTalkGifRunId((value) => value + 1);
      setIsCatTalkingVisual(true);

      // Some GIFs don't loop reliably across browsers, so force periodic restart while speaking.
      talkingVisualLoopRef.current = window.setInterval(() => {
        setTalkGifRunId((value) => value + 1);
      }, 1650);
    };

    setIsSpeaking(true);
    setIsCatTalkingVisual(false);
    setError("");
    try {
      const payload = await talkCatTts({
        text,
        catName: cat.name,
      });

      const audioBase64 = payload?.audioBase64;
      if (!audioBase64) {
        throw new Error("No audio returned");
      }

      const binary = atob(audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: payload?.mimeType || "audio/mpeg" });
      const url = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => {
        startTalkingVisual();
      };
      audio.onpause = () => {
        stopTalkingVisual();
      };

      await new Promise((resolve, reject) => {
        audio.onerror = () => {
          stopTalkingVisual();
          URL.revokeObjectURL(url);
          reject(new Error("Audio playback failed"));
        };
        audio.onended = () => {
          stopTalkingVisual();
          URL.revokeObjectURL(url);
          resolve();
        };
        audio
          .play()
          .then(() => {})
          .catch(reject);
      });
    } catch (speakError) {
      stopTalkingVisual();
      setError(speakError.message || "Could not play ElevenLabs voice");
    } finally {
      stopTalkingVisual();
      setIsSpeaking(false);
    }
  }

  async function sendUserMessage(text) {
    const safeText = String(text || "").trim();
    if (!safeText || isSending) return;

    setError("");
    setIsSending(true);
    setInput("");

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: safeText,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);

    try {
      const payload = await talkWithCat({
        message: safeText,
        history: toHistory(nextMessages),
        serverName,
        username,
        catName: cat.name,
      });

      const reply = String(payload?.reply || "").trim();
      if (!reply) {
        throw new Error("No reply from cat");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `cat-${Date.now()}`,
          role: "cat",
          text: reply,
        },
      ]);

      await speakText(reply);
    } catch (requestError) {
      setError(requestError.message || "Could not reach talk-with-cat service");
      setMessages((prev) => prev.filter((item) => item.id !== userMessage.id));
      setInput(safeText);
    } finally {
      setIsSending(false);
    }
  }

  async function speakLatestCatReply() {
    const latestCat = [...messages].reverse().find((item) => item.role === "cat");
    if (!latestCat || isSpeaking) return;
    await speakText(latestCat.text);
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = String(reader.result || "");
        const base64 = result.includes(",") ? result.split(",")[1] : "";
        if (!base64) {
          reject(new Error("Could not encode audio"));
          return;
        }
        resolve(base64);
      };
      reader.onerror = () => reject(new Error("Failed reading recorded audio"));
      reader.readAsDataURL(blob);
    });
  }

  async function stopRecordingAndTranscribe() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    if (recordingTimerRef.current) {
      window.clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setIsTranscribing(true);

    const audioBlob = await new Promise((resolve) => {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        resolve(blob);
      };
      recorder.stop();
    });

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      const base64 = await blobToBase64(audioBlob);
      const transcriptPayload = await talkCatStt({
        audioBase64: base64,
        mimeType: audioBlob.type || "audio/webm",
      });
      const transcript = String(transcriptPayload?.text || "").trim();
      if (!transcript) {
        throw new Error("No speech detected. Please try again.");
      }
      await sendUserMessage(transcript);
    } catch (transcribeError) {
      setError(transcribeError.message || "Could not transcribe voice input");
    } finally {
      setIsTranscribing(false);
      chunksRef.current = [];
      recorderRef.current = null;
    }
  }

  async function toggleVoiceInput() {
    if (isRecording) {
      await stopRecordingAndTranscribe();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone is not supported in this browser.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setError("MediaRecorder is not supported in this browser.");
      return;
    }

    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data?.size) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.start();
      setIsRecording(true);
      recordingTimerRef.current = window.setTimeout(() => {
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
          stopRecordingAndTranscribe();
        }
      }, MAX_RECORDING_MS);
    } catch (recordError) {
      setError(recordError.message || "Could not access microphone");
      if (recordingTimerRef.current) {
        window.clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }
  }

  const catVisualSrc = isCatTalkingVisual
    ? `/talking_cat.gif?run=${talkGifRunId}`
    : idleTalkCatFrame;

  function syncSliderWithScroll() {
    const container = scrollRef.current;
    if (!container) return;
    const maxScroll = Math.max(container.scrollHeight - container.clientHeight, 0);
    if (!maxScroll) {
      setTextScroll(100);
      return;
    }
    const nextValue = Math.round((container.scrollTop / maxScroll) * 100);
    setTextScroll(nextValue);
  }

  function onTextSliderChange(event) {
    const container = scrollRef.current;
    const nextValue = Number(event.target.value);
    setTextScroll(nextValue);
    if (!container) return;
    const maxScroll = Math.max(container.scrollHeight - container.clientHeight, 0);
    container.scrollTop = (nextValue / 100) * maxScroll;
  }

  return (
    <div
      className={`relative min-h-screen overflow-hidden px-4 py-8 transition-all duration-[2000ms] ${
        isDay
          ? "bg-gradient-to-t from-[#88A7BE] via-[#A6C0D2] to-[#C8D8E3]"
          : "bg-gradient-to-t from-[#0F172A] via-[#1E293B] to-[#334155]"
      }`}
    >
      <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-white/30 blur-2xl" />
      <div className="absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-primary/25 blur-2xl" />

      <div className="relative mx-auto max-w-5xl rounded-[2.5rem] border-4 border-primary/40 bg-surface/40 p-5 shadow-2xl backdrop-blur-xl md:p-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => navigate("/session")}
            className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-primary/45 bg-primary px-4 font-card text-lg font-black tracking-tight text-white transition hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </button>
          <button
            onClick={speakLatestCatReply}
            disabled={isSpeaking}
            className={`inline-flex h-11 items-center gap-2 rounded-xl border-2 px-4 font-card text-lg font-black tracking-tight transition ${
              isSpeaking
                ? "cursor-not-allowed border-slate-300 bg-slate-200 text-slate-500"
                : "border-primary/45 bg-primary text-white hover:bg-accent"
            }`}
          >
            <Volume2 className="h-5 w-5" />
            {isSpeaking ? "Speaking..." : "Speak Cat"}
          </button>
        </div>

        <div className="grid gap-4 grid-cols-[180px_minmax(0,1fr)] md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="sticky top-4 self-start rounded-2xl border-2 border-primary/35 bg-white/80 p-4 text-center">
            {catVisualSrc ? (
              <img
                src={catVisualSrc}
                alt={`${cat.name} cat`}
                className="mx-auto h-36 w-36 select-none object-contain"
                draggable={false}
              />
            ) : (
              <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full border border-primary/30 bg-white/90 text-sm font-black text-slate-700">
                {cat.name}
              </div>
            )}
            <p className="mt-2 rounded-full bg-white px-3 py-1 text-sm font-black text-slate-900">
              {cat.name}
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Server: {serverName}
            </p>
          </div>

          <div className="flex min-h-[60vh] flex-col rounded-2xl border-2 border-primary/35 bg-white/85 p-4">
            <div
              ref={scrollRef}
              onScroll={syncSliderWithScroll}
              className="min-h-[320px] flex-1 space-y-2 overflow-auto rounded-xl border border-primary/25 bg-white/75 p-3"
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
                        {mine ? username : cat.name}
                      </p>
                      <p className="break-words text-sm font-semibold text-slate-900">
                        {message.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 rounded-xl border border-primary/25 bg-white/70 px-3 py-2">
              <p className="mb-1 text-[11px] font-black uppercase tracking-wide text-slate-600">
                Slide Text
              </p>
              <input
                type="range"
                min="0"
                max="100"
                value={textScroll}
                onChange={onTextSliderChange}
                className="w-full accent-primary"
                aria-label="Slide through chat text"
              />
            </div>

            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={toggleVoiceInput}
                disabled={isSending || isTranscribing}
                className={`inline-flex h-14 w-14 items-center justify-center rounded-full border-2 transition ${
                  isRecording
                    ? "border-red-500 bg-red-500 text-white hover:bg-red-600"
                    : isSending || isTranscribing
                      ? "cursor-not-allowed border-slate-300 bg-slate-200 text-slate-500"
                      : "border-primary/45 bg-primary text-white hover:bg-accent"
                }`}
                title={
                  isRecording
                    ? "Stop and send voice"
                    : isTranscribing
                      ? "Transcribing..."
                      : "Click to talk"
                }
                aria-label={
                  isRecording
                    ? "Stop and send voice"
                    : isTranscribing
                      ? "Transcribing voice"
                      : "Click to talk"
                }
              >
                {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
              </button>
            </div>

            {error && (
              <p className="mt-2 rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
