import { DEMO_QUESTION, PROCEDURE_LIBRARY } from "./web-content.js";

const STORAGE_KEYS = {
  sessions: "ss-web-sessions-v2",
  activeSessionId: "ss-web-active-session-v2",
  dossiers: "ss-web-dossiers-v2",
  activeDossierId: "ss-web-active-dossier-v2",
};

const state = {
  sessions: loadJson(STORAGE_KEYS.sessions, []),
  activeSessionId: localStorage.getItem(STORAGE_KEYS.activeSessionId),
  dossiers: loadJson(STORAGE_KEYS.dossiers, []),
  activeDossierId: localStorage.getItem(STORAGE_KEYS.activeDossierId),
  pending: false,
  syncDossierOnNextAnswer: false,
  selectedMessageId: null,
};

const elements = {
  healthPill: document.querySelector("#health-pill"),
  procedureList: document.querySelector("#procedure-list"),
  sessionList: document.querySelector("#session-list"),
  promptRow: document.querySelector("#prompt-row"),
  messageStream: document.querySelector("#message-stream"),
  conversationTitle: document.querySelector("#conversation-title"),
  activeProcedureChip: document.querySelector("#active-procedure-chip"),
  chatForm: document.querySelector("#chat-form"),
  chatInput: document.querySelector("#chat-input"),
  newSessionButton: document.querySelector("#new-session-btn"),
  newSessionSideButton: document.querySelector("#new-session-side-btn"),
  demoQuestionButton: document.querySelector("#demo-question-btn"),
  dossierForm: document.querySelector("#dossier-form"),
  dossierProcedure: document.querySelector("#dossier-procedure"),
  dossierGoal: document.querySelector("#dossier-goal"),
  dossierSituation: document.querySelector("#dossier-situation"),
  dossierDocuments: document.querySelector("#dossier-documents"),
  dossierNotes: document.querySelector("#dossier-notes"),
  saveDossierButton: document.querySelector("#save-dossier-btn"),
  newDossierButton: document.querySelector("#new-dossier-btn"),
  checklistList: document.querySelector("#checklist-list"),
  checklistEmpty: document.querySelector("#checklist-empty"),
  dossierList: document.querySelector("#dossier-list"),
  dossierCount: document.querySelector("#dossier-count"),
  insightStatusPill: document.querySelector("#insight-status-pill"),
  insightSourceCount: document.querySelector("#insight-source-count"),
  insightPointCount: document.querySelector("#insight-point-count"),
  insightChecklistProgress: document.querySelector("#insight-checklist-progress"),
  insightSummary: document.querySelector("#insight-summary"),
  insightBody: document.querySelector("#insight-body"),
  insightPoints: document.querySelector("#insight-points"),
  insightSources: document.querySelector("#insight-sources"),
  insightEmpty: document.querySelector("#insight-empty"),
  insightNotesButton: document.querySelector("#insight-notes-btn"),
  insightChecklistButton: document.querySelector("#insight-checklist-btn"),
  dossierLastSummary: document.querySelector("#dossier-last-summary"),
  dossierSourceTotal: document.querySelector("#dossier-source-total"),
  dossierUpdatedAt: document.querySelector("#dossier-updated-at"),
  procedureTemplate: document.querySelector("#procedure-template"),
  sessionItemTemplate: document.querySelector("#session-item-template"),
  promptChipTemplate: document.querySelector("#prompt-chip-template"),
  messageTemplate: document.querySelector("#message-template"),
  checklistItemTemplate: document.querySelector("#checklist-item-template"),
  dossierItemTemplate: document.querySelector("#dossier-item-template"),
};

bootstrap();

function bootstrap() {
  seedProcedureOptions();

  if (!state.sessions.length) {
    const session = createSession();
    state.sessions.unshift(session);
    state.activeSessionId = session.id;
  }

  if (!state.activeSessionId || !state.sessions.some((session) => session.id === state.activeSessionId)) {
    state.activeSessionId = state.sessions[0]?.id ?? createSession().id;
  }

  if (!state.dossiers.length) {
    const dossier = createDossier(PROCEDURE_LIBRARY[0].id);
    state.dossiers.unshift(dossier);
    state.activeDossierId = dossier.id;
  }

  if (!state.activeDossierId || !state.dossiers.some((dossier) => dossier.id === state.activeDossierId)) {
    state.activeDossierId = state.dossiers[0]?.id ?? null;
  }

  persistSessions();
  persistDossiers();
  wireEvents();
  syncDossierForm();
  syncSelectedMessage();
  renderAll();
  loadHealth();
}

