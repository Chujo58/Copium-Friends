import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "0.0.0.0";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ELEVENLABS_VOICE_ID =
  process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
const ELEVENLABS_STT_MODEL = process.env.ELEVENLABS_STT_MODEL || "scribe_v1";
const ELEVENLABS_CONVAI_URL = "https://api.elevenlabs.io/v1/convai/conversation";
const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: {
    origin: true,
    credentials: true,
  },
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "25mb" }));

const servers = new Map();
const codeToServerId = new Map();
const socketPresence = new Map();
const flashcardDecksByUser = new Map();
const quizzesByUser = new Map();

function randomId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function createJoinCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  if (codeToServerId.has(code)) return createJoinCode();
  return code;
}

function normalizeName(value, fallback = "Guest") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeUsernameKey(username) {
  return normalizeName(username, "").toLowerCase();
}

function roomName(serverId) {
  return `server:${serverId}`;
}

function serializeMember(member) {
  return {
    id: member.id,
    username: member.username,
    online: Boolean(member.online),
    selectedCat: member.selectedCat || null,
    selectedAction: member.selectedAction || null,
    x: Number.isFinite(member.x) ? member.x : 80,
    y: Number.isFinite(member.y) ? member.y : 90,
    joinedAt: member.joinedAt,
    pomodoro: member.pomodoro || null,
  };
}

function serializeChatMessage(message) {
  return {
    id: message.id,
    memberId: message.memberId,
    username: message.username,
    text: message.text,
    createdAt: message.createdAt,
  };
}

function serializeServer(server) {
  const members = Array.from(server.members.values()).map(serializeMember);
  const chatMessages = Array.isArray(server.chatMessages)
    ? server.chatMessages.map(serializeChatMessage)
    : [];
  return {
    id: server.id,
    code: server.code,
    name: server.name,
    type: server.type,
    maxPlayers: server.maxPlayers,
    createdAt: server.createdAt,
    membersOnline: members.filter((member) => member.online).length,
    totalMembers: members.length,
    sharedOverlay: server.sharedOverlay || null,
    chatMessages,
    members,
  };
}

function createMember(server, username) {
  const member = {
    id: randomId("member"),
    username: normalizeName(username),
    online: false,
    socketId: null,
    selectedCat: null,
    selectedAction: null,
    x: 80,
    y: 90,
    pomodoro: null,
    joinedAt: Date.now(),
  };
  server.members.set(member.id, member);
  return member;
}

function normalizePomodoroState(payload = {}) {
  const phase = payload?.phase === "break" ? "break" : "focus";
  const isRunning = Boolean(payload?.isRunning);
  const rawSeconds = Number(payload?.secondsLeft);
  const secondsLeft = Number.isFinite(rawSeconds)
    ? Math.max(1, Math.min(60 * 60, Math.floor(rawSeconds)))
    : 25 * 60;
  const rawUpdatedAt = Number(payload?.updatedAt);
  const updatedAt = Number.isFinite(rawUpdatedAt) ? rawUpdatedAt : Date.now();
  return { phase, isRunning, secondsLeft, updatedAt };
}

function removeMemberFromServer(serverId, memberId) {
  const server = servers.get(serverId);
  if (!server) return false;
  return server.members.delete(memberId);
}

function isUsernameTaken(username, excludeMemberId = "") {
  const key = normalizeUsernameKey(username);
  if (!key) return false;
  for (const server of servers.values()) {
    for (const member of server.members.values()) {
      if (member.id === excludeMemberId) continue;
      if (normalizeUsernameKey(member.username) === key) return true;
    }
  }
  return false;
}

function safeCoordinate(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(5000, numeric));
}

function sanitizeConversationHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-12)
    .map((entry) => {
      const role = String(entry?.role || "user").toLowerCase();
      const text = String(entry?.text || "")
        .trim()
        .slice(0, 1000);
      if (!text) return null;
      return {
        role: role === "cat" || role === "model" ? "model" : "user",
        parts: [{ text }],
      };
    })
    .filter(Boolean);
}

function normalizeToolsArray(tools) {
  if (!Array.isArray(tools)) return [];
  return tools
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

function parseFlashcardDeckReply(payload, maxCards = 50) {
  const limit = Math.max(1, Math.min(50, Math.floor(Number(maxCards) || 10)));
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    const cards = Array.isArray(parsed?.cards)
      ? parsed.cards
          .map((card) => ({
            question: String(card?.question || "")
              .trim()
              .slice(0, 240),
            answer: String(card?.answer || "")
              .trim()
              .slice(0, 500),
          }))
          .filter((card) => card.question && card.answer)
          .slice(0, limit)
      : [];
    if (cards.length === 0) return null;
    return {
      deckTitle: String(parsed?.deckTitle || "")
        .trim()
        .slice(0, 80),
      cards,
    };
  } catch (_error) {
    return null;
  }
}

function normalizeCardCount(value, fallback = 10) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(50, Math.floor(numeric)));
}

function normalizeQuizType(value, fallback = "mcq") {
  const text = String(value || fallback)
    .trim()
    .toLowerCase();
  if (text === "mcq" || text === "short" || text === "long") return text;
  return fallback;
}

function normalizeQuestionCount(value, fallback = 10) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(50, Math.floor(numeric)));
}

function getUserDecks(username) {
  const key = normalizeUsernameKey(username) || "guest";
  if (!flashcardDecksByUser.has(key)) {
    flashcardDecksByUser.set(key, []);
  }
  return flashcardDecksByUser.get(key);
}

