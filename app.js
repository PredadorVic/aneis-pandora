"use strict";

const APP_VERSION = "2.6.0";
const CHAVE_FAVORITOS = "aneis-favoritos";
const CHAVE_TEMA = "aneis-tema";

const estado = {
  execucoes: [],
  execucaoAtual: null,
  indiceAtual: -1,
  carregando: false,
  dispositivo: matchMedia("(pointer: coarse)").matches ? "mobile" : "desktop",
  serviceWorkerRegistration: null,
  assinaturaInicial: null,
  ultimoFoco: null,
  scrollBloqueadoEm: 0,
  corpoBloqueado: false,
  visaoAtual: "inicio",
  pesquisa: "",
  ordenacao: "original",
  installPrompt: null,
  transicaoEmAndamento: false,
  carregamentoInicialConcluido: false,
  inicioCarregamento: performance.now()
};

const el = {
  appLoading: document.getElementById("appLoading"),
  grade: document.getElementById("grade"),
  atualizado: document.getElementById("atualizado"),
  seletorData: document.getElementById("seletorData"),
  resultStatus: document.getElementById("resultStatus"),
  sectionTitleText: document.getElementById("sectionTitleText"),
  drawer: document.getElementById("drawer"),
  drawerBackdrop: document.getElementById("drawerBackdrop"),
  openDrawer: document.getElementById("openDrawer"),
  closeDrawer: document.getElementById("closeDrawer"),
  themeSwitch: document.getElementById("themeSwitch"),
  drawerCurrentDate: document.getElementById("drawerCurrentDate"),
  drawerCurrentCount: document.getElementById("drawerCurrentCount"),
  appVersion: document.getElementById("appVersion"),
  historyModal: document.getElementById("historyModal"),
  historyBackdrop: document.getElementById("historyBackdrop"),
  historyDragHandle: document.getElementById("historyDragHandle"),
  closeHistory: document.getElementById("closeHistory"),
  openHistoryFromDrawer: document.getElementById("openHistoryFromDrawer"),
  compareFrom: document.getElementById("compareFrom"),
  compareTo: document.getElementById("compareTo"),
  comparisonSummary: document.getElementById("comparisonSummary"),
  comparisonList: document.getElementById("comparisonList"),
  timeline: document.getElementById("timeline"),
  toTop: document.getElementById("toTop"),
  pullIndicator: document.getElementById("pullIndicator"),
  updateBanner: document.getElementById("updateBanner"),
  applyUpdate: document.getElementById("applyUpdate"),
  metaThemeColor: document.getElementById("metaThemeColor"),
  searchRings: document.getElementById("searchRings"),
  sortRings: document.getElementById("sortRings"),
  freshnessBanner: document.getElementById("freshnessBanner"),
  installApp: document.getElementById("installApp")
};

document.documentElement.dataset.device = estado.dispositivo;
el.appVersion.textContent = `Versão ${APP_VERSION}`;

function escaparHTML(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textoValido(valor) {
  return typeof valor === "string" ? valor.trim() : String(valor ?? "").trim();
}

function textoParaBusca(valor) {
  return textoValido(valor)
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parsePreco(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;

  const texto = textoValido(valor).replace(/[^\d,.-]/g, "");
  if (!texto) return 0;

  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;

  const numero = Number.parseFloat(normalizado);
  return Number.isFinite(numero) ? Math.max(0, numero) : 0;
}

function parsePercentual(valor) {
  const numero = Number.parseFloat(
    textoValido(valor).replace(",", ".").replace(/[^\d.-]/g, "")
  );
  return Number.isFinite(numero) ? Math.min(100, Math.max(0, numero)) : 0;
}

function ehSim(valor) {
  return ["sim", "true", "1", "yes"].includes(textoValido(valor).toLowerCase());
}

function urlSegura(valor) {
  const texto = textoValido(valor);
  if (!texto) return "";

  try {
    const url = new URL(texto, location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function formatarBRL(valor) {
  if (!Number.isFinite(valor) || valor <= 0) return "";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2
  }).format(valor);
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

function formatarDataRelativa(dataHora) {
  const data = new Date(dataHora);
  if (Number.isNaN(data.getTime())) return "Data não informada";

  const agora = new Date();
  const diaUTC = Date.UTC(data.getFullYear(), data.getMonth(), data.getDate());
  const hojeUTC = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const diferencaDias = Math.round((hojeUTC - diaUTC) / 86_400_000);
  const hora = data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });

  if (diferencaDias === 0) return `Hoje, ${hora}`;
  if (diferencaDias === 1) return `Ontem, ${hora}`;
  if (diferencaDias === -1) return `Amanhã, ${hora}`;

  const incluirAno = data.getFullYear() !== agora.getFullYear();
  const dataCurta = data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    ...(incluirAno ? { year: "numeric" } : {})
  }).replace(/\./g, "").replace(/\sde\s/g, " ");

  return `${dataCurta}, ${hora}`;
}


function timestampSeguro(dataHora, fallback = 0) {
  const timestamp = new Date(dataHora).getTime();
  return Number.isFinite(timestamp) ? timestamp : fallback;
}