function wireEvents() {
  elements.chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = elements.chatInput.value.trim();

    if (!question || state.pending) {
      return;
    }

    elements.chatInput.value = "";
    state.syncDossierOnNextAnswer = false;
    await submitQuestion(question);
  });

  elements.newSessionButton.addEventListener("click", () => {
    startFreshSession();
  });

  elements.newSessionSideButton.addEventListener("click", () => {
    startFreshSession();
  });

  elements.demoQuestionButton.addEventListener("click", async () => {
    await submitQuestion(DEMO_QUESTION);
  });

  elements.procedureList.addEventListener("click", async (event) => {
    const card = event.target.closest(".procedure-card");
    if (!card || state.pending) {
      return;
    }

    await applyProcedurePreset(card.dataset.procedureId, true);
  });

  elements.promptRow.addEventListener("click", async (event) => {
    const chip = event.target.closest(".prompt-chip");
    if (!chip || state.pending) {
      return;
    }

    const prompt = chip.dataset.prompt;
    if (!prompt) {
      return;
    }

    state.syncDossierOnNextAnswer = true;
    await submitQuestion(prompt);
  });

  elements.dossierProcedure.addEventListener("change", () => {
    void applyProcedurePreset(elements.dossierProcedure.value, false);
  });

  elements.dossierForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (state.pending) {
      return;
    }

    saveActiveDossier();
    state.syncDossierOnNextAnswer = true;
    await submitQuestion(buildDossierPrompt());
  });

  elements.saveDossierButton.addEventListener("click", () => {
    saveActiveDossier();
  });

  elements.newDossierButton.addEventListener("click", () => {
    startFreshDossier();
  });

  elements.insightChecklistButton.addEventListener("click", () => {
    const message = getSelectedAssistantMessage();
    if (!message) {
      return;
    }

    syncAssistantMessageToDossier(message, {
      replaceChecklist: true,
      appendNotes: false,
    });
  });

  elements.insightNotesButton.addEventListener("click", () => {
    const message = getSelectedAssistantMessage();
    if (!message) {
      return;
    }

    syncAssistantMessageToDossier(message, {
      replaceChecklist: false,
      appendNotes: true,
    });
  });
}

function loadJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function createSession() {
  return {
    id: crypto.randomUUID(),
    title: "Nueva conversacion",
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

function createDossier(procedureId) {
  const procedure = getProcedure(procedureId) ?? PROCEDURE_LIBRARY[0];

  return {
    id: crypto.randomUUID(),
    procedureId: procedure.id,
    goal: procedure.goal,
    situation: procedure.defaultSituation,
    documents: "",
    notes: "",
    checklist: [],
    lastSummary: "",
    sources: [],
    updatedAt: new Date().toISOString(),
  };
}

function getProcedure(procedureId) {
  return PROCEDURE_LIBRARY.find((procedure) => procedure.id === procedureId);
}

function getActiveSession() {
  return state.sessions.find((session) => session.id === state.activeSessionId);
}

function getActiveDossier() {
  return state.dossiers.find((dossier) => dossier.id === state.activeDossierId);
}

function getAssistantMessages(session = getActiveSession()) {
  return (session?.messages ?? []).filter((message) => message.role === "assistant");
}

function getLatestAssistantMessage(session = getActiveSession()) {
  return getAssistantMessages(session).at(-1) ?? null;
}

function getSelectedAssistantMessage() {
  const session = getActiveSession();
  if (!session) {
    return null;
  }

  const selected = session.messages.find(
    (message) => message.id === state.selectedMessageId && message.role === "assistant",
  );

  return selected ?? getLatestAssistantMessage(session);
}

function syncSelectedMessage() {
  state.selectedMessageId = getLatestAssistantMessage()?.id ?? null;
}

function persistSessions() {
  localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(state.sessions));
  localStorage.setItem(STORAGE_KEYS.activeSessionId, state.activeSessionId ?? "");
}

function persistDossiers() {
  localStorage.setItem(STORAGE_KEYS.dossiers, JSON.stringify(state.dossiers));
  localStorage.setItem(STORAGE_KEYS.activeDossierId, state.activeDossierId ?? "");
}

function seedProcedureOptions() {
  elements.dossierProcedure.innerHTML = "";

  for (const procedure of PROCEDURE_LIBRARY) {
    const option = document.createElement("option");
    option.value = procedure.id;
    option.textContent = procedure.label;
    elements.dossierProcedure.appendChild(option);
  }
}

async function applyProcedurePreset(procedureId, shouldAskExampleQuestion) {
  const procedure = getProcedure(procedureId);
  if (!procedure) {
    return;
  }

  let dossier = getActiveDossier();
  if (!dossier) {
    dossier = createDossier(procedureId);
    state.dossiers.unshift(dossier);
    state.activeDossierId = dossier.id;
  }

  dossier.procedureId = procedure.id;
  dossier.goal = procedure.goal;
  dossier.situation = procedure.defaultSituation;
  dossier.updatedAt = new Date().toISOString();

  persistDossiers();
  syncDossierForm();
  renderAll();

  if (shouldAskExampleQuestion) {
    state.syncDossierOnNextAnswer = true;
    await submitQuestion(procedure.exampleQuestion);
  }
}

function startFreshSession() {
  const session = createSession();
  state.sessions.unshift(session);
  state.activeSessionId = session.id;
  state.selectedMessageId = null;
  persistSessions();
  renderAll();
}

function startFreshDossier() {
  const procedureId = elements.dossierProcedure.value || getActiveDossier()?.procedureId || PROCEDURE_LIBRARY[0].id;
  const dossier = createDossier(procedureId);

  state.dossiers.unshift(dossier);
  state.activeDossierId = dossier.id;
  persistDossiers();
  syncDossierForm();
  renderAll();
}

function buildDossierPrompt() {
  const procedure = getProcedure(elements.dossierProcedure.value);
  const goal = elements.dossierGoal.value;
  const situation = elements.dossierSituation.value.trim();
  const documents = elements.dossierDocuments.value.trim();
  const notes = elements.dossierNotes.value.trim();

  return [
    `Estoy preparando un expediente sobre ${procedure?.label ?? "un tramite de Seguridad Social"}.`,
    `Quiero ayuda enfocada en ${goal}.`,
    situation ? `Mi situacion actual es: ${situation}.` : "",
    documents ? `Documentos o datos ya disponibles: ${documents}.` : "",
    notes ? `Notas o dudas que quiero resolver: ${notes}.` : "",
    "Dame una respuesta operativa con resumen, puntos clave y un checklist corto de proximos pasos o documentacion habitual.",
  ]
    .filter(Boolean)
    .join(" ");
}

function saveActiveDossier() {
  const dossier = getActiveDossier();
  const procedure = getProcedure(elements.dossierProcedure.value) ?? PROCEDURE_LIBRARY[0];
  if (!dossier) {
    return;
  }

  dossier.procedureId = procedure.id;
  dossier.goal = elements.dossierGoal.value;
  dossier.situation = elements.dossierSituation.value.trim();
  dossier.documents = elements.dossierDocuments.value.trim();
  dossier.notes = elements.dossierNotes.value.trim();
  dossier.updatedAt = new Date().toISOString();

  persistDossiers();
  renderDossiers();
  renderDossierSnapshot();
}

function syncDossierForm() {
  const dossier = getActiveDossier();
  const procedure = getProcedure(dossier?.procedureId) ?? PROCEDURE_LIBRARY[0];

  elements.dossierProcedure.value = procedure.id;
  elements.dossierGoal.value = dossier?.goal ?? procedure.goal;
  elements.dossierSituation.value = dossier?.situation ?? procedure.defaultSituation;
  elements.dossierDocuments.value = dossier?.documents ?? "";
  elements.dossierNotes.value = dossier?.notes ?? "";
}

async function submitQuestion(question) {
  const session = getActiveSession();
  if (!session) {
    return;
  }

  state.pending = true;

  const userMessage = {
    id: crypto.randomUUID(),
    role: "user",
    text: question,
    summary: question,
    keyPoints: [],
    sources: [],
    legalNotice: "",
    createdAt: new Date().toISOString(),
  };

  session.messages.push(userMessage);
  if (session.title === "Nueva conversacion") {
    session.title = shorten(question, 52);
  }
  session.updatedAt = new Date().toISOString();
  persistSessions();
  renderAll();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ question }),
    });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "No se pudo generar la respuesta.");
    }

    const answer = payload.answer;
    const assistantMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      text: answer.text,
      summary: answer.summary,
      keyPoints: Array.isArray(answer.keyPoints) ? answer.keyPoints : [],
      sources: Array.isArray(answer.sources) ? answer.sources : [],
      legalNotice: answer.legalNotice ?? "",
      createdAt: new Date().toISOString(),
    };

    session.messages.push(assistantMessage);
    session.updatedAt = new Date().toISOString();
    state.selectedMessageId = assistantMessage.id;

    if (state.syncDossierOnNextAnswer) {
      hydrateActiveDossierFromAnswer(question, assistantMessage);
    }

    state.syncDossierOnNextAnswer = false;
    persistSessions();
    persistDossiers();
    renderAll();
  } catch (error) {
    const fallbackMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      text: "No se pudo completar la consulta en este momento. Intentalo de nuevo en unos segundos.",
      summary: "No se pudo completar la consulta en este momento.",
      keyPoints: [],
      sources: [],
      legalNotice: "",
      createdAt: new Date().toISOString(),
    };

    session.messages.push(fallbackMessage);
    session.updatedAt = new Date().toISOString();
    state.selectedMessageId = fallbackMessage.id;
    state.syncDossierOnNextAnswer = false;
    persistSessions();
    renderAll();
    console.error(error);
  } finally {
    state.pending = false;
  }
}

