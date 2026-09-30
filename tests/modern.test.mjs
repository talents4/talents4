import test from 'node:test';
import assert from 'node:assert/strict';

// t4-v2-models.js e t4-modern.js são scripts de navegador que esperam
// `window` como global (sem fallback para globalThis, diferente de
// t4-workbook.js). Um shim mínimo é suficiente pois nextActions() é lógica
// pura, sem DOM.
globalThis.window = globalThis;
await import('../assets/t4-v2-models.js');
await import('../assets/t4-modern.js');

test('próximo passo de uma Seleção usa next_action_at (regressão do campo trocado next_action_due)', () => {
  const state = {
    activities: [],
    enrollments: [],
    selections: { rows: [{
      talent_id: 'T1', stage: 'Apresentado', status: 'Ativo',
      next_action: 'Confirmar retorno sobre o perfil', next_action_at: '2026-09-03T14:00:00Z', owner_username: 'demo'
    }] }
  };
  const [next] = window.T4Modern.nextActions(state, 'T1');
  assert.equal(next.source, 'Seleção');
  assert.equal(next.due, '2026-09-03T14:00:00Z', 'due precisa vir de next_action_at, não de next_action_due (que não existe em talent_opportunity_matches)');
});

test('próximo passo combina Agenda, Seleção e Alemão e ordena pela data mais próxima', () => {
  const state = {
    activities: [{ talent_id: 'T1', status: 'Pendente', title: 'Ligar para o Talento', due_at: '2026-09-10', owner_username: 'ana' }],
    enrollments: [{ candidate_id: 'T1', status: 'Ativo', next_action: 'Reforçar conversação', next_action_due: '2026-09-01', owner_name: 'prof' }],
    selections: { rows: [{ talent_id: 'T1', stage: 'Entrevista', status: 'Ativo', next_action: 'Preparar entrevista', next_action_at: '2026-09-05', owner_username: 'demo' }] }
  };
  const result = window.T4Modern.nextActions(state, 'T1');
  assert.equal(result.length, 3);
  assert.deepEqual(result.map((r) => r.source), ['Alemão', 'Seleção', 'Agenda'], 'deve ordenar pela data mais próxima (09-01 < 09-05 < 09-10)');
});

test('seleções encerradas/contratadas não entram no próximo passo', () => {
  const state = {
    activities: [], enrollments: [],
    selections: { rows: [{ talent_id: 'T1', stage: 'Contratado', status: 'Ativo', next_action: 'Não deveria aparecer', next_action_at: '2026-09-01', owner_username: 'demo' }] }
  };
  assert.deepEqual(window.T4Modern.nextActions(state, 'T1'), []);
});
