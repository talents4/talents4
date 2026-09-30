-- Production: xcxqtjzlqmncwnhbolnl. Additive CRM update; no record backfill.
-- Requires the existing collaboration/visibility helpers from migrations 50/52.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create extension if not exists pg_cron with schema pg_catalog;

alter table public.candidatos add column if not exists estado_civil text;
alter table public.candidatos add column if not exists tem_filhos boolean;
alter table public.candidatos add column if not exists quantidade_filhos smallint;
do $check$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.candidatos'::regclass and conname='t4_children_quantity_check') then
    alter table public.candidatos add constraint t4_children_quantity_check
      check (quantidade_filhos is null or (quantidade_filhos between 0 and 50 and (tem_filhos is distinct from false or quantidade_filhos=0))) not valid;
  end if;
end;
$check$;

create table if not exists public.candidate_post_hire_followups (
  id text primary key default gen_random_uuid()::text,
  talent_id text not null references public.candidatos(id),
  employer_id uuid references public.employers(id),
  selection_source text not null check (selection_source in ('talent_opportunity_matches','candidate_employer_matches','candidate_employer_links')),
  selection_id text not null,
  stage text not null default 'Contrato e admissão' check (stage in ('Contrato e admissão','Documentação','Reconhecimento profissional','Visto e autorização','Preparação da mudança','Chegada e integração','Início no empregador','Processo finalizado','Acompanhamento de 12 meses')),
  status text not null default 'Ativo' check (status in ('Ativo','Concluído','Cancelado')),
  owner_username text,
  next_action text,
  next_action_at timestamptz,
  process_completed_at date,
  support_started_at date,
  support_end_date date,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(selection_source,selection_id),
  check (support_end_date is null or support_started_at is null or support_end_date >= support_started_at)
);
create index if not exists t4_post_hire_talent_idx on public.candidate_post_hire_followups(talent_id);
alter table public.candidate_post_hire_followups enable row level security;
revoke all on public.candidate_post_hire_followups from public,anon;
grant select,insert,update on public.candidate_post_hire_followups to authenticated;
grant all on public.candidate_post_hire_followups to service_role;
drop policy if exists t4_post_hire_access on public.candidate_post_hire_followups;
create policy t4_post_hire_access on public.candidate_post_hire_followups for all to authenticated
  using (public.t4_talents_v22_access(false)) with check (public.t4_talents_v22_access(true));

create or replace function public.t4_post_hire_validate()
returns trigger language plpgsql set search_path=pg_catalog,public
as $fn$
declare source_row jsonb; source_talent text; source_employer text;
begin
  if new.selection_source not in ('talent_opportunity_matches','candidate_employer_matches','candidate_employer_links') then
    raise exception 'Origem da contratação inválida.' using errcode='23514';
  end if;
  execute format('select to_jsonb(r) from public.%I r where id::text=$1',new.selection_source) into source_row using new.selection_id;
  source_talent = coalesce(source_row->>'talent_id',source_row->>'candidato_id',source_row->>'candidate_id');
  source_employer = coalesce(source_row->>'employer_id',source_row->>'empregador_id');
  if source_row is null or source_talent is distinct from new.talent_id or source_employer is distinct from new.employer_id::text then
    raise exception 'A contratação não corresponde ao talento e empregador informados.' using errcode='23514';
  end if;
  if tg_op='UPDATE' and (new.talent_id,new.employer_id,new.selection_source,new.selection_id) is distinct from (old.talent_id,old.employer_id,old.selection_source,old.selection_id) then
    raise exception 'A origem do acompanhamento deve ser preservada.' using errcode='23514';
  end if;
  new.updated_at=now();
  return new;
end;
$fn$;
revoke all on function public.t4_post_hire_validate() from public,anon,authenticated;
drop trigger if exists t4_post_hire_validate on public.candidate_post_hire_followups;
create trigger t4_post_hire_validate before insert or update on public.candidate_post_hire_followups
  for each row execute function public.t4_post_hire_validate();

