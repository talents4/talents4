import test from 'node:test';
import assert from 'node:assert/strict';

/* A exportação não tinha nenhum teste antes desta entrega. Este arquivo
   prova fidelidade estrutural fazendo um ciclo completo: montar o workbook
   com o gerador real do app, escrevê-lo como .xlsx de verdade (OOXML), e
   reler esse arquivo com o leitor real do app — não comparando contra uma
   cópia do array em memória, mas contra o que um Excel real abriria. */
globalThis.window = globalThis;
await import('../assets/t4-v2-models.js');
await import('../assets/talents-mapping-models.js');
globalThis.JSZip = (await import('../assets/jszip.min.js')).default;
await import('../assets/t4-workbook.js');
await import('../assets/t4-import-export.js');

const T = globalThis.T4TalentMapping;
const state = {
  talents: [
    { id: 'T1', nome_completo: 'Jean Carlos', area_profissional: 'TI', nivel_alemao: 'B1' },
    { id: 'T2', nome_completo: 'Carla Souza', area_profissional: 'Eventos', nivel_alemao: 'A2' }
  ],
  employers: [{ id: 'E1', nome: 'Empresa Alfa GmbH' }, { id: 'E2', nome: 'Empresa Beta GmbH' }],
  mappingProfiles: [
    { id: 'T1', lista_nectanet: 'Sim', employer_primary_id: 'E1', perfil_titulo: 'TI / Redes' },
    { id: 'T2', lista_nectanet: 'Não', perfil_titulo: 'Eventos / Cultura' }
  ],
  mappingItems: [
    { id: 'I1', talent_id: 'T1', employer_id: 'E1', nectanet: 'Sim', vacancy_status: 'ABERTA', professional_score: 90, vacancy_situation: 'Network Engineer' },
    { id: 'I2', talent_id: 'T2', employer_id: 'E2', nectanet: 'Não', vacancy_status: 'ABERTA', professional_score: 70, vacancy_situation: 'Eventmanager' }
  ],
  mappingPartners: [{ id: 'E1', is_nectanet: 'Sim' }]
};
const people = state.talents;

test('exportação NectaNet: mesmos nomes de aba, mesma ordem, mesmos cabeçalhos do modelo oficial (ciclo real de escrita + leitura OOXML)', async () => {
  const spec = globalThis.T4ImportExport.buildNectaWorkbook(state, people);
  assert.deepEqual(spec.sheets.map((s) => s.name), ['Nectanet Partner', 'Candidatos priorizados', 'Empresas detalhadas'],
    'nomes e ordem das abas devem bater com o modelo oficial (ver docs/mapeamento/CONTRATO_PLANILHAS.md)');

  const blob = await globalThis.T4Workbook.write(spec);
  const reloaded = await globalThis.T4Workbook.read({ name: 'reexport.xlsx', arrayBuffer: async () => await blob.arrayBuffer() });

  assert.deepEqual(reloaded.sheets.map((s) => s.name), ['Nectanet Partner', 'Candidatos priorizados', 'Empresas detalhadas']);
  const candidatos = reloaded.sheets.find((s) => s.name === 'Candidatos priorizados');
  assert.deepEqual(candidatos.rows[0], [
    'Lista Nectanet', 'Nome', 'Visto', 'Profissional Qualificado', 'Novo CV', 'CV', 'Idade', 'Área principal', 'Cluster',
    'Anos de experiência', 'Alemão', 'Inglês', 'Outros idiomas', 'Empresa principal', 'Empresa alternativa 1', 'Empresa alternativa 2', 'Resumo do candidato', 'Observação'
  ], 'cabeçalho lido de volta do arquivo real precisa ser idêntico ao do modelo oficial, na mesma ordem');
  assert.equal(candidatos.rows.length, 3, '1 cabeçalho + 2 Talentos selecionados, nenhum a mais nem a menos');
  const jeanRow = candidatos.rows.find((r) => r[1] === 'Jean Carlos');
  assert.ok(jeanRow, 'Talento selecionado precisa estar presente após o ciclo completo de escrita e leitura');
  assert.equal(jeanRow[13], 'Empresa Alfa GmbH', 'nome do empregador (não o ID interno) deve estar na coluna "Empresa principal"');

  const partners = reloaded.sheets.find((s) => s.name === 'Nectanet Partner');
  assert.deepEqual(partners.rows[0], ['nectanet source', 'Unternehmen', 'Geschäftsführer', 'Kontakt-E-Mail', 'Personaler', 'Kontakt-E-Mail 2', 'Kontaktstatus', 'Anzahl Kandidaten', 'Passende Kandidaten', 'Arbeitsbereich', 'Deutschniveau', 'Englischniveau', 'PS']);
});

test('exportação de acompanhamento: uma aba por Talento selecionado, com as 16 colunas oficiais, mais Resumo BW e Radar NectaNet', async () => {
  const spec = globalThis.T4ImportExport.buildMappingWorkbook(state, people);
  assert.deepEqual(spec.sheets.map((s) => s.name), ['Jean Carlos', 'Carla Souza', 'Resumo BW', 'Radar NectaNet'],
    'uma aba por Talento selecionado (nome do Talento, como no modelo oficial), depois Resumo BW e Radar NectaNet');

  const blob = await globalThis.T4Workbook.write(spec);
  const reloaded = await globalThis.T4Workbook.read({ name: 'reexport.xlsx', arrayBuffer: async () => await blob.arrayBuffer() });

  const jeanSheet = reloaded.sheets.find((s) => s.name === 'Jean Carlos');
  const headerRow = jeanSheet.rows.find((r) => r[0] === 'Empresa');
  assert.deepEqual(headerRow, T.FIELDS.tracking.map(([, label]) => label), 'cabeçalho das 16 colunas de acompanhamento precisa bater com o modelo oficial');
  const dataRow = jeanSheet.rows[jeanSheet.rows.indexOf(headerRow) + 1];
  assert.equal(dataRow[0], 'Empresa Alfa GmbH');
});
