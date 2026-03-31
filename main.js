import { loadCatalogData } from "./web-content.js";

const FALLBACK_PROCEDURE = {
  id: "operativa-inss",
  label: "Operativa comun del INSS",
  shortLabel: "Operativa",
  goal: "gestor guiado",
  summary: "Portal de Prestaciones, Mis Expedientes, CAISS, notificaciones, requerimientos y vias con SMS.",
  exampleQuestion:
    "Tengo un expediente del INSS y quiero saber como seguirlo, responder a un requerimiento o revisar una notificacion.",
  promptSeeds: [
    "Como seguir un expediente del INSS",
    "Como responder a un requerimiento o revisar una notificacion",
    "Que vias hay con certificado, Cl@ve, SMS o cita previa",
  ],
};

const FAQ_QUESTIONS = [
  "Cuando me puedo jubilar?",
  "Necesito la baja medica, que hago?",
  "Como pido el Ingreso Minimo Vital?",
  "Quiero la Tarjeta Sanitaria Europea",
  "Como veo el estado de mi expediente?",
];

const MAX_CHARS = 1400;

const state = {
  session: { messages: [], chatState: null },
  procedureLibrary: [],
  demoQuestion:
    "Tengo un expediente del INSS y quiero saber como seguirlo, responder a un requerimiento o revisar una notificacion.",
  pending: false,
};

const elements = {
  healthPill: document.querySelector("#health-pill"),
  procedureList: document.querySelector("#procedure-list"),
  promptRow: document.querySelector("#prompt-row"),
  messageStream: document.querySelector("#message-stream"),
  conversationTitle: document.querySelector("#conversation-title"),
  chatForm: document.querySelector("#chat-form"),
  chatInput: document.querySelector("#chat-input"),
  charCounter: document.querySelector("#char-counter"),
  newSessionButton: document.querySelector("#new-session-btn"),
  demoQuestionButton: document.querySelector("#demo-question-btn"),
  procedureTemplate: document.querySelector("#procedure-template"),
  promptChipTemplate: document.querySelector("#prompt-chip-template"),
  messageTemplate: document.querySelector("#message-template"),
};

void bootstrap();

async function bootstrap() {
  const catalog = await loadCatalogData();
  state.procedureLibrary = Array.isArray(catalog.procedureLibrary) ? catalog.procedureLibrary : [];
  state.demoQuestion = typeof catalog.demoQuestion === "string" ? catalog.demoQuestion : state.demoQuestion;

  restoreSession();
  wireEvents();
  renderAll();
  loadHealth();
}

function restoreSession() {
  try {
    const saved = sessionStorage.getItem("chatSession");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.messages)) {
        state.session = parsed;
      }
    }
  } catch {
    // ignore corrupt session
  }
}

function persistSession() {
  try {
    sessionStorage.setItem("chatSession", JSON.stringify(state.session));
  } catch {
    // ignore quota exceeded
  }
}

function wireEvents() {
  elements.chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = elements.chatInput.value.trim();

    if (!question || state.pending) {
      return;
    }

    elements.chatInput.value = "";
    updateCharCounter();
    await submitQuestion(question);
  });

  elements.chatInput.addEventListener("input", updateCharCounter);

  elements.chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      elements.chatForm.requestSubmit();
    }
  });

  elements.newSessionButton.addEventListener("click", () => {
    clearChat();
  });

  elements.demoQuestionButton.addEventListener("click", async () => {
    await submitQuestion(state.demoQuestion);
  });

  elements.procedureList.addEventListener("click", async (event) => {
    const card = event.target.closest(".procedure-card");
    if (!card || state.pending) {
      return;
    }

    const procedure = getProcedure(card.dataset.procedureId);
    if (procedure) {
      await submitQuestion(procedure.exampleQuestion);
    }
  });

  elements.promptRow.addEventListener("click", async (event) => {
    const chip = event.target.closest(".prompt-chip");
    if (!chip || state.pending) {
      return;
    }

    const prompt = chip.dataset.prompt;
    if (prompt) {
      await submitQuestion(prompt);
    }
  });
}

function updateCharCounter() {
  const len = elements.chatInput.value.length;
  if (len > 0) {
    elements.charCounter.textContent = `${len}/${MAX_CHARS}`;
    elements.charCounter.classList.toggle("over-limit", len > MAX_CHARS);
  } else {
    elements.charCounter.textContent = "";
  }
}

function getProcedure(procedureId) {
  return state.procedureLibrary.find((procedure) => procedure.id === procedureId);
}

