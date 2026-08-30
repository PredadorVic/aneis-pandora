"use strict";

const THEME_KEY = "catalogo-tema";
const state = { executions: [], currentIndex: -1, query: "", sort: "original" };

const elements = {
  dateSelect: document.getElementById("dateSelect"),
  searchInput: document.getElementById("searchInput"),
  sortSelect: document.getElementById("sortSelect"),
  bookGrid: document.getElementById("bookGrid"),
  resultCount: document.getElementById("resultCount"),
  updatedAt: document.getElementById("updatedAt"),
  notice: document.getElementById("notice"),
  themeButton: document.getElementById("themeButton"),
  menuButton: document.getElementById("menuButton"),
  sidebar: document.getElementById("sidebar"),
  backdrop: document.getElementById("backdrop"),
  themeColor: document.getElementById("themeColor")
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ""), location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function formatCurrency(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "Preço indisponível";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(number);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return date.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function normalizeText(value) {
  return String(value || "").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function currentExecution() {
  return state.executions[state.currentIndex] || null;
}

function updateConnectionNotice() {
  if (!navigator.onLine) {
    elements.notice.dataset.offline = "true";
    elements.notice.hidden = false;
    elements.notice.textContent = "Você está offline — exibindo os últimos preços salvos.";
    return;
  }

  if (elements.notice.dataset.offline === "true") {
    delete elements.notice.dataset.offline;
    elements.notice.hidden = true;
    elements.notice.textContent = "";
  }
}

function renderCard(book) {
  const link = safeUrl(book.link);
  const meta = String(book.autor || "");
  const previousPrice = Number(book.precoAnterior);
  const previousPriceHtml = Number.isFinite(previousPrice) && previousPrice > 0
    ? `<div class="price-block secondary-price"><small>Preço passado</small><strong>${escapeHtml(formatCurrency(previousPrice))}</strong></div>`
    : `<div class="price-block secondary-price"><small>Preço passado</small><strong>Não informado</strong></div>`;

  return `<article class="book-card">
    <div class="book-top">
      <div><h3>${escapeHtml(book.livro || "Livro sem nome")}</h3><p class="book-meta">${escapeHtml(meta || "Informações editoriais não cadastradas")}</p></div>
    </div>
    <div class="prices"><div class="price-block"><small>Preço ${escapeHtml(book.melhorLoja || "atual")}</small><strong>${escapeHtml(formatCurrency(book.melhorPreco))}</strong><span>${escapeHtml(book.melhorLoja || "Preço indisponível")}</span></div>${previousPriceHtml}</div>
    <div class="card-actions">${link ? `<a class="offer-button" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Abrir produto</a>` : '<span class="offer-button disabled">Produto indisponível</span>'}</div>
  </article>`;
}

function visibleBooks() {
  const execution = currentExecution();
  let books = Array.isArray(execution?.livros) ? [...execution.livros] : [];
  const query = normalizeText(state.query);
  if (query) books = books.filter((book) => normalizeText(`${book.livro} ${book.autor}`).includes(query));

  if (state.sort === "price-asc") books.sort((a, b) => (Number(a.melhorPreco) || Infinity) - (Number(b.melhorPreco) || Infinity));
  if (state.sort === "price-desc") books.sort((a, b) => (Number(b.melhorPreco) || 0) - (Number(a.melhorPreco) || 0));
  if (state.sort === "name") books.sort((a, b) => String(a.livro).localeCompare(String(b.livro), "pt-BR"));
  return books;
}

function render() {
  const execution = currentExecution();
  const books = visibleBooks();
  elements.updatedAt.textContent = execution ? `Atualizado em ${formatDate(execution.dataHora)}` : "Nenhuma consulta publicada";
  elements.resultCount.textContent = `${books.length} livro${books.length === 1 ? "" : "s"}`;
  elements.bookGrid.innerHTML = books.length
    ? books.map(renderCard).join("")
    : '<div class="empty">Nenhum livro encontrado nesta consulta.</div>';
  elements.bookGrid.setAttribute("aria-busy", "false");
}

function populateDates() {
  elements.dateSelect.innerHTML = state.executions.map((execution, index) =>
    `<option value="${index}">${escapeHtml(formatDate(execution.dataHora))}</option>`
  ).join("");
  elements.dateSelect.disabled = state.executions.length === 0;
  elements.dateSelect.value = String(state.currentIndex);
}

function applyTheme(theme) {
  const dark = theme === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  elements.themeButton.setAttribute("aria-pressed", String(dark));
  elements.themeButton.innerHTML = `<span aria-hidden="true">${dark ? "☀️" : "🌙"}</span> ${dark ? "Modo claro" : "Modo escuro"}`;
  elements.themeColor?.setAttribute("content", dark ? "#191411" : "#a13f1f");
}

function closeMenu() {
  elements.sidebar.classList.remove("open");
  elements.backdrop.hidden = true;
  elements.menuButton.setAttribute("aria-expanded", "false");
}

async function loadData() {
  try {
    const response = await fetch(`./dados.json?_=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.executions = Array.isArray(data.execucoes) ? data.execucoes : [];
    state.currentIndex = state.executions.length - 1;
    populateDates();
    render();
  } catch (error) {
    elements.notice.hidden = false;
    elements.notice.textContent = `Não foi possível carregar os dados: ${error.message}`;
    render();
  }
}

elements.dateSelect.addEventListener("change", () => { state.currentIndex = Number(elements.dateSelect.value); render(); });
elements.searchInput.addEventListener("input", () => { state.query = elements.searchInput.value; render(); });
elements.sortSelect.addEventListener("change", () => { state.sort = elements.sortSelect.value; render(); });
elements.themeButton.addEventListener("click", () => { const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; localStorage.setItem(THEME_KEY, next); applyTheme(next); });
elements.menuButton.addEventListener("click", () => { const open = !elements.sidebar.classList.contains("open"); elements.sidebar.classList.toggle("open", open); elements.backdrop.hidden = !open; elements.menuButton.setAttribute("aria-expanded", String(open)); });
elements.backdrop.addEventListener("click", closeMenu);
addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenu(); });

applyTheme(localStorage.getItem(THEME_KEY) || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
addEventListener("online", updateConnectionNotice);
addEventListener("offline", updateConnectionNotice);
updateConnectionNotice();
loadData();

if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