function serializeFlashcardDeck(deck) {
  return {
    id: deck.id,
    title: deck.title,
    prompt: deck.prompt,
    createdAt: deck.createdAt,
    cardCountTarget: normalizeCardCount(deck.cardCountTarget, deck.cards?.length || 10),
    cardsCount: Array.isArray(deck.cards) ? deck.cards.length : 0,
    cards: Array.isArray(deck.cards) ? deck.cards : [],
  };
}

function getUserQuizzes(username) {
  const key = normalizeUsernameKey(username) || "guest";
  if (!quizzesByUser.has(key)) {
    quizzesByUser.set(key, []);
  }
  return quizzesByUser.get(key);
}

function serializeQuizSummary(quiz) {
  return {
    id: quiz.id,
    title: quiz.title,
    prompt: quiz.prompt,
    type: quiz.type,
    createdAt: quiz.createdAt,
    questionCountTarget: normalizeQuestionCount(
      quiz.questionCountTarget,
      quiz.questions?.length || 10,
    ),
    questionsCount: Array.isArray(quiz.questions) ? quiz.questions.length : 0,
  };
}

function serializeQuiz(quiz) {
  return {
    ...serializeQuizSummary(quiz),
    questions: Array.isArray(quiz.questions) ? quiz.questions : [],
  };
}

function parseGeminiQuizReply(payload, quizType, maxQuestions = 10) {
  const type = normalizeQuizType(quizType, "mcq");
  const limit = normalizeQuestionCount(maxQuestions, 10);
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    const rawQuestions = Array.isArray(parsed?.questions) ? parsed.questions : [];
    const questions = rawQuestions
      .map((item) => {
        const questionLimit = type === "mcq" ? 180 : 400;
        const questionText = String(
          item?.questionText || item?.question || item?.prompt || "",
        )
          .trim()
          .slice(0, questionLimit);
        if (!questionText) return null;

        if (type === "mcq") {
          const options = Array.isArray(item?.options)
            ? item.options
                .map((value) => String(value || "").trim().slice(0, 90))
                .filter(Boolean)
            : [];
          if (options.length < 2) return null;
          const deduped = Array.from(new Set(options)).slice(0, 4);
          const normalizedOptions = deduped.length >= 2 ? deduped : options.slice(0, 2);
          const rawIndex = Number(item?.correctOptionIndex);
          const correctOptionIndex = Number.isFinite(rawIndex)
            ? Math.max(0, Math.min(normalizedOptions.length - 1, Math.floor(rawIndex)))
            : 0;
          return {
            id: randomId("quizq"),
            prompt: questionText,
            options: normalizedOptions,
            correctOptionIndex,
          };
        }

        const answerText = String(item?.answerText || item?.answer || "")
          .trim()
          .slice(0, 500);
        if (!answerText) return null;
        const rubricKeywords = Array.isArray(item?.rubricKeywords)
          ? item.rubricKeywords
              .map((keyword) => String(keyword || "").trim().toLowerCase().slice(0, 40))
              .filter(Boolean)
              .slice(0, 8)
          : [];
        return {
          id: randomId("quizq"),
          prompt: questionText,
          answerText,
          rubricKeywords,
        };
      })
      .filter(Boolean)
      .slice(0, limit);

    if (questions.length === 0) return null;

    return {
      title: String(parsed?.quizTitle || parsed?.title || "")
        .trim()
        .slice(0, 80),
      questions,
    };
  } catch (_error) {
    return null;
  }
}

async function requestGeminiQuiz({
  geminiKey,
  serverName,
  username,
  requestedTitle,
  prompt,
  type,
  questionCount,
}) {
  const quizType = normalizeQuizType(type, "mcq");
  const safeQuestionCount = normalizeQuestionCount(questionCount, 10);
  const typePromptMap = {
    mcq: "multiple choice questions with one clearly correct answer",
    short: "short-answer questions with concise expected answers",
    long: "long-answer or calculation-focused questions requiring deeper explanation",
  };
  const mcqFormattingRules =
    quizType === "mcq"
      ? [
          "For MCQ: keep each question concise (max ~20 words).",
          "For MCQ: each answer choice must be short (max ~8 words).",
          "For MCQ: avoid long sentence-style options.",
        ]
      : [];

  const systemPrompt = [
    "You are a study assistant that creates practical quizzes.",
    "Output ONLY valid JSON matching the response schema.",
    `Generate ${safeQuestionCount} ${typePromptMap[quizType]}.`,
    "Use clear wording and avoid duplicate questions.",
    ...mcqFormattingRules,
    `Server context: ${serverName}`,
    `User: ${username}`,
  ].join("\n");

  const userText = [
    requestedTitle ? `Title hint: ${requestedTitle}` : null,
    `Topic prompt: ${prompt}`,
    `Quiz type: ${quizType}`,
    `Question count: ${safeQuestionCount}`,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      GEMINI_MODEL,
    )}:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userText }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              quizTitle: { type: "STRING" },
              questions: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    questionText: { type: "STRING" },
                    options: {
                      type: "ARRAY",
                      items: { type: "STRING" },
                    },
                    correctOptionIndex: { type: "NUMBER" },
                    answerText: { type: "STRING" },
                    rubricKeywords: {
                      type: "ARRAY",
                      items: { type: "STRING" },
                    },
                  },
                  required: ["questionText"],
                },
              },
            },
            required: ["quizTitle", "questions"],
          },
        },
      }),
    },
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details =
      payload?.error?.message || payload?.error?.status || "Gemini request failed";
    return { ok: false, error: String(details) };
  }

  const parsed = parseGeminiQuizReply(payload, quizType, safeQuestionCount);
  if (!parsed) {
    return {
      ok: false,
      error: "Gemini returned an invalid quiz response",
    };
  }

  return {
    ok: true,
    title: parsed.title,
    questions: parsed.questions,
    type: quizType,
    questionCountTarget: safeQuestionCount,
  };
}

