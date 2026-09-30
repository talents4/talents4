import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHarness } from './harness.mjs';

test('PDF abre completo mas com dados internos e identificadores desmarcados para empregador', async () => {
  const h = await makeHarness().load('talents'); await h.action('pdf', 'DEMO-T1');
  const modal = h.modal;
  assert.match(modal.options.body, /Observação interna de demonstração/);
  for (const key of ['email', 'telefone', 'cpf', 'idade', 'observacoes_internas', 'status_pipeline']) {
    assert.equal(modal.querySelector(`[data-pdf-check="${key}"]`).checked, false, key);
  }
  assert.equal(modal.querySelector('[data-pdf-check="nome_completo"]').checked, true);
  assert.equal(h.fixture.writes.length, 0); assert.equal(h.printed, 0);
});
test('preset CEO seleciona contexto interno mas não seleciona automaticamente CPF/e-mail/telefone', async () => {
  const h = await makeHarness().load('talents'); await h.action('pdf', 'DEMO-T1');
  const modal = h.modal, preset = modal.querySelector('[data-pdf-preset]'); preset.value = 'ceo'; await preset.emit('change');
  assert.equal(modal.querySelector('[data-pdf-check="observacoes_internas"]').checked, true);
  assert.equal(modal.querySelector('[data-pdf-check="email"]').checked, false);
  assert.equal(modal.querySelector('[data-pdf-check="telefone"]').checked, false);
});
test('desmarcar tudo desabilita exportação e oculta todas as seções na impressão', async () => {
  const h = await makeHarness().load('talents'); await h.action('pdf', 'DEMO-T1');
  await h.modal.querySelector('[data-pdf-none]').emit('click');
  assert.equal(h.modal.querySelector('[data-pdf-export]').disabled, true);
  assert.ok(h.modal.querySelectorAll('[data-pdf-section]').every((section) => section.dataset.printEmpty === 'true'));
  await h.modal.querySelector('[data-pdf-export]').emit('click'); assert.equal(h.printed, 0);
});
test('campo desmarcado sai da seleção sem alterar o talento; exportação usa impressão local', async () => {
  const h = await makeHarness().load('talents'); const before = JSON.stringify(h.fixture.db.candidatos);
  await h.action('pdf', 'DEMO-T1'); const preset=h.modal.querySelector('[data-pdf-preset]'); preset.value='ceo'; await preset.emit('change'); const check = h.modal.querySelector('[data-pdf-check="nome_completo"]');
  check.checked = false; await h.modal.emit('change', { target: check });
  assert.equal(check.field.dataset.selected, 'false');
  await h.modal.querySelector('[data-pdf-export]').emit('click'); assert.equal(h.printed, 1);
  assert.doesNotMatch(h.window.document.title, /Marina|Duarte/);
  assert.equal(JSON.stringify(h.fixture.db.candidatos), before); assert.equal(h.network.length, 0);
});
