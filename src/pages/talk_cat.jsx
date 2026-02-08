import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Mic, Square, Volume2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { catOptions } from "./catFlowOptions";
import { getTalkCatWebRtcToken, talkCatStt, talkCatTts, talkWithCat } from "../lib/api";
import { getStoredUsername } from "../lib/identity";
import DraggableCatOverlay from "../components/DraggableCatOverlay";
import { getPomodoroStorageKey } from "../lib/pomodoro";
import { useTheme } from "../theme-context.jsx";
import { Sun, Moon } from "lucide-react";

const MAX_RECORDING_MS = 15000;
const LIVE_RECONNECT_BASE_MS = 800;
const LIVE_RECONNECT_MAX_MS = 6000;

function toHistory(messages) {
  return messages
    .slice(-12)
    .map((item) => ({ role: item.role, text: item.text }))
    .filter((item) => item.text);
}

function extractRealtimeText(payload) {
  if (!payload || typeof payload !== "object") return "";
  const candidates = [
    payload.text,
    payload.transcript,
    payload.message,
    payload.response,
    payload.output_text,
    payload.content,
    payload?.message?.text,
    payload?.message?.content,
    payload?.data?.text,
    payload?.data?.transcript,
    payload?.message?.transcript,
  ];
  for (const value of candidates) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function inferRealtimeRole(payload) {
  if (!payload || typeof payload !== "object") return null;
  const type = String(payload.type || payload.event_type || "").toLowerCase();
  const source = String(payload.source || payload.sender || payload.role || "").toLowerCase();

  if (
    source.includes("agent") ||
    source.includes("assistant") ||
    source.includes("cat") ||
    source.includes("ai") ||
    source.includes("model")
  ) {
    return "cat";
  }
  if (source.includes("user") || source.includes("human")) return "user";

  if (type.includes("assistant") || type.includes("agent") || type.includes("response")) {
    return "cat";
  }
  if (type.includes("user") || type.includes("transcript")) {
    return "user";
  }
  return null;
}

async function loadElevenLabsConversationSdk() {
  const localModuleName = "@elevenlabs/client";
  try {
    // Use a runtime string + vite-ignore so dev server doesn't fail if package is absent.
    return await import(/* @vite-ignore */ localModuleName);
  } catch (_localImportError) {
    try {
      return await import(/* @vite-ignore */ "https://esm.sh/@elevenlabs/client");
    } catch (_cdnImportError) {
      throw new Error(
        "Could not load ElevenLabs Conversation SDK. Install @elevenlabs/client or check network.",
      );
    }
  }
}

export default function TalkCat() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDay, toggleMode } = useTheme();
  const scrollRef = useRef(null);
  const audioRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const talkingVisualLoopRef = useRef(null);
  const conversationRef = useRef(null);
  const voiceModeRef = useRef("partial");
  const liveReconnectTimerRef = useRef(null);
  const liveReconnectAttemptRef = useRef(0);
  const liveManualOffRef = useRef(false);
  const isConnectingLiveRef = useRef(false);
  const activeAudioUrlRef = useRef("");
  const interruptedSpeakRef = useRef(false);

  const selectedCat =
    location.state?.selectedCat ||
    sessionStorage.getItem("activeSelectedCat") ||
    sessionStorage.getItem("selectedCatId") ||
    "";

  const selectedAction =
    location.state?.selectedAction ||
    sessionStorage.getItem("activeSelectedAction") ||
    "";

  const selectedCatId =
    typeof selectedCat === "string"
      ? selectedCat
      : selectedCat?.id || "";

  const selectedActionId =
    typeof selectedAction === "string"
      ? selectedAction
      : selectedAction?.id || "";
  
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
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isCatTalkingVisual, setIsCatTalkingVisual] = useState(false);
  const [idleTalkCatFrame, setIdleTalkCatFrame] = useState("");
  const [talkGifRunId, setTalkGifRunId] = useState(0);
  const [voiceMode, setVoiceMode] = useState("partial");
  const [isModeSwitching, setIsModeSwitching] = useState(false);
  const [webRtcStatus, setWebRtcStatus] = useState("off");
  const [isWebRtcMuted, setIsWebRtcMuted] = useState(false);

  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  useEffect(() => {
    try {
      sessionStorage.setItem("selectedCatId", cat.id);
    } catch (_storageError) {
      // Ignore storage errors.
    }
  }, [cat.id]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  function startTalkingVisual() {
    if (talkingVisualLoopRef.current) {
      window.clearInterval(talkingVisualLoopRef.current);
      talkingVisualLoopRef.current = null;
    }
    setTalkGifRunId((value) => value + 1);
    setIsCatTalkingVisual(true);

    // Some GIFs do not loop reliably across browsers, so force periodic restart.
    talkingVisualLoopRef.current = window.setInterval(() => {
      setTalkGifRunId((value) => value + 1);
    }, 1650);
  }

  function stopTalkingVisual() {
    if (talkingVisualLoopRef.current) {
      window.clearInterval(talkingVisualLoopRef.current);
      talkingVisualLoopRef.current = null;
    }
    setIsCatTalkingVisual(false);
  }

  function appendMessage(role, text) {
    const safeRole = role === "user" ? "user" : "cat";
    const safeText = String(text || "").trim();
    if (!safeText) return;

    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === safeRole && last?.text === safeText) return prev;
      return [
        ...prev,
        {
          id: `${safeRole}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: safeRole,
          text: safeText,
        },
      ];
    });
  }

  function cleanupPartialRecordingStream() {
    if (recordingTimerRef.current) {
      window.clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    chunksRef.current = [];
    recorderRef.current = null;
    setIsRecording(false);
    setIsTranscribing(false);
  }

  function stopLocalVoicePlayback() {
    interruptedSpeakRef.current = true;
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch (_error) {
        // Ignore pause errors.
      }
      audioRef.current = null;
    }
    if (activeAudioUrlRef.current) {
      URL.revokeObjectURL(activeAudioUrlRef.current);
      activeAudioUrlRef.current = "";
    }
    setIsSpeaking(false);
    stopTalkingVisual();
  }

  function clearLiveReconnectTimer() {
    if (liveReconnectTimerRef.current) {
      window.clearTimeout(liveReconnectTimerRef.current);
      liveReconnectTimerRef.current = null;
    }
  }

  async function disconnectWebRtcConversation({ manual = false } = {}) {
    if (manual) {
      liveManualOffRef.current = true;
      clearLiveReconnectTimer();
      liveReconnectAttemptRef.current = 0;
    }
    const conversation = conversationRef.current;
    conversationRef.current = null;
    if (conversation?.endSession) {
      try {
        await conversation.endSession();
      } catch (_error) {
        // Ignore end session errors.
      }
    }
    setWebRtcStatus("off");
    setIsWebRtcMuted(false);
    stopTalkingVisual();
  }

  function scheduleLiveReconnect(reason = "disconnect") {
    if (liveManualOffRef.current) return;
    if (voiceModeRef.current !== "webrtc") return;
    if (liveReconnectTimerRef.current || isConnectingLiveRef.current) return;

    const attempt = liveReconnectAttemptRef.current + 1;
    liveReconnectAttemptRef.current = attempt;
    const delay = Math.min(
      LIVE_RECONNECT_MAX_MS,
      LIVE_RECONNECT_BASE_MS * 2 ** Math.min(attempt - 1, 3),
    );
    setWebRtcStatus("reconnecting");

    liveReconnectTimerRef.current = window.setTimeout(async () => {
      liveReconnectTimerRef.current = null;
      if (liveManualOffRef.current || voiceModeRef.current !== "webrtc") return;
      try {
        await connectWebRtcConversation(`reconnect:${reason}:${attempt}`);
      } catch (error) {
        setError(error.message || "Live mode reconnect failed");
        scheduleLiveReconnect("retry");
      }
    }, delay);
  }

  async function connectWebRtcConversation(_reason = "manual") {
    if (isConnectingLiveRef.current) return;
    if (conversationRef.current) return;
    isConnectingLiveRef.current = true;
    const tokenPayload = await getTalkCatWebRtcToken();
    const token = String(tokenPayload?.token || "").trim();
    if (!token) {
      isConnectingLiveRef.current = false;
      throw new Error("Missing ElevenLabs conversation token.");
    }

    const sdk = await loadElevenLabsConversationSdk();
    const Conversation = sdk?.Conversation;
    if (!Conversation?.startSession) {
      isConnectingLiveRef.current = false;
      throw new Error("ElevenLabs Conversation SDK is unavailable.");
    }

    setWebRtcStatus("connecting");
    try {
      const conversation = await Conversation.startSession({
        conversationToken: token,
        connectionType: "webrtc",
        onConnect: () => {
          clearLiveReconnectTimer();
          liveReconnectAttemptRef.current = 0;
          setError("");
          setWebRtcStatus("on");
        },
        onDisconnect: () => {
          conversationRef.current = null;
          setIsWebRtcMuted(false);
          stopTalkingVisual();
          if (voiceModeRef.current === "webrtc" && !liveManualOffRef.current) {
            scheduleLiveReconnect("disconnect");
            return;
          }
          setWebRtcStatus("off");
        },
        onError: (sdkError) => {
          const message = String(sdkError?.message || sdkError || "").trim();
          if (message) setError(message);
        },
        onStatusChange: ({ status }) => {
          if (!status) return;
          const normalized = String(status).toLowerCase();
          if (normalized.includes("connect")) {
            setWebRtcStatus(normalized.includes("ed") ? "on" : "connecting");
            return;
          }
          if (normalized.includes("disconnect") || normalized.includes("ended")) {
            conversationRef.current = null;
            setIsWebRtcMuted(false);
            stopTalkingVisual();
            if (voiceModeRef.current === "webrtc" && !liveManualOffRef.current) {
              scheduleLiveReconnect(normalized);
              return;
            }
            setWebRtcStatus("off");
          }
        },
        onModeChange: ({ mode }) => {
          const normalized = String(mode || "").toLowerCase();
          if (normalized.includes("speak")) {
            startTalkingVisual();
          } else if (normalized.includes("listen") || normalized.includes("idle")) {
            stopTalkingVisual();
          }
        },
        onMessage: (payload) => {
          const type = String(payload?.type || payload?.event_type || "").toLowerCase();
          if (
            type.includes("agent") &&
            (type.includes("start") || type.includes("speaking") || type.includes("audio"))
          ) {
            startTalkingVisual();
          }
          if (
            type.includes("agent") &&
            (type.includes("end") || type.includes("done") || type.includes("stop"))
          ) {
            stopTalkingVisual();
          }

          const role = inferRealtimeRole(payload);
          const text = extractRealtimeText(payload);
          if (role && text) {
            appendMessage(role, text);
          }
        },
      });

      conversationRef.current = conversation;
    } finally {
      isConnectingLiveRef.current = false;
    }
  }

  async function toggleVoiceMode() {
    if (isModeSwitching) return;
    setError("");
    setIsModeSwitching(true);

    try {
      if (voiceMode === "partial") {
        stopLocalVoicePlayback();
        if (isRecording) cleanupPartialRecordingStream();
        liveManualOffRef.current = false;
        clearLiveReconnectTimer();
        liveReconnectAttemptRef.current = 0;
        await connectWebRtcConversation();
        setVoiceMode("webrtc");
        appendMessage("cat", "Live mode on. Speak naturally for real-time conversation.");
      } else {
        await disconnectWebRtcConversation({ manual: true });
        stopLocalVoicePlayback();
        setVoiceMode("partial");
        appendMessage("cat", "Switched back to push-to-talk mode.");
      }
    } catch (modeError) {
      await disconnectWebRtcConversation({ manual: true });
      setVoiceMode("partial");
      setError(modeError.message || "Could not switch voice mode");
    } finally {
      setIsModeSwitching(false);
    }
  }

  async function toggleWebRtcMute() {
    const conversation = conversationRef.current;
    if (!conversation?.setMicMuted) return;
    const nextMuted = !isWebRtcMuted;
    try {
      await conversation.setMicMuted(nextMuted);
      setIsWebRtcMuted(nextMuted);
    } catch (_error) {
      // Ignore mute API errors.
    }
  }

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
      stopLocalVoicePlayback();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      cleanupPartialRecordingStream();
      void disconnectWebRtcConversation({ manual: true });
      clearLiveReconnectTimer();
      stopTalkingVisual();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function speakText(text) {
    if (!text) return;

    interruptedSpeakRef.current = false;
    setIsSpeaking(true);
    stopTalkingVisual();
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
      activeAudioUrlRef.current = url;

      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => startTalkingVisual();
      audio.onpause = () => stopTalkingVisual();

      await new Promise((resolve, reject) => {
        let settled = false;
        const finalize = (handler) => {
          if (settled) return;
          settled = true;
          audio.onended = null;
          audio.onerror = null;
          audio.onpause = null;
          if (activeAudioUrlRef.current === url) {
            URL.revokeObjectURL(url);
            activeAudioUrlRef.current = "";
          }
          handler();
        };

        audio.onerror = () => {
          stopTalkingVisual();
          finalize(() => reject(new Error("Audio playback failed")));
        };
        audio.onended = () => {
          stopTalkingVisual();
          finalize(() => resolve());
        };
        audio.onpause = () => {
          stopTalkingVisual();
          if (interruptedSpeakRef.current) {
            finalize(() => resolve());
          }
        };
        audio
          .play()
          .then(() => {})
          .catch((error) => finalize(() => reject(error)));
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
    } finally {
      setIsSending(false);
    }
  }

  async function speakLatestCatReply() {
    const latestCat = [...messages].reverse().find((item) => item.role === "cat");
    if (!latestCat || isSpeaking || voiceMode !== "partial") return;
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
    if (voiceMode === "webrtc") {
      await toggleWebRtcMute();
      return;
    }

    if (isRecording) {
      await stopRecordingAndTranscribe();
      return;
    }

    if (!window.isSecureContext) {
      setError("Microphone requires HTTPS or http://localhost to work.");
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
      cleanupPartialRecordingStream();
    }
  }

  const catVisualSrc = isCatTalkingVisual
    ? `/talking_cat.gif?run=${talkGifRunId}`
    : idleTalkCatFrame;

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
      {/* <button
        onClick={toggleMode}
        className="fixed right-6 top-6 z-50 rounded-full border-2 border-primary/40 bg-white/90 p-2 text-slate-900 shadow hover:bg-white"
        title={isDay ? "Switch to dark mode" : "Switch to light mode"}
        aria-label="Toggle light/dark mode"
      >
        {isDay ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </button> */}
      <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-white/30 blur-2xl" />
      <div className="absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-primary/25 blur-2xl" />

      <div className="relative mx-auto flex h-full max-w-5xl flex-col rounded-[2.5rem] border-4 border-primary/40 bg-surface/40 p-5 shadow-2xl backdrop-blur-xl md:p-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => navigate("/session")}
            className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-primary/45 bg-primary px-4 font-card text-lg font-black tracking-tight text-white transition hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={toggleVoiceMode}
              disabled={isModeSwitching}
              className={`inline-flex h-11 items-center gap-2 rounded-xl border-2 px-4 font-card text-sm font-black tracking-tight transition ${
                voiceMode === "webrtc"
                  ? "border-emerald-500/60 bg-emerald-600 text-white hover:bg-emerald-700"
                  : "border-primary/45 bg-primary text-white hover:bg-accent"
              } ${isModeSwitching ? "cursor-not-allowed opacity-60" : ""}`}
            >
              {isModeSwitching
                ? "Switching..."
                : voiceMode === "webrtc"
                  ? "Live WebRTC: ON"
                  : "Live WebRTC: OFF"}
            </button>

            <button
              onClick={speakLatestCatReply}
              disabled={isSpeaking || voiceMode !== "partial"}
              className={`inline-flex h-11 items-center gap-2 rounded-xl border-2 px-4 font-card text-lg font-black tracking-tight transition ${
                isSpeaking || voiceMode !== "partial"
                  ? "cursor-not-allowed border-slate-300 bg-slate-200 text-slate-500"
                  : "border-primary/45 bg-primary text-white hover:bg-accent"
              }`}
            >
              <Volume2 className="h-5 w-5" />
              {isSpeaking ? "Speaking..." : "Speak Cat"}
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[180px_minmax(0,1fr)] gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="self-start rounded-2xl border-2 border-primary/35 bg-white/80 p-4 text-center">
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
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Mode:{" "}
              {voiceMode === "webrtc"
                ? `Live (${webRtcStatus})`
                : "Partial (push-to-talk)"}
            </p>
          </div>

          <div className="flex min-h-0 flex-col rounded-2xl border-2 border-primary/35 bg-white/85 p-4">
            <div className="relative min-h-0 flex-1">
              <div
                ref={scrollRef}
                className="h-full min-h-0 space-y-2 overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border-2 border-primary/30 bg-white/70 p-3"
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
            </div>

            <div className="mt-3 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={toggleVoiceInput}
                disabled={
                  voiceMode === "partial" &&
                  (isSending || isTranscribing || isModeSwitching)
                }
                className={`inline-flex h-14 min-w-14 items-center justify-center rounded-full border-2 px-4 transition ${
                  voiceMode === "webrtc"
                    ? isWebRtcMuted
                      ? "border-yellow-500 bg-yellow-500 text-white hover:bg-yellow-600"
                      : "border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-700"
                    : isRecording
                      ? "border-red-500 bg-red-500 text-white hover:bg-red-600"
                      : isSending || isTranscribing || isModeSwitching
                        ? "cursor-not-allowed border-slate-300 bg-slate-200 text-slate-500"
                        : "border-primary/45 bg-primary text-white hover:bg-accent"
                }`}
                title={
                  voiceMode === "webrtc"
                    ? isWebRtcMuted
                      ? "Unmute live microphone"
                      : "Mute live microphone"
                    : isRecording
                      ? "Stop and send voice"
                      : isTranscribing
                        ? "Transcribing..."
                        : "Click to talk"
                }
                aria-label={
                  voiceMode === "webrtc"
                    ? isWebRtcMuted
                      ? "Unmute live microphone"
                      : "Mute live microphone"
                    : isRecording
                      ? "Stop and send voice"
                      : isTranscribing
                        ? "Transcribing voice"
                        : "Click to talk"
                }
              >
                {voiceMode === "webrtc" ? (
                  <Mic className="h-5 w-5" />
                ) : isRecording ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </button>

              <p className="text-xs font-semibold text-slate-700">
                {voiceMode === "webrtc"
                  ? isWebRtcMuted
                    ? "Live mode muted"
                    : "Live mode active (continuous duplex audio)"
                  : isTranscribing
                    ? "Transcribing..."
                    : "Push-to-talk mode"}
              </p>
            </div>

            {error && (
              <p className="mt-2 rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>

      <DraggableCatOverlay
        selectedCatId={selectedCatId}
        selectedAction={selectedActionId}
        username={username}
        pomodoroStorageKey={getPomodoroStorageKey()}
      />
    </div>
  );
}