function clearChat() {
  state.session = { messages: [], chatState: null };
  try {
    sessionStorage.removeItem("chatSession");
  } catch {
    // ignore
  }
  renderAll();
}

function getLatestAssistantMessage() {
  return state.session.messages.filter((message) => message.role === "assistant").at(-1) ?? null;
}

async function submitQuestion(question) {
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

  state.session.messages.push(userMessage);
  renderAll();
  showLoadingIndicator();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        question,
        channel: "web",
        state: state.session.chatState ?? undefined,
      }),
    });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "No se pudo generar la respuesta.");
    }

    const answer = payload.answer;
    const assistantMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      mode: answer.mode,
      decisionStatus: answer.decisionStatus ?? "ready_to_prepare",
      confidence: answer.confidence ?? "medium",
      intent: answer.intent,
      text: answer.text,
      summary: answer.caseSummary || answer.summary,
      keyPoints:
        Array.isArray(answer.checklist) && answer.checklist.length > 0
          ? answer.checklist
          : Array.isArray(answer.keyPoints)
            ? answer.keyPoints
            : [],
      sources: Array.isArray(answer.sources) ? answer.sources : [],
      legalNotice: answer.legalNotice ?? "",
      clarifyingQuestions: Array.isArray(answer.clarifyingQuestions) ? answer.clarifyingQuestions : [],
      recommendedActions: Array.isArray(answer.recommendedActions) ? answer.recommendedActions : [],
      suggestedReplies: Array.isArray(answer.suggestedReplies) ? answer.suggestedReplies : [],
      createdAt: new Date().toISOString(),
    };

    state.session.messages.push(assistantMessage);
    state.session.chatState = answer.state ?? null;
    persistSession();
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
      recommendedActions: [],
      suggestedReplies: [],
      createdAt: new Date().toISOString(),
    };

    state.session.messages.push(fallbackMessage);
    renderAll();
    console.error(error);
  } finally {
    state.pending = false;
    hideLoadingIndicator();
  }
}

function showLoadingIndicator() {
  hideLoadingIndicator();
  const indicator = document.createElement("article");
  indicator.className = "message-card assistant-card loading-indicator";
  indicator.innerHTML = [
    '<p class="message-role">Asistente</p>',
    '<div class="typing-dots"><span></span><span></span><span></span></div>',
    '<p class="message-body loading-text">Consultando fuentes oficiales...</p>',
  ].join("");
  elements.messageStream.appendChild(indicator);
  elements.messageStream.scrollTop = elements.messageStream.scrollHeight;
}

function hideLoadingIndicator() {
  const existing = elements.messageStream.querySelector(".loading-indicator");
  if (existing) {
    existing.remove();
  }
}

function renderAll() {
  renderProcedures();
  renderPromptRow();
  renderMessages();
}

function renderProcedures() {
  elements.procedureList.innerHTML = "";

  for (const procedure of state.procedureLibrary) {
    const card = elements.procedureTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.procedureId = procedure.id;
    card.querySelector(".procedure-tag").textContent = procedure.shortLabel;
    card.querySelector(".procedure-title").textContent = procedure.label;
    card.querySelector(".procedure-copy").textContent = procedure.summary;
    elements.procedureList.appendChild(card);
  }
}

function renderPromptRow() {
  const latestAssistantMessage = getLatestAssistantMessage();
  const procedure = state.procedureLibrary[0] ?? FALLBACK_PROCEDURE;
  const actions =
    Array.isArray(latestAssistantMessage?.recommendedActions) && latestAssistantMessage.recommendedActions.length > 0
      ? latestAssistantMessage.recommendedActions
      : procedure.promptSeeds.map((prompt, index) => ({
          id: `seed-${index}`,
          label: prompt,
          prompt,
        }));
  elements.promptRow.innerHTML = "";

  for (const action of actions) {
    const chip = elements.promptChipTemplate.content.firstElementChild.cloneNode(true);
    chip.textContent = action.label;
    chip.dataset.prompt = action.prompt;
    elements.promptRow.appendChild(chip);
  }
}

