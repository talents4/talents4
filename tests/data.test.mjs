import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHarness, plain } from './harness.mjs';

test('sessão sem perfil interno não recebe papel viewer por padrão', async () => {
  const h = makeHarness({ role: null }); await assert.rejects(h.init(), /sem perfil interno autorizado/);
  assert.equal(h.D.canEdit(), false); assert.equal(h.fixture.writes.length, 0);
});
test('usuário viewer consegue ler e não consegue gravar', async () => {
  const h = makeHarness({ role: 'viewer' }); await h.init();
  assert.equal((await h.D.loadCandidates({ activeOnly: false })).length, 5);
  await assert.rejects(h.D.insert('contact_records', { display_name: 'Teste' }), /somente para leitura/);
  assert.equal(h.fixture.writes.length, 0);
});
test('perfil inativo é recusado antes de carregar dados da aplicação', async () => {
  const h = makeHarness(); h.fixture.db.usuarios[0].ativo = 'NÃO'; await assert.rejects(h.init(), /desativado/);
  assert.deepEqual([...new Set(h.fixture.reads.map((r) => r.table))], ['usuarios']);
});
test('paginação continua quando o servidor entrega menos linhas que o solicitado', async () => {
  const h = makeHarness(); await h.init(); h.fixture.pageCap = 2;
  const rows = await h.D.all('candidatos'); assert.equal(rows.length, 5);
  assert.deepEqual(plain(h.fixture.reads.filter((r) => r.table === 'candidatos').map((r) => r.offset)), [0, 2, 4, 5]);
});
test('limite de segurança falha explicitamente em vez de mostrar totais truncados', async () => {
  const h = makeHarness(); await h.init();
  await assert.rejects(h.D.all('candidatos', '*', null, { maxRows: 3, pageSize: 2 }), /mais de 3 registros/);
});
test('leitura compatível retira somente a coluna inexistente e emite aviso', async () => {
  const h = makeHarness(); await h.init(); const from = h.D.client.from;
  h.D.client.from = (table) => { const q = from(table), run = q.run; q.run = function () {
    if (table === 'candidatos' && this.columns.split(',').includes('idade')) return { data: null, error: { code: '42703', message: 'column candidatos.idade does not exist' } };
    return run.call(this);
  }; return q; };
  const rows = await h.D.loadCandidates({ activeOnly: false });
  assert.equal(rows.length, 5); assert.equal(rows[0].documentacao_completa != null, true);
  assert.match(h.D.readWarnings[0], /idade/); assert.ok(!h.fixture.reads.some((r) => r.table === 'candidatos' && r.columns === '*'));
});
test('erros de permissão não são tratados como tabela vazia ou inexistente', async () => {
  const h = makeHarness(); await h.init(); h.fixture.errors.contact_records = { code: '42501', message: 'permission denied' };
  await assert.rejects(h.D.optionalAll('contact_records'), { code: '42501' });
  delete h.fixture.db.contact_records; delete h.fixture.errors.contact_records;
  assert.equal((await h.D.optionalAll('contact_records')).available, false);
});
test('capacidade de seleção moderna independe da existência de linhas modernas', async () => {
  const h = makeHarness(); await h.init(); h.fixture.db.talent_opportunity_matches = [];
  const result = await h.D.loadMatches(); assert.equal(result.modern, true); assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].modern, false); assert.equal(result.rows[0].sources.length, 2);
});
test('edição envia apenas os campos alterados e preserva campos não exibidos', async () => {
  const h = makeHarness(); await h.init(); h.fixture.db.employers[0].campo_antigo = 'Preservar';
  const row = await h.D.one('employers', h.id(101));
  await h.W.saveRecord('employers', row, { nome: row.nome, descricao_resumida: 'Revisada' }, { descricao_resumida: 'Revisada' });
  assert.deepEqual(plain(h.fixture.writes.at(-1).payload), { descricao_resumida: 'Revisada' });
  assert.equal(h.fixture.db.employers[0].campo_antigo, 'Preservar');
});
test('edição concorrente é detectada e não sobrescreve a alteração mais recente', async () => {
  const h = makeHarness(); await h.init(); const row = await h.D.one('employers', h.id(101));
  await h.D.update('employers', row.id, { descricao_resumida: 'Outra edição' });
  await assert.rejects(h.D.update('employers', row.id, { descricao_resumida: 'Desatualizada' }, { expectedUpdatedAt: row.updated_at }), { code: 'PGRST116' });
  assert.equal(h.fixture.db.employers[0].descricao_resumida, 'Outra edição');
});
test('remoção limitada a associação exata nunca exclui cadastro principal', async () => {
  const h = makeHarness(); await h.init();
  await assert.rejects(h.D.removeAssociation('candidatos', { id: 'DEMO-T1' }), /associação exata/);
  await assert.rejects(h.D.removeAssociation('contact_record_categories', { contact_id: h.id(501) }), /associação exata/);
  await h.D.removeAssociation('contact_record_categories', { contact_id: h.id(501), category_id: h.id(601) });
  assert.equal(h.fixture.db.contact_record_categories.length, 1); assert.equal(h.fixture.db.contact_records.length, 4);
});
test('falha de uma fonte preserva os dados anteriores e não bloqueia as demais', async () => {
  const h = makeHarness(); await h.init(); const state = { talents: [], contacts: [] };
  const app = { setSync() {} }; let renders = 0;
  const load = h.W.loader(app, state, { talents: { load: () => h.D.loadCandidates({ activeOnly: false }) }, contacts: { load: () => h.D.loadContacts() } }, () => renders++);
  await load(); h.fixture.errors.contact_records = { code: '42501', message: 'permission denied' }; await load();
  assert.equal(state.contacts.length, 4); assert.equal(state.talents.length, 5); assert.equal(state.sources.contacts.stale, true);
  assert.match(h.W.sourceAlerts(state), /dados anteriores foram mantidos/); assert.equal(renders, 2);
});
test('concluir atividade originada em Contatos grava somente no follow-up original', async () => {
  const h = makeHarness(); await h.init();
  await h.R.finishActivity(h.fixture.db.crm_activities[1]);
  assert.deepEqual(plain(h.fixture.writes.map((r) => r.table)), ['contact_followups']);
  assert.equal(h.fixture.db.contact_followups[0].status, 'Concluído');
  assert.equal(h.fixture.db.crm_activities[1].status, 'Concluída');
});
test('atividade do contato aparece vinculada ao talento sem duplicar ou regravar a atividade', async () => {
  const h = makeHarness(); await h.init();
  Object.assign(h.fixture.db.contact_records[0], { source_system: 'candidatos', source_record_id: 'DEMO-T2' });
  const rows = (await h.D.loadActivities()).data;
  assert.equal(rows.find((r) => r.id === h.id(402)).talent_id, 'DEMO-T2');
  assert.equal(h.fixture.db.crm_activities[1].talent_id, null); assert.equal(h.fixture.writes.length, 0);
});
test('fonte moderna ausente gera aviso sem esconder os vínculos anteriores', async () => {
  const h = makeHarness(); delete h.fixture.db.talent_opportunity_matches; await h.load('talents');
  h.app.route('processes'); assert.match(h.html(), /Camila Santos/); assert.match(h.html(), /Seleções por vaga: fonte não disponível/);
  assert.equal(h.app.primary, null);
});
