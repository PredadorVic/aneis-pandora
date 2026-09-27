require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const webpush = require("web-push");

const porta = Number(process.env.PORT || process.env.PUSH_PORT || 3030);
const origemPermitida = String(process.env.PUSH_ALLOWED_ORIGIN || "").replace(/\/$/, "");
const arquivoInscricoes = process.env.PUSH_SUBSCRIPTIONS_FILE || path.join(__dirname, "data", "push-subscriptions.json");
const chavePublica = process.env.VAPID_PUBLIC_KEY;
const chavePrivada = process.env.VAPID_PRIVATE_KEY;
const assunto = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
const tokenApi = process.env.PUSH_API_TOKEN;

if (!chavePublica || !chavePrivada || !origemPermitida || !tokenApi) {
    throw new Error("Defina VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_ALLOWED_ORIGIN e PUSH_API_TOKEN no .env.");
}
webpush.setVapidDetails(assunto, chavePublica, chavePrivada);

function lerInscricoes() {
    try { return JSON.parse(fs.readFileSync(arquivoInscricoes, "utf8")); } catch { return []; }
}
function salvarInscricoes(inscricoes) {
    fs.mkdirSync(path.dirname(arquivoInscricoes), { recursive: true });
    fs.writeFileSync(arquivoInscricoes, JSON.stringify(inscricoes, null, 2), "utf8");
}
function cors(req, res, next) {
    if (req.headers.origin === origemPermitida) res.setHeader("Access-Control-Allow-Origin", origemPermitida);
    res.setHeader("Vary", "Origin");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
}
function origemValida(req) { return req.headers.origin === origemPermitida; }

const app = express();
app.use(express.json({ limit: "20kb" }));
app.use(cors);
app.get("/health", (_, res) => res.json({ ok: true }));
app.get("/api/push/chave-publica", (req, res) => {
    if (!origemValida(req)) return res.sendStatus(403);
    res.json({ chavePublica });
});
app.post("/api/push/inscricoes", (req, res) => {
    if (!origemValida(req) || !req.body?.assinatura?.endpoint) return res.sendStatus(400);
    const inscricoes = lerInscricoes();
    const nova = req.body.assinatura;
    const indice = inscricoes.findIndex(item => item.endpoint === nova.endpoint);
    if (indice >= 0) inscricoes[indice] = nova; else inscricoes.push(nova);
    salvarInscricoes(inscricoes);
    res.sendStatus(201);
});
app.post("/api/push/enviar", async (req, res) => {
    if (req.headers.authorization !== `Bearer ${tokenApi}`) return res.sendStatus(401);
    const payload = JSON.stringify({
        title: String(req.body?.titulo || "Busca Preços"),
        body: String(req.body?.corpo || "Preços atualizados."),
        url: String(req.body?.url || "/")
    });
    const inscricoes = lerInscricoes();
    const ativas = [];
    let enviadas = 0;
    for (const inscricao of inscricoes) {
        try { await webpush.sendNotification(inscricao, payload); ativas.push(inscricao); enviadas++; }
        catch (erro) { if (![404, 410].includes(erro.statusCode)) ativas.push(inscricao); }
    }
    salvarInscricoes(ativas);
    res.json({ enviadas });
});

app.listen(porta, () => console.log(`Servidor de notificações em execução na porta ${porta}.`));
