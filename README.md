# NIM → Janitor AI Proxy (Vercel)

Proxy compatível com a API da OpenAI que encaminha as requisições do **Janitor AI** para o **NVIDIA NIM** (`https://integrate.api.nvidia.com/v1`), hospedado de graça no **Vercel**. Suporta streaming (SSE) e CORS.

## Estrutura

```
nim-janitor-proxy/
├── api/
│   └── proxy.js        # função serverless que faz o proxy
├── vercel.json         # reescreve /v1/* para a função
├── package.json
├── .env.example
└── .gitignore
```

## 1. Pegue sua chave da NVIDIA

1. Entre em <https://build.nvidia.com> e faça login.
2. Escolha um modelo (ex.: `meta/llama-3.3-70b-instruct`) e clique em **Get API Key**.
3. Copie a chave (começa com `nvapi-`).

## 2. Suba para o GitHub

```bash
cd nim-janitor-proxy
git init
git add .
git commit -m "NIM proxy para Janitor AI"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/nim-janitor-proxy.git
git push -u origin main
```

(Crie antes o repositório vazio em <https://github.com/new>.)

## 3. Deploy no Vercel

1. Acesse <https://vercel.com/new> e importe o repositório.
2. Em **Framework Preset** deixe **Other** (não precisa de build).
3. Em **Environment Variables**, escolha **um** dos modos:

### Modo A — Chave no Janitor (mais simples)
Não defina nada. Você coloca sua chave `nvapi-...` direto no campo de API Key do Janitor AI e o proxy só repassa.

### Modo B — Chave escondida no servidor (recomendado)
| Variável | Valor |
|---|---|
| `NVIDIA_API_KEY` | sua chave `nvapi-...` |
| `PROXY_ACCESS_KEY` | uma senha que você inventar |

No Janitor, o campo API Key recebe a `PROXY_ACCESS_KEY`. Assim ninguém que descubra a URL consegue gastar sua cota.

4. Clique em **Deploy**. Você vai ganhar uma URL como `https://nim-janitor-proxy.vercel.app`.

## 4. Configure no Janitor AI

Em **API Settings → Proxy** (ou "Custom/OpenAI-compatible"):

| Campo | Valor |
|---|---|
| **Proxy URL** | `https://SEU-PROJETO.vercel.app/v1/chat/completions` |
| **API Key** | sua `nvapi-...` (Modo A) ou sua `PROXY_ACCESS_KEY` (Modo B) |
| **Model** | o ID do modelo, ex.: `meta/llama-3.3-70b-instruct` |

> Se o Janitor pedir só a base URL, use `https://SEU-PROJETO.vercel.app/v1`.

### Alguns modelos populares do NIM
- `meta/llama-3.3-70b-instruct`
- `meta/llama-3.1-405b-instruct`
- `deepseek-ai/deepseek-r1`
- `nvidia/llama-3.1-nemotron-70b-instruct`
- `mistralai/mixtral-8x22b-instruct-v0.1`

A lista atual está em <https://build.nvidia.com/models>.

## Testando

```bash
curl https://SEU-PROJETO.vercel.app/v1/chat/completions \
  -H "Authorization: Bearer SUA_CHAVE" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta/llama-3.3-70b-instruct",
    "messages": [{"role": "user", "content": "Olá!"}],
    "max_tokens": 100
  }'
```

## Solução de problemas

- **401**: chave errada ou ausente. No Modo B, confira se o Janitor está enviando a `PROXY_ACCESS_KEY`.
- **404 em `/v1/...`**: confira se o `vercel.json` foi enviado ao GitHub e faça um redeploy.
- **Respostas cortadas / timeout**: o plano gratuito do Vercel limita o tempo da função. O `vercel.json` pede 60s; se o seu plano permitir menos, a resposta pode ser interrompida. Reduza `max_tokens` ou use um modelo mais rápido.
- **Erro 400 da NVIDIA**: algum parâmetro do Janitor não é aceito pelo modelo. Abra os logs no painel do Vercel (aba **Logs**) para ver a mensagem.
- **Variáveis novas não funcionam**: depois de mudar variáveis de ambiente, faça **Redeploy**.

## Aviso

Nunca suba sua chave `nvapi-...` para o GitHub. Use sempre as variáveis de ambiente do Vercel.