function hydrateActiveDossierFromAnswer(question, answer) {
  syncAssistantMessageToDossier(answer, {
    replaceChecklist: true,
    appendNotes: false,
  });

  const dossier = getActiveDossier();
  if (!dossier) {
    return;
  }

  dossier.notes = [dossier.notes, `Ultima consulta: ${question}`].filter(Boolean).join("\n");
  dossier.updatedAt = new Date().toISOString();
}

function syncAssistantMessageToDossier(message, options) {
  const dossier = getActiveDossier();
  if (!dossier || !message) {
    return;
  }

  dossier.lastSummary = message.summary || shorten(extractAssistantBody(message.text), 160);
  dossier.sources = Array.isArray(message.sources) ? message.sources : [];

  if (options.replaceChecklist && Array.isArray(message.keyPoints) && message.keyPoints.length > 0) {
    const previousState = new Map(
      (dossier.checklist ?? []).map((item) => [item.text.trim().toLowerCase(), Boolean(item.done)]),
    );

    dossier.checklist = message.keyPoints.map((item) => ({
      id: crypto.randomUUID(),
      text: item,
      done: previousState.get(item.trim().toLowerCase()) ?? false,
    }));
  }

  if (options.appendNotes) {
    dossier.notes = [dossier.notes, buildNoteFromMessage(message)].filter(Boolean).join("\n\n");
    elements.dossierNotes.value = dossier.notes;
  }

  dossier.updatedAt = new Date().toISOString();
  persistDossiers();
  renderAll();
}

function buildNoteFromMessage(message) {
  const noteLines = [
    `Resumen vinculado: ${message.summary || shorten(extractAssistantBody(message.text), 160)}`,
    ...(Array.isArray(message.keyPoints) ? message.keyPoints.slice(0, 4).map((point) => `- ${point}`) : []),
  ];

  return noteLines.join("\n");
}

function renderAll() {
  renderProcedures();
  renderPromptRow();
  renderSessions();
  renderMessages();
  renderInsightPanel();
  renderDossierSnapshot();
  renderChecklist();
  renderDossiers();
  renderActiveProcedureChip();
}

function renderProcedures() {
  elements.procedureList.innerHTML = "";

  for (const procedure of PROCEDURE_LIBRARY) {
    const card = elements.procedureTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.procedureId = procedure.id;
    card.querySelector(".procedure-tag").textContent = procedure.shortLabel;
    card.querySelector(".procedure-title").textContent = procedure.label;
    card.querySelector(".procedure-copy").textContent = procedure.summary;

    if (getActiveDossier()?.procedureId === procedure.id) {
      card.classList.add("active");
    }

    elements.procedureList.appendChild(card);
  }
}

function renderPromptRow() {
  const procedure = getProcedure(getActiveDossier()?.procedureId) ?? PROCEDURE_LIBRARY[0];
  elements.promptRow.innerHTML = "";

  for (const prompt of procedure.promptSeeds) {
    const chip = elements.promptChipTemplate.content.firstElementChild.cloneNode(true);
    chip.textContent = prompt;
    chip.dataset.prompt = prompt;
    elements.promptRow.appendChild(chip);
  }
}