function normalizeComparableText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTokenSet(value) {
  const tokens = normalizeComparableText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
  return new Set(tokens);
}

function bigramDiceCoefficient(a, b) {
  const left = normalizeComparableText(a);
  const right = normalizeComparableText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;

  const leftMap = new Map();
  for (let i = 0; i < left.length - 1; i += 1) {
    const gram = left.slice(i, i + 2);
    leftMap.set(gram, (leftMap.get(gram) || 0) + 1);
  }

  let overlap = 0;
  for (let i = 0; i < right.length - 1; i += 1) {
    const gram = right.slice(i, i + 2);
    const count = leftMap.get(gram) || 0;
    if (count > 0) {
      overlap += 1;
      leftMap.set(gram, count - 1);
    }
  }

  const total = left.length - 1 + (right.length - 1);
  if (total <= 0) return 0;
  return (2 * overlap) / total;
}

function scoreFreeTextAnswer(userAnswer, expectedAnswer, rubricKeywords, quizType) {
  const userText = String(userAnswer || "").trim();
  const expectedText = String(expectedAnswer || "").trim();
  if (!userText) {
    return {
      points: 0,
      exact: false,
      almost: false,
      score: 0,
      feedback: "No answer submitted.",
    };
  }

  const userNorm = normalizeComparableText(userText);
  const expectedNorm = normalizeComparableText(expectedText);
  if (!expectedNorm) {
    return {
      points: 0,
      exact: false,
      almost: false,
      score: 0,
      feedback: "No reference answer configured.",
    };
  }

  const expectedTokens = toTokenSet(expectedText);
  const userTokens = toTokenSet(userText);
  const overlapCount = Array.from(expectedTokens).filter((token) =>
    userTokens.has(token),
  ).length;
  const overlapScore = expectedTokens.size
    ? overlapCount / expectedTokens.size
    : userNorm.includes(expectedNorm)
      ? 1
      : 0;

  const keywordList = Array.isArray(rubricKeywords)
    ? rubricKeywords
        .map((keyword) => normalizeComparableText(keyword))
        .filter(Boolean)
    : [];
  const keywordHits = keywordList.filter(
    (keyword) => keyword && userNorm.includes(keyword),
  ).length;
  const keywordScore = keywordList.length ? keywordHits / keywordList.length : overlapScore;
  const stringScore = bigramDiceCoefficient(userNorm, expectedNorm);

  const longAnswerPenalty =
    quizType === "long" && userNorm.length < 40
      ? Math.max(0.55, userNorm.length / 40)
      : 1;

  const blended =
    (0.45 * overlapScore + 0.35 * stringScore + 0.2 * keywordScore) * longAnswerPenalty;

  const exactMatch = userNorm === expectedNorm || userNorm.includes(expectedNorm);
  const score = Math.max(0, Math.min(1, exactMatch ? 1 : blended));

  const correctThreshold = quizType === "long" ? 0.55 : 0.62;
  const almostThreshold = quizType === "long" ? 0.38 : 0.44;

  if (score >= correctThreshold) {
    return {
      points: 1,
      exact: true,
      almost: false,
      score,
      feedback: "Correct answer.",
    };
  }
  if (score >= almostThreshold) {
    return {
      points: 0.5,
      exact: false,
      almost: true,
      score,
      feedback: "Almost correct. You have the main idea but missed some details.",
    };
  }
  return {
    points: 0,
    exact: false,
    almost: false,
    score,
    feedback: "Not quite correct yet. Review the expected answer and try again.",
  };
}