function normalizarDisponibilidade(bruto) {
  const valor =
    bruto.disponivel ??
    bruto.disponibilidade ??
    bruto.statusDisponibilidade ??
    bruto.statusEstoque ??
    bruto.estoque;

  if (valor === undefined || valor === null || valor === "") {
    return { tipo: "", texto: "" };
  }

  if (typeof valor === "boolean") {
    return valor
      ? { tipo: "disponivel", texto: "Disponível" }
      : { tipo: "indisponivel", texto: "Indisponível no momento" };
  }

  if (typeof valor === "number") {
    return valor > 0
      ? { tipo: "disponivel", texto: "Disponível" }
      : { tipo: "indisponivel", texto: "Indisponível no momento" };
  }

  const original = textoValido(valor);
  const texto = original
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const negativos = [
    "indisponivel",
    "esgotado",
    "sem estoque",
    "fora de estoque",
    "nao disponivel",
    "false"
  ];

  const positivos = [
    "disponivel",
    "em estoque",
    "estoque disponivel",
    "sim",
    "true"
  ];

  if (negativos.some(item => texto.includes(item))) {
    return { tipo: "indisponivel", texto: "Indisponível no momento" };
  }

  if (positivos.some(item => texto.includes(item))) {
    return { tipo: "disponivel", texto: "Disponível" };
  }

  return {
    tipo: "neutro",
    texto: original
  };
}

function normalizarAnel(item, indice) {
  const bruto = item && typeof item === "object" ? item : {};
  const nomeInformado = textoValido(bruto.anel);
  const nome = nomeInformado || `Anel sem nome ${indice + 1}`;
  const precoTexto = textoValido(bruto.precoBRL);
  const preco = parsePreco(precoTexto);
  const precoUSD = textoValido(bruto.precoUSD);
  const percentual = parsePercentual(bruto.percentualDesconto);
  const desconto = ehSim(bruto.desconto) || percentual > 0;
  const disponibilidade = normalizarDisponibilidade(bruto);

  return {
    ...bruto,
    anel: nome,
    precoBRL: precoTexto,
    precoUSD,
    link: urlSegura(bruto.link),
    desconto: desconto ? "Sim" : "Não",
    percentualDesconto: percentual ? `${percentual}%` : "",
    _preco: preco,
    _percentual: percentual,
    _temPreco: preco > 0,
    _temNomeOriginal: Boolean(nomeInformado),
    _chaveFavorito: nome,
    _statusDisponibilidade: disponibilidade.tipo,
    _textoDisponibilidade: disponibilidade.texto
  };
}

function normalizarExecucoes(valor) {
  if (!Array.isArray(valor)) return [];

  return valor
    .filter(execucao =>
      execucao &&
      typeof execucao === "object" &&
      Array.isArray(execucao.aneis)
    )
    .map((execucao, indice) => ({
      ...execucao,
      dataHora: execucao.dataHora || new Date(indice).toISOString(),
      aneis: Array.isArray(execucao.aneis)
        ? execucao.aneis
            .filter(item =>
              item &&
              typeof item === "object" &&
              Object.values(item).some(valor => textoValido(valor))
            )
            .map(normalizarAnel)
        : []
    }))
    .sort((a, b) =>
      timestampSeguro(a.dataHora) - timestampSeguro(b.dataHora)
    );
}

