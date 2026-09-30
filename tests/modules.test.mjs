import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHarness, plain } from './harness.mjs';

for (const module of ['talents', 'organization', 'contacts', 'german']) {
  test(`${module}: todas as rotas geram conteúdo sem rede e sem gravações na abertura`, async () => {
    const h = await makeHarness().load(module);
    for (const view of h.app.config.views) {
      h.app.route(view.id); assert.ok(h.html().length > 150, view.id);
      assert.doesNotMatch(h.html(), /\bNaN\b|>undefined</, view.id);
    }
    assert.equal(h.fixture.writes.length, 0); assert.equal(h.network.length, 0);
  });
}
test('Meu dia renderiza nos dois módulos com um gráfico compartilhado disponível', async () => {
  for (const [module, marker] of [['talents', /t4-bi-chart|data-bi-chart|t4-bi-stat/], ['organization', /mx-pulse|t4-funnel/]]) {
    const h = await makeHarness().load(module);
    h.app.route('overview');
    assert.match(h.html(), marker);
    assert.doesNotMatch(h.html(), /W\.funnelChart|funnelChart is not a function/);
    assert.equal(h.fixture.writes.length, 0);
  }
});
test('filtros compartilhados oferecem pesquisa e seleção múltipla sem gravar', async () => {
  const h = await makeHarness().load('organization');
  h.app.route('employers');
  assert.match(h.html(), /data-multi-filter-search="employer"/);
  assert.match(h.html(), /data-multi-filter="employer"/);
  h.filter('employer', [h.id(101), h.id(102)]);
  assert.match(h.html(), /2 selecionados/);
  assert.equal(h.fixture.writes.length, 0);
});
test('filtro de períodos destaca o mês atual e escala por ano', async () => {
  const h = makeHarness();
  h.fixture.db.organizational_meetings.push({ ...h.fixture.db.organizational_meetings[0], id: h.id(1008), month_ref: '2027-01', topic: 'Reunião de janeiro de 2027' });
  await h.load('organization'); h.app.route('summary');
  const html = h.html();
  assert.match(html, /t4-period-filter/);
  assert.match(html, /Mês atual/);
  assert.match(html, /data-period-current="true"/);
  assert.match(html, /Setembro de 2026/);
  assert.match(html, /data-period-year="2027"/);
  assert.match(html, /Janeiro de 2027/);
  assert.ok(html.indexOf('Mês atual') < html.indexOf('Janeiro de 2027'));
  h.app.route('operations');
  assert.match(h.html(), /MÊS DE EXECUÇÃO/);
  assert.match(h.html(), /Setembro de 2026/);
  await h.action('operations-month-next');
  assert.match(h.html(), /Outubro de 2026/);
  await h.action('operations-month-today');
  assert.match(h.html(), /Setembro de 2026/);
  h.app.route('planning');
  assert.match(h.html(), /data-action="planning-month-prev"/);
  assert.match(h.html(), /Setembro de 2026/);
});
test('reuniões e decisões usa o mesmo padrão de mês do PO, com atividades do mês, pendências abertas e histórico completo', async () => {
  const h = makeHarness();
  h.fixture.db.organizational_meetings.push({ ...h.fixture.db.organizational_meetings[0], id: h.id(1008), month_ref: '2027-01', topic: 'Reunião de janeiro de 2027', status: 'Concluído' });
  await h.load('organization'); h.app.route('meetings');
  const html = h.html();
  // Mesmo padrão do PO: stepper de mês dedicado, não o filtro genérico de "Períodos".
  assert.doesNotMatch(html, /t4-period-filter/);
  assert.match(html, /MÊS DE REFERÊNCIA/);
  assert.match(html, /data-action="meetings-month-prev"/);
  assert.match(html, /Setembro de 2026/);
  assert.match(html, /ATIVIDADES DO MÊS/);
  assert.match(html, /PENDÊNCIAS ABERTAS/);
  assert.match(html, /HISTÓRICO COMPLETO/);
  assert.ok(html.indexOf('ATIVIDADES DO MÊS') < html.indexOf('PENDÊNCIAS ABERTAS'));
  assert.ok(html.indexOf('PENDÊNCIAS ABERTAS') < html.indexOf('HISTÓRICO COMPLETO'));
  // Setembro (mês atual): só a reunião de setembro aparece nas atividades do
  // mês; a de janeiro de 2027 (concluída) só aparece no histórico completo.
  const monthSection = html.slice(html.indexOf('ATIVIDADES DO MÊS'), html.indexOf('PENDÊNCIAS ABERTAS'));
  assert.match(monthSection, /Prioridades da semana/);
  assert.doesNotMatch(monthSection, /Reunião de janeiro de 2027/);
  const historySection = html.slice(html.indexOf('HISTÓRICO COMPLETO'));
  assert.match(historySection, /Reunião de janeiro de 2027/);
  assert.match(historySection, /Prioridades da semana/);
  // Avançar 4 meses (out/nov/dez/jan) leva as atividades do mês para janeiro de 2027.
  for (let i = 0; i < 4; i++) await h.action('meetings-month-next');
  const jan = h.html();
  assert.match(jan, /Janeiro de 2027/);
  const janMonthSection = jan.slice(jan.indexOf('ATIVIDADES DO MÊS'), jan.indexOf('PENDÊNCIAS ABERTAS'));
  assert.match(janMonthSection, /Reunião de janeiro de 2027/);
  assert.doesNotMatch(janMonthSection, /Prioridades da semana/);
  await h.action('meetings-month-today');
  assert.match(h.html(), /Setembro de 2026/);
  assert.equal(h.fixture.writes.length, 0);
});
test('agenda continua mostrando atividades marcadas como concluídas no dia em que aconteceram', async () => {
  const h = makeHarness();
  h.fixture.db.organizational_plan_entries.push({ ...h.fixture.db.organizational_plan_entries[0], id: h.id(1009), activity_label: 'Atividade concluída na agenda', status: 'Concluído', start_date: '2026-09-10', end_date: '2026-09-10' });
  await h.load('organization'); h.app.route('calendar');
  assert.match(h.html(), /Atividade concluída na agenda/);
  h.filter('status', 'Concluído');
  assert.match(h.html(), /Atividade concluída na agenda/);
  assert.equal(h.fixture.writes.length, 0);
});
test('planejamento mostra atividades concluídas no mês, com pendências abertas e histórico completo', async () => {
  const h = makeHarness();
  h.fixture.db.organizational_plan_entries.push({ ...h.fixture.db.organizational_plan_entries[0], id: h.id(1009), activity_label: 'Atividade concluída no mês', status: 'Concluído', completed_at: '2026-09-02', start_date: '2026-09-01', end_date: '2026-09-02' });
  await h.load('organization'); h.app.route('planning');
  const html = h.html();
  assert.match(html, /ATIVIDADES DO MÊS/);
  assert.match(html, /PENDÊNCIAS ABERTAS/);
  assert.match(html, /HISTÓRICO COMPLETO/);
  assert.match(html, /Atividade concluída no mês/);
  assert.ok(html.indexOf('ATIVIDADES DO MÊS') < html.indexOf('PENDÊNCIAS ABERTAS'));
  assert.ok(html.indexOf('PENDÊNCIAS ABERTAS') < html.indexOf('HISTÓRICO COMPLETO'));
  // A atividade concluída aparece nas atividades do mês (qualquer situação)
  // e no histórico completo, mas não nas pendências abertas (só o que está
  // em aberto, de qualquer mês).
  const monthSection = html.slice(html.indexOf('ATIVIDADES DO MÊS'), html.indexOf('PENDÊNCIAS ABERTAS'));
  assert.match(monthSection, /Atividade concluída no mês/);
  const openSection = html.slice(html.indexOf('PENDÊNCIAS ABERTAS'), html.indexOf('HISTÓRICO COMPLETO'));
  assert.doesNotMatch(openSection, /Atividade concluída no mês/);
  const historySection = html.slice(html.indexOf('HISTÓRICO COMPLETO'));
  assert.match(historySection, /Atividade concluída no mês/);
  h.filter('status', 'Em andamento');
  assert.match(h.html(), /Atividade concluída no mês/);
});
test('classificação dos empregadores é acionável e prioriza parceiras diretas', async () => {
  const h = makeHarness();
  h.fixture.db.employers[0].direct_talents4_partnership = 'CONFIRMADA';
  h.fixture.db.employers[1].company_scope = 'GENERAL';
  await h.load('organization');
  h.app.route('employers');
  await h.action('employer-classification', 'all');
  const names = [...h.html().matchAll(/data-action="employer-detail" data-id="[^"]+">([^<]+)</g)].map(([, name]) => name);
  assert.deepEqual(names, ['Clínica Aurora · exemplo', 'Nord Technik · exemplo']);
  assert.match(h.html(), /data-action="employer-classification" data-id="partner"/);
  await h.action('employer-classification', 'partner');
  const partnerNames = [...h.html().matchAll(/data-action="employer-detail" data-id="[^"]+">([^<]+)</g)].map(([, name]) => name);
  assert.deepEqual(partnerNames, ['Clínica Aurora · exemplo']);
  assert.equal(h.fixture.writes.length, 0);
});
test('Organizacional abre em Empregadores com parceiras e cartões em destaque', async () => {
  const h = makeHarness();
  h.fixture.db.employers[0].direct_talents4_partnership = 'CONFIRMADA';
  await h.load('organization');
  assert.equal(h.app.view, 'employers');
  assert.match(h.html(), /data-action="employer-classification" data-id="partner"[^>]*aria-pressed="true"/);
  assert.match(h.html(), /data-action="employer-display" data-id="cards"[^>]*aria-pressed="true"/);
  assert.doesNotMatch(h.html(), /Uma empresa por vez|A fila operacional mostra/);
});
test('seletores longos mostram busca sem mudar o valor nativo do formulário', async () => {
  const h = makeHarness();
  h.fixture.db.employers.push(...Array.from({ length: 20 }, (_, i) => ({ ...h.fixture.db.employers[0], id: h.id(500 + i), nome: `Empresa ${i}` })));
  await h.load('organization');
  await h.action('new-opening-for', h.id(101));
  assert.match(h.forms.at(-1).innerHTML, /data-select-search="employer_id"/);
  assert.match(h.forms.at(-1).innerHTML, /name="employer_id"/);
  assert.equal(h.fixture.writes.length, 0);
});
test('cancelar vaga sincroniza status e is_active', async () => {
  const h = await makeHarness().load('organization');
  await h.action('edit-opening', h.id(201));
  const result = await h.submit({ status: 'Cancelada' });
  assert.equal(result.error, '');
  assert.equal(h.fixture.writes.at(-1).table, 'employer_openings');
  assert.equal(h.fixture.writes.at(-1).payload.status, 'Cancelada');
  assert.equal(h.fixture.writes.at(-1).payload.is_active, false);
  assert.equal(h.fixture.db.employer_openings[0].is_active, false);
});
test('busca deixa claro quando o Talento arquivado ainda tem seleção ativa', async () => {
  const h = makeHarness();
  h.fixture.db.candidatos[0].ativo = false;
  await h.load('talents');
  h.app.search('Marina');
  assert.match(h.html(), /também no arquivo/);
  assert.match(h.html(), /Arquivado · 1 seleção em andamento/);
  assert.match(h.html(), /Abrir ficha/);
  assert.equal(h.fixture.writes.length, 0);
});
test('exportação exige uma seleção explícita de Talentos', async () => {
  const h = await makeHarness().load('talents');
  await h.action('data-center');
  assert.match(h.notices.at(-1)?.[0] || '', /Selecione ao menos um Talento/);
  assert.equal(h.fixture.writes.length, 0);
});
test('rótulos legados são traduzidos somente na apresentação', async () => {
  const h = makeHarness();
  assert.equal(h.originalCore.term('Novo candidato'), 'Novo Talento');
  assert.equal(h.originalCore.term('Pronto para employer'), 'Pronto para apresentação');
  assert.equal(h.originalCore.term('Enviado ao employer'), 'Apresentado ao empregador');
});
test('Organizacional mostra planejamento, decisões, PO e resumo de fontes antigas', async () => {
  const h = await makeHarness().load('organization');
  for (const [view, text] of [['planning', 'Alinhar apresentação de perfis'], ['meetings', 'Confirmar horários'], ['operations', 'Histórico']]) {
    h.app.route(view); assert.match(h.html(), new RegExp(text));
  }
  h.app.route('summary'); h.filter('status', 'Concluído'); assert.match(h.html(), /Revisão de perfis/);
  assert.match(h.html(), /Apresentação/);
  assert.ok(!h.fixture.reads.some((r) => r.table === 'org_ui_state_snapshots'));
  await h.action('meeting-detail', h.id(1002)); assert.match(h.drawer.options.body, /Revisão do planejamento/);
});
test('planejamento edita somente o campo alterado; datas, ordem e observações ficam preservadas', async () => {
  const h = await makeHarness().load('organization');
  h.fixture.db.organizational_plan_entries[0].campo_compatibilidade = 'Não alterar';
  await h.action('edit-plan', h.id(1001));
  for (const key of ['obs', 'start_date', 'end_date', 'responsavel', 'employer_id', 'month_ref']) assert.ok(h.fields().includes(key), key);
  assert.equal((await h.submit({ responsavel: 'Equipe revisora' })).error, '');
  assert.deepEqual(plain(h.fixture.writes.at(-1).payload), { responsavel: 'Equipe revisora' });
  assert.equal(h.fixture.db.organizational_plan_entries[0].campo_compatibilidade, 'Não alterar');
});
test('planejamento rejeita prazo anterior ao início sem enviar uma gravação', async () => {
  const h = await makeHarness().load('organization'); await h.action('edit-plan', h.id(1001));
  const result = await h.submit({ start_date: '2026-10-10', end_date: '2026-09-01' });
  assert.match(result.error, /posterior/); assert.equal(h.fixture.writes.length, 0);
});
test('decisão de reunião cria tarefa referenciada, sem reescrever a reunião', async () => {
  const h = await makeHarness().load('organization'); const meeting = JSON.stringify(h.fixture.db.organizational_meetings);
  await h.action('meeting-task', h.id(1002));
  assert.equal((await h.submit()).error, '');
  const write = h.fixture.writes.at(-1); assert.equal(write.table, 'operational_tasks');
  assert.equal(write.payload.meeting_id, h.id(1002)); assert.equal(write.payload.context_type, 'meeting');
  assert.equal(JSON.stringify(h.fixture.db.organizational_meetings), meeting);
});
test('filtro de status das tarefas não oculta o histórico concluído do mês', async () => {
  const h = makeHarness();
  h.fixture.db.operational_tasks.push({ ...h.fixture.db.operational_tasks[0], id: h.id(1007), title: 'Tarefa concluída no mês', status: 'Pronto', completed_at: '2026-09-01', due_date: '2026-09-01' });
  await h.load('organization'); h.app.route('operations'); h.filter('status', 'A fazer');
  assert.match(h.html(), /Tarefa concluída no mês/);
  assert.match(h.html(), /Histórico/);
  assert.doesNotMatch(h.html(), /Métricas do período/);
});
test('PO separa atividades do mês do histórico completo paginado', async () => {
  const h = makeHarness();
  const base = h.fixture.db.operational_tasks[0];
  h.fixture.db.operational_tasks.push({ ...base, id: h.id(1007), title: 'Tarefa aberta de outro mês', month_ref: '2026-08', updated_at: '2026-08-20T10:00:00Z', due_date: '2026-08-25' });
  h.fixture.db.operational_tasks.push(...Array.from({ length: 21 }, (_, i) => ({ ...base, id: h.id(1100 + i), title: `Histórico concluído ${i + 1}`, status: 'Pronto', month_ref: '2026-08', completed_at: `2026-08-${String(21 - (i % 10)).padStart(2, '0')}T10:00:00Z`, updated_at: `2026-08-${String(21 - (i % 10)).padStart(2, '0')}T10:00:00Z`, due_date: `2026-08-${String(21 - (i % 10)).padStart(2, '0')}` })));
  await h.load('organization'); h.app.route('operations');
  const html = h.html(), historyStart = html.indexOf('<h2>Histórico');
  assert.match(html, /Tarefas do mês/);
  assert.doesNotMatch(html, /Cartões de prontidão/);
  assert.match(html, /data-table="operations-history"/);
  assert.match(html, /Página 1 de 2/);
  assert.ok(historyStart > html.indexOf('Tarefas do mês'));
  assert.ok(html.indexOf('Tarefa aberta de outro mês', historyStart) >= 0);
  assert.ok(html.indexOf('Tarefa aberta de outro mês', historyStart) < html.indexOf('Histórico concluído 1', historyStart));

  await h.action('operations-month-prev');
  const augustHtml = h.html(), augustHistoryStart = augustHtml.indexOf('<h2>Histórico');
  assert.match(augustHtml, /Agosto de 2026/);
  assert.ok(augustHtml.indexOf('Tarefa aberta de outro mês') < augustHistoryStart);
  assert.match(augustHtml, /data-table="operations-history"/);
});
test('histórico completo do PO ordena abertas > vencidas > prioridade > prazo > mais recente', async () => {
  const h = makeHarness();
  const base = h.fixture.db.operational_tasks[0];
  h.fixture.db.operational_tasks.length = 0;
  h.fixture.db.operational_tasks.push(
    { ...base, id: h.id(2001), title: 'Aberta vencida prioridade baixa', status: 'A fazer', priority: 'Baixa', due_date: '2026-08-01', updated_at: '2026-08-01T10:00:00Z' },
    { ...base, id: h.id(2002), title: 'Aberta em dia prioridade crítica', status: 'A fazer', priority: 'Crítica', due_date: '2026-12-01', updated_at: '2026-09-01T10:00:00Z' },
    { ...base, id: h.id(2003), title: 'Aberta em dia prioridade alta prazo próximo', status: 'A fazer', priority: 'Alta', due_date: '2026-11-01', updated_at: '2026-09-01T10:00:00Z' },
    { ...base, id: h.id(2004), title: 'Aberta em dia prioridade alta prazo distante', status: 'A fazer', priority: 'Alta', due_date: '2026-12-15', updated_at: '2026-09-01T10:00:00Z' },
    { ...base, id: h.id(2005), title: 'Concluída recente', status: 'Pronto', priority: 'Crítica', due_date: '2026-08-01', completed_at: '2026-09-03T10:00:00Z' },
    { ...base, id: h.id(2006), title: 'Concluída antiga', status: 'Pronto', priority: 'Crítica', due_date: '2026-08-01', completed_at: '2026-08-01T10:00:00Z' }
  );
  await h.load('organization'); h.app.route('operations'); await h.action('operations-display', 'all');
  const html = h.html(), historyStart = html.indexOf('<h2>Histórico');
  const pos = (title) => html.indexOf(title, historyStart);
  // Vencida antes de prioridade: mesmo com prioridade Baixa, a vencida
  // vem antes das em dia (mesmo a Crítica), pois todas estão abertas.
  assert.ok(pos('Aberta vencida prioridade baixa') < pos('Aberta em dia prioridade crítica'));
  // Entre as em dia, prioridade decide primeiro que prazo.
  assert.ok(pos('Aberta em dia prioridade crítica') < pos('Aberta em dia prioridade alta prazo próximo'));
  // Mesma prioridade (Alta): prazo mais próximo vem primeiro.
  assert.ok(pos('Aberta em dia prioridade alta prazo próximo') < pos('Aberta em dia prioridade alta prazo distante'));
  // Todas as abertas vêm antes de todas as concluídas.
  assert.ok(pos('Aberta em dia prioridade alta prazo distante') < pos('Concluída recente'));
  // Entre concluídas, mais recente primeiro.
  assert.ok(pos('Concluída recente') < pos('Concluída antiga'));
  assert.equal(h.fixture.writes.length, 0);
});
test('PO operacional alterna entre atividades em cartões e lista completa', async () => {
  const h = makeHarness();
  h.fixture.db.operational_tasks.push({ ...h.fixture.db.operational_tasks[0], id: h.id(1007), title: 'Tarefa já concluída', status: 'Pronto', priority: 'Crítica', completed_at: '2026-08-31T12:00:00Z', due_date: '2026-08-31' });
  await h.load('organization'); h.app.route('operations');
  const html = h.html();
  assert.match(html, /data-action="operations-display" data-id="activities"[^>]*aria-pressed="true"/);
  assert.match(html, /data-action="operations-display" data-id="all"[^>]*aria-pressed="false"/);
  assert.match(html, /Tarefas do mês/);
  assert.match(html, /org-ready-card-deadline/);
  assert.doesNotMatch(html, /org-ready-summary/);
  assert.doesNotMatch(html, /Métricas do período/);
  assert.doesNotMatch(html, /Lista completa/);
  // A tarefa aberta aparece 2x em modo "Atividades": no painel do mês e no
  // painel de pendências abertas (todos os meses) — são superfícies
  // diferentes, não uma duplicata por engano.
  assert.equal((html.match(/data-ready-task=/g) || []).length, 2);
  assert.doesNotMatch(html, /data-table="tasks"/);

  await h.action('operations-display', 'all');
  const listHtml = h.html();
  assert.match(listHtml, /data-action="operations-display" data-id="all"[^>]*aria-pressed="true"/);
  assert.match(listHtml, /Lista completa/);
  assert.doesNotMatch(listHtml, /data-ready-task=/);
  const listStart = html.indexOf('data-table="tasks"');
  const listStartAfterSwitch = listHtml.indexOf('data-table="tasks"');
  assert.equal(listStart, -1);
  assert.ok(listStartAfterSwitch >= 0);
  assert.ok(listHtml.indexOf('Preparar pauta das entrevistas', listStartAfterSwitch) < listHtml.indexOf('Tarefa já concluída', listStartAfterSwitch));
  assert.match(listHtml, /Concluir/);
  assert.ok(listHtml.indexOf('<h2>Histórico') > listHtml.indexOf('Lista completa'));

  await h.action('operations-display', 'activities');
  await h.action('finish-task', h.id(1005));
  assert.equal(h.fixture.writes.at(-1).table, 'operational_tasks');
  assert.equal(h.fixture.writes.at(-1).payload.status, 'Pronto');
  assert.ok(h.fixture.db.operational_tasks[0].completed_at);
  assert.equal((h.html().match(/data-ready-task=/g) || []).length, 0);
});
test('Seleções separa os abertos da lista analítica e reserva o Kanban para o quadro', async () => {
  const h = makeHarness();
  h.fixture.db.talent_opportunity_matches.push({ ...h.fixture.db.talent_opportunity_matches[0], id: h.id(310), talent_id: 'DEMO-T1', stage: 'Contratado', status: 'Ativo', updated_at: '2026-09-03T09:00:00.000Z', next_action: null, next_action_at: null });
  h.fixture.db.candidate_employer_matches.push(
    { id: h.id(313), candidato_id: 'DEMO-T5', empregador_id: h.id(102), status_vinculo: 'Não gostou', elegivel: true, prioridade: 2, proxima_acao: 'Registrar retorno', created_at: '2026-09-01T10:00:00.000Z', updated_at: '2026-09-01T10:00:00.000Z' },
    { id: h.id(314), candidato_id: 'DEMO-T4', empregador_id: h.id(102), status_vinculo: 'Removido', prioridade: 3, proxima_acao: null, created_at: '2026-09-01T11:00:00.000Z', updated_at: '2026-09-02T10:00:00.000Z' },
    { id: h.id(315), candidato_id: 'DEMO-T3', empregador_id: h.id(101), status_vinculo: 'Excluído', prioridade: 4, proxima_acao: null, created_at: '2026-09-01T12:00:00.000Z', updated_at: '2026-09-02T11:00:00.000Z' },
    { id: h.id(316), candidato_id: 'DEMO-T1', empregador_id: h.id(101), status_vinculo: 'Em análise', elegivel: true, prioridade: 1, proxima_acao: 'Avaliar perfil', proximo_followup_em: '2026-09-12T10:00:00.000Z', created_at: '2026-09-01T13:00:00.000Z', updated_at: '2026-09-03T10:00:00.000Z' },
    { id: h.id(317), candidato_id: 'DEMO-T2', empregador_id: h.id(101), status_vinculo: 'Apresentado', elegivel: true, prioridade: 1, proxima_acao: 'Aguardar retorno', proximo_followup_em: '2026-09-11T10:00:00.000Z', created_at: '2026-09-01T14:00:00.000Z', updated_at: '2026-09-03T11:00:00.000Z' },
    { id: h.id(318), candidato_id: 'DEMO-T3', empregador_id: h.id(102), status_vinculo: 'Entrevista', elegivel: true, prioridade: 1, proxima_acao: 'Confirmar horário', proximo_followup_em: '2026-09-10T10:00:00.000Z', created_at: '2026-09-01T15:00:00.000Z', updated_at: '2026-09-03T12:00:00.000Z' },
    { id: h.id(319), candidato_id: 'DEMO-T4', empregador_id: h.id(102), status_vinculo: 'Proposta', elegivel: true, prioridade: 1, proxima_acao: 'Enviar proposta', proximo_followup_em: '2026-09-09T10:00:00.000Z', created_at: '2026-09-01T16:00:00.000Z', updated_at: '2026-09-03T13:00:00.000Z' }
  );
  await h.load('organization'); h.app.route('pipeline');
  const listHtml = h.html();

  assert.match(listHtml, /Lista analítica/);
  assert.match(listHtml, /Quadro opcional/);
  assert.match(listHtml, /Seleções em aberto/);
  assert.match(listHtml, /Contratados/);
  assert.match(listHtml, /Não gostou/);

  const openStart = listHtml.indexOf('Seleções em aberto');
  const hiredStart = listHtml.indexOf('Contratados');
  assert.ok(openStart >= 0 && hiredStart > openStart);
  const openHtml = listHtml.slice(openStart, hiredStart);
  assert.match(openHtml, /Em análise/);
  assert.match(openHtml, /Apresentados/);
  assert.match(openHtml, /Entrevistas/);
  assert.match(openHtml, /Propostas/);
  assert.match(openHtml, /Não gostou/);
  assert.doesNotMatch(openHtml, /Removido/);
  assert.doesNotMatch(openHtml, /Excluído/);

  assert.match(listHtml, /data-table="org-selection-open"/);
  const tableStart = listHtml.indexOf('data-table="org-selection-open"');
  const historyHtml = listHtml.slice(tableStart);
  assert.match(historyHtml, /Rafael Costa/);
  assert.match(historyHtml, /Camila Santos/);
  assert.match(historyHtml, /Lucas Vieira/);
  assert.match(historyHtml, /Marina Duarte/);

  await h.action('selection-scope', 'all');
  const allHtml = h.html();
  const allHistoryStart = allHtml.indexOf('Histórico de encerrados');
  assert.ok(allHistoryStart >= 0);
  const allHistoryHtml = allHtml.slice(allHistoryStart);
  assert.match(allHistoryHtml, /Removido/);
  assert.match(allHistoryHtml, /Excluído/);

  await h.action('selection-scope', 'active');
  await h.action('selection-display', 'cards');
  const cardHtml = h.html();
  assert.doesNotMatch(cardHtml, /data-table="org-selection-open"/);
  assert.match(cardHtml, /class="t4-board"/);
  assert.doesNotMatch(cardHtml, /Histórico de encerrados/);
  assert.match(cardHtml, /Não gostou/);
  assert.equal(h.fixture.writes.length, 0);
});
test('detalhes de empregador e vaga com histórico encerrado não chamam W.badge', async () => {
  const h = makeHarness();
  h.fixture.db.talent_opportunity_matches.push({ id: h.id(305), created_at: '2026-09-01T10:00:00.000Z', updated_at: '2026-09-01T10:00:00.000Z', talent_id: 'DEMO-T2', opening_id: h.id(201), employer_id: h.id(101), stage: 'Encerrado', status: 'Encerrado', priority: 3, owner_username: 'demo', next_action: null, next_action_at: null, viability: 'Baixa', overall_score: null, reasons: null, barriers: null, sent_at: null, responded_at: null });
  await h.load('organization');
  await h.action('employer-detail', h.id(101));
  assert.match(h.drawer.options.body, /Histórico de seleções encerradas/);
  await h.action('opening-detail', h.id(201));
  assert.match(h.drawer.options.body, /Histórico encerrado/);
  assert.equal(h.fixture.writes.length, 0);
});
test('nova seleção grava vínculo por vaga sem mudar o acompanhamento do talento', async () => {
  const h = await makeHarness().load('talents'); const original = JSON.stringify(h.fixture.db.candidatos);
  h.app.route('processes'); h.app.primary();
  assert.equal((await h.submit({ talent_id: 'DEMO-T3', opening_id: h.id(202), stage: 'Em análise', next_action: 'Agendar avaliação' })).error, '');
  assert.equal(h.fixture.writes.at(-1).table, 'talent_opportunity_matches');
  assert.equal(h.fixture.writes.at(-1).payload.employer_id, h.id(102));
  assert.equal(JSON.stringify(h.fixture.db.candidatos), original);
});
test('vínculo antigo é editado na própria origem, nunca inserido como seleção moderna', async () => {
  const h = await makeHarness().load('talents');
  await h.action('edit-selection', `candidate_employer_matches:${h.id(303)}`);
  assert.equal((await h.submit({ proxima_acao: 'Próximo passo revisado' })).error, '');
  assert.equal(h.fixture.writes.length, 1); assert.equal(h.fixture.writes[0].table, 'candidate_employer_matches');
  assert.equal(h.fixture.db.talent_opportunity_matches.length, 2);
});
test('duplicidade talento + vaga é bloqueada antes da inclusão', async () => {
  const h = await makeHarness().load('talents'); h.app.route('processes'); h.app.primary();
  const result = await h.submit({ talent_id: 'DEMO-T1', opening_id: h.id(201) });
  assert.match(result.error, /já está vinculado/); assert.equal(h.fixture.writes.length, 0);
});
test('ficha completa é lida sob demanda, inclusive campos fora da listagem', async () => {
  const h = await makeHarness().load('talents'); h.fixture.db.candidatos[0].campo_historico = 'Informação anterior preservada';
  assert.ok(!h.fixture.reads.some((r) => r.table === 'candidatos' && r.columns === '*'));
  await h.action('talent-detail', 'DEMO-T1'); await h.action('detail-tab', 'all');
  assert.match(h.drawer.options.body, /Informação anterior preservada/);
});
// "Todos os dados" existe para preservar o que não tem apresentação
// dedicada — não para repetir com o nome bruto da coluna o que a aba
// Perfil/Alemão/Documentos/Histórico já mostra formatado. Sem a lista de
// exclusão passada a R.storedFields(), a ficha inteira do Talento parecia
// uma planilha crua nessa aba (achado ao revisar a tela com o usuário).
test('aba "Todos os dados" não repete campo com apresentação dedicada em outra aba', async () => {
  const h = await makeHarness().load('talents');
  await h.action('talent-detail', 'DEMO-T1');
  assert.match(h.drawer.options.body, /talento1@example\.invalid/, 'e-mail aparece formatado na aba Perfil');
  await h.action('detail-tab', 'all');
  assert.doesNotMatch(h.drawer.options.body, /t4-detail-label">Email</, 'e-mail não deve ser repetido cru no bloco de sobras');
  assert.doesNotMatch(h.drawer.options.body, /t4-detail-label">Nome completo</, 'nome não deve ser repetido cru no bloco de sobras');
  assert.doesNotMatch(h.drawer.options.body, /t4-detail-label">Resumo profissional</, 'texto longo já mostrado em Perfil não deve duplicar');
  assert.match(h.drawer.options.body, /Data entrada etapa atual/, 'campo genuinamente sem apresentação dedicada continua preservado');
});
test('turma mantém instituição, horários, links e professor vinculado', async () => {
  const h = await makeHarness().load('german'); await h.action('class-detail', h.id(901));
  assert.match(h.drawer.options.body, /Instituto de demonstração/); assert.match(h.drawer.options.body, /19h BRT/);
  await h.action('edit-class', h.id(901));
  for (const key of ['provider', 'schedule_text', 'meeting_link', 'drive_link', 'teacher_contact_id', 'teacher_name']) assert.ok(h.fields().includes(key), key);
  assert.equal((await h.submit({ notes: 'Observação revisada' })).error, '');
  assert.deepEqual(plain(h.fixture.writes.at(-1).payload), { notes: 'Observação revisada' });
});
test('registro de presença usa uma gravação; métricas são responsabilidade do banco', async () => {
  const h = await makeHarness().load('german'); const original = JSON.stringify(h.fixture.db.candidatos);
  await h.action('new-update', h.id(911));
  assert.equal((await h.submit({ attendance_status: 'Presente', event_date: '2026-09-01', note: 'Registro de teste' })).error, '');
  assert.deepEqual(plain(h.fixture.writes.map((r) => r.table)), ['german_course_updates']);
  assert.equal(h.fixture.db.german_course_updates.at(-1).attendance_status, 'Presente');
  assert.equal(JSON.stringify(h.fixture.db.candidatos), original);
});
test('avaliação não carrega presença indevida e mantém os registros anteriores', async () => {
  const h = await makeHarness().load('german'); await h.action('new-update', h.id(911));
  assert.equal((await h.submit({ kind: 'Avaliação', score: 82, attendance_status: 'Presente' })).error, '');
  assert.equal(h.fixture.db.german_course_updates.at(-1).attendance_status, null);
  assert.equal(h.fixture.db.german_course_updates.length, 2);
  assert.equal(h.fixture.db.german_course_enrollments[0].last_assessment_score, 82);
});
test('aluno sem frequência medida não aparece indevidamente na lista de risco', async () => {
  const h = await makeHarness().load('german'); h.app.route('attention');
  assert.match(h.html(), /Lucas Vieira/); assert.doesNotMatch(h.html(), /Sofia Almeida/);
  await h.action('enrollment-detail', h.id(912)); assert.match(h.drawer.options.body, /Sem registro/);
});
test('Contatos mantém canais secundários, endereço, vínculos e histórico', async () => {
  const h = await makeHarness().load('contacts'); await h.action('contact-detail', `contact:${h.id(501)}`);
  assert.match(h.drawer.options.body, /Resumo fictício de uma interação/);
  assert.match(h.drawer.options.body, /Vincular a talento ou empregador existente/);
  await h.action('edit-contact', `contact:${h.id(501)}`);
  for (const field of ['secondary_email', 'whatsapp', 'primary_organization_id', 'address_line', 'postal_code', 'preferred_channel', 'language']) assert.ok(h.fields().includes(field), field);
});
test('abrir acompanhamento de talento sem contato auxiliar não cria registro antes de salvar', async () => {
  const h = await makeHarness().load('contacts'); await h.action('new-followup', 'talent:DEMO-T2');
  assert.equal(h.fixture.writes.length, 0);
  h.U.closeModal(); assert.equal(h.fixture.writes.length, 0);
  await h.action('new-interaction', 'talent:DEMO-T2'); assert.equal(h.fixture.writes.length, 0);
});
test('edição de contato vinculado atualiza identificação na origem canônica', async () => {
  const h = await makeHarness().load('contacts'); const originalStatus = h.fixture.db.candidatos[0].status_pipeline;
  await h.action('edit-contact', 'talent:DEMO-T1');
  assert.equal((await h.submit({ phone: '+55 00 00000-0023' })).error, '');
  assert.equal(h.fixture.db.candidatos[0].telefone, '+55 00 00000-0023');
  assert.equal(h.fixture.db.candidatos[0].status_pipeline, originalStatus);
  assert.ok(h.fixture.writes.some((r) => r.table === 'candidatos'));
  assert.ok(!h.fixture.writes.some((r) => r.operation === 'insert'));
});
test('falha depois de salvar a origem não anuncia sucesso completo nem permite repetição cega', async () => {
  const h = await makeHarness().load('contacts');
  h.fixture.writeErrors.contact_records = { code: '42501', message: 'permission denied' };
  await h.action('edit-contact', 'talent:DEMO-T1');
  const result = await h.submit({ phone: '+55 00 00000-0034', notes: 'Complemento' });
  assert.match(result.error, /dados principais foram salvos/); assert.equal(result.disabled, true);
  assert.equal(h.fixture.db.candidatos[0].telefone, '+55 00 00000-0034');
  assert.equal(h.fixture.db.contact_records.find((r) => r.id === h.id(504)).notes, 'Histórico do contato vinculado.');
});
test('vincular contato existente preserva o ID e seu histórico, sem criar talento', async () => {
  const h = await makeHarness().load('contacts'); const count = h.fixture.db.candidatos.length;
  await h.action('link-canonical', `contact:${h.id(501)}`);
  assert.equal((await h.submit({ target_key: 'talent:DEMO-T2' })).error, '');
  assert.equal(h.fixture.db.candidatos.length, count);
  assert.equal(h.fixture.db.contact_records.find((r) => r.id === h.id(501)).source_record_id, 'DEMO-T2');
  assert.equal(h.fixture.db.contact_interactions[0].contact_id, h.id(501));
});
test('viewer consegue abrir o detalhe de uma atividade sem controles de gravação', async () => {
  const h = await makeHarness({ role: 'viewer' }).load('talents');
  await h.action('edit-activity', h.id(401));
  assert.match(h.drawer.options.body, /ação compartilhada/); assert.equal(h.forms.length, 0); assert.equal(h.fixture.writes.length, 0);
});
test('acervo do Organizacional só é lido ao solicitar, sem importar dados', async () => {
  const h = await makeHarness().load('organization'); h.app.route('history');
  assert.equal(h.fixture.reads.some((r) => r.table === 'org_ui_state_snapshots'), false);
  await h.action('load-archive'); assert.match(h.html(), /Parceiro anterior/); assert.match(h.html(), /Contexto preservado/);
  assert.equal(h.fixture.writes.length, 0);
});
test('nome do professor alterado em Contatos é lido em Alemão com o mesmo ID', async () => {
  const h = await makeHarness().load('contacts'); await h.action('edit-contact', `contact:${h.id(501)}`);
  assert.equal((await h.submit({ display_name: 'Professor atualizado · exemplo' })).error, '');
  await h.load('german'); await h.action('class-detail', h.id(901));
  assert.match(h.drawer.options.body, /Professor atualizado/); assert.equal(h.fixture.db.german_course_classes[0].teacher_contact_id, h.id(501));
});
test('talento criado passa a aparecer na agenda de Contatos sem outro cadastro de pessoa', async () => {
  const h = await makeHarness().load('talents'); await h.app.primary();
  assert.equal((await h.submit({ nome_completo: 'Novo talento de teste', email: 'novo@example.invalid' })).error, '');
  await h.load('contacts'); assert.match(h.html(), /Novo talento de teste/);
  assert.equal(h.fixture.db.contact_records.length, 4); assert.equal(h.fixture.db.candidatos.length, 6);
});
test('histórico de aulas acima do limite padrão é paginado por completo', async () => {
  const h = makeHarness(), sample = h.fixture.db.german_course_updates[0];
  h.fixture.db.german_course_updates = Array.from({ length: 1203 }, (_, n) => ({ ...sample, id: h.id(10000 + n), note: `Registro fictício ${n}` }));
  h.fixture.pageCap = 100;
  await h.load('german'); h.app.route('history');
  assert.equal(h.app.counts.history, 1203); assert.match(h.html(), /de 1203/);
  assert.equal(h.fixture.writes.length, 0);
});
test('salvar formulário sem alteração não envia atualização vazia ao banco', async () => {
  const h = await makeHarness().load('german'); await h.action('edit-class', h.id(901));
  assert.equal((await h.submit()).error, ''); assert.equal(h.fixture.writes.length, 0);
});
test('resposta incerta impede um segundo envio do mesmo formulário', async () => {
  const h = await makeHarness().load('german'); h.fixture.writeErrors.german_course_classes = { message: 'Failed to fetch' };
  await h.action('edit-class', h.id(901));
  const first = await h.submit({ notes: 'Teste de resposta incerta' }); assert.equal(first.disabled, true);
  delete h.fixture.writeErrors.german_course_classes; await h.submit({ notes: 'Tentativa duplicada' });
  assert.equal(h.fixture.writes.length, 0);
});
test('Seleções em Empregadores usam os mesmos escopos de Talentos e isolam o quadro opcional', async () => {
  const h = await makeHarness().load('organization');
  h.app.route('pipeline');
  const listHtml = h.html();
  for (const id of ['active', 'all', 'closed']) assert.match(listHtml, new RegExp('data-action="selection-scope" data-id="' + id + '"'));
  assert.match(listHtml, /Lista analítica/);
  assert.match(listHtml, /Quadro opcional/);
  await h.action('selection-scope', 'closed');
  assert.match(h.html(), /Histórico de encerrados/);
  assert.match(h.html(), /Nenhum registro encerrado/);
  assert.doesNotMatch(h.html(), /data-table="org-selection-open"/);
  await h.action('selection-scope', 'active');
  await h.action('selection-display', 'cards');
  assert.match(h.html(), /class="t4-board"/);
  assert.doesNotMatch(h.html(), /Todas as seleções em aberto/);
  assert.doesNotMatch(h.html(), /Contratações mais recentes/);
  assert.equal(h.fixture.writes.length, 0);
});
test('Talentos e Organizacional usam a mesma superfície de Seleções', async () => {
  const h = makeHarness();
  h.fixture.db.candidate_employer_matches.push(
    { id: h.id(413), candidato_id: 'DEMO-T1', empregador_id: h.id(101), status_vinculo: 'Em análise', prioridade: 1, proxima_acao: 'Avaliar perfil', proximo_followup_em: '2026-09-12T10:00:00.000Z', created_at: '2026-09-01T10:00:00.000Z', updated_at: '2026-09-03T10:00:00.000Z' },
    { id: h.id(414), candidato_id: 'DEMO-T2', empregador_id: h.id(101), status_vinculo: 'Apresentado', prioridade: 1, proxima_acao: 'Aguardar retorno', proximo_followup_em: '2026-09-11T10:00:00.000Z', created_at: '2026-09-01T11:00:00.000Z', updated_at: '2026-09-03T11:00:00.000Z' },
    { id: h.id(415), candidato_id: 'DEMO-T3', empregador_id: h.id(102), status_vinculo: 'Não gostou', prioridade: 2, proxima_acao: 'Registrar retorno', proximo_followup_em: '2026-09-10T10:00:00.000Z', created_at: '2026-09-01T12:00:00.000Z', updated_at: '2026-09-03T12:00:00.000Z' },
    { id: h.id(416), candidato_id: 'DEMO-T4', empregador_id: h.id(102), status_vinculo: 'Entrevista', prioridade: 1, proxima_acao: 'Confirmar horário', proximo_followup_em: '2026-09-09T10:00:00.000Z', created_at: '2026-09-01T13:00:00.000Z', updated_at: '2026-09-03T13:00:00.000Z' },
    { id: h.id(417), candidato_id: 'DEMO-T5', empregador_id: h.id(102), status_vinculo: 'Proposta', prioridade: 1, proxima_acao: 'Enviar proposta', proximo_followup_em: '2026-09-08T10:00:00.000Z', created_at: '2026-09-01T14:00:00.000Z', updated_at: '2026-09-03T14:00:00.000Z' },
    { id: h.id(418), candidato_id: 'DEMO-T1', empregador_id: h.id(101), status_vinculo: 'Contratado', prioridade: 1, created_at: '2026-09-01T15:00:00.000Z', updated_at: '2026-09-03T15:00:00.000Z' },
    { id: h.id(419), candidato_id: 'DEMO-T2', empregador_id: h.id(102), status_vinculo: 'Removido', prioridade: 3, created_at: '2026-09-01T16:00:00.000Z', updated_at: '2026-09-03T16:00:00.000Z' },
    { id: h.id(420), candidato_id: 'DEMO-T3', empregador_id: h.id(101), status_vinculo: 'Excluído', prioridade: 4, created_at: '2026-09-01T17:00:00.000Z', updated_at: '2026-09-03T17:00:00.000Z' }
  );
  await h.load('talents'); h.app.route('processes');
  const listHtml = h.html();
  assert.match(listHtml, /Lista analítica/);
  assert.match(listHtml, /Quadro opcional/);
  assert.match(listHtml, /Seleções em aberto/);
  assert.match(listHtml, /Contratados/);
  assert.match(listHtml, /data-multi-filter="employer"/);
  assert.match(listHtml, /data-multi-filter="status"/);

  const openStart = listHtml.indexOf('Seleções em aberto');
  const hiredStart = listHtml.indexOf('Contratados');
  assert.ok(openStart >= 0 && hiredStart > openStart);
  const openHtml = listHtml.slice(openStart, hiredStart);
  for (const label of ['Em análise', 'Apresentados', 'Entrevistas', 'Propostas', 'Não gostou']) assert.match(openHtml, new RegExp(label));
  assert.doesNotMatch(openHtml, /Removido|Excluído/);
  assert.match(listHtml, /data-table="talent-selection-open"/);

  await h.action('selection-scope', 'all');
  const allHtml = h.html();
  const historyStart = allHtml.indexOf('Histórico de encerrados');
  assert.ok(historyStart >= 0);
  assert.match(allHtml, /data-table="talent-selection-closed"/);
  assert.match(allHtml.slice(historyStart), /Removido/);
  assert.match(allHtml.slice(historyStart), /Excluído/);
  await h.action('selection-scope', 'closed');
  assert.match(h.html(), /data-table="talent-selection-closed"/);
  assert.doesNotMatch(h.html(), /Seleções em aberto/);
  await h.action('selection-scope', 'active');
  await h.action('selection-display', 'cards');
  assert.match(h.html(), /class="t4-board"/);
  assert.doesNotMatch(h.html(), /Seleções em aberto/);
  assert.doesNotMatch(h.html(), /t4-selection-analytics/);
  assert.equal(h.fixture.writes.length, 0);
});
test('Apresentações usa três recortes, seleção manual e folha A4 vertical de campos', async () => {
  const h = makeHarness();
  h.fixture.db.talent_mapping_profiles = [
    { id: 'DEMO-T1', lista_nectanet: 'Sim', visto: 'Sim', cluster: 'Saúde', novo_cv: 'Feito', updated_at: '2026-09-01T10:00:00.000Z' },
    { id: 'DEMO-T2', lista_nectanet: 'Não', visto: 'Não informado', cluster: 'Técnico', updated_at: '2026-09-01T10:00:00.000Z' }
  ];
  h.fixture.db.candidatos[1].pronto_para_employer = 'Parcial';
  await h.load('talents');
  h.app.route('presentation');
  const nectanet = h.html();
  for (const label of ['Lista Nectanet = Sim', 'Sim — liberado para apresentação', 'Parcial — ainda em preparação']) assert.match(nectanet, new RegExp(label));
  assert.match(nectanet, /Selecionar Talentos/);
  assert.match(nectanet, /data-presentation-select/);
  assert.match(nectanet, /data-tw-sheet="presentation-a4"/);
  assert.match(nectanet, /data-presentation-scroll/);
  assert.match(nectanet, /tw-presentation-field-label/);
  assert.match(nectanet, /tw-presentation-value is-filled/);
  assert.match(nectanet, /tw-presentation-value is-missing/);
  assert.match(nectanet, /Marina Duarte/);
  await h.action('presentation-view', 'released');
  assert.match(h.html(), /Sim — liberado para apresentação/);
  assert.match(h.html(), /Marina Duarte/);
  await h.action('presentation-view', 'partial');
  assert.match(h.html(), /Parcial — ainda em preparação/);
  assert.match(h.html(), /Lucas Vieira/);
  assert.equal(h.fixture.writes.length, 0);
});