function renderMessages() {
  elements.messageStream.innerHTML = "";

  if (!state.session.messages.length) {
    elements.conversationTitle.textContent = "Nueva conversacion";
    renderWelcomeState();
    return;
  }

  elements.conversationTitle.textContent = shorten(
    state.session.messages.find((m) => m.role === "user")?.text ?? "Conversacion",
    52,
  );

  for (const message of state.session.messages) {
    const card = elements.messageTemplate.content.firstElementChild.cloneNode(true);
    const pointsList = card.querySelector(".message-points");
    const checklistContainer = card.querySelector(".message-checklist");
    const sourcesContainer = card.querySelector(".message-sources");
    const actionsContainer = card.querySelector(".message-actions");
    const feedbackContainer = card.querySelector(".message-feedback");
    const confidencePill = card.querySelector(".confidence-pill");

    card.classList.add(message.role === "assistant" ? "assistant-card" : "user-card");
    card.querySelector(".message-role").textContent = message.role === "assistant" ? "Asistente" : "Tu";
    card.querySelector(".message-summary").textContent = message.summary || shorten(message.text, 120);

    // Rich formatting for assistant body
    const bodyContainer = card.querySelector(".message-body");
    if (message.role === "assistant") {
      bodyContainer.innerHTML = formatAssistantBody(message.text);
    } else {
      bodyContainer.textContent = message.text;
    }

    // Confidence pill for assistant messages
    if (message.role === "assistant" && message.confidence) {
      const confidenceLabels = {
        high: "Bien documentado",
        medium: "Orientativo",
        low: "Informacion limitada",
      };
      confidencePill.textContent = confidenceLabels[message.confidence] ?? "";
      confidencePill.classList.add(`confidence-${message.confidence}`);
    } else {
      confidencePill.remove();
    }

    // Key points as plain list
    if (Array.isArray(message.keyPoints) && message.keyPoints.length > 0 && message.role === "user") {
      pointsList.innerHTML = "";
      for (const point of message.keyPoints) {
        const item = document.createElement("li");
        item.textContent = point;
        pointsList.appendChild(item);
      }
    } else {
      pointsList.remove();
    }

    // Inline checklist for assistant messages
    if (message.role === "assistant" && Array.isArray(message.keyPoints) && message.keyPoints.length > 0) {
      checklistContainer.innerHTML = "";

      if (!message._checklistState) {
        message._checklistState = message.keyPoints.map(() => false);
      }

      message.keyPoints.forEach((point, index) => {
        const row = document.createElement("label");
        row.className = "message-checklist-item";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = message._checklistState[index];
        checkbox.addEventListener("change", () => {
          message._checklistState[index] = checkbox.checked;
        });

        const text = document.createElement("span");
        text.textContent = point;

        row.appendChild(checkbox);
        row.appendChild(text);
        checklistContainer.appendChild(row);
      });
    } else {
      checklistContainer.remove();
    }

    // Source links
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

    // Download checklist button for assistant messages with checklist items
    if (
      message.role === "assistant" &&
      Array.isArray(message.keyPoints) &&
      message.keyPoints.length > 0
    ) {
      const downloadBtn = document.createElement("button");
      downloadBtn.className = "ghost-btn small";
      downloadBtn.textContent = "Descargar checklist";
      downloadBtn.type = "button";
      downloadBtn.addEventListener("click", () => {
        downloadChecklist(message);
      });
      actionsContainer.appendChild(downloadBtn);
    } else {
      actionsContainer.remove();
    }

    // Feedback buttons for assistant messages
    if (message.role === "assistant" && message.text && !message._feedbackGiven) {
      renderFeedbackButtons(feedbackContainer, message);
    } else {
      if (message._feedbackGiven) {
        feedbackContainer.innerHTML = '<p class="feedback-thanks">Gracias por tu opinion</p>';
      } else {
        feedbackContainer.remove();
      }
    }

    elements.messageStream.appendChild(card);
  }

  elements.messageStream.scrollTop = elements.messageStream.scrollHeight;
}

function renderWelcomeState() {
  const card = document.createElement("article");
  card.className = "message-card assistant-card welcome-card";

  const header = document.createElement("p");
  header.className = "message-role";
  header.textContent = "Asistente";
  card.appendChild(header);

  const title = document.createElement("h3");
  title.className = "message-summary";
  title.textContent = "Hola! En que puedo ayudarte?";
  card.appendChild(title);

  const body = document.createElement("p");
  body.className = "message-body";
  body.textContent = "Preguntame sobre jubilacion, bajas medicas, prestaciones, tramites o cualquier duda de Seguridad Social. Aqui tienes las consultas mas frecuentes:";
  card.appendChild(body);

  const faqContainer = document.createElement("div");
  faqContainer.className = "faq-buttons";

  for (const question of FAQ_QUESTIONS) {
    const btn = document.createElement("button");
    btn.className = "faq-btn";
    btn.type = "button";
    btn.textContent = question;
    btn.addEventListener("click", async () => {
      if (!state.pending) {
        await submitQuestion(question);
      }
    });
    faqContainer.appendChild(btn);
  }

  card.appendChild(faqContainer);
  elements.messageStream.appendChild(card);
}

