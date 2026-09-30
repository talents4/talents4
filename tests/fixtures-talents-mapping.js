/* Complemento fictício exclusivo da prévia/testes de Talentos 2.2.
   Não contém linhas das planilhas e não é carregado pela página conectada. */
(function () {
  'use strict';
  const fixture = window.T4Fixture?.fixture;
  if (!fixture || fixture.mappingSeeded) return;
  fixture.mappingSeeded = true;
  const id = window.T4Fixture.id, stamp = '2026-09-01T10:00:00.000Z';
  const base = (key) => ({id:key,created_at:stamp,updated_at:stamp});
  for (const row of fixture.db.candidatos) {
    for (const [key,value] of Object.entries({idade:30,cv_drive_web_link:null,lingua_estrangeira:null,nivel_lingua_estrangeira:null,pronto_para_employer:false})) if (!(key in row)) row[key]=value;
  }
  fixture.db.talent_mapping_profiles = [
    {...base('DEMO-T1'),lista_nectanet:'Sim',visto:'Em análise',profissional_qualificado:'Fachkraft',novo_cv:'Feito',cluster:'Saúde',ingles:'B2',outros_idiomas:'Português nativo',employer_primary_id:id(101),employer_alt1_id:id(102),employer_alt2_id:null,observacao_apresentacao:'Conteúdo fictício para revisão antes do envio.',perfil_titulo:'Enfermagem · oportunidades de exemplo',perfil_comprovado:'Formação e experiência fictícias para demonstração.',idiomas_contexto:'Alemão B1 informado · inglês B2',regra_revisao:'Verificar vaga, idioma e reconhecimento separadamente.',premissa_projecao:null,barreira_principal:'Reconhecimento ainda em avaliação · exemplo',prioridade_mapeamento:'Alta',best_nectanet_item_id:id(1101),best_external_item_id:id(1102)},
    {...base('DEMO-T2'),lista_nectanet:'Sim',visto:null,profissional_qualificado:'Técnico',novo_cv:'Não feito',cluster:'Indústria',ingles:'A2',outros_idiomas:null,employer_primary_id:id(102),employer_alt1_id:null,employer_alt2_id:null,perfil_titulo:'Mecatrônica · exemplo',perfil_comprovado:null,idiomas_contexto:null,regra_revisao:null,barreira_principal:'Evolução do idioma',prioridade_mapeamento:'Normal'}
  ];
  fixture.db.talent_mapping_items = [
    {...base(id(1101)),talent_id:'DEMO-T1',employer_id:id(101),employer_name:null,opening_id:id(201),source_table:'talent_opportunity_matches',source_record_id:id(301),nectanet:'Sim',vacancy_status:null,professional_score:94,current_viability_score:68,projected_b1_score:88,vacancy_situation:null,type_area:null,fit_reasons:'Afinidade profissional demonstrativa.',barriers:'Reconhecimento a verificar; não é dispensado pelo idioma.',language_requirement:null,recognition_requirement:null,location:null,contact:'RH de demonstração',official_url:null,verified_on:'2026-08-31',verification_notes:'Exemplo, não corresponde a uma verificação real.',archived_at:null},
    {...base(id(1102)),talent_id:'DEMO-T1',employer_id:null,employer_name:'Centro Horizonte · alvo fictício',opening_id:null,source_table:null,source_record_id:null,nectanet:'Não',vacancy_status:'ABERTA',professional_score:89,current_viability_score:55,projected_b1_score:63,vacancy_situation:'Profissional de saúde · exemplo',type_area:'Saúde',fit_reasons:'Alvo de pesquisa, sem seleção criada.',barriers:'Requisitos ainda não confirmados.',language_requirement:'B1/B2 a confirmar',recognition_requirement:'A avaliar',location:'Baden-Württemberg',contact:null,official_url:'https://example.com/posicao',verified_on:null,verification_notes:null,archived_at:null},
    {...base(id(1103)),talent_id:'DEMO-T2',employer_id:id(102),employer_name:null,opening_id:id(202),source_table:'talent_opportunity_matches',source_record_id:id(302),nectanet:'Não',vacancy_status:null,professional_score:91,current_viability_score:35,projected_b1_score:70,vacancy_situation:null,type_area:null,fit_reasons:'Experiência compatível · exemplo.',barriers:'Preparação de idioma.',language_requirement:null,recognition_requirement:null,location:null,contact:null,official_url:null,verified_on:null,verification_notes:null,archived_at:null}
  ];
  fixture.db.talent_mapping_partners = [
    {...base(id(101)),is_nectanet:'Sim',source:'Demonstração',ceo_name:'Direção de exemplo',ceo_email:'direcao@example.invalid',hr_name:'Equipe de RH',hr_email:'rh@example.invalid',contact_status:'Offen',notes:'Parceiro inteiramente fictício.',send_email:'rh@example.invalid',sector:null,description:null,openings_note:null},
    {...base(id(102)),is_nectanet:'Não',source:'Demonstração',ceo_name:null,ceo_email:null,hr_name:'RH técnico',hr_email:'tecnico@example.invalid',contact_status:'Kontakt gefunden',notes:null,send_email:null,sector:null,description:null,openings_note:null}
  ];
})();
