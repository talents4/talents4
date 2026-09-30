import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHarness, plain } from './harness.mjs';

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const query = (type, id, extra = {}) => '?' + new URLSearchParams({ record: type, recordId: id, ...extra });

test('deadline notifications point to the exact record in its own module, never to an external URL', () => {
  const h = makeHarness();
  for (const [type, file, view] of [
    ['operational_task', 'organizacional.html', 'operations'], ['organizational_plan', 'organizacional.html', 'planning'],
    ['organizational_meeting', 'organizacional.html', 'meetings'], ['crm_activity', 'organizacional.html', 'calendar'],
    ['contact_followup', 'contatos.html', 'followups'], ['german_enrollment', 'alemao.html', 'students'],
    ['german_class', 'alemao.html', 'classes'], ['selection', 'index.html', 'processes'],
    ['post_hire', 'index.html', 'post-hire'], ['talent', 'index.html', 'talents']
  ]) {
    const id = 'ID with & <unsafe> characters';
    const url = new URL(h.W.notificationUrl({ entity_type: type, entity_id: id, url: 'https://evil.invalid' }), 'https://crm.invalid/');
    assert.equal(url.origin, 'https://crm.invalid'); assert.equal(url.pathname, '/' + file);
    assert.equal(url.searchParams.get('recordId'), id); assert.equal(url.searchParams.get('view'), view);
  }
  assert.equal(h.W.notificationUrl({ entity_type: 'constructor', entity_id: 'x' }), '');
  assert.equal(h.W.notificationUrl({ entity_type: 'crm_activity', entity_id: null }), '');
});

test('modern and legacy selection notifications remain distinct even if their IDs collide', async () => {
  const h = makeHarness({ query: query('selection', uuid(301), { recordSource: 'candidate_employer_links' }) });
  h.fixture.db.candidate_employer_links[0].id = uuid(301);
  await h.load('talents');
  assert.match(h.drawer.options.title, /Camila/);
  assert.match(h.drawer.options.body, /Origem antiga preservada/);
  assert.doesNotMatch(h.drawer.options.body, /Formação e nível de idioma aderentes/);
  await h.action('edit-selection', `candidate_employer_links:${uuid(301)}`);
  assert.equal(h.modal.options.title, 'Editar vínculo geral');
  assert.equal(h.modal.fields.get('proxima_acao').value, 'Revisar documentação');
  const url = new URL(h.W.notificationUrl({ entity_type: 'selection', entity_id: 'wrong', deadline_row_id: uuid(301), deadline_source: 'candidate_employer_links.proximo_followup_em' }), 'https://crm.invalid');
  assert.equal(url.searchParams.get('recordSource'), 'candidate_employer_links');
  assert.equal(url.searchParams.get('recordId'), uuid(301));
  assert.equal(h.W.linkedSelection([{ id: 'same', _source: 'a' }, { id: 'same', _source: 'b' }], 'same', ''), null);
});

test('click destination opens the existing task for a viewer without changing its ownership or data', async () => {
  const h = makeHarness({ role: 'viewer', query: query('operational_task', uuid(1005)) });
  h.fixture.db.operational_tasks[0].owner_user_key = 'demo';
  const before = JSON.stringify(h.fixture.db.operational_tasks);
  await h.load('organization');
  assert.equal(h.app.view, 'operations');
  assert.equal(h.modal.fields.get('title').value, 'Preparar pauta das entrevistas');
  assert.equal(h.modal.fields.get('owner_user_key').disabled, true);
  assert.equal(JSON.stringify(h.fixture.db.operational_tasks), before);
  assert.equal(h.fixture.writes.length, 0);
});

test('monthly planning notification opens the exact item even outside the current month', async () => {
  const h = makeHarness({ query: query('organizational_plan', uuid(1001)) });
  h.fixture.db.organizational_plan_entries[0].month_ref = '2025-12';
  await h.load('organization');
  assert.equal(h.app.view, 'planning');
  assert.equal(h.modal.fields.get('activity_label').value, 'Alinhar apresentação de perfis');
  assert.equal(h.modal.fields.get('month_ref').value, '2025-12');
  assert.equal(h.fixture.writes.length, 0);
});

test('activity notification opens an editor for editors and a read-only detail for viewers', async () => {
  for (const role of ['admin', 'viewer']) {
    const h = await makeHarness({ role, query: query('crm_activity', uuid(401)) }).load('organization');
    assert.equal(h.app.view, 'calendar');
    if (role === 'admin') assert.equal(h.modal.fields.get('title').value, 'Conferir documentos de Marina');
    else { assert.equal(h.forms.length, 0); assert.equal(h.drawer.options.title, 'Conferir documentos de Marina'); }
    assert.equal(h.fixture.writes.length, 0);
  }
});

