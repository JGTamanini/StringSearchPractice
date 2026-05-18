# StringScope — Visualizador de Algoritmos de Busca em Strings

Aplicação educacional para visualização e comparação de algoritmos de busca em strings, instrumentada com **OpenTelemetry** para observabilidade completa.

---

## Stack de Observabilidade

| Componente | URL | Descrição |
|---|---|---|
| Aplicação | http://localhost:3000 | Interface principal |
| Grafana | http://localhost:3001 | Dashboard (login: `admin` / `stringscope`) |
| Jaeger | http://localhost:16686 | Visualização de traces |
| Prometheus | http://localhost:9090 | Métricas brutas |
| Métricas raw | http://localhost:9464/metrics | Endpoint Prometheus da app |

---

## Como Executar

### Com Docker (recomendado)

```bash
# Subir toda a stack
docker compose up --build

# Derrubar tudo
docker compose down
```

### Sem Docker (só o servidor)

```bash
cd Backend
npm install
npm start          # produção
npm run dev        # desenvolvimento (hot-reload)
```

> O servidor roda na porta 3000. Traces tentarão conectar no Jaeger (`localhost:4318`).
> Sem Jaeger rodando, os traces falham silenciosamente, mas a aplicação funciona normalmente.

---

## Algoritmos Implementados

| Algoritmo | Complexidade (melhor) | Complexidade (pior) |
|---|---|---|
| Naive (Força Bruta) | O(nm) | O(nm) |
| Rabin-Karp | O(n+m) | O(nm) |
| KMP | O(n+m) | O(n+m) |
| Boyer-Moore | O(n/m) | O(nm) |

---

## Métricas Coletadas (Prometheus)

- `search_requests_total` — total de buscas por algoritmo
- `search_duration_ms` — histograma de duração em ms por algoritmo
- `search_comparisons` — histograma de comparações por algoritmo
- `search_occurrences_total` — ocorrências encontradas por algoritmo
- `search_text_length` — distribuição do tamanho dos textos de entrada

---

## API

### `POST /api/search`
Executa um algoritmo e retorna o SearchResult completo.
```json
{ "text": "...", "pattern": "...", "algorithm": "kmp" }
```

### `POST /api/search/all`
Executa todos os algoritmos para comparação.
```json
{ "text": "...", "pattern": "..." }
```

### `GET /health`
Health check do servidor.
