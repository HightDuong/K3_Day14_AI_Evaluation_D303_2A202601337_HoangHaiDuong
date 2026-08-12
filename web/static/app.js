"use strict";

const messagesEl = document.getElementById("messages");
const typingEl = document.getElementById("typing");
const questionEl = document.getElementById("question");
const sendBtn = document.getElementById("send");
const toastEl = document.getElementById("toast");
const chipsEl = document.getElementById("quick-chips");
const statePill = document.getElementById("state-pill");

let busy = false;

async function getJSON(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove("hidden");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toastEl.classList.add("hidden"), 3800);
}

function addMessage(role, html) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.innerHTML = html;
  messagesEl.appendChild(div);
  scrollDown();
  return div;
}

function addUser(text) {
  const label = escapeHTML(text);
  return addMessage("user", `<span class="label">You</span>${label}`);
}

function addBot(text) {
  return addMessage("bot", `<span class="label">Assistant</span>${escapeHTML(text)}`);
}

function addError(text) {
  return addMessage("error", `<span class="label">Error</span>${escapeHTML(text)}`);
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scrollDown() {
  const inner = document.querySelector(".chat-inner");
  inner.scrollTop = inner.scrollHeight;
}

function setStatePill(text, cls) {
  statePill.textContent = text;
  statePill.className = `pill neu neu-raised ${cls || ""}`;
}

function renderEvidence(container, chunks) {
  if (!chunks || !chunks.length) return;
  const details = document.createElement("div");
  details.className = "evidence neu neu-raised";
  details.innerHTML = `
    <button class="evidence-toggle neu-inset" type="button">
      <span>Retrieved contexts (${chunks.length})</span>
      <span class="caret">&#9660;</span>
    </button>
    <div class="evidence-body">
      ${chunks
        .map(
          (c, i) => `
        <div class="chunk">
          <div class="chunk-meta">
            <span class="rank">#${i + 1}</span>
            <span class="source">${escapeHTML(c.source_doc)}</span>
            <span class="chunk-id">${escapeHTML(c.chunk_id)}</span>
            <span class="score">BM25 ${c.score.toFixed(4)}</span>
          </div>
          <div class="text">${escapeHTML(c.text)}</div>
        </div>`
        )
        .join("")}
    </div>`;
  const toggle = details.querySelector(".evidence-toggle");
  toggle.addEventListener("click", () => {
    details.classList.toggle("open");
  });
  container.after(details);
}

async function ask(question) {
  if (busy) return;
  busy = true;
  sendBtn.disabled = true;
  typingEl.classList.remove("hidden");
  scrollDown();

  try {
    const data = await getJSON("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    typingEl.classList.add("hidden");
    addBot(data.answer);
    const last = messagesEl.lastElementChild;
    renderEvidence(last, data.chunks);
    document.getElementById("info-latency").textContent = `${data.latency.toFixed(2)}s`;
    if (data.model) document.getElementById("info-model").textContent = data.model;
  } catch (err) {
    typingEl.classList.add("hidden");
    addError(err.message);
  } finally {
    busy = false;
    sendBtn.disabled = false;
    questionEl.focus();
  }
}

function handleSend() {
  const text = questionEl.value.trim();
  if (!text || busy) return;
  questionEl.value = "";
  addUser(text);
  ask(text);
}

questionEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
});

sendBtn.addEventListener("click", handleSend);

async function init() {
  try {
    const state = await getJSON("/api/state");
    document.getElementById("info-model").textContent = state.model;
    document.getElementById("info-corpus").textContent = state.corpus_id;
    document.getElementById("info-chunks").textContent = state.num_chunks;
    document.getElementById("info-topk").textContent = state.top_k;
    setStatePill("online", "");
    chipsEl.innerHTML = "";
    state.quick_questions.forEach((item) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.title = item.question;
      chip.textContent = `${item.id} · ${item.question}`;
      chip.addEventListener("click", () => {
        questionEl.value = item.question;
        questionEl.focus();
      });
      chipsEl.appendChild(chip);
    });
    if (state.generator_error) {
      setStatePill("no API key", "");
      toast(`Generator unavailable: ${state.generator_error}`);
    }
  } catch (err) {
    setStatePill("offline", "");
    toast(err.message);
  }
}

init();
