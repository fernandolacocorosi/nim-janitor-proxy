// Proxy OpenAI-compatible: Janitor AI -> NVIDIA NIM (build.nvidia.com)
// Roda como Serverless Function no Vercel.

const NIM_BASE = (process.env.NIM_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, "");

// Só repassa endpoints conhecidos
const ALLOWED_PATHS = new Set(["chat/completions", "completions", "models", "embeddings"]);

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const path = String(req.query.path || "").replace(/^\/+|\/+$/g, "");
  if (!ALLOWED_PATHS.has(path)) {
    return sendJson(res, 404, { error: { message: `Endpoint não suportado: /v1/${path}` } });
  }

  // --- Autenticação ---
  // Modo 1 (padrão): você coloca a sua chave da NVIDIA no campo "API Key" do Janitor AI
  //                  e o proxy apenas repassa.
  // Modo 2: define NVIDIA_API_KEY no Vercel; a chave fica escondida no servidor.
  //         (Recomendado definir também PROXY_ACCESS_KEY para ninguém usar seu proxy.)
  const incomingKey = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const serverKey = process.env.NVIDIA_API_KEY;
  const accessKey = process.env.PROXY_ACCESS_KEY;

  let apiKey;
  if (serverKey) {
    if (accessKey && incomingKey !== accessKey) {
      return sendJson(res, 401, { error: { message: "Chave de acesso do proxy inválida." } });
    }
    apiKey = serverKey;
  } else {
    apiKey = incomingKey;
  }

  if (!apiKey) {
    return sendJson(res, 401, { error: { message: "Nenhuma API key fornecida." } });
  }

  // --- Monta a requisição para a NVIDIA ---
  const url = `${NIM_BASE}/${path}`;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: req.headers.accept || "application/json",
  };

  const init = { method: req.method, headers };

  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { /* mantém string */ }
    }
    if (body && typeof body === "object") {
      // Opcional: força um modelo específico, ignorando o que o Janitor mandar
      if (process.env.FORCE_MODEL) body.model = process.env.FORCE_MODEL;
      // Alguns campos que o Janitor às vezes envia e a NIM pode rejeitar
      delete body.repetition_penalty_range;
    }
    init.body = typeof body === "string" ? body : JSON.stringify(body || {});
  }

  const controller = new AbortController();
  req.on("close", () => controller.abort());
  init.signal = controller.signal;

  try {
    const upstream = await fetch(url, init);

    res.statusCode = upstream.status;
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");

    if (!upstream.body) return res.end();

    // Repassa o stream (SSE) chunk por chunk
    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    if (err && err.name === "AbortError") return; // cliente desconectou
    if (!res.headersSent) {
      return sendJson(res, 502, { error: { message: "Falha ao contactar a NVIDIA NIM: " + (err && err.message) } });
    }
    res.end();
  }
};
