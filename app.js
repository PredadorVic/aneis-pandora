"use strict";

const CHAVE_FAVORITOS = "aneis-favoritos";
const CHAVE_TEMA = "aneis-tema";

const estado = {
  execucoes: [],
  execucaoAtual: null,
  indiceAtual: -1,
  carregando: false,
  dispositivo: matchMedia("(pointer: coarse)").matches ? "mobile" : "desktop",
  serviceWorkerRegistration: null,
  assinaturaInicial: null
};

const el = {
  grade: document.getElementById("grade"),
  atualizado: document.getElementById("atualizado"),
  seletorData: document.getElementById("seletorData"),
  resultStatus: document.getElementById("resultStatus"),
  drawer: document.getElementById("drawer"),
  drawerBackdrop: document.getElementById("drawerBackdrop"),
  openDrawer: document.getElementById("openDrawer"),
  closeDrawer: document.getElementById("closeDrawer"),
  themeSwitch: document.getElementById("themeSwitch"),
  historyModal: document.getElementById("historyModal"),
  historyBackdrop: document.getElementById("historyBackdrop"),
  closeHistory: document.getElementById("closeHistory"),
  openHistoryFromDrawer: document.getElementById("openHistoryFromDrawer"),
  compareFrom: document.getElementById("compareFrom"),
  compareTo: document.getElementById("compareTo"),
  comparisonList: document.getElementById("comparisonList"),
  timeline: document.getElementById("timeline"),
  toTop: document.getElementById("toTop"),
  pullIndicator: document.getElementById("pullIndicator"),
  updateBanner: document.getElementById("updateBanner"),
  applyUpdate: document.getElementById("applyUpdate"),
  metaThemeColor: document.getElementById("metaThemeColor")
};

document.documentElement.dataset.device = estado.dispositivo;

function escaparHTML(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pegarFavoritos() {
  try {
    const valor = JSON.parse(localStorage.getItem(CHAVE_FAVORITOS));
    return Array.isArray(valor) ? valor : [];
  } catch {
    return [];
  }
}

function salvarFavoritos(favoritos) {
  localStorage.setItem(CHAVE_FAVORITOS, JSON.stringify(favoritos));
}

function alternarFavorito(nomeAnel) {
  const favoritos = pegarFavoritos();
  const indice = favoritos.indexOf(nomeAnel);
  const adicionou = indice === -1;

  if (adicionou) favoritos.push(nomeAnel);
  else favoritos.splice(indice, 1);

  salvarFavoritos(favoritos);

  if ("vibrate" in navigator) {
    navigator.vibrate(adicionou ? [28, 35, 28] : 25);
  }

  return adicionou;
}

function parsePreco(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;

  const texto = String(valor ?? "").replace(/[^\d,.-]/g, "");
  if (!texto) return 0;

  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;

  const numero = Number.parseFloat(normalizado);
  return Number.isFinite(numero) ? numero : 0;
}

function parsePercentual(valor) {
  const numero = Number.parseFloat(
    String(valor ?? "").replace(",", ".").replace(/[^\d.-]/g, "")
  );
  return Number.isFinite(numero) ? Math.max(0, numero) : 0;
}

function formatarBRL(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2
  }).format(valor || 0);
}

