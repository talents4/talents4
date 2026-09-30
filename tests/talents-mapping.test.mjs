import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { makeHarness, root } from './harness.mjs';

async function boot(options) { const h=makeHarness(options); await h.load('talents'); return h; }
const text = (h) => h.app.pageRoot.innerHTML;
const state = async (h) => ({talents:h.fixture.db.candidatos,employers:h.fixture.db.employers,openings:h.fixture.db.employer_openings,selections:await h.D.loadMatches(),activities:h.fixture.db.crm_activities,enrollments:h.fixture.db.german_course_enrollments,mappingProfiles:h.fixture.db.talent_mapping_profiles,mappingItems:h.fixture.db.talent_mapping_items,mappingPartners:h.fixture.db.talent_mapping_partners});

test('contratos: 18 Nectanet, 16 acompanhamento, 12 resumo, 11 radar, 13 parceiros e 5 empresas',async()=>{
  const h=await boot();
  assert.deepEqual(Object.fromEntries(Object.entries(h.T.FIELDS).map(([k,v])=>[k,v.length])),{presentation:18,tracking:16,summary:12,radar:11,partners:13,companies:5});
  assert.deepEqual(Array.from(h.T.FIELDS.tracking,x=>x[1]),['Empresa','NectaNet?','Status','Aderência profissional','Viabilidade atual','Viabilidade projetada — B1 em 3 meses','Vaga / situação','Tipo / área','Por que se encaixa','Barreira / risco','Idioma / requisito','Anerkennung / Approbation','Local','Contato','Link direto / oficial','Verificado em']);
  h.app.route('presentation'); await h.action('presentation-view','released');
  // A folha comparativa A4 é um grid, não uma <table>: o nome vira coluna
  // (cabeçalho de cada Talento) e cada campo vira uma linha identificada por
  // data-presentation-field. Confere a ordem das linhas, não de um <thead>.
  const html=text(h); let previous=-1;
  for(const [key,label] of h.T.FIELDS.presentation) {
    if (key==='nome_completo') continue;
    const at=html.indexOf(`data-presentation-field="${key}"`);assert.ok(at>previous,`ordem ${label}`);previous=at;
  }
});
test('folha de apresentação mantém a rolagem que fixa os nomes no topo',async()=>{
  // O cabeçalho com os nomes só continua visível ao descer a página se o
  // painel rolável (.tw-presentation-sheet-scroll) receber a variável de
  // deslocamento — CSS var não sobe de um filho para o pai, então ela precisa
  // estar no PRÓPRIO elemento que agora é sticky, não numa <section> interna.
  const h=await boot(); h.app.route('presentation'); await h.action('presentation-view','released');
  const html=text(h);
  const scrollStart=html.indexOf('tw-presentation-sheet-scroll');
  assert.ok(scrollStart>=0);
  const scrollTagEnd=html.indexOf('>',scrollStart);
  assert.match(html.slice(scrollStart,scrollTagEnd),/style="--tw-presentation-sticky-top:\d+px"/);
});
test('filtros: OU dentro da etapa, E com idioma; remover uma opção preserva as outras',async()=>{
  const h=await boot(); h.filter('stage',['Curso de Alemão','Análise']);
  assert.match(text(h),/Lucas Vieira/); assert.match(text(h),/Sofia Almeida/); assert.doesNotMatch(text(h),/Marina Duarte/);
  h.filter('german',['A2']); assert.match(text(h),/Lucas Vieira/); assert.match(text(h),/Sofia Almeida/);
  await h.action('filter-remove',JSON.stringify(['stage','Análise'])); assert.doesNotMatch(text(h),/Sofia Almeida/); assert.match(text(h),/Lucas Vieira/);
  assert.equal(h.fixture.writes.length,0);
});
test('filtro de empregador inclui alvos sem cadastro pelo nome importado', async () => {
  const h = await boot(), s = await state(h);
  s.mappingItems = [...s.mappingItems, { id: 'UNMAPPED-1', talent_id: 'DEMO-T3', employer_id: null, employer_name: 'Empresa sem cadastro · exemplo', archived_at: null }];
  const rows = h.T.filterTalents({ ...s, filters: { employer: ['Empresa sem cadastro · exemplo'] }, quick: [] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'DEMO-T3');
});
test('filtros rápidos combinam curso e atenção sem trazer todos os alunos',async()=>{
  const h=await boot(); await h.action('quick','course'); await h.action('quick','attention');
  assert.match(text(h),/Lucas Vieira/); assert.doesNotMatch(text(h),/Sofia Almeida/);
  assert.equal((text(h).match(/aria-pressed="true"/g)||[]).length,2);
  await h.action('quick','attention'); assert.match(text(h),/Sofia Almeida/);
});
test('barra de filtros expõe o essencial e agrupa critérios avançados',async()=>{
  const h=await boot();
  h.app.route('presentation');
  assert.match(text(h),/Filtros/);
  assert.match(text(h),/Mais filtros/);
  assert.doesNotMatch(text(h),/Dentro de cada filtro, escolha uma opção ou mais/);
  assert.doesNotMatch(text(h),/Você pode combinar vários filtros/);
  assert.doesNotMatch(text(h),/t4-window-controls/);
  assert.equal(h.fixture.writes.length,0);
});
test('liberação e Lista Nectanet são independentes; selecionar pronto abre as 18 colunas',async()=>{
  const h=await boot(); await h.action('quick','ready');
  assert.match(text(h),/Empresa alternativa 2/); assert.match(text(h),/Marina Duarte/);
  // Lucas Vieira pode aparecer no seletor manual (lista todos os Talentos
  // ativos para inclusão manual), mas não deve estar na folha comparativa em
  // si — só quem atende o recorte "liberado" (ou foi incluído manualmente).
  const sheetHtml = text(h).slice(text(h).indexOf('data-tw-sheet="presentation-a4"'));
  assert.match(sheetHtml,/Marina Duarte/); assert.doesNotMatch(sheetHtml,/Lucas Vieira/);
  await h.action('quick','all'); assert.match(text(h),/Lucas Vieira/); assert.doesNotMatch(text(h),/tw-presentation-grid/);
  await h.action('readiness','DEMO-T2'); const result=await h.submit({pronto_para_employer:'true'}); assert.equal(result.error,'');
  assert.equal(h.fixture.db.candidatos.find(r=>r.id==='DEMO-T2').pronto_para_employer,true);
  assert.equal(h.fixture.writes.length,1); assert.equal(h.fixture.writes[0].table,'candidatos');
});
test('seleção original é exibida uma vez, complementos não sobrescrevem scores gerais',async()=>{
  const h=await boot(),s=await state(h),rows=h.T.mappingRows(s);
  assert.equal(rows.filter(r=>r.source_record_id===h.id(301)).length,1);
  assert.equal(rows.find(r=>r.source_record_id===h.id(301)).professional_score,94);
  assert.equal(h.fixture.db.talent_opportunity_matches[0].overall_score,88);
  const without={...s,mappingItems:[]}, legacy=h.T.mappingRows(without).find(r=>r.source_record_id===h.id(301));
  assert.equal(legacy.professional_score,null); assert.equal(legacy.vacancy_status,'Aberta');
});
test('resumo conta somente vagas abertas; scores vazios não são zero nem aprovam',async()=>{
  const h=await boot(),s=await state(h); const row=h.T.summaryRows(s,[s.talents[0]])[0];
  assert.equal(row.mapped,2);assert.equal(row.open,2);assert.equal(row.nectanet_open,1);assert.equal(row.fit90,1);assert.equal(row.current60,1);assert.equal(row.projected60,2);
  assert.match(row.best_nectanet,/Aurora/);assert.match(row.best_external,/Horizonte/);
  assert.equal(h.T.score(null),null);assert.equal(h.T.score(''),null);assert.equal(h.T.score(0),0);
  assert.throws(()=>h.T.validateScores({projected_b1_score:101}),/0 a 100/);
});
test('edição de score grava só o complemento e mantém a situação atual independente do B1',async()=>{
  const h=await boot(); await h.action('mapping-item',h.id(1103)); const r=await h.submit({projected_b1_score:'92'}); assert.equal(r.error,'');
  assert.equal(h.fixture.writes.length,1); assert.equal(h.fixture.writes[0].table,'talent_mapping_items');
  assert.equal(h.fixture.db.talent_mapping_items[2].current_viability_score,35);
  assert.equal(h.fixture.db.candidatos[1].nivel_alemao,'A2'); assert.equal(h.fixture.db.candidatos[1].pronto_para_employer,false);
  assert.equal(h.fixture.db.talent_opportunity_matches[1].stage,'Entrevista');
});
test('resumo e inglês antigos ficam visíveis sem copiar nem gravar valores na carga',async()=>{
  const h=await boot(),s=await state(h);s.presentationDetails=[{id:'DEMO-T1',lingua_estrangeira:'Inglês',nivel_lingua_estrangeira:'C1'}];s.mappingProfiles=[];
  const row=h.T.presentationRows(s,[s.talents[0]])[0];assert.equal(row.perfil_profissional_para_apresentacao,s.talents[0].resumo_rh_curto);assert.equal(row.ingles,'C1');assert.ok(row._englishFallback);assert.ok(row._summaryFallback);
  assert.equal(h.fixture.writes.length,0);
});
test('parceiros deduplicam o Talento e usam informações canônicas dos empregadores',async()=>{
  const h=await boot(),s=await state(h);s.mappingProfiles[0].employer_alt2_id=h.id(101);
  const rows=h.T.partnerRows(s,[s.talents[0]]);const aurora=rows.find(r=>r.id===h.id(101));assert.equal(aurora.count,1);assert.equal(aurora.description,s.employers[0].descricao_resumida);
  await h.action('presentation-cell',JSON.stringify(['DEMO-T1','employer_alt2_id']));const r=await h.submit({employer_alt2_id:h.id(101)});assert.match(r.error,/empresas diferentes/);assert.equal(h.fixture.writes.length,0);
});
test('mapeamento pode ter empresa prospectiva sem criar empregador, seleção ou Talento',async()=>{
  const h=await boot();await h.action('mapping-new','DEMO-T3');const r=await h.submit({employer_name:'Empresa puramente fictícia',vacancy_status:'A CONFIRMAR',professional_score:'82',current_viability_score:'',projected_b1_score:''});assert.equal(r.error,'');
  assert.deepEqual(Array.from(h.fixture.writes,w=>w.table),['talent_mapping_items']);
  const row=h.fixture.db.talent_mapping_items.at(-1);assert.equal(row.current_viability_score,null);assert.equal(row.talent_id,'DEMO-T3');
});
test('rejeita vaga de outro empregador e URL executável antes de gravar',async()=>{
  const h=await boot();await h.action('mapping-new','DEMO-T3');const wrong=await h.submit({employer_id:h.id(101),opening_id:h.id(202)});assert.match(wrong.error,/outro empregador/);assert.equal(h.fixture.writes.length,0);
  await h.action('mapping-new','DEMO-T3');const bad=await h.submit({employer_name:'Empresa fictícia',official_url:'javascript:alert(1)'});assert.match(bad.error,/HTTP ou HTTPS/);assert.equal(h.fixture.writes.length,0);
});
test('leitor vê os acompanhamentos, mas não recebe formulários de alteração',async()=>{
  const h=await boot({role:'viewer'});h.app.route('mapping');assert.match(text(h),/Viabilidade atual/);
  await h.action('mapping-item',h.id(1101));await h.action('readiness','DEMO-T1');assert.equal(h.forms.length,0);assert.equal(h.fixture.writes.length,0);
});
test('fontes novas ausentes geram aviso; seleções antigas continuam consultáveis',async()=>{
  const h=await boot();delete h.fixture.db.talent_mapping_items;delete h.fixture.db.talent_mapping_profiles;delete h.fixture.db.talent_mapping_partners;
  await h.action('reload');h.app.route('mapping');assert.match(text(h),/ainda não foi importado/);assert.match(text(h),/Viabilidade atual/);
  await assert.rejects(h.action('mapping-new','DEMO-T1'),/não estão disponíveis/);assert.equal(h.fixture.writes.length,0);
});
test('abrir acompanhamento por ficha remove filtros incompatíveis e preserva arquivados',async()=>{
  const h=await boot();h.filter('stage',['Análise']);await h.action('mapping-for','DEMO-T1');assert.match(text(h),/Marina Duarte/);assert.match(text(h),/Perfil comprovado/);
  await h.action('mapping-for','DEMO-T4');assert.match(text(h),/Talento arquivado/);assert.match(text(h),/Rafael Costa/);
});
test('novo estilo e modelos são carregados somente no switch Talentos',()=>{
  for(const module of ['organizacional','alemao','contatos'])assert.doesNotMatch(readFileSync(resolve(root,`${module}.html`),'utf8'),/talents-mapping/);
  const main=readFileSync(resolve(root,'index.html'),'utf8');assert.match(main,/talents-mapping-models\.js/);assert.doesNotMatch(main,/fixtures-talents-mapping/);
});
test('checkboxes reais do controlador adicionam e retiram opções sem gravar',async()=>{
  const h=await boot();
  const toggle=async(value,checked)=>h.ctx.document.emit('change',{target:{matches:s=>s==='[data-tw-check]',dataset:{twCheck:'stage'},value,checked,id:'teste-checkbox',closest:()=>null}});
  await toggle('Curso de Alemão',true);await toggle('Análise',true);assert.match(text(h),/Lucas Vieira/);assert.match(text(h),/Sofia Almeida/);
  await toggle('Curso de Alemão',false);assert.doesNotMatch(text(h),/Lucas Vieira/);assert.match(text(h),/Sofia Almeida/);assert.equal(h.fixture.writes.length,0);
});
test('filtros múltiplos das seleções são independentes dos filtros da base',async()=>{
  const h=await boot();h.filter('stage',['Análise']);h.app.route('processes');h.filter('status',['Apresentado','Entrevista']);
  assert.match(text(h),/Marina Duarte/);assert.match(text(h),/Lucas Vieira/);
  h.filter('employer',[h.id(101)]);assert.match(text(h),/Marina Duarte/);assert.doesNotMatch(text(h),/Lucas Vieira/);
  h.app.route('talents');assert.match(text(h),/Sofia Almeida/);assert.doesNotMatch(text(h),/Marina Duarte/);
});
test('complementos podem ser preparados antes da liberação',async()=>{
  const h=await boot();await h.action('presentation-profile','DEMO-T2');const result=await h.submit({visto:'A conferir',outros_idiomas:'Português'});assert.equal(result.error,'');
  assert.equal(h.fixture.writes.length,1);assert.equal(h.fixture.writes[0].table,'talent_mapping_profiles');assert.equal(h.fixture.db.candidatos[1].pronto_para_employer,false);
});
test('uma vaga já acompanhada não gera uma segunda linha',async()=>{
  const h=await boot();await h.action('mapping-new','DEMO-T1');const result=await h.submit({employer_id:h.id(101),opening_id:h.id(201)});assert.match(result.error,/já está no acompanhamento/);assert.equal(h.fixture.writes.length,0);
});
test('concorrência nos campos novos exige atualizar antes de salvar',async()=>{
  const h=await boot();await h.action('presentation-cell',JSON.stringify(['DEMO-T1','visto']));h.fixture.db.talent_mapping_profiles[0].updated_at='2026-09-01T12:30:00.000Z';
  const result=await h.submit({visto:'Novo valor'});assert.match(result.error,/registro mudou|nenhum|encontrado/i);assert.equal(h.fixture.db.talent_mapping_profiles[0].visto,'Em análise');
});
test('idade textual existente permanece no formulário sem conversão',async()=>{
  const h=await boot();h.fixture.db.candidatos[0].idade='30 anos · informado';await h.action('edit-talent','DEMO-T1');assert.equal(h.forms.at(-1).fields.get('idade').value,'30 anos · informado');
  const result=await h.submit({telefone:'Telefone de exemplo'});assert.equal(result.error,'');assert.equal(h.fixture.db.candidatos[0].idade,'30 anos · informado');
});
