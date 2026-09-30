import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHarness, plain } from './harness.mjs';

test('presença ausente não vira 0% nem alerta falso', () => {
  const { M } = makeHarness();
  assert.deepEqual(plain(M.riskReasons({ status: 'Ativo', attendance_percent: null })), []);
  assert.deepEqual(plain(M.riskReasons({ status: 'Ativo', attendance_percent: '' })), []);
  assert.equal(M.riskReasons({ status: 'Ativo', attendance_percent: 0 }).length, 1);
  assert.deepEqual(plain(M.riskReasons({ status: 'Concluído', attendance_percent: 0 })), []);
  assert.equal(M.number(''), null); assert.equal(M.number(0), 0);
});
test('risco acadêmico considera prazo, avaliação e presença, sem inventar notas', () => {
  const { M } = makeHarness();
  const reasons = M.riskReasons({ status: 'Matriculado', risk_level: 'Alto', performance: 'Crítico', attendance_percent: 74, next_action_due: '2026-08-30' }, '2026-09-01');
  assert.equal(reasons.length, 4);
  assert.equal(M.overdue('2026-08-01', 'Concluída', '2026-09-01'), false);
});
test('quadro trata encerramento, rejeição e contratação corretamente', () => {
  const { M } = makeHarness();
  for (const label of ['Encerrado', 'Rejeitado', 'Removido', 'Excluído', 'Cancelada']) assert.equal(M.selectionBucket({ stage: label, status: 'Ativo' }), 'closed');
  assert.equal(M.selectionBucket({ stage: 'Não gostou', status: 'Ativo' }), 'sent');
  assert.equal(M.selectionBucket({ stage: 'Entrevista', status: 'Encerrado' }), 'closed');
  assert.equal(M.selectionBucket({ stage: 'Contratado', status: 'Ativo' }), 'hired');
  assert.equal(M.selectionBucket({ stage: 'Aguardando resposta', status: 'Ativo' }), 'sent');
});
test('inelegibilidade antiga não arquiva o vínculo e a avaliação original permanece visível', () => {
  const { M } = makeHarness();
  const row = M.canonicalMatch({ id: 'antigo', candidato_id: 't1', empregador_id: 'e1', status_vinculo: 'Mapeado', elegivel: false, match_strength: 42 }, 'candidate_employer_matches');
  assert.equal(row.status, 'Ativo'); assert.equal(row.viability, 'Baixa'); assert.equal(row.overall_score, 42);
  assert.equal(M.selectionBucket(row), 'review');
});
test('vínculos anteriores permanecem mesmo com a tabela moderna vazia', () => {
  const { M, fixture } = makeHarness();
  const rows = M.mergeMatches([], fixture.db.candidate_employer_matches, fixture.db.candidate_employer_links);
  assert.equal(rows.length, 1); assert.equal(rows[0].sources.length, 2);
  assert.equal(rows[0].talent_id, 'DEMO-T3'); assert.equal(rows[0]._source, 'candidate_employer_matches');
});
test('conflito entre fontes antigas fica explícito e os originais não são alterados', () => {
  const { M, fixture } = makeHarness();
  fixture.db.candidate_employer_links[0].status_vinculo = 'Contratado';
  const original = JSON.stringify(fixture.db);
  const rows = M.mergeMatches(fixture.db.talent_opportunity_matches, fixture.db.candidate_employer_matches, fixture.db.candidate_employer_links);
  assert.equal(rows.length, 3); assert.equal(rows[2].sourceConflict, true);
  assert.equal(rows[2].stage, 'Em processo'); assert.equal(JSON.stringify(fixture.db), original);
});
test('contatos unificados mantêm IDs e não escondem origem órfã', () => {
  const { M, fixture, id } = makeHarness(), db = fixture.db;
  const rows = M.buildContacts(db.candidatos, db.employers, db.contact_records, db.contact_categories, db.contact_record_categories);
  const marina = rows.filter((r) => r.sourceId === 'DEMO-T1');
  assert.equal(marina.length, 1); assert.equal(marina[0].contactId, id(504)); assert.ok(marina[0].roles.includes('Talento'));
  const orphan = rows.find((r) => r.contactId === id(503)); assert.equal(orphan.unresolved, true);
  assert.ok(rows.some((r) => r.displayName.includes('Café da Praça')));
});
test('duplicidades incluem canais secundários e não unem pessoas automaticamente', () => {
  const { M } = makeHarness();
  const rows = [{ key: 'a', email: 'a@example.invalid', link: { secondary_email: 'COMUM@example.invalid' } }, { key: 'b', email: 'comum@example.invalid', link: {} }, { key: 'c', phone: '0000000000', link: {} }];
  const groups = M.duplicateGroups(rows);
  assert.equal(groups.length, 1); assert.equal(groups[0].rows.length, 2); assert.equal(rows.length, 3);
});
test('HTML e links de dados são escapados; protocolos executáveis são recusados', () => {
  const { U, W, M } = makeHarness();
  assert.equal(M.safeUrl('javascript:alert(1)'), ''); assert.equal(M.safeUrl('data:text/html,test'), '');
  assert.equal(M.safeUrl('https://user:password@example.com/'), '');
  assert.match(U.field('Nome', '<img src=x onerror=alert(1)>'), /&lt;img/);
  assert.doesNotMatch(W.person('<script>x</script>'), /<script>/);
  assert.match(U.field('Pronto', false), />Não</);
});
test('opções anteriores desconhecidas continuam disponíveis nos formulários', () => {
  const { W } = makeHarness();
  const html = W.optionsHtml(['Ativo', 'Inativo'], 'Etapa personalizada antiga');
  assert.match(html, /value="Etapa personalizada antiga" selected/);
});
test('acervo só expõe as seções conhecidas, sem restaurar ou gravar snapshots', () => {
  const { M } = makeHarness();
  const original = { state: { employers: [{ name: 'Exemplo' }], dossiers: {}, unexpected: 'ignore' } };
  assert.deepEqual(Object.keys(M.snapshotEntries(original)), ['employers', 'dossiers']);
  assert.equal(original.state.unexpected, 'ignore');
});
test('calendário usa o dia local para timestamps e mantém datas sem horário intactas', () => {
  const previous = process.env.TZ; process.env.TZ = 'America/Sao_Paulo';
  try {
    const { M } = makeHarness();
    assert.equal(M.dateOnly('2026-09-01T01:00:00Z'), '2026-08-31');
    assert.equal(M.dateOnly('2026-09-01'), '2026-09-01');
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