-- Keep the current read scope: only principal/additional responsible users.
-- Viewers may create private tasks and edit operational fields on visible tasks.
drop policy if exists t4_collab_tasks_access on public.operational_tasks;
drop policy if exists t4_collab_tasks_read on public.operational_tasks;
drop policy if exists t4_collab_tasks_insert on public.operational_tasks;
drop policy if exists t4_collab_tasks_update on public.operational_tasks;
create policy t4_collab_tasks_access on public.operational_tasks as permissive for all to authenticated
  using (public.t4_talents_v22_access(false)) with check (public.t4_talents_v22_access(false));
-- Evaluate principal ownership on the row itself. A helper that SELECTs the
-- task cannot see a just-inserted row during INSERT ... RETURNING checks.
create policy t4_collab_tasks_read on public.operational_tasks as restrictive for select to authenticated
  using (public.t4_talents_v22_access(false) and (
    exists (select 1 from public.usuarios u where lower(u.username)=lower(public.current_username_from_auth())
      and (lower(owner_user_key) in (lower(u.username),lower(u.nome)) or lower(assigned_user_key) in (lower(u.username),lower(u.nome))))
    or public.t4_collab_task_visible(id::text)
  ));
create policy t4_collab_tasks_insert on public.operational_tasks as restrictive for insert to authenticated
  with check (
    public.t4_talents_v22_access(false)
    and exists (select 1 from public.usuarios u where lower(u.username)=lower(public.current_username_from_auth())
      and lower(coalesce(nullif(btrim(owner_user_key),''),nullif(btrim(assigned_user_key),''))) in (lower(u.username),lower(u.nome)))
    and (public.t4_talents_v22_access(true) or (
      lower(owner_user_key)=lower(public.current_username_from_auth())
      and lower(assigned_user_key)=lower(public.current_username_from_auth())
      and team_scope in ('private','personal')
      and employer_id is null and meeting_id is null
    ))
  );
create policy t4_collab_tasks_update on public.operational_tasks as restrictive for update to authenticated
  using (public.t4_talents_v22_access(false) and public.t4_collab_task_editable(id::text))
  with check (public.t4_talents_v22_access(false));
revoke all on public.operational_tasks from public,anon;
revoke truncate,trigger,references on public.operational_tasks from authenticated;
grant select,insert,update on public.operational_tasks to authenticated;

create or replace function public.t4_task_viewer_guard()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $fn$
declare me text=public.current_username_from_auth();
begin
  if auth.uid() is null then return new; end if;
  if public.t4_talents_v22_access(true) then return new; end if;
  if not public.t4_talents_v22_access(false) then raise exception 'Perfil não autorizado.' using errcode='42501'; end if;
  if tg_op='INSERT' then
    if lower(new.owner_user_key) is distinct from lower(me) or lower(new.assigned_user_key) is distinct from lower(me)
      or coalesce(new.team_scope,'') not in ('private','personal') or new.employer_id is not null or new.meeting_id is not null
      or to_jsonb(new)->>'plan_id' is not null or new.deleted_at is not null
      or (new.created_by is not null and lower(new.created_by)<>lower(me)) then
      raise exception 'Crie uma tarefa privada sob sua própria responsabilidade.' using errcode='42501';
    end if;
  elsif (to_jsonb(new)-array['title','description','notes','month_ref','start_date','due_date','priority','status','completed_at','updated_at'])
    is distinct from (to_jsonb(old)-array['title','description','notes','month_ref','start_date','due_date','priority','status','completed_at','updated_at']) then
    raise exception 'Seu perfil não pode alterar responsáveis, vínculos ou escopo da tarefa.' using errcode='42501';
  end if;
  return new;
end;
$fn$;
revoke all on function public.t4_task_viewer_guard() from public,anon,authenticated;
drop trigger if exists t4_task_viewer_guard on public.operational_tasks;
create trigger t4_task_viewer_guard before insert or update on public.operational_tasks
  for each row execute function public.t4_task_viewer_guard();

alter table public.crm_notifications add column if not exists resolved_at timestamptz;
alter table public.crm_notifications add column if not exists deadline_source text;
alter table public.crm_notifications add column if not exists deadline_row_id text;
alter table public.crm_notifications add column if not exists deadline_date date;

