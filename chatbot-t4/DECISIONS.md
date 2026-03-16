# Decisões Arquiteturais — Chatbot T4

## O que foi feito e por quê

### 1. Duas chamadas de IA separadas (classificador + redator)
**Feito:** Toda mensagem passa por dois steps de IA: classificador (JSON puro, sem resposta ao usuário) e gerador de resposta final.
**Por quê:** Evita que a IA "invente" chamadas de banco ou misture intenção com resposta. O classificador é determinístico e validado por Zod antes de qualquer ação.

### 2. Backend como único ponto de inteligência
**Feito:** Frontend é "burro" — apenas envia a mensagem e exibe a resposta. Nenhuma chave, nenhum prompt, nenhuma regra de negócio no cliente.
**Por quê:** Segurança, controle e manutenibilidade. Mudanças de regra não exigem deploy do frontend.

### 3. Ações de banco fechadas (whitelist)
**Feito:** `allowed-actions.ts` lista explicitamente as 7 únicas operações de banco que a IA pode triggear. Cada uma tem uma função dedicada em `query-handlers.ts` com parâmetros validados e `LIMIT` explícito.
**Por quê:** Elimina SQL injection via IA e garante que o modelo nunca acesse tabelas não previstas.

### 4. Fallback em cada camada
**Feito:**
- Classificador falha → fallback local por palavras-chave
- Resposta final falha → template com dados já resolvidos
- Banco falha → mensagem de erro controlada, sem invenção
- Ambiguidade → pergunta de clarificação, sem escolha arbitrária

**Por quê:** O sistema nunca para completamente. Cada camada tem contingência independente.

### 5. Knowledge base em código (não embeddings)
**Feito:** `knowledge-index.ts` define blocos com keywords e categorias. Seleção por scoring determinístico.
**Por quê:** Zero custo, zero latência extra, zero dependência de vector DB. Para o volume atual (< 20 blocos), keyword scoring é mais confiável que embeddings. Evolução para embeddings é trivial no futuro.

### 6. Sessão com sumarização progressiva
**Feito:** `summarizer.ts` condensa o histórico quando atinge SUMMARISE_AFTER mensagens. O prompt recebe apenas as últimas N mensagens + resumo persistido.
**Por quê:** Controla custo de tokens sem perder contexto relevante.

### 7. Response guard como barreira final
**Feito:** `response-guard.ts` valida resposta antes de enviar ao usuário. Detecta vazio, placeholder, texto excessivo.
**Por quê:** Última linha de defesa contra output malformado ou alucinado.

---

## O que foi deliberadamente evitado

| Decisão | Motivo |
|---|---|
| LangChain | Abstração desnecessária com overhead de manutenção |
| Embeddings / vector search | Custo e complexidade não justificados no estágio atual |
| SQL gerado livremente pela IA | Risco de injeção e acesso irrestrito a tabelas |
| Múltiplos agentes | Não há caso de uso que justifique no escopo atual |
| Histórico completo no prompt | Custo de tokens e risco de context poisoning |
| Gemini no frontend | Risco de vazamento de API key |
| n8n como orquestrador | Acoplamento de infra desnecessário |
| Rate limit em Redis | Complexidade não justificada agora; substituição é trivial |

---

## Limitações remanescentes reais

1. **Rate limiter em memória** — reseta ao reiniciar o servidor. Para produção com múltiplas instâncias, substituir por Upstash Redis.
2. **Knowledge base em código** — adicionar novo bloco exige PR. Para times não-técnicos, mover para tabela `knowledge_documents` no Supabase.
3. **Sem autenticação real** — RLS no Supabase está comentado. Habilitar se houver multiusuário.
4. **Sem streaming** — respostas chegam completas. Para UX mais fluida, implementar SSE/stream na rota e no `ChatWindow`.
5. **Tabelas assumidas** — `candidatos`, `empregadores`, `matches`, `documentos_candidato` precisam existir com os nomes e colunas esperados. Se o schema do CRM for diferente, ajustar `query-handlers.ts`.
