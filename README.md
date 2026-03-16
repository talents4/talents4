# T4 Chatbot — Assistente de Recrutamento Internacional

Chatbot híbrido com Gemini + Supabase para o CRM Talents4.

## Arquitetura

```
Frontend (burro)
     │ POST /api/chat/message
     ▼
┌─────────────────────────────────────────────────────┐
│  chat-service.ts  (pipeline orquestrador)           │
│                                                     │
│  1. getOrCreateSession + getRecentMessages          │
│  2. classifyIntent() ──→ Gemini Call 1 (JSON)       │
│     └── fallback: classificador local por keywords  │
│  3. resolveKnowledge() ──→ scoring por keywords     │
│  4. resolveData() ──→ query handler fechado         │
│     └── fallback: mensagem de erro controlada       │
│  5. generateFinalAnswer() ──→ Gemini Call 2         │
│     └── fallback: template com dados estruturados  │
│  6. guardResponse() ──→ validação final             │
│  7. persistMessages() + summarise se necessário     │
└─────────────────────────────────────────────────────┘
```

### Tipos de pergunta suportados

| Tipo | Exemplo | Fonte |
|---|---|---|
| A — FAQ | "Como funciona o processo?" | Knowledge base |
| B — Dinâmico | "Qual o status da Maria Silva?" | Supabase |
| C — Híbrido | "O que falta pro João e qual a regra?" | Knowledge + Supabase |

---

## Setup

### 1. Pré-requisitos

- Node.js 20+
- Projeto Supabase criado
- Gemini API Key (Google AI Studio)

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
# Preencher todas as variáveis em .env.local
```

Variáveis obrigatórias:

```
GEMINI_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 4. Criar tabelas no Supabase

Execute no **SQL Editor** do Supabase:

```sql
-- Cole o conteúdo de db/migrations/001_chat_tables.sql
```

### 5. Seed de dados de teste (opcional)

```sql
-- Cole o conteúdo de db/seeds/001_test_data.sql
```

### 6. Rodar localmente

```bash
npm run dev
# Acesse http://localhost:3000
```

---

## Testes

```bash
# Todos os testes
npm test

# Com cobertura
npm run test:coverage

# Watch mode
npm run test:watch
```

### Cenários cobertos pelos testes

| # | Cenário | Arquivo |
|---|---|---|
| 1 | FAQ institucional — sem DB, usa knowledge | `knowledge-resolver.test.ts`, `chat-service.test.ts` |
| 2 | Status de candidato existente | `data-resolver.test.ts`, `chat-service.test.ts` |
| 3 | Documentos faltantes | `data-resolver.test.ts` |
| 4 | Pergunta híbrida | `chat-service.test.ts` |
| 5 | Nome ambíguo | `classify-intent.test.ts`, `data-resolver.test.ts` |
| 6 | Candidato inexistente | `data-resolver.test.ts` |
| 7 | Falha no classificador Gemini | `classify-intent.test.ts` |
| 8 | Falha na resposta final Gemini | `response-guard.test.ts` |
| 9 | Falha no Supabase | `data-resolver.test.ts`, `chat-service.test.ts` |
| 10 | Histórico longo → sumarização | `chat-service.test.ts` |

---

## Adicionar novos blocos de knowledge base

Edite `src/lib/knowledge/knowledge-index.ts` e adicione um novo `KnowledgeBlock`:

```ts
{
  slug: "novo_topico",
  category: "process_rules",       // ver KnowledgeCategory
  title: "Título do bloco",
  content: "Conteúdo completo...",
  keywords: ["palavra1", "palavra2"],
  priority: 2,                      // 1 = mais importante
  version: "1.0",
  isActive: true,
}
```

Nenhuma alteração de código adicional é necessária. O resolver seleciona automaticamente.

---

## Adicionar nova ação de banco

1. **`src/lib/data/allowed-actions.ts`** — adicionar a action ao tipo `ActionDefinition[]`
2. **`src/lib/data/query-handlers.ts`** — criar a função dedicada com parâmetros validados
3. **`src/lib/data/data-resolver.ts`** — adicionar o case no switch
4. **`src/types/chat.ts`** — adicionar ao `ActionSchema` enum
5. **Testes** — adicionar cenário em `data-resolver.test.ts`

---

## Estrutura de arquivos

```
src/
  app/
    api/
      chat/message/route.ts      ← pipeline principal
      chat-feedback/route.ts
      chat-session/route.ts
    layout.tsx
    page.tsx
    globals.css
  components/
    ChatWindow.tsx                ← estado central do chat
    ChatMessage.tsx
    ChatInput.tsx
    ChatHeader.tsx
    LoadingState.tsx
  lib/
    ai/
      gemini-client.ts            ← wrapper com timeout
      classify-intent.ts          ← Call 1 + fallback local
      generate-final-answer.ts    ← Call 2 + template fallback
      prompts.ts                  ← todos os prompts centralizados
    chat/
      chat-service.ts             ← orquestrador do pipeline
      session-service.ts
      summarizer.ts
      response-guard.ts
    data/
      allowed-actions.ts          ← whitelist de operações
      query-handlers.ts           ← uma função por operação
      data-resolver.ts            ← roteador + serialização
    knowledge/
      knowledge-index.ts          ← blocos de conhecimento
      knowledge-resolver.ts       ← seleção por scoring
    supabase/
      server.ts
      client.ts
    utils/
      logger.ts
      errors.ts
      sanitize.ts
      constants.ts
  types/
    chat.ts                       ← schemas Zod + tipos
    domain.ts
    knowledge.ts
  __tests__/
    classify-intent.test.ts
    data-resolver.test.ts
    knowledge-resolver.test.ts
    response-guard.test.ts
    chat-service.test.ts
db/
  migrations/001_chat_tables.sql
  seeds/001_test_data.sql
knowledge-base/                   ← arquivos MD de referência
DECISIONS.md                      ← decisões arquiteturais
.env.example
```