create or replace function public.t4_deadline_open(value text)
returns boolean language sql immutable set search_path=pg_catalog
as $fn$
  select coalesce(translate(lower(value),'áàâãéêíóôõúç','aaaaeeiooouc'),'') !~ '(concluid|complet|cancelad|encerrad|resolvid|realizad|inativ|arquivad|rejeitad|descartad|nao aprovado|^pronto$|^feito$|^done$|^closed$|^cancelled$)';
$fn$;

-- Only these known deadline fields are scanned. JSON access tolerates legacy
-- schemas; dates are accepted only in ISO form and no free text is rewritten.
create or replace function public.t4_crm_deadlines()
returns table (source_key text,row_key text,entity_type text,entity_id text,deadline_date date,owner_key text,creator_key text,item_title text,private_task boolean)
language plpgsql security definer set search_path=pg_catalog,public
as $fn$
declare spec record; r jsonb; due_text text;
begin
  for spec in select * from (values
    ('operational_tasks','due_date','operational_task','Tarefa operacional',true),
    ('organizational_plan_entries','end_date','organizational_plan','Planejamento mensal',false),
    ('organizational_meetings','scheduled_at','organizational_meeting','Reunião',false),
    ('crm_activities','due_at','crm_activity','Atividade',false),
    ('contact_followups','due_at','contact_followup','Próximo passo do contato',false),
    ('german_course_enrollments','next_action_due','german_enrollment','Próxima ação do curso',false),
    ('german_course_classes','expected_end_date','german_class','Conclusão prevista da turma',false),
    ('talent_opportunity_matches','next_action_at','selection','Próxima ação da seleção',false),
    ('candidate_employer_links','proximo_followup_em','selection','Próximo passo do vínculo',false),
    ('candidate_post_hire_followups','next_action_at','post_hire','Próxima ação pós-contratação',false),
    ('candidate_post_hire_followups','support_end_date','post_hire','Fim do acompanhamento de 12 meses',false),
    ('candidatos','passaporte_validade','talent','Validade do passaporte',false),
    ('candidatos','registro_validade','talent','Validade do registro profissional',false),
    ('candidatos','previsao_termino_alemao','talent','Conclusão prevista do alemão',false),
    ('candidatos','data_prevista_mudanca','talent','Mudança prevista',false)
  ) as s(table_name,date_field,entity,label,is_private)
  loop
    if not exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=spec.table_name and c.column_name=spec.date_field) then continue; end if;
    for r in execute format('select to_jsonb(r) from public.%I r where %I is not null',spec.table_name,spec.date_field)
    loop
      if nullif(r->>'deleted_at','') is not null or nullif(r->>'archived_at','') is not null
        or coalesce(lower(r->>'ativo'),'true') in ('false','0','nao','não','inativo')
        or not public.t4_deadline_open(coalesce(r->>'status',r->>'status_vinculo',r->>'status_pipeline'))
        or (spec.table_name='talent_opportunity_matches' and not public.t4_deadline_open(r->>'stage'))
        or (spec.table_name in ('operational_tasks','crm_activities','contact_followups','german_course_enrollments','candidate_post_hire_followups') and nullif(r->>'completed_at','') is not null)
      then continue; end if;
      due_text=r->>spec.date_field;
      if due_text !~ '^\d{4}-\d{2}-\d{2}([T ][0-9:]|$)' then continue; end if;
      begin
        deadline_date=case when length(due_text)=10 then due_text::date else (due_text::timestamptz at time zone 'America/Sao_Paulo')::date end;
      exception when invalid_datetime_format or datetime_field_overflow then continue;
      end;
      source_key=spec.table_name||'.'||spec.date_field;
      row_key=r->>'id'; entity_type=spec.entity; entity_id=row_key; private_task=spec.is_private;
      owner_key=coalesce(nullif(r->>'owner_user_key',''),nullif(r->>'assigned_user_key',''),nullif(r->>'assigned_username',''),nullif(r->>'owner_username',''),nullif(r->>'owner_name',''),nullif(r->>'responsavel',''),nullif(r->>'responsavel_interno',''));
      creator_key=r->>'created_by';
      item_title=spec.label||' · '||coalesce(nullif(r->>'title',''),nullif(r->>'activity_label',''),nullif(r->>'topic',''),nullif(r->>'next_action',''),nullif(r->>'nome_completo',''),nullif(r->>'name',''),'Pendência do CRM');
      return next;
    end loop;
  end loop;
