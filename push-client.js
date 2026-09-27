(function () {
  "use strict";

  function apiUrl() {
    return String(window.PUSH_CONFIG?.apiUrl || "").replace(/\/$/, "");
  }

  function base64UrlParaUint8Array(valor) {
    const preenchido = `${valor}${"=".repeat((4 - valor.length % 4) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
    const dados = atob(preenchido);
    return Uint8Array.from(dados, caractere => caractere.charCodeAt(0));
  }

  async function ativarNotificacoes(botao) {
    const baseUrl = apiUrl();
    if (!baseUrl) {
      alert("As notificações ainda não foram configuradas neste app.");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      alert("Este navegador não oferece suporte a notificações push.");
      return;
    }

    botao.disabled = true;
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") throw new Error("Permissão não concedida");

      const registro = await navigator.serviceWorker.ready;
      const respostaChave = await fetch(`${baseUrl}/api/push/chave-publica`);
      if (!respostaChave.ok) throw new Error("Não foi possível obter a chave de notificações");
      const { chavePublica } = await respostaChave.json();
      const assinatura = await registro.pushManager.getSubscription()
        || await registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlParaUint8Array(chavePublica)
        });

      const resposta = await fetch(`${baseUrl}/api/push/inscricoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assinatura })
      });
      if (!resposta.ok) throw new Error("Não foi possível salvar este celular para receber avisos");

      botao.textContent = "Notificações ativadas";
      botao.disabled = true;
    } catch (erro) {
      console.warn("Não foi possível ativar notificações:", erro);
      alert(erro.message || "Não foi possível ativar as notificações.");
      botao.disabled = false;
    }
  }

  window.configurarBotaoDeNotificacoes = function configurarBotaoDeNotificacoes(id) {
    const botao = document.getElementById(id);
    if (!botao) return;
    botao.addEventListener("click", () => ativarNotificacoes(botao));
  };
}());