test('missing or inaccessible linked records cannot create a new task or open another item', async () => {
  const h = await makeHarness({ query: query('operational_task', 'not-found') }).load('organization');
  assert.equal(h.forms.length, 0); assert.equal(h.drawers.length, 0); assert.equal(h.fixture.writes.length, 0);
  assert.match(h.notices.at(-1)[0], /não está disponível/);
  const restricted = makeHarness({ query: query('operational_task', uuid(1005)) });
  restricted.fixture.db.operational_task_responsibles = [];
  restricted.fixture.db.operational_tasks[0].owner_user_key = 'other';
  await restricted.load('organization');
  assert.equal(restricted.forms.length, 0); assert.match(restricted.notices.at(-1)[0], /não está disponível/);
});

test('follow-up and German deadlines open the underlying follow-up, enrollment or class', async () => {
  const h = await makeHarness({ role: 'viewer', query: query('contact_followup', uuid(701)) }).load('contacts');
  assert.equal(h.app.view, 'followups'); assert.equal(h.drawer.options.title, 'Retornar ao professor');
  assert.equal(h.forms.length, 0); assert.equal(h.fixture.writes.length, 0);
  const enrollment = await makeHarness({ query: query('german_enrollment', uuid(911)) }).load('german');
  assert.equal(enrollment.app.view, 'students'); assert.equal(enrollment.drawer.options.title, 'Lucas Vieira');
  const course = await makeHarness({ query: query('german_class', uuid(901)) }).load('german');
  assert.equal(course.app.view, 'classes'); assert.equal(course.drawer.options.title, 'Alemão para profissionais');
});

test('passport expiry opens the documents section of the original talent', async () => {
  const h = makeHarness();
  const destination = new URL(h.W.notificationUrl({ entity_type: 'talent', entity_id: 'DEMO-T1', deadline_source: 'candidatos.passaporte_validade' }), 'https://local.invalid');
  const target = await makeHarness({ query: destination.search }).load('talents');
  assert.equal(target.drawer.options.title, 'Marina Duarte');
  assert.match(target.drawer.options.body, /data-id="documents" aria-pressed="true"/);
  assert.match(target.drawer.options.body, /Validade do passaporte/);
  assert.equal(target.fixture.writes.length, 0);
});

test('post-hire notification opens its follow-up without creating or reclassifying a hire', async () => {
  const h = makeHarness({ role: 'viewer', query: query('post_hire', 'post-1') });
  h.fixture.db.candidate_post_hire_followups = [{ id: 'post-1', talent_id: 'DEMO-T1', stage: 'Visto e autorização', status: 'Ativo', next_action: 'Conferir prazo fictício' }];
  await h.load('talents');
  assert.equal(h.app.view, 'post-hire'); assert.match(h.drawer.options.body, /Conferir prazo fictício/);
  assert.equal(h.forms.length, 0); assert.equal(h.fixture.writes.length, 0);
});