end;
$fn$;

create or replace function public.t4_deadline_recipients(owner_key text,creator_key text,task_key text default null)
returns table(username text) language sql stable security definer set search_path=pg_catalog,public
as $fn$
  with active_users as (
    select u.username,u.nome,u.auth_uid,u.role from public.usuarios u
    where upper(coalesce(u.ativo,'SIM'))='SIM' and u.role in ('admin','recrutador','viewer')
  ), named as (
    select u.username from active_users u where lower(u.username)=lower(btrim(owner_key))
    union all
    select u.username from active_users u where lower(u.nome)=lower(btrim(owner_key))
      and not exists (select 1 from active_users x where lower(x.username)=lower(btrim(owner_key)))
      and (select count(*) from active_users x where lower(x.nome)=lower(btrim(owner_key)))=1
  ), creators as (
    select u.username from active_users u where (u.auth_uid::text=creator_key or lower(u.username)=lower(creator_key)) and not exists(select 1 from named)
  )
  select distinct recipient.username from (
    select n.username from named n
    union all
    select u.username from public.operational_task_responsibles r join active_users u on lower(u.username)=lower(r.username)
      where task_key is not null and r.task_id=task_key and r.deleted_at is null
    union all
    select c.username from creators c where task_key is null
    union all
    select u.username from active_users u where task_key is null and u.role in ('admin','recrutador')
      and not exists(select 1 from named) and not exists(select 1 from creators)
  ) recipient;
$fn$;

create or replace function public.t4_crm_deadline_sweep(as_of date default (now() at time zone 'America/Sao_Paulo')::date)
returns integer language plpgsql security definer set search_path=pg_catalog,public
as $fn$
declare inserted integer;
begin
  with deadlines as materialized (select d.*,u.username from public.t4_crm_deadlines() d
    cross join lateral public.t4_deadline_recipients(d.owner_key,d.creator_key,case when d.private_task then d.row_key end) u)
  update public.crm_notifications n set resolved_at=now()
  where n.deadline_source is not null and n.resolved_at is null and not exists (
    select 1 from deadlines d where d.source_key=n.deadline_source and d.row_key=n.deadline_row_id
      and d.deadline_date=n.deadline_date and lower(d.username)=lower(n.recipient_username)
  );
  insert into public.crm_notifications as existing (recipient_username,type,title,body,entity_type,entity_id,dedupe_key,deadline_source,deadline_row_id,deadline_date)
  select u.username,'prazo',case when d.deadline_date<as_of then 'Prazo atrasado' when d.deadline_date=as_of then 'Prazo vence hoje' else 'Prazo próximo' end,
    d.item_title||' · Prazo: '||to_char(d.deadline_date,'DD/MM/YYYY')||case when d.deadline_date<as_of then '. Lembrete diário até resolver ou cancelar.' else '.' end,
    d.entity_type,d.entity_id,'deadline:'||d.source_key||':'||d.row_key||':'||d.deadline_date||':'||as_of,
    d.source_key,d.row_key,d.deadline_date
  from public.t4_crm_deadlines() d
  cross join lateral public.t4_deadline_recipients(d.owner_key,d.creator_key,case when d.private_task then d.row_key end) u
  where d.deadline_date<=as_of+2
  on conflict (recipient_username,dedupe_key) do update set resolved_at=null,read_at=null
    where existing.resolved_at is not null;
  get diagnostics inserted=row_count;
  return inserted;
end;
$fn$;
revoke all on function public.t4_crm_deadlines(),public.t4_deadline_recipients(text,text,text),public.t4_crm_deadline_sweep(date) from public,anon,authenticated;
grant execute on function public.t4_crm_deadline_sweep(date) to service_role;

-- Reusing the job name makes subsequent migration runs idempotent.
select cron.schedule('t4-crm-deadlines','*/15 * * * *','select public.t4_crm_deadline_sweep();');
select public.t4_crm_deadline_sweep();
notify pgrst,'reload schema';
commit;
