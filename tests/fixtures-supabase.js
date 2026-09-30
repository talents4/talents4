/* Somente demonstração/testes. Nunca carregado pelas páginas de produção. */
(function () {
  'use strict';
  const w = typeof window === 'undefined' ? globalThis : window;
  w.T4_DEMO = true;
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const stamp = '2026-09-01T10:00:00.000Z';
  const base = (n) => ({ id: id(n), created_at: stamp, updated_at: stamp });
  const talent = (n, name, profession, level, stage, extra = {}) => ({ id: `DEMO-T${n}`, nome_completo: name, ativo: true, email: `talento${n}@example.invalid`, telefone: '+55 00 00000-0001', cidade_atual: 'Cidade de exemplo', pais_de_origem: 'Brasil', profissao_principal: profession, area_profissional: profession, nivel_alemao: level, status_pipeline: stage, responsavel_interno: 'Equipe demonstração', prioridade_comercial: 'Normal', documentacao_completa: 'NÃO', pendencia_documental_critica: null, resumo_rh_curto: 'Perfil fictício criado exclusivamente para testar a interface.', resumo_profissional: 'Experiência em equipe multidisciplinar e interesse em atuação internacional.', perfil_profissional_para_apresentacao: null, observacoes_internas: 'Observação interna de demonstração. Não é um registro real.', universidade: 'Instituição de exemplo', curso_de_graduacao: profession, experiencia_profissional_tempo: '5 anos', passaporte_status: 'Em preparação', diploma_status: 'Conferido', historico_status: 'A conferir', passaporte_numero: null, passaporte_validade: null, registro_status: 'Ativo', registro_numero: null, registro_validade: null, anabin: null, posgraduacao: null, relato_sobre_a_experiencia_profissional: 'Atuação e projetos de demonstração.', disponibilidade_mudanca: 'A combinar', data_prevista_mudanca: null, data_da_candidatura: '2026-08-03', data_entrada_etapa_atual: stamp, ultima_atualizacao: stamp, atualizado_por: 'Equipe demonstração', data_inativacao: null, motivo_inativacao: null, observacao_final_de_saida: 'Histórico preservado.', ...extra });
  function seed() {
    return {
      usuarios: [{ username: 'demo', nome: 'Equipe demonstração', role: 'admin', ativo: 'SIM', color: '#002A4A' }],
      candidatos: [
        talent(1, 'Marina Duarte', 'Enfermagem', 'B1', 'Pronto para employer', { documentacao_completa: 'SIM', pronto_para_employer: true }),
        talent(2, 'Lucas Vieira', 'Mecatrônica', 'A2', 'Curso de Alemão', { prioridade_comercial: 'Alta' }),
        talent(3, 'Camila Santos', 'Fisioterapia', 'B2', 'Enviado ao employer'),
        talent(4, 'Rafael Costa', 'Tecnologia', 'A1', 'Triagem', { ativo: false, data_inativacao: '2026-08-20', motivo_inativacao: 'Pausa solicitada · exemplo' }),
        talent(5, 'Sofia Almeida', 'Hotelaria', 'A2', 'Análise')
      ],
      employers: [
        { ...base(101), nome: 'Clínica Aurora · exemplo', nome_normalizado: 'clinica_aurora', ativo: true, status: 'ativo', tipo: 'empregador', cidade: 'Freiburg', pais: 'Alemanha', area_atuacao: 'Saúde e reabilitação', descricao_resumida: 'Parceria fictícia para demonstrar o relacionamento com empregadores.', descricao_operacional: 'Demanda de profissionais com alemão B1/B2 e documentação conferida.', contato_principal: 'Equipe de RH · exemplo', email_principal: 'rh@aurora.example.invalid', telefone: null, site: 'https://example.com/', responsavel_interno: 'Equipe demonstração', nivel_alemao_minimo: 'B1', vagas_abertas: 2, perfis_buscados: 'Enfermagem; Fisioterapia', requisitos_principais: 'Formação compatível', diferenciais_desejaveis: null, observacoes_internas: 'Reunião de alinhamento agendada.', deleted_at: null },
        { ...base(102), nome: 'Nord Technik · exemplo', nome_normalizado: 'nord_technik', ativo: true, status: 'ativo', tipo: 'empregador', cidade: 'Karlsruhe', pais: 'Alemanha', area_atuacao: 'Indústria e tecnologia', descricao_resumida: 'Empresa de demonstração para o fluxo de vagas técnicas.', descricao_operacional: null, contato_principal: 'RH técnico · exemplo', email_principal: 'rh@nord.example.invalid', telefone: null, site: null, responsavel_interno: 'Equipe demonstração', nivel_alemao_minimo: 'A2', vagas_abertas: 1, deleted_at: null }
      ],
      employer_openings: [
        { ...base(201), employer_id: id(101), title: 'Enfermagem · exemplo', quantity: 2, status: 'Aberta', order_index: 0, is_active: true, deleted_at: null, location: 'Freiburg', area: 'Saúde', language_requirement: 'B1', recognition_requirement: 'A avaliar', external_url: 'https://example.com/', source: 'Demonstração', verified_at: stamp, description: 'Oportunidade inteiramente fictícia.' },
        { ...base(202), employer_id: id(102), title: 'Técnico em mecatrônica · exemplo', quantity: 1, status: 'Aberta', order_index: 1, is_active: true, deleted_at: null, location: 'Karlsruhe', area: 'Indústria', language_requirement: 'A2', recognition_requirement: null, external_url: null, source: 'Demonstração', verified_at: stamp, description: 'Vaga de exemplo para validação funcional.' }
      ],
      talent_opportunity_matches: [
        { ...base(301), talent_id: 'DEMO-T1', opening_id: id(201), employer_id: id(101), stage: 'Apresentado', status: 'Ativo', priority: 1, owner_username: 'demo', next_action: 'Confirmar retorno sobre o perfil', next_action_at: '2026-09-03T14:00:00Z', viability: 'Alta', overall_score: 88, reasons: 'Formação e nível de idioma aderentes · exemplo', barriers: null, sent_at: stamp, responded_at: null },
        { ...base(302), talent_id: 'DEMO-T2', opening_id: id(202), employer_id: id(102), stage: 'Entrevista', status: 'Ativo', priority: 2, owner_username: 'demo', next_action: 'Preparar entrevista técnica', next_action_at: '2026-09-05T10:00:00Z', viability: 'A validar', overall_score: null, reasons: null, barriers: 'Acompanhar evolução do idioma', sent_at: stamp, responded_at: null }
      ],
      candidate_employer_matches: [{ ...base(303), candidato_id: 'DEMO-T3', empregador_id: id(101), status_vinculo: 'Em processo', elegivel: true, is_primary: true, prioridade: 1, proxima_acao: 'Revisar documentação', observacoes: 'Vínculo anterior preservado', motivo_encaixe: 'Histórico do CRM original' }],
      candidate_employer_links: [{ ...base(304), candidate_id: 'DEMO-T3', employer_id: id(101), status_vinculo: 'Em processo', ativo: true, proxima_acao: 'Revisar documentação', observacao_rh: 'Origem antiga preservada' }],
      crm_activities: [
        { ...base(401), title: 'Conferir documentos de Marina', activity_type: 'Documento', status: 'Pendente', priority: 'Alta', due_at: '2026-09-01T15:00:00Z', talent_id: 'DEMO-T1', employer_id: id(101), owner_username: 'demo', contact_id: null, contact_followup_id: null, notes: 'Exemplo de ação compartilhada entre Talentos e Organizacional.', outcome: null, completed_at: null },
        { ...base(402), title: 'Retornar ao professor', activity_type: 'Follow-up', status: 'Pendente', priority: 'Normal', due_at: '2026-09-02T13:00:00Z', talent_id: null, employer_id: null, owner_username: 'demo', contact_id: id(501), contact_followup_id: id(701), notes: 'Confirmar cronograma.', outcome: null, completed_at: null }
      ],
      contact_records: [
        { ...base(501), display_name: 'Professor de demonstração', entity_type: 'Pessoa', email: 'professor@example.invalid', phone: null, whatsapp: null, secondary_email: null, city: 'Cidade de exemplo', country: 'Brasil', status: 'Ativo', relationship_stage: 'Relacionamento', priority: 'Normal', owner_username: 'demo', job_title: 'Professor de alemão', legal_name: null, notes: 'Contato fictício.', source_system: null, source_record_id: null, archived_at: null, primary_organization_id: null, website: null, linkedin_url: null, language: 'Português / alemão', preferred_channel: 'E-mail' },
        { ...base(502), display_name: 'Café da Praça · exemplo', entity_type: 'Organização', email: 'cafe@example.invalid', phone: '+55 00 00000-9999', city: 'Cidade de exemplo', status: 'Ativo', relationship_stage: 'Em contato', priority: 'Normal', owner_username: 'demo', source_system: null, source_record_id: null, archived_at: null, notes: 'Exemplo de contato geral que não é empregador nem talento.' },
        { ...base(503), display_name: 'Contato de origem não encontrada · exemplo', entity_type: 'Pessoa', email: 'origem@example.invalid', status: 'Ativo', relationship_stage: 'Novo', source_system: 'candidatos', source_record_id: 'DEMO-ORIGEM-AUSENTE', archived_at: null },
        { ...base(504), display_name: 'Marina Duarte', entity_type: 'Pessoa', email: 'talento1@example.invalid', status: 'Ativo', relationship_stage: 'Relacionamento', source_system: 'candidatos', source_record_id: 'DEMO-T1', archived_at: null, notes: 'Histórico do contato vinculado.', owner_username: 'demo', secondary_email: null, whatsapp: null }
      ],
      contact_categories: [{ ...base(601), name: 'Professor', slug: 'professor', is_system: true, is_active: true, color: '#1E1349', sort_order: 1 }, { ...base(602), name: 'Fornecedor', slug: 'fornecedor', is_system: false, is_active: true, color: '#245B85', sort_order: 2 }],
      contact_record_categories: [{ contact_id: id(501), category_id: id(601) }, { contact_id: id(502), category_id: id(602) }],
      contact_relationships: [{ ...base(801), contact_id: id(504), related_contact_id: id(501), relationship_label: 'Acompanhado por', is_primary: false, notes: 'Vínculo de demonstração.' }],
      contact_interactions: [{ ...base(802), contact_id: id(501), occurred_at: stamp, interaction_type: 'E-mail', subject: 'Alinhamento de aulas', summary: 'Resumo fictício de uma interação profissional.', outcome: 'Confirmar cronograma' }],
      contact_followups: [{ ...base(701), contact_id: id(501), title: 'Retornar ao professor', due_at: '2026-09-02T13:00:00Z', status: 'Pendente', priority: 'Normal', assigned_username: 'demo', notes: 'Confirmar cronograma.', completed_at: null }],
      german_course_classes: [{ ...base(901), code: 'DEMO-A2-B1', name: 'Alemão para profissionais', provider: 'Instituto de demonstração', teacher_name: 'Professor de demonstração', teacher_contact_id: id(501), level_start: 'A2', level_target: 'B1', start_date: '2026-08-03', expected_end_date: '2026-12-18', schedule_text: 'Terças e quintas · 19h BRT', modality: 'Online', capacity: 12, status: 'Ativa', meeting_link: 'https://example.com/aula', drive_link: 'https://example.com/materiais', notes: 'Turma inteiramente fictícia.' }],
      german_course_enrollments: [
        { ...base(911), class_id: id(901), candidate_id: 'DEMO-T2', status: 'Ativo', enrolled_at: '2026-08-03', completed_at: null, current_level: 'A2', target_level: 'B1', attendance_percent: 72, progress_percent: 45, performance: 'Atenção', risk_level: 'Médio', exam_status: 'Não agendado', next_action: 'Reforçar conversação', next_action_due: '2026-09-04', owner_name: 'Equipe demonstração', notes: 'Acompanhamento de exemplo.', last_assessment_score: 68, last_assessment_at: '2026-08-27' },
        { ...base(912), class_id: id(901), candidate_id: 'DEMO-T5', status: 'Matriculado', enrolled_at: '2026-09-01', completed_at: null, current_level: 'A2', target_level: 'B1', attendance_percent: null, progress_percent: 0, performance: 'Sem avaliação', risk_level: 'Baixo', exam_status: 'Não agendado', next_action: 'Apresentação à turma', next_action_due: '2026-09-10', owner_name: 'Equipe demonstração', notes: null, last_assessment_score: null, last_assessment_at: null }
      ],
      german_course_updates: [{ ...base(921), enrollment_id: id(911), event_date: '2026-08-27', kind: 'Avaliação', attendance_status: null, score: 68, level_after: 'A2', note: 'Avaliação fictícia de demonstração.' }],
      organizational_plan_entries: [{ ...base(1001), employer_id: id(101), employer_name_snapshot: 'Clínica Aurora · exemplo', month_ref: '2026-09', activity_label: 'Alinhar apresentação de perfis', activity_key: 'envio', activity_type: 'standard', responsavel: 'Equipe demonstração', status: 'Em andamento', obs: 'Apresentação acompanhada de breve resumo profissional.', start_date: '2026-09-01', end_date: '2026-09-04', order_index: 0, deleted_at: null }],
      organizational_meetings: [{ ...base(1002), employer_id: null, employer_name_snapshot: null, meeting_scope: 'internal', group_name: 'Talents 4', title: 'Alinhamento semanal · exemplo', topic: 'Prioridades da semana', month_ref: '2026-09', week_label: 'Semana 1', scheduled_at: '2026-09-03T14:00:00Z', owner_name: 'Equipe demonstração', status: 'Em andamento', decision_summary: 'Priorizar entrevistas e documentação.', resolved_items: 'Revisão do planejamento', pending_items: 'Confirmar horários', next_action: 'Agendar entrevistas', notes: null, deleted_at: null }],
      organizational_weekly_summaries: [{ ...base(1003), employer_id: id(101), employer_name_snapshot: 'Clínica Aurora · exemplo', summary_scope: 'employer', month_ref: '2026-08', week_label: 'Semana 4', period_start: '2026-08-24', period_end: '2026-08-28', what_was_done: 'Revisão de perfis · exemplo', result_summary: 'Perfis preparados', next_action: 'Apresentação', owner_name: 'Equipe demonstração', status: 'Concluído', notes: 'Histórico anterior demonstrativo.', order_index: 0, deleted_at: null }],
      organizational_replacement_requests: [{ ...base(1004), employer_id: id(102), employer_name_snapshot: 'Nord Technik · exemplo', profile_needed: 'Perfil técnico · exemplo', replaces_candidate_name_snapshot: 'Registro fictício', priority: 'Alta', search_status: 'Em busca', notes: JSON.stringify({ __t4_replacement_v1: true, qtd: 1, gatilho: 'Reposição demonstrativa', dataSolicitacao: '2026-08-28', obs: 'Histórico preservado.' }), deleted_at: null }],
      operational_tasks: [{ ...base(1005), title: 'Preparar pauta das entrevistas', description: 'Tarefa fictícia para verificar o PO operacional.', month_ref: '2026-09', employer_id: id(102), context_type: 'employer', candidate_id: null, meeting_id: null, status: 'A fazer', priority: 'Alta', owner_user_key: 'Equipe demonstração', assigned_user_key: 'Equipe demonstração', team_scope: 'team', start_date: '2026-09-01', due_date: '2026-09-02', completed_at: null, notes: null, resource_link: null, sort_index: 0, is_recurring: false, deleted_at: null }],
      operational_metrics: [{ ...base(1006), month_ref: '2026-09', metric_key: 'entrevistas_demo', metric_label: 'Entrevistas preparadas', target_value: 5, actual_value: 2, owner_user_key: 'Equipe demonstração', team_scope: 'team', notes: 'Meta fictícia.', deleted_at: null }],
      org_ui_state_snapshots: [{ app_key: 'talents4_crm_v5', updated_at: stamp, payload: { employers: [{ name: 'Parceiro anterior · exemplo', descricao: 'Contexto preservado no acervo.', pasta: 'https://example.com/material' }], dossiers: { Exemplo: { candidatos: [], removidos: [{ nome: 'Histórico fictício' }], reposicao: [] } } } }]
    };
  }
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const fixture = { db: seed(), writes: [], reads: [], errors: {}, writeErrors: {}, pageCap: 500, version: 0, signedIn: true };
  function error(message, code = '23514') { return { message, code }; }
  function trigger(table, row) {
    if (table === 'contact_followups') {
      const payload = { title: row.title, activity_type: 'Follow-up', status: { 'Concluído': 'Concluída', 'Cancelado': 'Cancelada' }[row.status] || 'Pendente', due_at: row.due_at, priority: row.priority, owner_username: row.assigned_username, notes: row.notes, contact_id: row.contact_id, contact_followup_id: row.id, completed_at: row.completed_at, updated_at: row.updated_at };
      const target = fixture.db.crm_activities.find((r) => r.contact_followup_id === row.id);
      if (target) Object.assign(target, payload); else fixture.db.crm_activities.push({ ...base(2000 + fixture.version), ...payload });
    }
    if (table === 'german_course_updates') {
      const updates = fixture.db.german_course_updates.filter((r) => r.enrollment_id === row.enrollment_id).sort((x, y) => String(y.event_date).localeCompare(String(x.event_date)) || String(y.created_at).localeCompare(String(x.created_at)));
      const target = fixture.db.german_course_enrollments.find((r) => r.id === row.enrollment_id);
      const attendance = updates.filter((r) => r.kind === 'Presença');
      const assessment = updates.find((r) => r.kind === 'Avaliação' && r.score != null), level = updates.find((r) => r.level_after);
      if (target) Object.assign(target, { ...(attendance.length ? { attendance_percent: Math.round(attendance.filter((r) => r.attendance_status === 'Presente').length / attendance.length * 10000) / 100 } : {}), last_assessment_score: assessment?.score ?? null, last_assessment_at: assessment?.event_date ?? null, current_level: level?.level_after || target.current_level, updated_at: row.updated_at });
    }
  }
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.orders = []; this.operation = 'read'; this.columns = '*'; this.take = Infinity; this.offset = 0; this.end = Infinity; this.cardinality = ''; }
    select(columns = '*') { this.columns = columns; return this; }
    eq(key, value) { this.filters.push((r) => String(r[key]) === String(value)); return this; }
    neq(key, value) { this.filters.push((r) => String(r[key]) !== String(value)); return this; }
    is(key, value) { this.filters.push((r) => value === null ? r[key] == null : r[key] === value); return this; }
    in(key, values) { this.filters.push((r) => values.map(String).includes(String(r[key]))); return this; }
    order(key, options = {}) { this.orders.push([key, options.ascending !== false ? 1 : -1]); return this; }
    limit(value) { this.take = value; return this; }
    range(start, end) { this.offset = start; this.end = end + 1; return this; }
    single() { this.cardinality = 'single'; return this; }
    maybeSingle() { this.cardinality = 'maybe'; return this; }
    insert(payload) { this.operation = 'insert'; this.payload = clone(payload); return this; }
    update(payload) { this.operation = 'update'; this.payload = clone(payload); return this; }
    upsert(payload) { this.operation = 'upsert'; this.payload = clone(payload); return this; }
    delete() { this.operation = 'delete'; return this; }
    then(resolve, reject) { return Promise.resolve().then(() => this.run()).then(resolve, reject); }
    run() {
      if (fixture.errors[this.table]) return { data: null, error: fixture.errors[this.table] };
      if (!fixture.db[this.table]) return { data: null, error: error('relation does not exist', '42P01') };
      const matched = fixture.db[this.table].filter((r) => this.filters.every((fn) => fn(r)));
      let rows = matched;
      if (this.operation !== 'read') {
        if (fixture.writeErrors[this.table]) return { data: null, error: fixture.writeErrors[this.table] };
        const payloads = Array.isArray(this.payload) ? this.payload : [this.payload];
        if (this.operation === 'insert' || this.operation === 'upsert') {
          for (const p of payloads) {
            if (this.operation === 'insert' && fixture.db[this.table].some((r) => p.id && r.id === p.id || this.table === 'contact_record_categories' && r.contact_id === p.contact_id && r.category_id === p.category_id || this.table === 'german_course_enrollments' && r.candidate_id === p.candidate_id && r.class_id === p.class_id || this.table === 'talent_opportunity_matches' && r.talent_id === p.talent_id && r.opening_id === p.opening_id)) return { data: null, error: error('Duplicate record', '23505') };
          }
        }
        if (this.table === 'german_course_updates') {
          const next = { ...(matched[0] || {}), ...this.payload };
          if (next.kind === 'Presença' && !next.attendance_status || next.kind !== 'Presença' && next.attendance_status != null) return { data: null, error: error('Presença incompatível com tipo') };
        }
        if (this.table === 'talent_opportunity_matches' && this.operation === 'insert') {
          const opening = fixture.db.employer_openings.find((r) => r.id === this.payload.opening_id);
          if (!opening || !fixture.db.employers.some((r) => String(r.id) === String(opening.employer_id))) return { data: null, error: error('Invalid employer', '23503') };
          this.payload.employer_id = opening.employer_id;
        }
        const timestamp = new Date(Date.parse(stamp) + (++fixture.version * 1000)).toISOString();
        if (this.operation === 'delete') fixture.db[this.table] = fixture.db[this.table].filter((r) => !matched.includes(r));
        else if (this.operation === 'update') matched.forEach((r) => { Object.assign(r, this.payload, { updated_at: timestamp }); trigger(this.table, r); });
        else {
          rows = payloads.map((p) => {
            const existing = this.operation === 'upsert' ? fixture.db[this.table].find((r) => r.id && r.id === p.id) : null;
            const row = existing || { id: p.id || id(3000 + fixture.version), created_at: timestamp };
            Object.assign(row, p, { updated_at: timestamp });
            if (!existing) fixture.db[this.table].push(row);
            trigger(this.table, row); return row;
          });
        }
        fixture.writes.push({ table: this.table, operation: this.operation, payload: clone(this.payload ?? {}), count: rows.length });
      } else {
        fixture.reads.push({ table: this.table, offset: this.offset, columns: this.columns });
        rows = [...rows].sort((x, y) => { for (const [key, direction] of this.orders) { const n = String(x[key] ?? '').localeCompare(String(y[key] ?? ''), 'pt-BR', { numeric: true }); if (n) return direction * n; } return 0; });
        rows = rows.slice(this.offset, Math.min(this.end, this.offset + fixture.pageCap, this.offset + this.take));
      }
      rows = rows.map((r) => this.columns === '*' ? clone(r) : Object.fromEntries(this.columns.split(',').map((key) => [key, clone(r[key] ?? null)])));
      if (this.cardinality && rows.length > 1 || this.cardinality === 'single' && !rows.length) return { data: null, error: error('Zero or multiple rows', 'PGRST116') };
      return { data: this.cardinality ? rows[0] || null : rows, error: null };
    }
  }
  function createClient() {
    return {
      from: (table) => new Query(table),
      auth: {
        getSession: async () => ({ data: { session: fixture.signedIn ? { user: { id: id(1), email: 'demo@example.invalid', user_metadata: { username: 'demo' } } } : null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({ error: null })
      },
      channel: () => { const c = { on() { return c; }, subscribe() { return c; } }; return c; }, removeChannel() {}
    };
  }
  w.T4Fixture = { fixture, seed, id, createClient, reset() { Object.assign(fixture, { db: seed(), writes: [], reads: [], errors: {}, writeErrors: {}, version: 0, signedIn: true, pageCap: 500 }); } };
  w.supabase = { createClient };
})();
