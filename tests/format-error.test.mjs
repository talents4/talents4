import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHarness } from './harness.mjs';

// Redesign UI/UX desta conversa: mensagens técnicas (SQL do Postgres, texto
// bruto de fetch()) nunca podem chegar à tela — só ao console do navegador,
// que é o log técnico disponível nesta pilha sem backend próprio.
test('erro do Postgres com código não mapeado não expõe SQL bruto na tela', () => {
  const { W } = makeHarness();
  const raw = { code: '23514', message: 'new row for relation "talentos" violates check constraint "talentos_status_check"' };
  const shown = W.formatError(raw);

  assert.ok(!shown.includes('constraint'), 'não deve conter jargão SQL bruto');
  assert.ok(!shown.includes('relation'), 'não deve conter jargão SQL bruto');
  assert.match(shown, /validação/i, 'explica a regra de validação');
  assert.match(shown,/opções e quantidades/i);
});

test('falha de rede (fetch) vira mensagem de conexão, não "Failed to fetch"', () => {
  const { W } = makeHarness();
  const shown = W.formatError(new TypeError('Failed to fetch'));

  assert.ok(!shown.includes('Failed to fetch'), 'não repete o texto técnico do navegador');
  assert.match(shown, /conex[ãa]o/i, 'explica que é um problema de conexão');
});

test('códigos conhecidos continuam com a mensagem específica de sempre', () => {
  const { W } = makeHarness();
  assert.match(W.formatError({ code: '23505' }), /já existe um registro/i);
  assert.match(W.formatError({ code: '42501' }), /permissão/i);
});

test('mensagens próprias do app (sem .code) continuam passando direto', () => {
  const { W } = makeHarness();
  const shown = W.formatError(new Error('Acervo indisponível. Nenhuma restauração foi executada.'));
  assert.equal(shown, 'Acervo indisponível. Nenhuma restauração foi executada.');
});