async function requestGeminiFlashcards({
  geminiKey,
  serverName,
  username,
  requestedTitle,
  prompt,
  cardCount,
}) {
  const safeCount = normalizeCardCount(cardCount, 10);
  const systemPrompt = [
    "You are a study assistant that creates high-quality flashcards.",
    "Output ONLY valid JSON matching the response schema.",
    "Create clear and concise cards with one fact/concept per card.",
    "Avoid duplicates and avoid cards that are too vague.",
    `Generate up to ${safeCount} cards.`,
    `Server context: ${serverName}`,
    `User: ${username}`,
  ].join("\n");

  const userText = requestedTitle
    ? `Deck title hint: ${requestedTitle}\nTopic prompt: ${prompt}\nTarget cards: ${safeCount}`
    : `Topic prompt: ${prompt}\nTarget cards: ${safeCount}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      GEMINI_MODEL,
    )}:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userText }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              deckTitle: { type: "STRING" },
              cards: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    question: { type: "STRING" },
                    answer: { type: "STRING" },
                  },
                  required: ["question", "answer"],
                },
              },
            },
            required: ["deckTitle", "cards"],
          },
        },
      }),
    },
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details =
      payload?.error?.message || payload?.error?.status || "Gemini request failed";
    return { ok: false, error: String(details) };
  }

  const parsed = parseFlashcardDeckReply(payload, safeCount);
  if (!parsed) {
    return {
      ok: false,
      error: "Gemini returned an invalid flashcard deck response",
    };
  }

  return {
    ok: true,
    deckTitle: parsed.deckTitle,
    cards: parsed.cards,
    cardCountTarget: safeCount,
  };
}

function parseGeminiStructuredReply(payload) {
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    const reply = String(parsed?.reply || "").trim();
    if (!reply) return null;
    return {
      reply,
      intent: String(parsed?.intent || "general").trim() || "general",
      tools: normalizeToolsArray(parsed?.tools),
    };
  } catch (_error) {
    return null;
  }
}

function broadcastMembers(serverId) {
  const server = servers.get(serverId);
  if (!server) return;
  io.to(roomName(serverId)).emit("server:members", {
    server: serializeServer(server),
  });
}

function markMemberOfflineBySocket(socketId) {
  const presence = socketPresence.get(socketId);
  if (!presence) return;
  const server = servers.get(presence.serverId);
  if (server) {
    const member = server.members.get(presence.memberId);
    if (member) {
      member.online = false;
      member.socketId = null;
    }
    broadcastMembers(presence.serverId);
  }
  socketPresence.delete(socketId);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, servers: servers.size });
});

app.get("/api/servers", (_req, res) => {
  const list = Array.from(servers.values()).map((server) => {
    const serialized = serializeServer(server);
    return {
      id: serialized.id,
      code: serialized.code,
      name: serialized.name,
      type: serialized.type,
      maxPlayers: serialized.maxPlayers,
      membersOnline: serialized.membersOnline,
      totalMembers: serialized.totalMembers,
      playersLabel: `${serialized.totalMembers}/${serialized.maxPlayers}`,
    };
  });
  res.json({ servers: list });
});

app.get("/api/servers/:serverId", (req, res) => {
  const server = servers.get(req.params.serverId);
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }
  res.json({ server: serializeServer(server) });
});

app.post("/api/servers", (req, res) => {
  const name = normalizeName(req.body?.name, "");
  const username = normalizeName(req.body?.username);
  if (!name) {
    res.status(400).json({ error: "Server name is required" });
    return;
  }
  if (isUsernameTaken(username)) {
    res.status(409).json({ error: "Username already taken. Choose another one." });
    return;
  }

  const requestedType = String(req.body?.type || "Public").toLowerCase();
  const type = requestedType === "private" ? "Private" : "Public";
  const requestedMax = Number(req.body?.maxPlayers || 12);
  const maxPlayers = Math.max(1, Math.min(12, Math.floor(requestedMax)));

  const id = randomId("server");
  const code = createJoinCode();
  const server = {
    id,
    code,
    name,
    type,
    maxPlayers,
    sharedOverlay: null,
    chatMessages: [],
    members: new Map(),
    createdAt: Date.now(),
  };

  const hostMember = createMember(server, username);
  servers.set(id, server);
  codeToServerId.set(code, id);

  res.status(201).json({
    server: serializeServer(server),
    member: serializeMember(hostMember),
  });
});

app.post("/api/servers/join", (req, res) => {
  const code = String(req.body?.code || "")
    .trim()
    .toUpperCase();
  const username = normalizeName(req.body?.username);
  if (!code) {
    res.status(400).json({ error: "Join code is required" });
    return;
  }
  if (isUsernameTaken(username)) {
    res.status(409).json({ error: "Username already taken. Choose another one." });
    return;
  }

  const serverId = codeToServerId.get(code);
  if (!serverId || !servers.has(serverId)) {
    res.status(404).json({ error: "Server code not found" });
    return;
  }

  const server = servers.get(serverId);
  if (server.members.size >= server.maxPlayers) {
    res.status(409).json({ error: "Server is full" });
    return;
  }

  const member = createMember(server, username);
  res.json({
    server: serializeServer(server),
    member: serializeMember(member),
  });
});

app.post("/api/servers/leave", (req, res) => {
  const serverId = String(req.body?.serverId || "").trim();
  const memberId = String(req.body?.memberId || "").trim();
  if (!serverId || !memberId) {
    res.status(400).json({ error: "serverId and memberId are required" });
    return;
  }

  const removed = removeMemberFromServer(serverId, memberId);
  if (!removed) {
    res.status(404).json({ error: "Member not found in server" });
    return;
  }

  broadcastMembers(serverId);
  res.json({ ok: true });
});

app.get("/api/flashcards/decks", (req, res) => {
  const username = normalizeName(req.query?.username, "Guest");
  const decks = getUserDecks(username)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(serializeFlashcardDeck);
  res.json({ decks });
});

app.get("/api/flashcards/decks/:deckId", (req, res) => {
  const deckId = String(req.params.deckId || "").trim();
  const username = normalizeName(req.query?.username, "Guest");
  if (!deckId) {
    res.status(400).json({ error: "deckId is required" });
    return;
  }

  const decks = getUserDecks(username);
  const deck = decks.find((item) => item.id === deckId);
  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  res.json({ deck: serializeFlashcardDeck(deck) });
});

app.post("/api/flashcards/decks", async (req, res) => {
  const username = normalizeName(req.body?.username, "Guest");
  const serverName = normalizeName(req.body?.serverName, "My Server");
  const requestedTitle = String(req.body?.title || "")
    .trim()
    .slice(0, 80);
  const prompt = String(req.body?.prompt || "")
    .trim()
    .slice(0, 1200);
  const cardCount = normalizeCardCount(req.body?.cardCount, 10);

  if (!prompt) {
    res.status(400).json({ error: "Prompt is required" });
    return;
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    res.status(503).json({
      error:
        "Missing GEMINI_API_KEY on backend. Add it to server environment variables.",
    });
    return;
  }

  try {
    const generated = await requestGeminiFlashcards({
      geminiKey,
      serverName,
      username,
      requestedTitle,
      prompt,
      cardCount,
    });
    if (!generated.ok) {
      res.status(502).json({ error: generated.error });
      return;
    }

    const deck = {
      id: randomId("deck"),
      title: requestedTitle || generated.deckTitle || "Untitled Deck",
      prompt,
      createdAt: Date.now(),
      cardCountTarget: generated.cardCountTarget,
      cards: generated.cards.map((card) => ({
        id: randomId("card"),
        question: card.question,
        answer: card.answer,
      })),
    };

    const decks = getUserDecks(username);
    decks.push(deck);
    if (decks.length > 60) {
      decks.splice(0, decks.length - 60);
    }

    res.status(201).json({ deck: serializeFlashcardDeck(deck) });
  } catch (error) {
    res.status(500).json({
      error: error.message || "Could not reach Gemini service",
    });
  }
});

app.post("/api/flashcards/decks/:deckId/regenerate", async (req, res) => {
  const deckId = String(req.params.deckId || "").trim();
  const username = normalizeName(req.body?.username, "Guest");
  const cardCount = normalizeCardCount(req.body?.cardCount, 10);
  if (!deckId) {
    res.status(400).json({ error: "deckId is required" });
    return;
  }

  const decks = getUserDecks(username);
  const deck = decks.find((item) => item.id === deckId);
  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    res.status(503).json({
      error:
        "Missing GEMINI_API_KEY on backend. Add it to server environment variables.",
    });
    return;
  }

  try {
    const generated = await requestGeminiFlashcards({
      geminiKey,
      serverName: normalizeName(req.body?.serverName, "My Server"),
      username,
      requestedTitle: deck.title,
      prompt: deck.prompt,
      cardCount,
    });
    if (!generated.ok) {
      res.status(502).json({ error: generated.error });
      return;
    }

    deck.cardCountTarget = generated.cardCountTarget;
    deck.cards = generated.cards.map((card) => ({
      id: randomId("card"),
      question: card.question,
      answer: card.answer,
    }));
    deck.updatedAt = Date.now();

    res.json({ deck: serializeFlashcardDeck(deck) });
  } catch (error) {
    res.status(500).json({
      error: error.message || "Could not reach Gemini service",
    });
  }
});

app.delete("/api/flashcards/decks/:deckId", (req, res) => {
  const deckId = String(req.params.deckId || "").trim();
  const username = normalizeName(req.query?.username || req.body?.username, "Guest");
  if (!deckId) {
    res.status(400).json({ error: "deckId is required" });
    return;
  }

  const decks = getUserDecks(username);
  const index = decks.findIndex((deck) => deck.id === deckId);
  if (index === -1) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  decks.splice(index, 1);
  res.json({ ok: true });
});

app.get("/api/quizzes", (req, res) => {
  const username = normalizeName(req.query?.username, "Guest");
  const quizzes = getUserQuizzes(username)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(serializeQuizSummary);
  res.json({ quizzes });
});

app.get("/api/quizzes/:quizId", (req, res) => {
  const quizId = String(req.params.quizId || "").trim();
  const username = normalizeName(req.query?.username, "Guest");
  if (!quizId) {
    res.status(400).json({ error: "quizId is required" });
    return;
  }

  const quizzes = getUserQuizzes(username);
  const quiz = quizzes.find((item) => item.id === quizId);
  if (!quiz) {
    res.status(404).json({ error: "Quiz not found" });
    return;
  }

  res.json({ quiz: serializeQuiz(quiz) });
});

app.post("/api/quizzes", async (req, res) => {
  const username = normalizeName(req.body?.username, "Guest");
  const serverName = normalizeName(req.body?.serverName, "My Server");
  const requestedTitle = String(req.body?.title || "")
    .trim()
    .slice(0, 80);
  const prompt = String(req.body?.prompt || "")
    .trim()
    .slice(0, 1200);
  const type = normalizeQuizType(req.body?.type, "mcq");
  const questionCount = normalizeQuestionCount(req.body?.questionCount, 10);

  if (!prompt) {
    res.status(400).json({ error: "Prompt is required" });
    return;
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    res.status(503).json({
      error:
        "Missing GEMINI_API_KEY on backend. Add it to server environment variables.",
    });
    return;
  }

  try {
    const generated = await requestGeminiQuiz({
      geminiKey,
      serverName,
      username,
      requestedTitle,
      prompt,
      type,
      questionCount,
    });
    if (!generated.ok) {
      res.status(502).json({ error: generated.error });
      return;
    }

    const quiz = {
      id: randomId("quiz"),
      title: requestedTitle || generated.title || "Untitled Quiz",
      prompt,
      type: generated.type,
      questionCountTarget: generated.questionCountTarget,
      createdAt: Date.now(),
      questions: generated.questions,
    };

    const quizzes = getUserQuizzes(username);
    quizzes.push(quiz);
    if (quizzes.length > 80) {
      quizzes.splice(0, quizzes.length - 80);
    }

    res.status(201).json({ quiz: serializeQuiz(quiz) });
  } catch (error) {
    res.status(500).json({
      error: error.message || "Could not reach Gemini service",
    });
  }
});

app.post("/api/quizzes/:quizId/submit", (req, res) => {
  const quizId = String(req.params.quizId || "").trim();
  const username = normalizeName(req.body?.username, "Guest");
  if (!quizId) {
    res.status(400).json({ error: "quizId is required" });
    return;
  }

  const quizzes = getUserQuizzes(username);
  const quiz = quizzes.find((item) => item.id === quizId);
  if (!quiz) {
    res.status(404).json({ error: "Quiz not found" });
    return;
  }

  const rawAnswers = req.body?.answers;
  const answerMap = new Map();
  if (Array.isArray(rawAnswers)) {
    rawAnswers.forEach((item) => {
      const questionId = String(item?.questionId || "").trim();
      if (!questionId) return;
      answerMap.set(questionId, item?.answer);
    });
  } else if (rawAnswers && typeof rawAnswers === "object") {
    Object.entries(rawAnswers).forEach(([questionId, answer]) => {
      if (!questionId) return;
      answerMap.set(String(questionId), answer);
    });
  }

  const quizType = normalizeQuizType(quiz.type, "mcq");
  const results = [];
  let totalScore = 0;
  const maxScore = Array.isArray(quiz.questions) ? quiz.questions.length : 0;

  (quiz.questions || []).forEach((question) => {
    const submitted = answerMap.get(question.id);
    if (quizType === "mcq") {
      const selectedIndex = Number(submitted);
      const expectedIndex = Number(question.correctOptionIndex);
      const isCorrect =
        Number.isFinite(selectedIndex) &&
        Number.isFinite(expectedIndex) &&
        selectedIndex === expectedIndex;
      const points = isCorrect ? 1 : 0;
      totalScore += points;
      results.push({
        questionId: question.id,
        points,
        maxPoints: 1,
        isCorrect,
        isAlmostCorrect: false,
        feedback: isCorrect
          ? "Correct answer."
          : "Incorrect. Check the correct option and try again.",
        submittedAnswer:
          Number.isFinite(selectedIndex) && Array.isArray(question.options)
            ? question.options[selectedIndex] || ""
            : "",
        correctAnswer:
          Array.isArray(question.options) &&
          Number.isFinite(expectedIndex) &&
          question.options[expectedIndex]
            ? question.options[expectedIndex]
            : "",
      });
      return;
    }

    const scored = scoreFreeTextAnswer(
      submitted,
      question.answerText,
      question.rubricKeywords,
      quizType,
    );
    totalScore += scored.points;
    results.push({
      questionId: question.id,
      points: scored.points,
      maxPoints: 1,
      isCorrect: scored.exact,
      isAlmostCorrect: scored.almost,
      feedback: scored.feedback,
      similarity: Number(scored.score.toFixed(3)),
      submittedAnswer: String(submitted || "").trim().slice(0, 1200),
      correctAnswer: String(question.answerText || ""),
    });
  });

  const percent = maxScore
    ? Math.max(0, Math.min(100, Math.round((totalScore / maxScore) * 100)))
    : 0;
  const label = percent >= 85 ? "Excellent" : percent >= 70 ? "Good" : percent >= 50 ? "Fair" : "Needs Review";

  res.json({
    score: {
      earned: Number(totalScore.toFixed(2)),
      max: maxScore,
      percent,
      label,
    },
    results,
    quiz: serializeQuiz(quiz),
  });
});

app.get("/api/talk-cat/webrtc-token", async (req, res) => {
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  const agentId = String(req.query?.agentId || process.env.ELEVENLABS_AGENT_ID || "").trim();

  if (!elevenKey) {
    res.status(503).json({
      error:
        "Missing ELEVENLABS_API_KEY on backend. Add it to server environment variables.",
    });
    return;
  }

  if (!agentId) {
    res.status(503).json({
      error:
        "Missing ELEVENLABS_AGENT_ID on backend. Set it in .env or pass ?agentId=...",
    });
    return;
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(
        agentId,
      )}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": elevenKey,
        },
      },
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detailMessage =
        payload?.detail?.message ||
        payload?.error?.message ||
        payload?.detail ||
        "ElevenLabs WebRTC token request failed";
      res.status(502).json({ error: String(detailMessage) });
      return;
    }

    const token = String(payload?.token || "").trim();
    if (!token) {
      res.status(502).json({ error: "No token returned by ElevenLabs" });
      return;
    }

    res.json({ token, agentId });
  } catch (error) {
    res.status(500).json({
      error: error.message || "Could not reach ElevenLabs token service",
    });
  }
});

app.post("/api/talk-cat/webrtc-connect", async (req, res) => {
  const token = String(req.body?.token || "").trim();
  const agentId = String(req.body?.agentId || process.env.ELEVENLABS_AGENT_ID || "").trim();
  const offerSdp = String(req.body?.offerSdp || "").trim();

  if (!token) {
    res.status(400).json({ error: "token is required" });
    return;
  }
  if (!agentId) {
    res.status(400).json({ error: "agentId is required" });
    return;
  }
  if (!offerSdp) {
    res.status(400).json({ error: "offerSdp is required" });
    return;
  }

  const attempts = [
    {
      url: `${ELEVENLABS_CONVAI_URL}?agent_id=${encodeURIComponent(agentId)}`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/sdp",
      },
    },
    {
      url: `${ELEVENLABS_CONVAI_URL}?agent_id=${encodeURIComponent(
        agentId,
      )}&token=${encodeURIComponent(token)}`,
      headers: {
        "Content-Type": "application/sdp",
      },
    },
  ];

  let lastError = "ElevenLabs WebRTC negotiation failed";
  try {
    for (const attempt of attempts) {
      const response = await fetch(attempt.url, {
        method: "POST",
        headers: attempt.headers,
        body: offerSdp,
      });

      const answerSdp = await response.text();
      if (response.ok && String(answerSdp).trim()) {
        res.json({ answerSdp });
        return;
      }

      lastError =
        String(answerSdp || "").trim() ||
        `${response.status} ${response.statusText}` ||
        lastError;
    }

    res.status(502).json({ error: lastError });
  } catch (error) {
    res.status(500).json({
      error: error.message || "Could not reach ElevenLabs WebRTC service",
    });
  }
});

app.post("/api/talk-cat/message", async (req, res) => {
  const message = String(req.body?.message || "")
    .trim()
    .slice(0, 1000);
  const serverName = normalizeName(req.body?.serverName, "My Server");
  const username = normalizeName(req.body?.username, "Guest");
  const catName = normalizeName(req.body?.catName, "Cat");
  const history = sanitizeConversationHistory(req.body?.history);

  if (!message) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    res.status(503).json({
      error:
        "Missing GEMINI_API_KEY on backend. Add it to server environment variables.",
    });
    return;
  }

  const systemPrompt = [
    `You are ${catName}, a friendly study cat companion in server "${serverName}".`,
    `User name: ${username}.`,
    "Reply briefly, warmly, and helpfully.",
    "Output ONLY valid JSON matching the schema.",
    "Always provide at least one concrete next action.",
  ].join("\n");

  const contents = [
    ...history,
    {
      role: "user",
      parts: [{ text: message }],
    },
  ];

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        GEMINI_MODEL,
      )}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents,
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                reply: { type: "STRING" },
                intent: { type: "STRING" },
                tools: {
                  type: "ARRAY",
                  items: { type: "STRING" },
                },
              },
              required: ["reply", "intent", "tools"],
            },
          },
        }),
      },
    );

    const payload = await response.json();
    if (!response.ok) {
      const details =
        payload?.error?.message || payload?.error?.status || "Gemini request failed";
      res.status(502).json({ error: details });
      return;
    }

    const parsed = parseGeminiStructuredReply(payload);
    if (!parsed) {
      res.status(502).json({
        error: "Gemini returned an invalid structured response",
      });
      return;
    }

    res.json(parsed);
  } catch (error) {
    res.status(500).json({
      error: error.message || "Could not reach Gemini service",
    });
  }
});

app.post("/api/talk-cat/tts", async (req, res) => {
  const text = String(req.body?.text || "")
    .trim()
    .slice(0, 1200);
  const voiceId = String(req.body?.voiceId || ELEVENLABS_VOICE_ID).trim();

  if (!text) {
    res.status(400).json({ error: "Text is required for TTS" });
    return;
  }

  const elevenKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenKey) {
    res.status(503).json({
      error:
        "Missing ELEVENLABS_API_KEY on backend. Add it to server environment variables.",
    });
    return;
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
        voiceId,
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": elevenKey,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.75,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      res.status(502).json({
        error: errorBody || "ElevenLabs TTS request failed",
      });
      return;
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    res.json({
      audioBase64: audioBuffer.toString("base64"),
      mimeType: "audio/mpeg",
    });
  } catch (error) {
    res.status(500).json({
      error: error.message || "Could not reach ElevenLabs service",
    });
  }
});

app.post("/api/talk-cat/stt", async (req, res) => {
  const audioBase64 = String(req.body?.audioBase64 || "").trim();
  const mimeType = String(req.body?.mimeType || "audio/webm").trim();
  const elevenKey = process.env.ELEVENLABS_API_KEY;

  if (!audioBase64) {
    res.status(400).json({ error: "audioBase64 is required" });
    return;
  }
  if (!elevenKey) {
    res.status(503).json({
      error:
        "Missing ELEVENLABS_API_KEY on backend. Add it to server environment variables.",
    });
    return;
  }

  try {
    const audioBuffer = Buffer.from(audioBase64, "base64");
    if (!audioBuffer.length) {
      res.status(400).json({ error: "Invalid audio payload" });
      return;
    }

    const extension = mimeType.includes("wav")
      ? "wav"
      : mimeType.includes("mpeg")
        ? "mp3"
        : "webm";

    const form = new FormData();
    form.append("model_id", ELEVENLABS_STT_MODEL);
    form.append(
      "file",
      new Blob([audioBuffer], { type: mimeType }),
      `recording.${extension}`,
    );

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": elevenKey,
      },
      body: form,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detailMessage =
        payload?.detail?.message ||
        payload?.error?.message ||
        payload?.detail ||
        "ElevenLabs STT request failed";
      res.status(502).json({ error: String(detailMessage) });
      return;
    }

    const text = String(payload?.text || payload?.transcript || "").trim();
    if (!text) {
      res.status(502).json({ error: "No transcript returned by ElevenLabs STT" });
      return;
    }

    res.json({ text });
  } catch (error) {
    res.status(500).json({
      error: error.message || "Could not reach ElevenLabs STT service",
    });
  }
});

io.on("connection", (socket) => {
  socket.on("server:subscribe", (payload = {}) => {
    const serverId = String(payload.serverId || "");
    const memberId = String(payload.memberId || "");
    const selectedCat = String(payload.selectedCat || "").trim();
    const selectedAction = String(payload.selectedAction || "").trim();
    const server = servers.get(serverId);

    if (!server) {
      socket.emit("server:error", { error: "Server not found" });
      return;
    }

    const member = server.members.get(memberId);
    if (!member) {
      socket.emit("server:error", { error: "Member not found in server" });
      return;
    }

    markMemberOfflineBySocket(socket.id);

    socket.join(roomName(serverId));
    socketPresence.set(socket.id, { serverId, memberId });
    member.online = true;
    member.socketId = socket.id;
    if (selectedCat) member.selectedCat = selectedCat;
    if (selectedAction) member.selectedAction = selectedAction;

    socket.emit("server:subscribed", {
      server: serializeServer(server),
      member: serializeMember(member),
    });
    broadcastMembers(serverId);
  });

  socket.on("server:move", (payload = {}) => {
    const presence = socketPresence.get(socket.id);
    if (!presence) return;
    const server = servers.get(presence.serverId);
    if (!server) return;
    const member = server.members.get(presence.memberId);
    if (!member) return;

    member.x = safeCoordinate(payload.x, member.x);
    member.y = safeCoordinate(payload.y, member.y);
    broadcastMembers(presence.serverId);
  });

  socket.on("server:overlay:set", (payload = {}, callback) => {
    const presence = socketPresence.get(socket.id);
    if (!presence) {
      if (typeof callback === "function") callback({ ok: false, error: "Not in a server" });
      return;
    }

    const server = servers.get(presence.serverId);
    if (!server) {
      if (typeof callback === "function") callback({ ok: false, error: "Server not found" });
      return;
    }

    const member = server.members.get(presence.memberId);
    if (!member) {
      if (typeof callback === "function") callback({ ok: false, error: "Member not found" });
      return;
    }

    const name = normalizeName(payload?.name, "Shared Link");
    const rawUrl = String(payload?.url || "").trim();
    let url = "";
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("Only http/https links are allowed");
      }
      url = parsed.toString();
    } catch (error) {
      if (typeof callback === "function") callback({ ok: false, error: "Invalid URL" });
      return;
    }

    server.sharedOverlay = {
      name,
      url,
      updatedBy: member.username,
      updatedAt: Date.now(),
    };
    broadcastMembers(presence.serverId);

    if (typeof callback === "function") {
      callback({ ok: true, sharedOverlay: server.sharedOverlay });
    }
  });

  socket.on("server:timer:update", (payload = {}) => {
    const presence = socketPresence.get(socket.id);
    if (!presence) return;
    const server = servers.get(presence.serverId);
    if (!server) return;
    const member = server.members.get(presence.memberId);
    if (!member) return;

    member.pomodoro = normalizePomodoroState(payload);
    broadcastMembers(presence.serverId);
  });

  socket.on("server:chat:send", (payload = {}, callback) => {
    const presence = socketPresence.get(socket.id);
    if (!presence) {
      if (typeof callback === "function") callback({ ok: false, error: "Not in a server" });
      return;
    }

    const server = servers.get(presence.serverId);
    if (!server) {
      if (typeof callback === "function") callback({ ok: false, error: "Server not found" });
      return;
    }

    const member = server.members.get(presence.memberId);
    if (!member) {
      if (typeof callback === "function") callback({ ok: false, error: "Member not found" });
      return;
    }

    const text = String(payload?.text || "").trim();
    if (!text) {
      if (typeof callback === "function") callback({ ok: false, error: "Message is empty" });
      return;
    }

    const message = {
      id: randomId("chat"),
      memberId: member.id,
      username: member.username,
      text: text.slice(0, 400),
      createdAt: Date.now(),
    };

    if (!Array.isArray(server.chatMessages)) {
      server.chatMessages = [];
    }
    server.chatMessages.push(message);
    if (server.chatMessages.length > 200) {
      server.chatMessages.splice(0, server.chatMessages.length - 200);
    }

    io.to(roomName(presence.serverId)).emit("server:chat:message", {
      message: serializeChatMessage(message),
    });

    if (typeof callback === "function") {
      callback({ ok: true, message: serializeChatMessage(message) });
    }
  });

  socket.on("server:leave", (_payload = {}, callback) => {
    const presence = socketPresence.get(socket.id);
    if (!presence) {
      if (typeof callback === "function") callback({ ok: true });
      return;
    }

    const { serverId, memberId } = presence;
    socket.leave(roomName(serverId));
    socketPresence.delete(socket.id);
    removeMemberFromServer(serverId, memberId);
    broadcastMembers(serverId);

    if (typeof callback === "function") callback({ ok: true });
  });

  socket.on("server:unsubscribe", () => {
    markMemberOfflineBySocket(socket.id);
  });

  socket.on("disconnect", () => {
    markMemberOfflineBySocket(socket.id);
  });
});

httpServer.listen(PORT, HOST, () => {
  console.log(`Backend running on http://${HOST}:${PORT}`);
});
