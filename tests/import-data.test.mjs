import test from 'node:test';
import assert from 'node:assert/strict';

// importData() não tinha nenhum teste antes desta auditoria. t4-import-export.js
// captura `global.T4Data`/`global.T4TalentMapping` em constantes locais no
// momento em que o módulo é carregado (const D = global.T4Data || {}), e o
// arquivo é CommonJS (sem package.json "type":"module"), então dynamic
// import() com query string de cache-busting não força reavaliação — o
// módulo real do Node só executa uma vez. Por isso o mock usa um único
// objeto D estável, com métodos que cada teste reatribui antes de chamar
// importData(), em vez de recarregar o módulo a cada teste.
globalThis.window = globalThis;
await import('../assets/t4-v2-models.js');

const D = { TABLES: { employers: 'employers', candidates: 'candidatos' } };
const T = { TABLES: { profiles: 'talent_mapping_profiles', items: 'talent_mapping_items', partners: 'talent_mapping_partners' } };
globalThis.T4Data = D;
globalThis.T4TalentMapping = T;
await import('../assets/t4-import-export.js');
const importer = globalThis.T4ImportExport;

function resetD({ failOn = null } = {}) {
  const log = { upserts: [], updates: [] };
  let counter = 0;
  Object.assign(D, {
    canEdit: () => true,
    uuid: () => `uuid-${++counter}`,
    missingColumn: () => false,
    async upsert(table, rows) {
      if (table === failOn) throw new Error(`Falha simulada em ${table}`);
      log.upserts.push({ table, rows: JSON.parse(JSON.stringify(rows)) });
      return rows;
    },
    async update(table, id, patch) {
      if (table === failOn) throw new Error(`Falha simulada em ${table}`);
      log.updates.push({ table, id, patch });
      return patch;
    }
  });
  return log;
}

test('linha de acompanhamento sem Talento correspondente é rejeitada e reportada, não descartada em silêncio', async () => {
  const log = resetD();
  const source = {
    nectanet: { presentation: [], partners: [], companies: [] },
    mapping: { tracking: [{ talent_name: 'Fulano Desconhecido', empresa: 'Empresa X', _row: 7, _sheet: 'Fulano Desconhecido' }], radar: [], contexts: [], summaries: [] }
  };
  const report = await importer.importData(source, { state: { talents: [], employers: [] } });
  assert.equal(report.rejected.length, 1);
  assert.match(report.rejected[0], /linha 7/);
  assert.match(report.rejected[0], /Fulano Desconhecido/);
  assert.match(report.rejected[0], /não encontrado/);
  assert.equal(log.upserts.some((u) => u.table === T.TABLES.items), false, 'nenhuma linha deveria ter sido enviada para talent_mapping_items');
});

test('empregador já existente é contado como atualizado, um novo é contado como criado', async () => {
  resetD();
  const source = {
    nectanet: { presentation: [], partners: [], companies: [
      { empresa: 'Empresa Existente', sector: 'TI', _row: 2, _sheet: 'Empresas detalhadas' },
      { empresa: 'Empresa Nova', sector: 'Saúde', _row: 3, _sheet: 'Empresas detalhadas' }
    ] },
    mapping: { tracking: [], radar: [], contexts: [], summaries: [] }
  };
  const state = { talents: [], employers: [{ id: 'e1', nome: 'Empresa Existente' }] };
  const report = await importer.importData(source, { state });
  assert.equal(report.employers.created, 1);
  assert.equal(report.employers.updated, 1);
  assert.equal(report.rejected.length, 0);
});

test('empregador novo criado a partir de sinal NectaNet recebe classificação de origem, mas nunca parceria direta', async () => {
  const log = resetD();
  const signalHeaders = ['Empresa', 'Geschäftsführung', 'E-mail', 'HR / Personal', 'E-mail HR', 'Status', 'Qtd.', 'Talentos aderentes'];
  const source = {
    nectanet: { presentation: [], partners: [], companies: [], companySignals: [{ empresa: 'Empresa NectaNet', _row: 2, _sheet: 'Nectanet Partner 01092026' }] },
    mapping: { tracking: [], radar: [], contexts: [], summaries: [], matrizNectanet: [] }
  };
  const report = await importer.importData(source, { state: { talents: [], employers: [] } });
  assert.equal(report.employers.created, 1);
  assert.equal(report.companiesNeedingPartnershipReview, 1);
  const created = log.upserts.find((u) => u.table === 'employers').rows[0];
  assert.equal(created.presented_by_nectanet, true);
  assert.equal(created.source_channel, 'NECTANET');
  assert.equal(created.direct_talents4_partnership, 'UNKNOWN', 'nunca deve gravar parceria direta como confirmada a partir da planilha');
});

test('falha em uma etapa posterior preserva no erro o que já foi gravado nas etapas anteriores (sem transação entre tabelas)', async () => {
  const log = resetD({ failOn: 'candidatos' });
  const source = {
    nectanet: { presentation: [{ nome_completo: 'Novo Talento', _row: 2, _sheet: 'Candidatos priorizados' }], partners: [], companies: [
      { empresa: 'Empresa Nova', _row: 2, _sheet: 'Empresas detalhadas' }
    ] },
    mapping: { tracking: [], radar: [], contexts: [], summaries: [] }
  };
  await assert.rejects(
    importer.importData(source, { state: { talents: [], employers: [] } }),
    (error) => {
      assert.ok(error.importReport, 'o erro precisa carregar o relatório parcial');
      assert.equal(error.importReport.employers.created, 1, 'a etapa de Empregadores já tinha concluído antes da falha em Talentos');
      assert.equal(error.importReport.talents.created, 0, 'Talentos não deve constar como concluído, pois foi onde falhou');
      return true;
    }
  );
  assert.equal(log.upserts.some((u) => u.table === 'employers'), true, 'o upsert de empregadores realmente rodou antes da falha (não é reversível)');
});
