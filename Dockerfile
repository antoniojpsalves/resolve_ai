# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# deps: só instala dependências (npm ci completo, com devDependencies — o
# estágio `builder` precisa delas para processar o CSS via
# @tailwindcss/postcss/tw-animate-css, ver src/app/globals.css). Separado do
# `builder` só para aproveitar cache de camada: se o código mudar mas
# package.json/package-lock.json não, o Docker reusa esta camada inteira.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# builder: gera o Prisma Client e a build de produção (output: 'standalone',
# ver next.config.ts). `prisma generate` só lê prisma/schema.prisma, não
# conecta a banco nenhum — não precisa de DATABASE_URL aqui. Precisa, porém,
# de um AUTH_SECRET disponível durante `next build` (mesmo padrão do job
# `quality` do CI) — o default abaixo é só para permitir a build, nunca deve
# ser usado como segredo real de runtime (esse é passado no `docker run`).
# ---------------------------------------------------------------------------
FROM node:24-alpine AS builder
WORKDIR /app

ARG AUTH_SECRET=docker-build-secret-nao-usar-em-producao
ENV AUTH_SECRET=$AUTH_SECRET

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ---------------------------------------------------------------------------
# runner: imagem final de produção. Roda `node server.js` (entrypoint do
# build standalone) — NUNCA `next start`/`npm run start`: `next start` não
# funciona corretamente com `output: 'standalone'` (achado confirmado na
# Tarefa 3 do Dia 4 — ver docs/sdd/dia-04/tarefa-3-relatorio.md) e o
# `standalone/` sequer inclui a CLI completa do Next para `next start`
# funcionar.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
# Sem isto o servidor standalone do Next escuta só em localhost dentro do
# container — inacessível de fora mesmo com a porta publicada no host.
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# O build `standalone` não inclui public/ nem .next/static/ sozinho — são
# cópias manuais adicionais, na estrutura exata abaixo, ou o servidor sobe
# mas serve assets estáticos quebrados/404 (confirmado ao vivo na Parte E).
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Diretório de upload local gravável: sem BLOB_READ_WRITE_TOKEN, a
# aplicação usa .storage/uploads/ (src/modules/occurrence/infra/
# file-storage.ts) — sem o diretório existir e ser gravável dentro do
# container, todo upload responde 500. Resolver upload em produção real
# (Blob) é decisão do Dia 5; aqui só garantimos que o container não fica
# quebrado por causa disso.
RUN mkdir -p .storage/uploads && chown -R nextjs:nodejs .storage

USER nextjs

EXPOSE 3000

# Alpine tem wget via busybox por padrão — não assume curl disponível.
# 127.0.0.1, não localhost: confirmado ao vivo (Parte E) que dentro do
# container "localhost" resolve para ::1 primeiro, e o servidor Next só
# escuta em IPv4 (HOSTNAME=0.0.0.0 não abre socket IPv6) — com "localhost"
# o healthcheck falhava com "connection refused" mesmo com o servidor no ar
# e respondendo normalmente via IPv4/porta publicada.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health || exit 1

CMD ["node", "server.js"]