function renderSessions() {
  elements.sessionList.innerHTML = "";
  const sortedSessions = [...state.sessions].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  for (const session of sortedSessions) {
    const item = elements.sessionItemTemplate.content.firstElementChild.cloneNode(true);
    item.querySelector(".session-title").textContent = session.title;
    item.querySelector(".session-time").textContent = formatRelative(session.updatedAt);

    if (session.id === state.activeSessionId) {
      item.classList.add("active");
    }

    item.addEventListener("click", () => {
      state.activeSessionId = session.id;
      syncSelectedMessage();
      persistSessions();
      renderAll();
    });

    elements.sessionList.appendChild(item);
  }
}

function renderMessages() {
  const session = getActiveSession();
  elements.messageStream.innerHTML = "";

  if (!session || !session.messages.length) {
    elements.conversationTitle.textContent = "Nueva conversacion";
    renderEmptyMessageState();
    return;
  }

  elements.conversationTitle.textContent = session.title;

  for (const message of session.messages) {
    const card = elements.messageTemplate.content.firstElementChild.cloneNode(true);
    const pointsList = card.querySelector(".message-points");
    const sourcesContainer = card.querySelector(".message-sources");

    card.classList.add(message.role === "assistant" ? "assistant-card" : "user-card");
    card.querySelector(".message-role").textContent = message.role === "assistant" ? "Asistente" : "Tu";
    card.querySelector(".message-summary").textContent = message.summary || shorten(message.text, 120);
    card.querySelector(".message-body").textContent = message.role === "assistant" ? compactBody(message.text) : message.text;
    card.querySelector(".message-legal").textContent = message.role === "assistant" ? message.legalNotice : "";

    if (message.role === "assistant") {
      card.classList.add("selectable-message");

      if (message.id === state.selectedMessageId) {
        card.classList.add("active");
      }

      card.tabIndex = 0;
      card.addEventListener("click", () => {
        state.selectedMessageId = message.id;
        renderMessages();
        renderInsightPanel();
      });
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          state.selectedMessageId = message.id;
          renderMessages();
          renderInsightPanel();
        }
      });
    }

    if (Array.isArray(message.keyPoints) && message.keyPoints.length > 0) {
      pointsList.innerHTML = "";
      for (const point of message.keyPoints) {
        const item = document.createElement("li");
        item.textContent = point;
        pointsList.appendChild(item);
      }
    } else {
      pointsList.remove();
    }

    if (Array.isArray(message.sources) && message.sources.length > 0) {
      sourcesContainer.innerHTML = "";
      for (const source of message.sources) {
        const link = document.createElement("a");
        link.className = "source-link";
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = source.title;
        sourcesContainer.appendChild(link);
      }
    } else {
      sourcesContainer.remove();
    }

    if (!message.legalNotice || message.role !== "assistant") {
      card.querySelector(".message-legal").remove();
    }

    elements.messageStream.appendChild(card);
  }

  elements.messageStream.scrollTop = elements.messageStream.scrollHeight;
}

function renderEmptyMessageState() {
  const card = document.createElement("article");
  card.className = "message-card assistant-card";
  card.innerHTML = [
    '<p class="message-role">Asistente</p>',
    '<h3 class="message-summary">Empieza con una duda concreta.</h3>',
    '<p class="message-body">Ejemplo: que documentacion necesito para solicitar la jubilacion anticipada, como pedir una prestacion por viudedad o como rellenar una solicitud.</p>',
  ].join("");
  elements.messageStream.appendChild(card);
}

function renderInsightPanel() {
  const message = getSelectedAssistantMessage();
  const dossier = getActiveDossier();
  const checklist = dossier?.checklist ?? [];
  const completedChecklist = checklist.filter((item) => item.done).length;

  elements.insightChecklistProgress.textContent = `${completedChecklist}/${checklist.length}`;
  elements.insightChecklistButton.disabled = !message;
  elements.insightNotesButton.disabled = !message;

  if (!message) {
    elements.insightStatusPill.textContent = "Sin respuesta";
    elements.insightSourceCount.textContent = "0";
    elements.insightPointCount.textContent = "0";
    elements.insightSummary.textContent =
      "Selecciona una respuesta del chat para convertirla en un resumen operativo del expediente.";
    elements.insightBody.textContent = "";
    elements.insightPoints.innerHTML = "";
    elements.insightSources.innerHTML = "";
    elements.insightEmpty.hidden = false;
    return;
  }

  elements.insightStatusPill.textContent = "Respuesta seleccionada";
  elements.insightSourceCount.textContent = String(message.sources?.length ?? 0);
  elements.insightPointCount.textContent = String(message.keyPoints?.length ?? 0);
  elements.insightSummary.textContent = message.summary || "Respuesta disponible para trabajar el expediente.";
  elements.insightBody.textContent = shorten(extractAssistantBody(message.text), 420);
  elements.insightPoints.innerHTML = "";
  elements.insightSources.innerHTML = "";
  elements.insightEmpty.hidden = true;

  for (const point of message.keyPoints ?? []) {
    const pill = document.createElement("span");
    pill.className = "insight-pill";
    pill.textContent = point;
    elements.insightPoints.appendChild(pill);
  }

  for (const source of message.sources ?? []) {
    const link = document.createElement("a");
    link.className = "source-link";
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = source.title;
    elements.insightSources.appendChild(link);
  }
}

