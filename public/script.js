/* =========================================================
 * AI Chat Mini App (Frontend)
 * - Tailwind + Vanilla JS
 * - Fitur: bubble chat, auto-scroll, typing indicator,
 *   localStorage history, export TXT/PDF, dark/light mode
 *   Enter = kirim, Shift+Enter = baris baru
 * =======================================================*/

const chatContainer = document.getElementById('chatContainer');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const exportTxtBtn = document.getElementById('exportTxtBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const themeToggle = document.getElementById('themeToggle');

const sunIcon = document.getElementById('sunIcon');
const moonIcon = document.getElementById('moonIcon');

const tplUser = document.getElementById('bubbleUser');
const tplAI = document.getElementById('bubbleAI');
const tplTyping = document.getElementById('typingTpl');

const LS_KEY = 'ai-chat-history-v1';
const THEME_KEY = 'ai-chat-theme';
const MAX_INPUT = 500;

// Jika backend beda domain, isi BASE_URL. Jika sama origin, biarkan kosong.
const BASE_URL = '';
const CHAT_ENDPOINT = `${BASE_URL}/api/chat`;

let history = [];

/* ---------- Helpers ---------- */
function nowTime() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function appendBubble(role, text, time = nowTime()) {
  const tpl = role === 'user' ? tplUser : tplAI;
  const node = tpl.content.cloneNode(true);
  node.querySelector('p').textContent = text;
  node.querySelector('.time').textContent = time;
  chatContainer.appendChild(node);
  scrollToBottom();
}
function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}
function showTyping() {
  const n = tplTyping.content.cloneNode(true);
  chatContainer.appendChild(n);
  scrollToBottom();
}
function hideTyping() {
  const n = document.getElementById('typingIndicator');
  if (n) n.remove();
}
function saveHistory() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(history)); } catch (_) {}
}
function loadHistory() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    history = JSON.parse(raw);
    history.forEach(m => appendBubble(m.role, m.content, m.time));
  } catch (_) {}
}
function addToHistory(role, content) {
  history.push({ role, content, time: nowTime() });
  saveHistory();
}

/* ---------- Theme toggle & ikon sinkron ---------- */
function syncThemeIcon() {
  const dark = document.documentElement.classList.contains('dark');
  // sunIcon tampil saat dark (untuk mengisyaratkan bisa pindah ke light)
  // moonIcon tampil saat light
  if (sunIcon && moonIcon) {
    sunIcon.classList.toggle('hidden', !dark);
    moonIcon.classList.toggle('hidden', dark);
  }
}

themeToggle.addEventListener('click', () => {
  const el = document.documentElement;
  const dark = el.classList.toggle('dark');
  try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch(_) {}
  syncThemeIcon();
});

/* ---------- Export ---------- */
exportTxtBtn.addEventListener('click', () => {
  const lines = history.map(m => `[${m.time}] ${m.role.toUpperCase()}: ${m.content}`);
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ai-chat-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
});

exportPdfBtn.addEventListener('click', async () => {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    alert('Gagal memuat jsPDF. Coba ulangi.');
    return;
  }
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(16);
  doc.text('AI Chat Export', margin, y);
  y += 24;

  doc.setFontSize(11);
  history.forEach(m => {
    const header = `[${m.time}] ${m.role.toUpperCase()}`;
    const content = m.content;

    const wrappedHeader = doc.splitTextToSize(header, maxWidth);
    const wrappedContent = doc.splitTextToSize(content, maxWidth);
    const blockHeight = (wrappedHeader.length + wrappedContent.length) * 14 + 12;

    if (y + blockHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }

    doc.setFont('Helvetica', 'bold');
    doc.text(wrappedHeader, margin, y);
    y += wrappedHeader.length * 14 + 4;

    doc.setFont('Helvetica', 'normal');
    doc.text(wrappedContent, margin, y);
    y += wrappedContent.length * 14 + 12;
  });

  const filename = `ai-chat-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.pdf`;
  doc.save(filename);
});

/* ---------- Submit form ---------- */
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  let text = (userInput.value || '').trim();
  if (!text) return;
  if (text.length > MAX_INPUT) {
    alert(`Maksimal ${MAX_INPUT} karakter.`);
    return;
  }

  appendBubble('user', text);
  addToHistory('user', text);

  userInput.value = '';
  userInput.style.height = 'auto';

  showTyping();
  disableSend(true);

  try {
    const res = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });

    if (!res.ok) {
      const err = await safeJson(res);
      throw new Error(err?.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const reply = (data && data.reply) ? data.reply.trim() : '(Tidak ada respons)';
    hideTyping();
    appendBubble('assistant', reply);
    addToHistory('assistant', reply);
  } catch (err) {
    hideTyping();
    console.error(err);
    const msg = `Maaf, terjadi kesalahan: ${err.message || err}`;
    appendBubble('assistant', msg);
    addToHistory('assistant', msg);
  } finally {
    disableSend(false);
  }
});

function disableSend(disabled) {
  sendBtn.disabled = disabled;
}

/* ---------- Auto-resize textarea ---------- */
userInput.addEventListener('input', () => {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 140) + 'px';
});

/* ---------- Enter to send (Shift+Enter = newline) ---------- */
let isComposing = false; // untuk IME (Bahasa/emoji)
userInput.addEventListener('compositionstart', () => { isComposing = true; });
userInput.addEventListener('compositionend', () => { isComposing = false; });
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
    e.preventDefault(); // cegah newline
    if (typeof chatForm.requestSubmit === 'function') {
      chatForm.requestSubmit();
    } else {
      chatForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  }
});

/* ---------- Utility ---------- */
async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

/* ---------- Init ---------- */
loadHistory();
scrollToBottom();
syncThemeIcon(); // sinkronkan ikon saat halaman pertama kali dibuka
