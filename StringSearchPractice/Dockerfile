FROM node:22-alpine

WORKDIR /app

# Instala dependências antes de copiar o código (cache de layers)
COPY Backend/package.json ./Backend/
RUN cd Backend && npm install --omit=dev

# Copia código fonte
COPY Backend/ ./Backend/
COPY Frontend/ ./Frontend/

WORKDIR /app/Backend

EXPOSE 3000 9464

CMD ["node", "--import", "./tracing.js", "server.js"]