function formatarData(dataHora, completa = true) {
  const data = new Date(dataHora);
  if (Number.isNaN(data.getTime())) return "Data não informada";

  return data.toLocaleString("pt-BR", completa ? {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  } : {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function precoAnteriorEstimado(anel) {
  const atual = parsePreco(anel.precoBRL);
  const percentual = parsePercentual(anel.percentualDesconto);

  if (!atual || percentual <= 0 || percentual >= 100) return 0;
  return atual / (1 - percentual / 100);
}

function mapaPorNome(execucao) {
  return new Map((execucao?.aneis || []).map(item => [item.anel, item]));
}

function obterExecucaoAnterior(indiceAtual) {
  return indiceAtual > 0 ? estado.execucoes[indiceAtual - 1] : null;
}

function ehNovoDesconto(anel, indiceAtual) {
  if (anel.desconto !== "Sim") return false;

  const anterior = obterExecucaoAnterior(indiceAtual);
  if (!anterior) return false;

  const itemAnterior = mapaPorNome(anterior).get(anel.anel);
  return Boolean(itemAnterior && itemAnterior.desconto !== "Sim");
}

function mostrarSkeleton() {
  el.grade.setAttribute("aria-busy", "true");
  el.resultStatus.textContent = "Carregando...";

  el.grade.innerHTML = `
    <div class="skeleton-grid" style="grid-column:1/-1">
      ${Array.from({ length: 4 }, (_, i) => `
        <div class="skeleton-card" style="animation-delay:${i * 70}ms">
          <div class="skeleton-inner">
            <div class="skeleton-line medium"></div>
            <div class="skeleton-line short"></div>
            <div class="skeleton-line price"></div>
            <div class="skeleton-line short"></div>
            <div class="skeleton-block"></div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function cardTemplate(anel, indice, favoritos) {
  const ehFavorito = favoritos.includes(anel.anel);
  const emDesconto = anel.desconto === "Sim";
  const percentual = parsePercentual(anel.percentualDesconto);
  const precoAntigo = emDesconto ? precoAnteriorEstimado(anel) : 0;
  const novoDesconto = ehNovoDesconto(anel, estado.indiceAtual);

  return `
    <article
      class="card ${emDesconto ? "desconto" : ""} ${ehFavorito ? "favorito" : ""}"
      data-anel="${escaparHTML(anel.anel)}"
      data-promocao="${emDesconto ? "true" : "false"}"
      data-favorito="${ehFavorito ? "true" : "false"}"
      style="--card-delay:${Math.min(indice * 48, 360)}ms;animation-delay:${Math.min(indice * 48, 360)}ms"
      tabindex="0">
      <div class="card-head">
        <h3 class="nome">${escaparHTML(anel.anel)}</h3>

        <button
          class="botao-favorito ${ehFavorito ? "ativo" : ""} ripple-host"
          type="button"
          data-favorite="${escaparHTML(anel.anel)}"
          aria-label="${ehFavorito ? "Remover" : "Adicionar"} ${escaparHTML(anel.anel)} dos favoritos"
          aria-pressed="${ehFavorito}">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z"/>
          </svg>
        </button>
      </div>

      <div class="badge-row">
        ${emDesconto ? `
          <span class="selo-desconto">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="m4 14 10-10 6 6-10 10H4zM14 4l6 6"/>
            </svg>
            ${percentual ? `${percentual.toLocaleString("pt-BR")}% OFF` : "Em promoção"}
          </span>
        ` : ""}
        ${novoDesconto ? `<span class="novo-desconto">Novo desconto</span>` : ""}
      </div>

      <div class="precos">
        <span class="preco-brl">${escaparHTML(anel.precoBRL)}</span>
        ${precoAntigo ? `<span class="preco-antigo">${formatarBRL(precoAntigo)}</span>` : ""}
        <span class="preco-usd">${escaparHTML(anel.precoUSD || "")}</span>
      </div>

      <div class="card-meta">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
        </svg>
        Preço atualizado em ${formatarData(estado.execucaoAtual.dataHora, false)}
      </div>

      <a
        class="pandora-button ripple-host"
        href="${escaparHTML(anel.link)}"
        target="_blank"
        rel="noopener"
        aria-label="Ver ${escaparHTML(anel.anel)} no site da Pandora, abre em nova aba">
        Ver na Pandora <span class="arrow" aria-hidden="true">→</span>
      </a>
    </article>
  `;
}

function renderizar(aneis) {
  const favoritos = pegarFavoritos();
  const ordenados = [...aneis];

  el.grade.setAttribute("aria-busy", "false");
  el.resultStatus.textContent = `${ordenados.length} ${ordenados.length === 1 ? "anel" : "anéis"}`;

  if (!ordenados.length) {
    el.grade.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>
          </svg>
          <strong>Nenhum anel nesta consulta</strong>
          <div style="margin-top:6px;font-size:.82rem">Escolha outra data para visualizar os resultados.</div>
        </div>
      </div>
    `;
    return;
  }

  el.grade.innerHTML = ordenados
    .map((anel, indice) => cardTemplate(anel, indice, favoritos))
    .join("");

  registrarInteracoesCards();
}

function registrarInteracoesCards() {
  document.querySelectorAll("[data-favorite]").forEach(botao => {
    botao.addEventListener("click", event => {
      event.stopPropagation();

      const nome = botao.dataset.favorite;
      const adicionou = alternarFavorito(nome);
      const card = botao.closest(".card");

      botao.classList.toggle("ativo", adicionou);
      botao.classList.remove("animando");
      void botao.offsetWidth;
      botao.classList.add("animando");
      botao.setAttribute("aria-pressed", String(adicionou));
      botao.setAttribute(
        "aria-label",
        `${adicionou ? "Remover" : "Adicionar"} ${nome} dos favoritos`
      );

      card?.classList.toggle("favorito", adicionou);
      card?.setAttribute("data-favorito", String(adicionou));

      setTimeout(() => botao.classList.remove("animando"), 500);
    });
  });

  registrarRipple();
}

function preencherSeletorDeData(execucoes) {
  el.seletorData.innerHTML = execucoes
    .map((exec, indice) => `
      <option value="${indice}">${formatarData(exec.dataHora)}</option>
    `)
    .reverse()
    .join("");

  el.seletorData.value = String(execucoes.length - 1);
}

function mostrarExecucao(indice) {
  const execucao = estado.execucoes[indice];
  if (!execucao) return;

  estado.indiceAtual = indice;
  estado.execucaoAtual = execucao;

  el.atualizado.textContent = `Consulta de ${formatarData(execucao.dataHora)}`;
  renderizar(execucao.aneis || []);
}

async function carregarDados({ silencioso = false } = {}) {
  if (estado.carregando) return;
  estado.carregando = true;

  if (!silencioso) mostrarSkeleton();

  try {
    const resposta = await fetch(`dados.json?_=${Date.now()}`, {
      cache: "no-store"
    });

    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

    const dados = await resposta.json();
    estado.execucoes = Array.isArray(dados.execucoes) ? dados.execucoes : [];

    if (!estado.execucoes.length) {
      el.atualizado.textContent = "Nenhuma consulta registrada.";
      el.seletorData.innerHTML = "";
      renderizar([]);
      preencherHistorico();
      return;
    }

    preencherSeletorDeData(estado.execucoes);
    mostrarExecucao(estado.execucoes.length - 1);
    preencherHistorico();
  } catch (erro) {
    console.error("Erro ao carregar dados.json:", erro);
    el.atualizado.textContent = "Não foi possível carregar os dados agora.";
    el.resultStatus.textContent = "Indisponível";
    el.grade.setAttribute("aria-busy", "false");
    el.grade.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div>
          <strong>Dados temporariamente indisponíveis</strong>
          <div style="margin-top:6px;font-size:.82rem">Tente atualizar novamente em instantes.</div>
        </div>
      </div>
    `;
  } finally {
    estado.carregando = false;
  }
}

function preencherHistorico() {
  const options = estado.execucoes
    .map((exec, indice) => `<option value="${indice}">${formatarData(exec.dataHora)}</option>`)
    .join("");

  el.compareFrom.innerHTML = options;
  el.compareTo.innerHTML = options;

  const ultimo = Math.max(estado.execucoes.length - 1, 0);
  el.compareFrom.value = String(Math.max(ultimo - 1, 0));
  el.compareTo.value = String(ultimo);

  el.timeline.innerHTML = [...estado.execucoes]
    .reverse()
    .map((exec, reverseIndex) => {
      const realIndex = estado.execucoes.length - 1 - reverseIndex;
      const total = (exec.aneis || []).length;
      const promocoes = (exec.aneis || []).filter(a => a.desconto === "Sim").length;

      return `
        <div class="timeline-item" style="animation-delay:${Math.min(reverseIndex * 55, 330)}ms">
          <strong>${formatarData(exec.dataHora)}</strong>
          <small>
            ${total} ${total === 1 ? "anel" : "anéis"} ·
            ${promocoes} ${promocoes === 1 ? "promoção" : "promoções"}
            ${realIndex === estado.execucoes.length - 1 ? " · consulta atual" : ""}
          </small>
        </div>
      `;
    })
    .join("") || `<div class="empty-state">Sem histórico disponível.</div>`;

  renderizarComparacao();
}

function renderizarComparacao() {
  const de = estado.execucoes[Number(el.compareFrom.value)];
  const para = estado.execucoes[Number(el.compareTo.value)];

  if (!de || !para) {
    el.comparisonList.innerHTML = `<div class="empty-state">Escolha duas datas para comparar.</div>`;
    return;
  }

  const mapaDe = mapaPorNome(de);
  const mapaPara = mapaPorNome(para);
  const nomes = [...new Set([...mapaDe.keys(), ...mapaPara.keys()])];
  const mudancas = [];

  nomes.forEach(nome => {
    const antigo = mapaDe.get(nome);
    const atual = mapaPara.get(nome);

    if (!antigo || !atual) return;

    const precoAntigo = parsePreco(antigo.precoBRL);
    const precoAtual = parsePreco(atual.precoBRL);
    const virouDesconto = antigo.desconto !== "Sim" && atual.desconto === "Sim";

    if (precoAtual !== precoAntigo || virouDesconto) {
      mudancas.push({
        nome,
        antigo,
        atual,
        precoAntigo,
        precoAtual,
        virouDesconto
      });
    }
  });

  if (!mudancas.length) {
    el.comparisonList.innerHTML = `
      <div class="empty-state" style="min-height:140px">
        <div>
          <strong>Nenhuma mudança encontrada</strong>
          <div style="margin-top:6px;font-size:.8rem">Os preços permaneceram iguais entre as datas escolhidas.</div>
        </div>
      </div>
    `;
    return;
  }

  el.comparisonList.innerHTML = mudancas.map((item, indice) => {
    const diferenca = item.precoAtual - item.precoAntigo;
    const percentual = item.precoAntigo
      ? Math.abs((diferenca / item.precoAntigo) * 100)
      : 0;

    let variacao = "";

    if (item.virouDesconto) {
      variacao = `<span class="variation new-sale">Novo desconto</span>`;
    } else if (diferenca < 0) {
      variacao = `
        <span class="variation down" aria-label="Preço diminuiu ${percentual.toFixed(1)} por cento">
          ↓ ${percentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
        </span>
      `;
    } else if (diferenca > 0) {
      variacao = `
        <span class="variation up" aria-label="Preço aumentou ${percentual.toFixed(1)} por cento">
          ↑ ${percentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
        </span>
      `;
    }

    return `
      <div class="comparison-item" style="animation-delay:${Math.min(indice * 45, 300)}ms">
        <div>
          <strong>${escaparHTML(item.nome)}</strong>
          <small>${escaparHTML(item.antigo.precoBRL)} → ${escaparHTML(item.atual.precoBRL)}</small>
        </div>
        ${variacao}
      </div>
    `;
  }).join("");
}

function abrirDrawer() {
  el.drawer.classList.add("aberto");
  el.drawerBackdrop.classList.add("aberto");
  el.drawer.setAttribute("aria-hidden", "false");
  el.openDrawer.setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden";
  setTimeout(() => el.closeDrawer.focus(), 260);
}

function fecharDrawer() {
  el.drawer.classList.remove("aberto");
  el.drawerBackdrop.classList.remove("aberto");
  el.drawer.setAttribute("aria-hidden", "true");
  el.openDrawer.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
}

function abrirHistorico() {
  fecharDrawer();

  el.historyModal.classList.add("aberto");
  el.historyBackdrop.classList.add("aberto");
  el.historyModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  setNavAtivo("historico");

  setTimeout(() => el.closeHistory.focus(), 270);
}

function fecharHistorico() {
  el.historyModal.classList.remove("aberto");
  el.historyBackdrop.classList.remove("aberto");
  el.historyModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  setNavAtivo("inicio");
}

function setNavAtivo(nome) {
  document.querySelectorAll("[data-nav]").forEach(botao => {
    botao.classList.toggle("ativo", botao.dataset.nav === nome);
  });
}

function scrollParaPrimeiro(seletor, navNome) {
  const alvo = document.querySelector(seletor);
  setNavAtivo(navNome);

  if (alvo) {
    alvo.scrollIntoView({ behavior: "smooth", block: "center" });

    if (typeof alvo.animate === "function") {
      alvo.animate([
        { transform: "scale(1)" },
        { transform: "scale(1.018)" },
        { transform: "scale(1)" }
      ], {
        duration: 620,
        easing: "cubic-bezier(.2,.8,.2,1)"
      });
    }
  } else {
    document.querySelector(".overview")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  setTimeout(() => setNavAtivo("inicio"), 900);
}

function aplicarTema(tema) {
  const escuro = tema === "dark";

  document.documentElement.dataset.theme = escuro ? "dark" : "light";
  el.themeSwitch.classList.toggle("ativo", escuro);
  el.themeSwitch.setAttribute("aria-checked", String(escuro));
  el.themeSwitch.setAttribute(
    "aria-label",
    escuro ? "Desativar modo escuro" : "Ativar modo escuro"
  );

  el.metaThemeColor.setAttribute("content", escuro ? "#160f14" : "#ec4899");
  localStorage.setItem(CHAVE_TEMA, escuro ? "dark" : "light");
}

function inicializarTema() {
  const salvo = localStorage.getItem(CHAVE_TEMA);
  const preferenciaSistema = matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

  aplicarTema(salvo || preferenciaSistema);
}

function registrarRipple() {
  document.querySelectorAll(".ripple-host").forEach(elemento => {
    if (elemento.dataset.rippleReady === "true") return;
    elemento.dataset.rippleReady = "true";

    elemento.addEventListener("pointerdown", event => {
      const rect = elemento.getBoundingClientRect();
      const tamanho = Math.max(rect.width, rect.height);
      const ripple = document.createElement("span");

      ripple.className = "ripple";
      ripple.style.width = ripple.style.height = `${tamanho}px`;
      ripple.style.left = `${event.clientX - rect.left - tamanho / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - tamanho / 2}px`;

      elemento.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove(), {
        once: true
      });
    });
  });
}

function configurarPullToRefresh() {
  let inicioY = 0;
  let distancia = 0;
  let puxando = false;
  const limite = 78;

  window.addEventListener("touchstart", event => {
    if (window.scrollY !== 0 || estado.carregando) return;

    inicioY = event.touches[0].clientY;
    distancia = 0;
    puxando = true;
  }, { passive: true });

  window.addEventListener("touchmove", event => {
    if (!puxando) return;

    distancia = Math.max(0, event.touches[0].clientY - inicioY);
    if (distancia < 12) return;

    el.pullIndicator.classList.add("visivel");
    el.pullIndicator.classList.toggle("pronto", distancia >= limite);
    el.pullIndicator.querySelector("span").textContent =
      distancia >= limite ? "Solte para atualizar" : "Puxe para atualizar";
  }, { passive: true });

  window.addEventListener("touchend", async () => {
    if (!puxando) return;
    puxando = false;

    if (distancia >= limite) {
      el.pullIndicator.classList.add("carregando");
      el.pullIndicator.querySelector("span").textContent = "Atualizando...";
      await carregarDados({ silencioso: true });
    }

    setTimeout(() => {
      el.pullIndicator.classList.remove("visivel", "pronto", "carregando");
      el.pullIndicator.querySelector("span").textContent = "Puxe para atualizar";
    }, 380);
  }, { passive: true });
}

function hashTexto(texto) {
  let hash = 2166136261;

  for (let i = 0; i < texto.length; i += 1) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16);
}

async function obterAssinaturaRemota() {
  const arquivos = ["index.html", "app.css", "app.js"];

  const conteudos = await Promise.all(
    arquivos.map(async arquivo => {
      const resposta = await fetch(`./${arquivo}?version_check=${Date.now()}`, {
        cache: "no-store"
      });

      if (!resposta.ok) throw new Error(`Falha ao verificar ${arquivo}`);
      return resposta.text();
    })
  );

  return hashTexto(conteudos.join("|"));
}

async function monitorarVersao() {
  try {
    estado.assinaturaInicial = await obterAssinaturaRemota();

    setInterval(async () => {
      try {
        const assinaturaAtual = await obterAssinaturaRemota();

        if (
          estado.assinaturaInicial &&
          assinaturaAtual !== estado.assinaturaInicial
        ) {
          el.updateBanner.classList.add("visivel");
        }
      } catch (erro) {
        console.warn("Não foi possível verificar nova versão:", erro);
      }
    }, 120_000);
  } catch (erro) {
    console.warn("Monitoramento de versão indisponível:", erro);
  }
}

async function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registro = await navigator.serviceWorker.register("./sw.js", {
      updateViaCache: "none"
    });

    estado.serviceWorkerRegistration = registro;

    if (registro.waiting && navigator.serviceWorker.controller) {
      el.updateBanner.classList.add("visivel");
    }

    registro.addEventListener("updatefound", () => {
      const novoWorker = registro.installing;
      if (!novoWorker) return;

      novoWorker.addEventListener("statechange", () => {
        if (
          novoWorker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          el.updateBanner.classList.add("visivel");
        }
      });
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      location.reload();
    });

    setInterval(() => registro.update(), 120_000);
  } catch (erro) {
    console.warn("Service worker não registrado:", erro);
  }
}

el.seletorData.addEventListener("change", event => {
  mostrarExecucao(Number(event.target.value));
});

el.compareFrom.addEventListener("change", renderizarComparacao);
el.compareTo.addEventListener("change", renderizarComparacao);

el.openDrawer.addEventListener("click", abrirDrawer);
el.closeDrawer.addEventListener("click", fecharDrawer);
el.drawerBackdrop.addEventListener("click", fecharDrawer);

el.themeSwitch.addEventListener("click", () => {
  const atual = document.documentElement.dataset.theme;
  aplicarTema(atual === "dark" ? "light" : "dark");
});

el.openHistoryFromDrawer.addEventListener("click", abrirHistorico);
el.closeHistory.addEventListener("click", fecharHistorico);
el.historyBackdrop.addEventListener("click", fecharHistorico);

document.querySelectorAll("[data-nav]").forEach(botao => {
  botao.addEventListener("click", () => {
    const acao = botao.dataset.nav;

    if (acao === "inicio") {
      setNavAtivo("inicio");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (acao === "ofertas") {
      scrollParaPrimeiro('.card[data-promocao="true"]', "ofertas");
    }

    if (acao === "favoritos") {
      scrollParaPrimeiro('.card[data-favorito="true"]', "favoritos");
    }

    if (acao === "historico") {
      abrirHistorico();
    }
  });
});

el.toTop.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

el.applyUpdate.addEventListener("click", () => {
  const waiting = estado.serviceWorkerRegistration?.waiting;

  if (waiting) {
    waiting.postMessage({ type: "SKIP_WAITING" });
  } else {
    location.reload();
  }
});

window.addEventListener("scroll", () => {
  el.toTop.classList.toggle("visivel", window.scrollY > 560);
}, { passive: true });

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;


  if (el.historyModal.classList.contains("aberto")) {
    fecharHistorico();
  }

  if (el.drawer.classList.contains("aberto")) {
    fecharDrawer();
  }
});

window.addEventListener("resize", () => {
  estado.dispositivo = matchMedia("(pointer: coarse)").matches
    ? "mobile"
    : "desktop";

  document.documentElement.dataset.device = estado.dispositivo;
});

inicializarTema();
registrarRipple();
configurarPullToRefresh();
registrarServiceWorker();
monitorarVersao();
carregarDados();