function renderDossierSnapshot() {
  const dossier = getActiveDossier();

  elements.dossierLastSummary.textContent = dossier?.lastSummary
    ? shorten(dossier.lastSummary, 80)
    : "Sin resumen todavia";
  elements.dossierSourceTotal.textContent = String(dossier?.sources?.length ?? 0);
  elements.dossierUpdatedAt.textContent = dossier ? formatRelative(dossier.updatedAt) : "ahora";
}

function renderChecklist() {
  const dossier = getActiveDossier();
  const checklist = dossier?.checklist ?? [];

  elements.checklistList.innerHTML = "";
  elements.checklistEmpty.hidden = checklist.length > 0;

  for (const item of checklist) {
    const row = elements.checklistItemTemplate.content.firstElementChild.cloneNode(true);
    const checkbox = row.querySelector(".checklist-checkbox");
    const text = row.querySelector(".checklist-text");

    checkbox.checked = Boolean(item.done);
    text.textContent = item.text;

    checkbox.addEventListener("change", () => {
      item.done = checkbox.checked;
      if (dossier) {
        dossier.updatedAt = new Date().toISOString();
      }
      persistDossiers();
      renderDossiers();
      renderInsightPanel();
      renderDossierSnapshot();
    });

    elements.checklistList.appendChild(row);
  }
}

function renderDossiers() {
  elements.dossierCount.textContent = String(state.dossiers.length);
  elements.dossierList.innerHTML = "";

  const sortedDossiers = [...state.dossiers].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  for (const dossier of sortedDossiers) {
    const item = elements.dossierItemTemplate.content.firstElementChild.cloneNode(true);
    const procedure = getProcedure(dossier.procedureId);

    item.querySelector(".dossier-title").textContent = procedure?.label ?? "Expediente";
    item.querySelector(".dossier-summary").textContent = shorten(
      dossier.lastSummary || dossier.situation || "Sin resumen todavia.",
      120,
    );

    if (dossier.id === state.activeDossierId) {
      item.classList.add("active");
    }

    item.querySelector(".dossier-load-btn").addEventListener("click", () => {
      state.activeDossierId = dossier.id;
      persistDossiers();
      syncDossierForm();
      renderAll();
    });

    elements.dossierList.appendChild(item);
  }
}

function renderActiveProcedureChip() {
  const procedure = getProcedure(getActiveDossier()?.procedureId);
  elements.activeProcedureChip.textContent = procedure ? `Expediente activo: ${procedure.label}` : "Sin expediente activo";
}

function extractAssistantBody(text) {
  const [withoutSources] = text.split(/\n\s*\nFuentes oficiales:/i);
  const [withoutLegal] = withoutSources.split(/\n\s*\nAviso legal:/i);

  return withoutLegal.trim();
}

function compactBody(text) {
  return shorten(
    extractAssistantBody(text)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" "),
    280,
  );
}

function shorten(input, length) {
  return input.length <= length ? input : `${input.slice(0, length - 3).trimEnd()}...`;
}

function formatRelative(isoDate) {
  const date = new Date(isoDate);
  const diffMinutes = Math.round((Date.now() - date.getTime()) / 60000);

  if (diffMinutes < 1) {
    return "ahora";
  }

  if (diffMinutes < 60) {
    return `hace ${diffMinutes} min`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `hace ${diffHours} h`;
  }

  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  });
}

async function loadHealth() {
  try {
    const response = await fetch("/api/health");
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      return;
    }

    const provider = payload.configured.groq ? "Groq activo" : payload.configured.gemini ? "Gemini activo" : "IA no lista";
    elements.healthPill.textContent = provider;
  } catch {
    elements.healthPill.textContent = "Backend activo";
  }
}
