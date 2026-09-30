import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHarness, plain } from './harness.mjs';

// Regra de negócio fixa (redesign UI/UX desta conversa): "Parceira Talents 4"
// só pode aparecer com evidência explícita no banco. Nunca inferida de
// "Nectanet MATCH", nome de aba ou qualquer sinal indireto.
test('nunca mostra "Parceira Talents 4" sem direct_talents4_partnership === CONFIRMADA', () => {
  const { R } = makeHarness();
  const labels = (employer) => plain(R.employerClassificationBadges(employer)).map((b) => b.label);

  assert.deepEqual(labels({}), ['Classificação pendente'], 'sem nenhum campo de classificação, fica pendente, nunca parceira');
  assert.deepEqual(labels({ source_channel: 'NECTANET', presented_by_nectanet: true, direct_talents4_partnership: 'UNKNOWN' }),
    ['Apresentada pela NectaNet', 'Parceria direta não confirmada'],
    'apresentada pela NectaNet com parceria UNKNOWN nunca vira "Parceira Talents 4" sozinha');
  assert.deepEqual(labels({ presented_by_nectanet: true, direct_talents4_partnership: 'CONFIRMADA' }),
    ['Parceira Talents 4', 'Apresentada pela NectaNet'],
    'uma empresa pode ter as duas classificações ao mesmo tempo, sem serem mutuamente exclusivas');
  assert.deepEqual(labels({ direct_talents4_partnership: 'REJEITADA', company_scope: 'GENERAL' }),
    ['Empresa geral', 'Sem parceria direta'],
    'parceria rejeitada não mostra pendência nem parceira — mostra o escopo real');
});

test('filtros de classificação mantêm origem NectaNet, escopo geral e parceria direta independentes', () => {
  const { R } = makeHarness();
  const partnerAndNectanet = { presented_by_nectanet: true, source_channel: 'NECTANET', direct_talents4_partnership: 'CONFIRMADA' };
  const general = { company_scope: 'GENERAL', direct_talents4_partnership: 'REJEITADA' };
  const pending = {};

  assert.equal(R.employerClassificationMatches(partnerAndNectanet, 'partner'), true);
  assert.equal(R.employerClassificationMatches(partnerAndNectanet, 'nectanet'), true);
  assert.equal(R.employerClassificationMatches(general, 'general'), true);
  assert.equal(R.employerClassificationMatches(general, 'partner'), false);
  assert.equal(R.employerClassificationMatches(pending, 'pending'), true);
  assert.equal(R.employerClassificationMatches(partnerAndNectanet, 'all'), true);
});