function renderFeedbackButtons(container, message) {
  container.innerHTML = "";

  const label = document.createElement("span");
  label.className = "feedback-label";
  label.textContent = "Te ha resultado util?";
  container.appendChild(label);

  const upBtn = document.createElement("button");
  upBtn.className = "feedback-btn";
  upBtn.type = "button";
  upBtn.textContent = "Si";
  upBtn.setAttribute("aria-label", "Respuesta util");

  const downBtn = document.createElement("button");
  downBtn.className = "feedback-btn";
  downBtn.type = "button";
  downBtn.textContent = "No";
  downBtn.setAttribute("aria-label", "Respuesta no util");

  function handleFeedback(value) {
    message._feedbackGiven = true;
    container.innerHTML = '<p class="feedback-thanks">Gracias por tu opinion</p>';
    sendFeedback(message.id, value);
  }

  upBtn.addEventListener("click", () => handleFeedback("positive"));
  downBtn.addEventListener("click", () => handleFeedback("negative"));

  container.appendChild(upBtn);
  container.appendChild(downBtn);
}

function sendFeedback(messageId, value) {
  try {
    fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId, value, timestamp: new Date().toISOString() }),
    }).catch(() => {
      // fire and forget
    });
  } catch {
    // ignore
  }
}

function formatAssistantBody(text) {
  const rawBody = extractAssistantBody(text);
  const lines = rawBody.split("\n");
  const fragments = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      fragments.push("");
      continue;
    }

    // Detect headings (lines ending with ":" that are not bullets)
    if (/^[A-Z\u00c0-\u00dc]/.test(trimmed) && trimmed.endsWith(":") && !trimmed.startsWith("-") && trimmed.length < 80) {
      fragments.push(`<h4 class="response-heading">${escapeHtml(trimmed.slice(0, -1))}</h4>`);
      continue;
    }

    // Detect bullet points
    if (/^[-*]\s+/.test(trimmed)) {
      const bulletText = trimmed.replace(/^[-*]\s+/, "");
      fragments.push(`<li>${escapeHtml(bulletText)}</li>`);
      continue;
    }

    // Detect numbered items
    if (/^\d+\.\s+/.test(trimmed)) {
      const numberedText = trimmed.replace(/^\d+\.\s+/, "");
      fragments.push(`<li>${escapeHtml(numberedText)}</li>`);
      continue;
    }

    fragments.push(`<p>${escapeHtml(trimmed)}</p>`);
  }

  // Wrap consecutive <li> items in <ul>
  let result = "";
  let inList = false;
  for (const fragment of fragments) {
    if (fragment.startsWith("<li>")) {
      if (!inList) {
        result += "<ul class=\"response-list\">";
        inList = true;
      }
      result += fragment;
    } else {
      if (inList) {
        result += "</ul>";
        inList = false;
      }
      result += fragment;
    }
  }
  if (inList) {
    result += "</ul>";
  }

  return result;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function downloadChecklist(message) {
  const lines = (message.keyPoints || []).map((point, index) => {
    const done = message._checklistState?.[index] ?? false;
    return `[${done ? "x" : " "}] ${point}`;
  });

  if (Array.isArray(message.sources) && message.sources.length > 0) {
    lines.push("", "Enlaces oficiales:", ...message.sources.map((s) => `- ${s.title}: ${s.url}`));
  }

  lines.push("", "Aviso: esta informacion no sustituye la atencion oficial ni es asesoramiento juridico.");

  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "checklist-seguridad-social.txt";
  a.click();
  URL.revokeObjectURL(url);
}

function extractAssistantBody(text) {
  const [withoutSources] = text.split(/\n\s*\nFuentes oficiales:/i);
  const [withoutLegal] = withoutSources.split(/\n\s*\nAviso legal:/i);

  return withoutLegal.trim();
}

function shorten(input, length) {
  return input.length <= length ? input : `${input.slice(0, length - 3).trimEnd()}...`;
}

async function loadHealth() {
  try {
    const response = await fetch("/api/health");
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      return;
    }

    const provider = payload.configured.groq
      ? "Groq activo"
      : payload.configured.gemini
        ? "Gemini activo"
        : "IA no lista";
    elements.healthPill.textContent = provider;
  } catch {
    elements.healthPill.textContent = "Backend activo";
  }
}