test('opening a notification marks only that notice as read and navigates to its record', async () => {
  const h = makeHarness({ role: 'viewer' }); await h.init();
  h.fixture.db.operational_tasks = [];
  h.fixture.db.crm_notifications = [{ id: 'notice-1', recipient_username: 'demo', title: 'Prazo atrasado', body: 'Atividade fictícia', type: 'prazo', entity_type: 'crm_activity', entity_id: uuid(401), created_at: '2026-09-01', read_at: null }];
  h.window.T4_DEMO = false; h.window.setInterval = () => 1; h.window.clearInterval = () => {};
  h.run('assets/t4-collaboration.js'); h.window.T4Collaboration.start(); await h.window.T4Collaboration.openNotifications();
  assert.match(h.drawer.options.body, /<a class="t4-notification-open"/);
  const before = JSON.stringify(h.fixture.db.crm_activities);
  let prevented = false;
  const element = { dataset: { collabAction: 'notification-open', collabId: 'notice-1' } };
  await h.ctx.document.emit('click', { target: { closest: selector => selector === '[data-collab-action]' ? element : null }, button: 0, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(new URL(h.window.location.href, 'https://local.invalid').searchParams.get('recordId'), uuid(401));
  assert.ok(h.fixture.db.crm_notifications[0].read_at);
  assert.equal(h.fixture.writes.length, 1);
  assert.deepEqual(Object.keys(plain(h.fixture.writes[0].payload)), ['read_at']);
  assert.equal(JSON.stringify(h.fixture.db.crm_activities), before);
});

test('operational opportunities split confirmed partners from prospects, with partners first', async () => {
  const h = makeHarness();
  h.fixture.db.employers[0].direct_talents4_partnership = 'CONFIRMADA';
  Object.assign(h.fixture.db.employers[1], { presented_by_nectanet: true, direct_talents4_partnership: 'UNKNOWN' });
  const before = JSON.stringify(h.fixture.db.employer_openings);
  await h.load('organization'); h.app.route('opportunities');
  const html = h.html(), partnerStart = html.indexOf('data-opportunity-group="partner"'), prospectStart = html.indexOf('data-opportunity-group="prospect"');
  assert.ok(partnerStart >= 0 && prospectStart > partnerStart);
  assert.match(html.slice(partnerStart, prospectStart), /Enfermagem/);
  assert.doesNotMatch(html.slice(partnerStart, prospectStart), /Técnico em mecatrônica/);
  assert.match(html.slice(prospectStart), /Técnico em mecatrônica/);
  assert.doesNotMatch(html.slice(prospectStart), /Enfermagem/);
  await h.action('opportunity-partnership', 'partner');
  assert.match(h.html(), /Enfermagem/); assert.doesNotMatch(h.html(), /Técnico em mecatrônica|data-opportunity-group="prospect"/);
  await h.action('opportunity-partnership', 'prospect');
  assert.match(h.html(), /Técnico em mecatrônica/); assert.doesNotMatch(h.html(), /Enfermagem|data-opportunity-group="partner"/);
  h.fixture.db.employer_openings[1].status = 'Fechada';
  await h.action('reload'); await h.action('opportunity-scope', 'closed');
  assert.match(h.html(), /Técnico em mecatrônica/); assert.doesNotMatch(h.html(), /Enfermagem/);
  h.fixture.db.employer_openings[1].status = 'Aberta';
  assert.equal(JSON.stringify(h.fixture.db.employer_openings), before);
  assert.equal(h.fixture.writes.length, 0);
});

test('unknown classification stays in prospects and never gains confirmed partner priority', async () => {
  const h = await makeHarness().load('organization'); h.app.route('opportunities');
  const html = h.html();
  assert.doesNotMatch(html.slice(html.indexOf('data-opportunity-group="partner"'), html.indexOf('data-opportunity-group="prospect"')), /Enfermagem|Técnico em mecatrônica/);
  assert.match(html.slice(html.indexOf('data-opportunity-group="prospect"')), /Enfermagem/);
});

test('Talents uses the same partner priority and prospect labels', async () => {
  const h = makeHarness(); h.fixture.db.employers[0].direct_talents4_partnership = 'CONFIRMADA';
  await h.load('talents'); h.app.route('opportunities');
  assert.match(h.html(), /Parceiras Talents 4 · prioridade/);
  assert.match(h.html(), /Prospecções · sem parceria confirmada/);
});

function authHarness(href, signedIn = false, navigation = 'navigate') {
  const h = makeHarness(); const url = new URL(href);
  Object.assign(h.window.location, { href: url.href, search: url.search, pathname: url.pathname });
  h.window.T4_DEMO = false; h.fixture.signedIn = signedIn;
  h.ctx.performance = { getEntriesByType: () => [{ type: navigation }] };
  return h;
}

test('an expired session preserves the notification destination through the login redirect', async () => {
  const href = 'https://local.invalid/organizacional.html' + query('operational_task', uuid(1005), { view: 'operations' });
  const h = authHarness(href);
  await assert.rejects(h.D.init({ setSync() {}, setUser() {} }), /Sessão não encontrada/);
  const login = new URL(h.locationChanges.at(-1));
  assert.equal(login.pathname, '/index.html');
  assert.equal(login.searchParams.get('next'), new URL(href).pathname + new URL(href).search);
});

test('reloading a notification record keeps the destination instead of redirecting to Meu dia', async () => {
  const h = authHarness('https://local.invalid/organizacional.html' + query('operational_task', uuid(1005)), true, 'reload');
  await h.D.init({ setSync() {}, setUser() {} });
  assert.equal(h.locationChanges.length, 0); assert.equal(h.D.profile.username, 'demo');
});

test('login returns to the notification and rejects external or unsupported return destinations', async () => {
  const target = '/organizacional.html' + query('operational_task', uuid(1005), { view: 'operations' });
  for (const next of [target, 'https://evil.invalid/organizacional.html' + query('operational_task', 'x'), '/configuracoes.html' + query('operational_task', 'x')]) {
    const h = authHarness('https://local.invalid/index.html?' + new URLSearchParams({ next }));
    let submit;
    const control = { textContent: '', disabled: false, hidden: true };
    const form = { username: { value: 'fixture' }, password: { value: 'test-only' }, querySelector: () => control, addEventListener: (_, fn) => { submit = fn; } };
    const create = h.window.supabase.createClient;
    h.window.supabase.createClient = () => { const client = create(); client.auth.signInWithPassword = async () => ({ error: null }); return client; };
    void h.D.init({ setSync() {}, pageRoot: { innerHTML: '', querySelector: () => form } });
    for (let n = 0; n < 20 && !submit; n++) await Promise.resolve();
    assert.ok(submit); await submit({ preventDefault() {} });
    assert.equal(h.window.location.href, next === target ? target : './index.html?view=overview');
    assert.equal(h.network.length, 0);
  }
});