function pegarFavoritos() {
  try {
    const valor = JSON.parse(localStorage.getItem(CHAVE_FAVORITOS));
    return Array.isArray(valor)
      ? valor.filter(item => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function salvarFavoritos(favoritos) {
  localStorage.setItem(CHAVE_FAVORITOS, JSON.stringify([...new Set(favoritos)]));
}

function alternarFavorito(chave) {
  const favoritos = pegarFavoritos();
  const indice = favoritos.indexOf(chave);
  const adicionou = indice === -1;

  if (adicionou) favoritos.push(chave);
  else favoritos.splice(indice, 1);

  salvarFavoritos(favoritos);

  if ("vibrate" in navigator) {
    navigator.vibrate(adicionou ? [28, 35, 28] : 25);
  }

  return adicionou;
}

function precoAnteriorHistorico(anel, indiceAtual) {
  if (!anel._temPreco || indiceAtual <= 0) return 0;

  const execucaoAnterior = estado.execucoes[indiceAtual - 1];
  const anterior = mapaPorNome(execucaoAnterior).get(anel.anel);

  if (!anterior?._temPreco || anterior._preco <= anel._preco) return 0;
  return anterior._preco;
}

function variacaoDesdeAnterior(anel, indiceAtual) {
  if (!anel._temPreco || indiceAtual <= 0) return null;
  const anterior = mapaPorNome(estado.execucoes[indiceAtual - 1]).get(anel.anel);
  if (!anterior?._temPreco || anterior._preco <= 0 || anterior._preco === anel._preco) return null;
  const percentual = ((anel._preco - anterior._preco) / anterior._preco) * 100;
  return { percentual, anterior: anterior._preco };
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


function ehAnelNovo(anel, indiceAtual) {
  const anterior = obterExecucaoAnterior(indiceAtual);

  // Na primeira consulta não há base de comparação.
  if (!anterior) return false;

  return !mapaPorNome(anterior).has(anel.anel);
}


function esconderCarregamentoInicial() {
  if (estado.carregamentoInicialConcluido || !el.appLoading) return;

  clearTimeout(window.__appLoadingFailsafe);
  estado.carregamentoInicialConcluido = true;
  const tempoDecorrido = performance.now() - estado.inicioCarregamento;
  const espera = Math.max(0, 900 - tempoDecorrido);

  setTimeout(() => {
    el.appLoading.classList.add("oculto");
    el.appLoading.setAttribute("aria-hidden", "true");
    document.body.classList.remove("app-loading-active");

    setTimeout(() => {
      el.appLoading.hidden = true;
    }, 220);
  }, espera);
}

function mostrarSkeleton() {
  el.grade.setAttribute("aria-busy", "true");
  el.resultStatus.textContent = "Carregando...";

  el.grade.innerHTML = `
    <div class="skeleton-grid" style="grid-column:1/-1">
      ${Array.from({ length: 4 }, (_, indice) => `
        <div class="skeleton-card" style="animation-delay:${indice * 70}ms">
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
  const ehFavorito = favoritos.includes(anel._chaveFavorito);
  const emDesconto = anel.desconto === "Sim";
  const precoAntigo = emDesconto ? precoAnteriorHistorico(anel, estado.indiceAtual) : 0;
  const novoDesconto = ehNovoDesconto(anel, estado.indiceAtual);
  const anelNovo = ehAnelNovo(anel, estado.indiceAtual);
  const variacao = variacaoDesdeAnterior(anel, estado.indiceAtual);
  const precoPrincipal = anel._temPreco
    ? escaparHTML(anel.precoBRL || formatarBRL(anel._preco))
    : "Preço indisponível";

  const precoUSD = anel.precoUSD
    ? `<span class="preco-usd">${escaparHTML(anel.precoUSD)}</span>`
    : "";

  const botaoPandora = anel.link
    ? `
      <a
        class="pandora-button ripple-host"
        href="${escaparHTML(anel.link)}"
        target="_blank"
        rel="noopener"
        aria-label="Ver ${escaparHTML(anel.anel)} no site da Pandora, abre em nova aba">
        Ver na Pandora <span class="arrow" aria-hidden="true">→</span>
      </a>
    `
    : `
      <span class="pandora-button indisponivel" aria-disabled="true">
        Link indisponível
      </span>
    `;

  return `
    <article
      class="card ${emDesconto ? "desconto" : ""} ${ehFavorito ? "favorito" : ""} ${anel._temPreco ? "" : "dados-incompletos"}"
      data-anel="${escaparHTML(anel.anel)}"
      data-promocao="${emDesconto ? "true" : "false"}"
      data-favorito="${ehFavorito ? "true" : "false"}"
      style="--card-delay:${Math.min(indice * 48, 360)}ms;animation-delay:${Math.min(indice * 48, 360)}ms">
      <div class="card-head">
        <h3 class="nome">${escaparHTML(anel.anel)}</h3>

        <button
          class="botao-favorito ${ehFavorito ? "ativo" : ""} ripple-host"
          type="button"
          data-favorite="${escaparHTML(anel._chaveFavorito)}"
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
            ${anel._percentual
              ? `${anel._percentual.toLocaleString("pt-BR")}% OFF`
              : "Em promoção"}
          </span>
        ` : ""}
        ${novoDesconto ? `<span class="novo-desconto">Novo desconto</span>` : ""}
        ${anelNovo ? `<span class="badge-novo">Novo</span>` : ""}
        ${variacao ? `<span class="price-change ${variacao.percentual < 0 ? "down" : "up"}">${variacao.percentual < 0 ? "↓" : "↑"} ${Math.abs(variacao.percentual).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>` : ""}
      </div>

      <div class="precos">
        <span class="preco-brl ${anel._temPreco ? "" : "indisponivel"}">${precoPrincipal}</span>
        ${precoAntigo ? `<span class="preco-antigo">${formatarBRL(precoAntigo)}</span>` : ""}
        ${precoUSD}
      </div>

      ${anel._statusDisponibilidade ? `
        <div
          class="availability-row ${anel._statusDisponibilidade}"
          aria-label="Disponibilidade: ${escaparHTML(anel._textoDisponibilidade)}">
          <span class="availability-dot" aria-hidden="true"></span>
          <span>${escaparHTML(anel._textoDisponibilidade)}</span>
        </div>
      ` : ""}

      <div class="card-meta">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
        </svg>
        Consultado: ${formatarDataRelativa(estado.execucaoAtual.dataHora)}
      </div>

      <div class="card-actions">
        ${botaoPandora}
        <button class="share-button ripple-host" type="button" data-share="${escaparHTML(anel._chaveFavorito)}" aria-label="Compartilhar ${escaparHTML(anel.anel)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg>
          <span>Compartilhar</span>
        </button>
      </div>
    </article>
  `;
}

function registrarInteracoesCards() {
  document.querySelectorAll("[data-favorite]").forEach(botao => {
    botao.addEventListener("click", event => {
      event.stopPropagation();

      const chave = botao.dataset.favorite;
      const adicionou = alternarFavorito(chave);
      const card = botao.closest(".card");
      const nome = card?.dataset.anel || "anel";

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

      if (estado.visaoAtual === "favoritos" && !adicionou) {
        card?.classList.add("saindo");

        setTimeout(() => {
          renderizar(estado.execucaoAtual?.aneis || []);
        }, 230);
      }

      setTimeout(() => botao.classList.remove("animando"), 500);
    });
  });

  document.querySelectorAll("[data-share]").forEach(botao => {
    botao.addEventListener("click", async () => {
      const anel = estado.execucaoAtual?.aneis?.find(item => item._chaveFavorito === botao.dataset.share);
      if (!anel) return;
      const dados = {
        title: anel.anel,
        text: `${anel.anel} está por ${anel.precoBRL || formatarBRL(anel._preco)}.`,
        url: anel.link || location.href
      };
      try {
        if (navigator.share) await navigator.share(dados);
        else {
          await navigator.clipboard.writeText(`${dados.text} ${dados.url}`);
          const textoOriginal = botao.querySelector("span").textContent;
          botao.querySelector("span").textContent = "Link copiado";
          setTimeout(() => { botao.querySelector("span").textContent = textoOriginal; }, 1800);
        }
      } catch (erro) {
        if (erro?.name !== "AbortError") console.warn("Não foi possível compartilhar:", erro);
      }
    });
  });

  registrarRipple();
}

function configuracaoDaVisao() {
  switch (estado.visaoAtual) {
    case "ofertas":
      return {
        titulo: "Ofertas",
        vazioTitulo: "Nenhuma oferta nesta consulta",
        vazioDescricao: "Quando um anel entrar em promoção, ele aparecerá aqui automaticamente."
      };

    case "favoritos":
      return {
        titulo: "Favoritos",
        vazioTitulo: "Nenhum favorito ainda",
        vazioDescricao: "Toque no coração de um anel para encontrá-lo facilmente nesta tela."
      };

    case "inicio":
    default:
      return {
        titulo: "Anéis encontrados",
        vazioTitulo: "Nenhum anel nesta consulta",
        vazioDescricao: "Escolha outra data para visualizar os resultados."
      };
  }
}

function aneisDaVisao(aneis) {
  let lista = Array.isArray(aneis) ? [...aneis] : [];

  if (estado.visaoAtual === "ofertas") {
    lista = lista.filter(anel => anel.desconto === "Sim");
  }

  if (estado.visaoAtual === "favoritos") {
    const favoritos = pegarFavoritos();
    lista = lista.filter(anel => favoritos.includes(anel._chaveFavorito));
  }

  if (estado.pesquisa) {
    const termo = textoParaBusca(estado.pesquisa);
    lista = lista.filter(anel => textoParaBusca(anel.anel).includes(termo));
  }

  switch (estado.ordenacao) {
    case "price-asc": lista.sort((a, b) => (a._preco || Infinity) - (b._preco || Infinity)); break;
    case "price-desc": lista.sort((a, b) => (b._preco || 0) - (a._preco || 0)); break;
    case "discount": lista.sort((a, b) => b._percentual - a._percentual); break;
    case "name": lista.sort((a, b) => a.anel.localeCompare(b.anel, "pt-BR")); break;
  }

  return lista;
}

function renderizar(aneis) {
  const todos = Array.isArray(aneis) ? aneis : [];
  const lista = aneisDaVisao(todos);
  const favoritos = pegarFavoritos();
  const configuracao = configuracaoDaVisao();

  el.sectionTitleText.textContent = configuracao.titulo;

  if (!estado.transicaoEmAndamento) {
    el.sectionTitleText.classList.remove("mudando");
    void el.sectionTitleText.offsetWidth;
    el.sectionTitleText.classList.add("mudando");
  }

  el.grade.setAttribute("aria-busy", "false");
  el.resultStatus.textContent = `${lista.length} ${lista.length === 1 ? "anel" : "anéis"}`;

  if (!lista.length) {
    el.grade.innerHTML = `
      <div class="empty-state view-empty" style="grid-column:1/-1">
        <div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            ${estado.visaoAtual === "favoritos"
              ? '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z"/>'
              : estado.visaoAtual === "ofertas"
                ? '<path d="M20 13 13 20l-9-9V4h7z"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/>'
                : '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>'}
          </svg>
          <strong>${configuracao.vazioTitulo}</strong>
          <div class="empty-description">${configuracao.vazioDescricao}</div>
          ${estado.visaoAtual !== "inicio"
            ? '<button class="empty-action ripple-host" type="button" data-back-home>Ver todos os anéis</button>'
            : ""}
        </div>
      </div>
    `;

    document.querySelector("[data-back-home]")?.addEventListener("click", () => {
      mudarVisao("inicio");
    });

    registrarRipple();
    return;
  }

  el.grade.innerHTML = lista
    .map((anel, indice) => cardTemplate(anel, indice, favoritos))
    .join("");

  registrarInteracoesCards();
}

function mudarVisao(nome, { rolar = true } = {}) {
  const visoes = ["inicio", "ofertas", "favoritos"];
  if (!visoes.includes(nome)) return;

  const visaoAnterior = estado.visaoAtual;

  const rolarParaLista = () => {
    if (!rolar) return;

    document.querySelector(".section-title")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  };

  if (nome === visaoAnterior) {
    setNavAtivo(nome);
    rolarParaLista();
    return;
  }

  const atualizarInterface = () => {
    estado.visaoAtual = nome;
    setNavAtivo(nome);

    if (estado.execucaoAtual) {
      renderizar(estado.execucaoAtual.aneis);
    }
  };

  const movimentoReduzido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const suportaTransicao = typeof document.startViewTransition === "function";

  if (!suportaTransicao || movimentoReduzido) {
    atualizarInterface();
    rolarParaLista();
    return;
  }

  const direcao = visoes.indexOf(nome) > visoes.indexOf(visaoAnterior)
    ? "avancar"
    : "voltar";

  estado.transicaoEmAndamento = true;
  document.documentElement.dataset.viewDirection = direcao;
  document.documentElement.classList.add("view-transition-running");

  const transicao = document.startViewTransition(atualizarInterface);

  transicao.finished
    .catch(() => {})
    .finally(() => {
      estado.transicaoEmAndamento = false;
      document.documentElement.classList.remove("view-transition-running");
      delete document.documentElement.dataset.viewDirection;
      rolarParaLista();
    });
}


function preencherSeletorDeData(execucoes) {
  el.seletorData.innerHTML = execucoes
    .map((execucao, indice) => `
      <option value="${indice}">${formatarDataRelativa(execucao.dataHora)}</option>
    `)
    .reverse()
    .join("");

  el.seletorData.value = String(execucoes.length - 1);
  el.seletorData.disabled = execucoes.length <= 1;
}

function atualizarStatusDoMenu(execucao) {
  const quantidade = execucao?.aneis?.length || 0;
  el.drawerCurrentDate.textContent = execucao
    ? formatarDataRelativa(execucao.dataHora)
    : "Nenhuma consulta";

  el.drawerCurrentCount.textContent = execucao
    ? `${quantidade} ${quantidade === 1 ? "anel disponível" : "anéis disponíveis"}`
    : "Aguardando os dados";
}

function atualizarFrescor(execucao) {
  if (!navigator.onLine) {
    el.freshnessBanner.hidden = false;
    el.freshnessBanner.classList.add("offline");
    el.freshnessBanner.textContent = "Você está sem internet. Exibindo a última consulta salva neste dispositivo.";
    return;
  }

  el.freshnessBanner.classList.remove("offline");
  const idadeHoras = (Date.now() - timestampSeguro(execucao?.dataHora, Date.now())) / 3_600_000;
  el.freshnessBanner.hidden = idadeHoras <= 48;
  if (idadeHoras > 48) {
    const dias = Math.floor(idadeHoras / 24);
    el.freshnessBanner.textContent = `Os preços desta consulta têm ${dias} ${dias === 1 ? "dia" : "dias"}. Confirme o valor na Pandora antes de comprar.`;
  }
}

function mostrarExecucao(indice) {
  const execucao = estado.execucoes[indice];
  if (!execucao) return;

  estado.indiceAtual = indice;
  estado.execucaoAtual = execucao;

  el.atualizado.textContent = `Última consulta: ${formatarDataRelativa(execucao.dataHora)}`;
  atualizarFrescor(execucao);
  atualizarStatusDoMenu(execucao);
  renderizar(execucao.aneis);
}

async function carregarDados({ silencioso = false } = {}) {
  if (estado.carregando) return;
  estado.carregando = true;

  if (!silencioso) mostrarSkeleton();

  const controlador = new AbortController();
  const limiteDeTempo = setTimeout(() => controlador.abort(), 6000);

  try {
    const resposta = await fetch(`dados.json?_=${Date.now()}`, {
      cache: "no-store",
      signal: controlador.signal
    });

    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

    const dados = await resposta.json();
    estado.execucoes = normalizarExecucoes(dados.execucoes);

    if (!estado.execucoes.length) {
      el.atualizado.textContent = "Nenhuma consulta registrada.";
      el.seletorData.innerHTML = "";
      el.seletorData.disabled = true;
      atualizarStatusDoMenu(null);
      renderizar([]);
      preencherHistorico();
      return;
    }

    preencherSeletorDeData(estado.execucoes);
    mostrarExecucao(estado.execucoes.length - 1);
    preencherHistorico();
  } catch (erro) {
    console.error("Erro ao carregar dados.json:", erro);
    el.atualizado.textContent = erro?.name === "AbortError"
      ? "A consulta demorou mais que o esperado."
      : "Não foi possível carregar os dados agora.";
    el.resultStatus.textContent = "Indisponível";
    el.grade.setAttribute("aria-busy", "false");
    el.grade.innerHTML = `
      <div class="empty-state error-state" style="grid-column:1/-1">
        <div>
          <strong>Dados temporariamente indisponíveis</strong>
          <div class="empty-description">Puxe a tela para baixo e tente novamente.</div>
        </div>
      </div>
    `;
  } finally {
    clearTimeout(limiteDeTempo);
    estado.carregando = false;
    esconderCarregamentoInicial();
  }
}

function preencherHistorico() {
  const options = estado.execucoes
    .map((execucao, indice) =>
      `<option value="${indice}">${formatarDataRelativa(execucao.dataHora)}</option>`
    )
    .join("");

  el.compareFrom.innerHTML = options;
  el.compareTo.innerHTML = options;

  const ultimo = Math.max(estado.execucoes.length - 1, 0);
  el.compareFrom.value = String(Math.max(ultimo - 1, 0));
  el.compareTo.value = String(ultimo);

  const comparacaoDisponivel = estado.execucoes.length >= 2;
  el.compareFrom.disabled = !comparacaoDisponivel;
  el.compareTo.disabled = !comparacaoDisponivel;

  el.timeline.innerHTML = [...estado.execucoes]
    .reverse()
    .map((execucao, reverseIndex) => {
      const realIndex = estado.execucoes.length - 1 - reverseIndex;
      const total = execucao.aneis.length;
      const promocoes = execucao.aneis.filter(anel => anel.desconto === "Sim").length;

      return `
        <div class="timeline-item ${realIndex === estado.indiceAtual ? "atual" : ""}"
             style="animation-delay:${Math.min(reverseIndex * 55, 330)}ms">
          <strong>${formatarDataRelativa(execucao.dataHora)}</strong>
          <small>
            ${total} ${total === 1 ? "anel" : "anéis"}
            ${promocoes ? ` · ${promocoes} ${promocoes === 1 ? "promoção" : "promoções"}` : ""}
            ${realIndex === estado.indiceAtual ? " · exibida agora" : ""}
          </small>
        </div>
      `;
    })
    .join("") || `
      <div class="empty-state compact">
        <strong>Sem histórico disponível</strong>
      </div>
    `;

  renderizarComparacao();
}

function sincronizarDatasComparacao(origem) {
  const total = estado.execucoes.length;
  if (total < 2) return;

  let inicial = Number(el.compareFrom.value);
  let final = Number(el.compareTo.value);

  if (inicial < final) return;

  if (origem === "inicial") {
    final = Math.min(inicial + 1, total - 1);
    if (final === inicial) inicial = Math.max(0, final - 1);
  } else {
    inicial = Math.max(0, final - 1);
    if (inicial === final) final = Math.min(total - 1, inicial + 1);
  }

  el.compareFrom.value = String(inicial);
  el.compareTo.value = String(final);
}

function criarMudancas(de, para) {
  const mapaDe = mapaPorNome(de);
  const mapaPara = mapaPorNome(para);
  const nomes = [...new Set([...mapaDe.keys(), ...mapaPara.keys()])];
  const mudancas = [];

  nomes.forEach(nome => {
    const antigo = mapaDe.get(nome);
    const atual = mapaPara.get(nome);

    if (!antigo && atual) {
      mudancas.push({
        tipo: "adicionado",
        nome,
        atual
      });
      return;
    }

    if (antigo && !atual) {
      mudancas.push({
        tipo: "removido",
        nome,
        antigo
      });
      return;
    }

    if (!antigo || !atual) return;

    const virouDesconto = antigo.desconto !== "Sim" && atual.desconto === "Sim";
    const deixouDesconto = antigo.desconto === "Sim" && atual.desconto !== "Sim";
    const precoMudou =
      antigo._temPreco &&
      atual._temPreco &&
      antigo._preco !== atual._preco;

    if (precoMudou || virouDesconto || deixouDesconto) {
      mudancas.push({
        tipo: virouDesconto
          ? "novo-desconto"
          : deixouDesconto
            ? "fim-desconto"
            : atual._preco < antigo._preco
              ? "queda"
              : "aumento",
        nome,
        antigo,
        atual
      });
    }
  });

  const prioridade = {
    "novo-desconto": 0,
    queda: 1,
    aumento: 2,
    "fim-desconto": 3,
    adicionado: 4,
    removido: 5
  };

  return mudancas.sort((a, b) => prioridade[a.tipo] - prioridade[b.tipo]);
}

function resumoMudancas(mudancas) {
  const quedas = mudancas.filter(item => item.tipo === "queda").length;
  const aumentos = mudancas.filter(item => item.tipo === "aumento").length;
  const novosDescontos = mudancas.filter(item => item.tipo === "novo-desconto").length;

  const partes = [`${mudancas.length} ${mudancas.length === 1 ? "mudança" : "mudanças"}`];
  if (quedas) partes.push(`${quedas} ${quedas === 1 ? "queda" : "quedas"}`);
  if (aumentos) partes.push(`${aumentos} ${aumentos === 1 ? "aumento" : "aumentos"}`);
  if (novosDescontos) partes.push(`${novosDescontos} ${novosDescontos === 1 ? "novo desconto" : "novos descontos"}`);

  return partes.join(" · ");
}

function variacaoTemplate(item) {
  if (item.tipo === "adicionado") {
    return `
      <div>
        <strong>${escaparHTML(item.nome)}</strong>
        <small>Entrou na consulta por ${item.atual._temPreco ? escaparHTML(item.atual.precoBRL) : "preço não informado"}</small>
      </div>
      <span class="variation added">Novo</span>
    `;
  }

  if (item.tipo === "removido") {
    return `
      <div>
        <strong>${escaparHTML(item.nome)}</strong>
        <small>Não aparece mais na consulta final</small>
      </div>
      <span class="variation removed">Saiu</span>
    `;
  }

  const antigo = item.antigo;
  const atual = item.atual;
  const diferenca = atual._preco - antigo._preco;
  const percentual = antigo._preco
    ? Math.abs((diferenca / antigo._preco) * 100)
    : 0;

  let selo = "";

  if (item.tipo === "novo-desconto") {
    selo = `<span class="variation new-sale">Novo desconto</span>`;
  } else if (item.tipo === "fim-desconto") {
    selo = `<span class="variation ended-sale">Fim da promoção</span>`;
  } else if (item.tipo === "queda") {
    selo = `
      <span class="variation down" aria-label="Preço diminuiu ${percentual.toFixed(1)} por cento">
        ↓ ${percentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
      </span>
    `;
  } else {
    selo = `
      <span class="variation up" aria-label="Preço aumentou ${percentual.toFixed(1)} por cento">
        ↑ ${percentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
      </span>
    `;
  }

  const deTexto = antigo._temPreco ? antigo.precoBRL : "Preço não informado";
  const paraTexto = atual._temPreco ? atual.precoBRL : "Preço não informado";

  return `
    <div>
      <strong>${escaparHTML(item.nome)}</strong>
      <small>${escaparHTML(deTexto)} → ${escaparHTML(paraTexto)}</small>
    </div>
    ${selo}
  `;
}

function renderizarComparacao() {
  if (estado.execucoes.length < 2) {
    el.comparisonSummary.textContent = "Histórico insuficiente";
    el.comparisonList.innerHTML = `
      <div class="empty-state compact">
        <div>
          <strong>É necessária mais de uma consulta</strong>
          <div class="empty-description">A comparação ficará disponível após a próxima atualização dos preços.</div>
        </div>
      </div>
    `;
    return;
  }

  const de = estado.execucoes[Number(el.compareFrom.value)];
  const para = estado.execucoes[Number(el.compareTo.value)];

  if (!de || !para) {
    el.comparisonSummary.textContent = "Selecione as datas";
    el.comparisonList.innerHTML = `
      <div class="empty-state compact">
        Escolha duas datas para comparar.
      </div>
    `;
    return;
  }

  const mudancas = criarMudancas(de, para);
  el.comparisonSummary.textContent = resumoMudancas(mudancas);

  if (!mudancas.length) {
    el.comparisonList.innerHTML = `
      <div class="empty-state compact">
        <div>
          <strong>Nenhuma mudança encontrada</strong>
          <div class="empty-description">Os dados permaneceram iguais entre as datas escolhidas.</div>
        </div>
      </div>
    `;
    return;
  }

  el.comparisonList.innerHTML = mudancas
    .map((item, indice) => `
      <div class="comparison-item" style="animation-delay:${Math.min(indice * 45, 300)}ms">
        ${variacaoTemplate(item)}
      </div>
    `)
    .join("");
}

function bloquearRolagem() {
  if (estado.corpoBloqueado) return;

  estado.scrollBloqueadoEm = window.scrollY;
  estado.corpoBloqueado = true;

  document.body.style.position = "fixed";
  document.body.style.top = `-${estado.scrollBloqueadoEm}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}

function liberarRolagem() {
  if (!estado.corpoBloqueado) return;
  if (el.drawer.classList.contains("aberto") || el.historyModal.classList.contains("aberto")) {
    return;
  }

  const posicao = estado.scrollBloqueadoEm;
  estado.corpoBloqueado = false;

  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  window.scrollTo(0, posicao);
}

function elementosFocaveis(container) {
  return [...container.querySelectorAll(
    'button:not([disabled]), a[href], select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter(item => !item.hasAttribute("aria-hidden") && item.offsetParent !== null);
}

function prenderFoco(event, container) {
  if (event.key !== "Tab") return;

  const focaveis = elementosFocaveis(container);
  if (!focaveis.length) {
    event.preventDefault();
    container.focus();
    return;
  }

  const primeiro = focaveis[0];
  const ultimo = focaveis[focaveis.length - 1];

  if (event.shiftKey && document.activeElement === primeiro) {
    event.preventDefault();
    ultimo.focus();
  } else if (!event.shiftKey && document.activeElement === ultimo) {
    event.preventDefault();
    primeiro.focus();
  }
}

function abrirDrawer() {
  estado.ultimoFoco = document.activeElement;
  bloquearRolagem();

  el.drawer.inert = false;
  el.drawer.classList.add("aberto");
  el.drawerBackdrop.classList.add("aberto");
  el.drawer.setAttribute("aria-hidden", "false");
  el.openDrawer.setAttribute("aria-expanded", "true");

  setTimeout(() => el.closeDrawer.focus(), 220);
}

function fecharDrawer({ restaurarFoco = true, manterBloqueio = false } = {}) {
  el.drawer.style.transform = "";
  el.drawer.classList.remove("arrastando", "aberto");
  el.drawerBackdrop.classList.remove("aberto");
  el.drawer.setAttribute("aria-hidden", "true");
  el.drawer.inert = true;
  el.openDrawer.setAttribute("aria-expanded", "false");

  if (!manterBloqueio) {
    setTimeout(liberarRolagem, 210);
  }

  if (restaurarFoco && estado.ultimoFoco instanceof HTMLElement) {
    setTimeout(() => estado.ultimoFoco.focus(), 220);
  }
}

function abrirHistorico() {
  const abriuPeloMenu = el.drawer.classList.contains("aberto");

  if (!abriuPeloMenu) {
    estado.ultimoFoco = document.activeElement;
    bloquearRolagem();
  } else {
    fecharDrawer({ restaurarFoco: false, manterBloqueio: true });
  }

  const exibir = () => {
    el.historyModal.inert = false;
    el.historyModal.classList.add("aberto");
    el.historyBackdrop.classList.add("aberto");
    el.historyModal.setAttribute("aria-hidden", "false");
    setNavAtivo("historico");

    setTimeout(() => el.closeHistory.focus(), 220);
  };

  setTimeout(exibir, abriuPeloMenu ? 105 : 0);
}

function fecharHistorico({ restaurarFoco = true } = {}) {
  el.historyModal.style.transform = "";
  el.historyModal.style.opacity = "";
  el.historyModal.classList.remove("arrastando", "aberto");
  el.historyBackdrop.classList.remove("aberto");
  el.historyModal.setAttribute("aria-hidden", "true");
  el.historyModal.inert = true;
  setNavAtivo(estado.visaoAtual);

  setTimeout(liberarRolagem, 210);

  if (restaurarFoco && estado.ultimoFoco instanceof HTMLElement) {
    setTimeout(() => estado.ultimoFoco.focus(), 220);
  }
}

function setNavAtivo(nome) {
  document.querySelectorAll("[data-nav]").forEach(botao => {
    const ativo = botao.dataset.nav === nome;
    botao.classList.toggle("ativo", ativo);

    if (ativo) botao.setAttribute("aria-current", "page");
    else botao.removeAttribute("aria-current");
  });
}

function sinalizarNavegacaoVazia(navNome, texto) {
  const botao = document.querySelector(`[data-nav="${navNome}"]`);
  if (!botao) return;

  const label = botao.querySelector("span");
  const original = label.dataset.original || label.textContent;
  label.dataset.original = original;

  botao.classList.remove("sem-resultado");
  void botao.offsetWidth;
  botao.classList.add("sem-resultado");
  label.textContent = texto;
  botao.setAttribute("aria-label", texto);

  document.querySelector(".section-title")?.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  setTimeout(() => {
    botao.classList.remove("sem-resultado");
    label.textContent = original;
    botao.setAttribute(
      "aria-label",
      navNome === "ofertas"
        ? "Ir para a primeira oferta"
        : "Ir para o primeiro favorito"
    );
    setNavAtivo("inicio");
  }, 1500);
}

function scrollParaPrimeiro(seletor, navNome) {
  const alvo = document.querySelector(seletor);
  setNavAtivo(navNome);

  if (!alvo) {
    sinalizarNavegacaoVazia(
      navNome,
      navNome === "ofertas" ? "Sem ofertas" : "Sem favoritos"
    );
    return;
  }

  alvo.scrollIntoView({ behavior: "smooth", block: "center" });

  if (typeof alvo.animate === "function") {
    alvo.animate([
      { boxShadow: "var(--shadow-sm)" },
      { boxShadow: "0 0 0 4px color-mix(in srgb, var(--primary) 24%, transparent), var(--shadow-md)" },
      { boxShadow: "var(--shadow-sm)" }
    ], {
      duration: 700,
      easing: "ease"
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
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

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
    const sobreposicaoAberta =
      el.drawer.classList.contains("aberto") ||
      el.historyModal.classList.contains("aberto");

    if (window.scrollY !== 0 || estado.carregando || sobreposicaoAberta) return;

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

function configurarGestoDrawer() {
  let inicioX = 0;
  let deslocamento = 0;
  let ativo = false;

  el.drawer.addEventListener("pointerdown", event => {
    if (estado.dispositivo !== "mobile") return;
    if (event.target.closest("button, select, a")) return;

    ativo = true;
    inicioX = event.clientX;
    deslocamento = 0;
    el.drawer.classList.add("arrastando");
    el.drawer.setPointerCapture?.(event.pointerId);
  });

  el.drawer.addEventListener("pointermove", event => {
    if (!ativo) return;

    deslocamento = Math.min(0, event.clientX - inicioX);
    el.drawer.style.transform = `translateX(${deslocamento}px)`;
  });

  const finalizar = () => {
    if (!ativo) return;
    ativo = false;
    el.drawer.classList.remove("arrastando");

    if (deslocamento < -72) {
      fecharDrawer();
    } else {
      el.drawer.style.transform = "";
    }
  };

  el.drawer.addEventListener("pointerup", finalizar);
  el.drawer.addEventListener("pointercancel", finalizar);
}

function configurarGestoHistorico() {
  let inicioY = 0;
  let deslocamento = 0;
  let ativo = false;

  el.historyDragHandle.addEventListener("pointerdown", event => {
    if (estado.dispositivo !== "mobile") return;

    ativo = true;
    inicioY = event.clientY;
    deslocamento = 0;
    el.historyModal.classList.add("arrastando");
    el.historyDragHandle.setPointerCapture?.(event.pointerId);
  });

  el.historyDragHandle.addEventListener("pointermove", event => {
    if (!ativo) return;

    deslocamento = Math.max(0, event.clientY - inicioY);
    el.historyModal.style.transform = `translateY(${deslocamento}px)`;
    el.historyModal.style.opacity = String(Math.max(0.72, 1 - deslocamento / 500));
  });

  const finalizar = () => {
    if (!ativo) return;
    ativo = false;
    el.historyModal.classList.remove("arrastando");

    if (deslocamento > 88) {
      fecharHistorico();
    } else {
      el.historyModal.style.transform = "";
      el.historyModal.style.opacity = "";
    }
  };

  el.historyDragHandle.addEventListener("pointerup", finalizar);
  el.historyDragHandle.addEventListener("pointercancel", finalizar);
}

function hashTexto(texto) {
  let hash = 2166136261;

  for (let indice = 0; indice < texto.length; indice += 1) {
    hash ^= texto.charCodeAt(indice);
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
  preencherHistorico();
});

el.searchRings.addEventListener("input", event => {
  estado.pesquisa = event.target.value;
  renderizar(estado.execucaoAtual?.aneis || []);
});

el.sortRings.addEventListener("change", event => {
  estado.ordenacao = event.target.value;
  renderizar(estado.execucaoAtual?.aneis || []);
});

el.compareFrom.addEventListener("change", () => {
  sincronizarDatasComparacao("inicial");
  renderizarComparacao();
});

el.compareTo.addEventListener("change", () => {
  sincronizarDatasComparacao("final");
  renderizarComparacao();
});

el.openDrawer.addEventListener("click", abrirDrawer);
el.closeDrawer.addEventListener("click", () => fecharDrawer());
el.drawerBackdrop.addEventListener("click", () => fecharDrawer());

el.themeSwitch.addEventListener("click", () => {
  const atual = document.documentElement.dataset.theme;
  aplicarTema(atual === "dark" ? "light" : "dark");
});

el.openHistoryFromDrawer.addEventListener("click", abrirHistorico);
el.closeHistory.addEventListener("click", () => fecharHistorico());
el.historyBackdrop.addEventListener("click", () => fecharHistorico());

document.querySelectorAll("[data-nav]").forEach(botao => {
  botao.addEventListener("click", () => {
    const acao = botao.dataset.nav;

    if (acao === "historico") {
      abrirHistorico();
      return;
    }

    mudarVisao(acao);
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

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  estado.installPrompt = event;
  el.installApp.hidden = false;
});

el.installApp.addEventListener("click", async () => {
  if (!estado.installPrompt) return;
  estado.installPrompt.prompt();
  await estado.installPrompt.userChoice;
  estado.installPrompt = null;
  el.installApp.hidden = true;
});

window.addEventListener("appinstalled", () => {
  estado.installPrompt = null;
  el.installApp.hidden = true;
});

window.addEventListener("online", () => atualizarFrescor(estado.execucaoAtual));
window.addEventListener("offline", () => atualizarFrescor(estado.execucaoAtual));

window.addEventListener("scroll", () => {
  el.toTop.classList.toggle("visivel", window.scrollY > 560);
}, { passive: true });

document.addEventListener("keydown", event => {
  if (el.historyModal.classList.contains("aberto")) {
    if (event.key === "Escape") {
      fecharHistorico();
      return;
    }

    prenderFoco(event, el.historyModal);
    return;
  }

  if (el.drawer.classList.contains("aberto")) {
    if (event.key === "Escape") {
      fecharDrawer();
      return;
    }

    prenderFoco(event, el.drawer);
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
configurarGestoDrawer();
configurarGestoHistorico();
registrarServiceWorker();
monitorarVersao();

window.__appLoadingShortTimer = setTimeout(() => {
  esconderCarregamentoInicial();
}, 1200);

carregarDados();
