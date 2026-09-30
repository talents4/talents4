import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// PostgreSQL fixture: types and task policies verified in the production SQL
// editor. All personal information below is artificial. pg_cron itself is
// mocked because it is a Supabase extension, unavailable in embedded Postgres.
const fixture = `
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema cron;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function public.current_username_from_auth() returns text language sql stable as $$select nullif(current_setting('test.username',true),'')$$;
create table usuarios(username text primary key,nome text,role text,ativo text,auth_uid uuid);
insert into usuarios values ('viewer','Viewer fictício','viewer','SIM','00000000-0000-0000-0000-000000000001'),('editor','Editor fictício','recrutador','SIM','00000000-0000-0000-0000-000000000002'),('other','Outro fictício','viewer','SIM','00000000-0000-0000-0000-000000000003');
create function public.t4_talents_v22_access(write boolean default false) returns boolean language sql stable security definer as $$select auth.uid() is not null and exists(select 1 from usuarios u where lower(u.username)=lower(current_username_from_auth()) and (u.auth_uid is null or u.auth_uid=auth.uid()) and u.ativo='SIM' and u.role=any(case when write then array['admin','recrutador'] else array['admin','recrutador','viewer'] end))$$;
create table candidatos(id text primary key,nome_completo text,estado_civil text,filho text,ativo boolean default true,status_pipeline text,passaporte_validade date,registro_validade date,previsao_termino_alemao text,data_prevista_mudanca text,responsavel_interno text);
insert into candidatos(id,nome_completo,estado_civil,filho) values ('T-1','Talento fictício','Casado(a)','Texto histórico preservado'),('T-2','Outro talento fictício',null,null);
create table employers(id uuid primary key);
insert into employers values ('00000000-0000-0000-0000-000000000101');
create table talent_opportunity_matches(id uuid primary key,talent_id text,employer_id uuid,status text,stage text,next_action_at timestamptz,owner_username text,created_by uuid,next_action text);
insert into talent_opportunity_matches(id,talent_id,employer_id,status,stage) values ('00000000-0000-0000-0000-000000000201','T-1','00000000-0000-0000-0000-000000000101','Ativo','Contratado');
create table candidate_employer_matches(id uuid primary key,candidato_id text,empregador_id uuid);
create table candidate_employer_links(id uuid primary key,candidate_id text,employer_id uuid,proximo_followup_em timestamptz,status_vinculo text,ativo boolean,responsavel_interno text);
create table operational_tasks(id uuid primary key default gen_random_uuid(),title text,description text,notes text,month_ref text,start_date date,due_date date,priority text,status text,completed_at timestamptz,deleted_at timestamptz,created_by text,created_at timestamptz default now(),updated_at timestamptz default now(),owner_user_key text,assigned_user_key text,team_scope text default 'personal' check(team_scope in ('personal','team')),employer_id text,meeting_id uuid,plan_id text,context_type text,sort_index int,is_recurring boolean);
create table operational_task_responsibles(task_id text,username text,deleted_at timestamptz);
create function public.t4_collab_task_visible(key text) returns boolean language sql stable security definer as $$select exists(select 1 from operational_tasks t join usuarios u on lower(u.username)=lower(current_username_from_auth()) where t.id::text=key and (lower(coalesce(t.owner_user_key,'')) in (lower(u.username),lower(u.nome)) or lower(coalesce(t.assigned_user_key,'')) in (lower(u.username),lower(u.nome)) or exists(select 1 from operational_task_responsibles r where r.task_id=key and r.deleted_at is null and lower(r.username)=lower(u.username))))$$;
create function public.t4_collab_task_editable(key text) returns boolean language sql stable security definer as $$select t4_collab_task_visible(key)$$;
alter table operational_tasks enable row level security;
create policy t4_collab_tasks_access on operational_tasks as permissive for all to authenticated using(t4_talents_v22_access(false)) with check(t4_talents_v22_access(true));
create policy t4_collab_tasks_read on operational_tasks as restrictive for select to authenticated using(t4_talents_v22_access(false) and t4_collab_task_visible(id::text));
create policy t4_collab_tasks_delete on operational_tasks as restrictive for delete to authenticated using(t4_talents_v22_access(true) and t4_collab_task_editable(id::text));
create table crm_notifications(id text primary key default gen_random_uuid()::text,recipient_username text,type text,title text,body text,entity_type text,entity_id text,dedupe_key text,read_at timestamptz,created_at timestamptz default now(),unique(recipient_username,dedupe_key));
create table organizational_plan_entries(id uuid primary key,end_date date,responsavel text,created_by text,status text,deleted_at timestamptz,activity_label text);
create table organizational_meetings(id uuid primary key,scheduled_at timestamptz,owner_name text,status text,deleted_at timestamptz);
create table crm_activities(id uuid primary key,due_at timestamptz,status text,owner_username text,created_by uuid,completed_at timestamptz);
create table contact_followups(id uuid primary key,due_at timestamptz,status text,assigned_username text,created_by uuid,completed_at timestamptz);
create table german_course_enrollments(id uuid primary key,next_action_due date,status text,owner_name text,created_by uuid,completed_at date);
create table german_course_classes(id uuid primary key,expected_end_date date,status text);
create table cron.job(jobname text primary key,schedule text,command text);
create function cron.schedule(name text,schedule text,command text) returns bigint language plpgsql as $$begin insert into cron.job values(name,schedule,command) on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command;return 1;end$$;
grant usage on schema public,auth to authenticated;
grant select on usuarios,talent_opportunity_matches,candidate_employer_matches,candidate_employer_links,candidatos,employers,operational_task_responsibles to authenticated;
grant select,insert,update,delete,truncate on operational_tasks to authenticated;
`;
const originalMigration=readFileSync(new URL('../supabase/talents-v22/55_crm_updates_pack.sql',import.meta.url),'utf8');
const migration=originalMigration.replace('create extension if not exists pg_cron with schema pg_catalog;','-- Mocked extension activation only; cron.schedule is exercised above.');
const db=new PGlite();
await db.exec(fixture);
await db.exec(migration);
const uid='00000000-0000-0000-0000-000000000001';
const asViewer=async()=>db.exec(`set role authenticated;set "request.jwt.claim.sub"='${uid}';set "test.username"='viewer';`);
const asOwner=async()=>db.exec(`reset role;set "request.jwt.claim.sub"='';set "test.username"='';`);
const count=async(sql)=>Number((await db.query(sql)).rows[0].n);

test('migration is additive, rerunnable and schedules one background job',async()=>{
  const before=(await db.query('select id,nome_completo,estado_civil,filho,ativo from candidatos order by id')).rows;
  await db.exec(migration);
  assert.deepEqual((await db.query('select id,nome_completo,estado_civil,filho,ativo from candidatos order by id')).rows,before);
  assert.equal(await count('select count(*) n from cron.job'),1);
  assert.equal(await count('select count(*) n from candidate_post_hire_followups'),0);
});

test('viewer creates own private task, preserves owners, and cannot access another task',async()=>{
  await asViewer();
  const own=(await db.query("insert into operational_tasks(title,status,owner_user_key,assigned_user_key,team_scope) values ('Tarefa fictícia','A fazer','viewer','viewer','personal') returning id")).rows[0].id;
  await db.query("update operational_tasks set title='Título revisto',status='Pronto',completed_at=now() where id=$1",[own]);
  await assert.rejects(db.query("update operational_tasks set owner_user_key='other' where id=$1",[own]),/responsáveis/);
  await assert.rejects(db.query("update operational_tasks set deleted_at=now() where id=$1",[own]),/responsáveis/);
  await assert.rejects(db.query("insert into operational_tasks(title,owner_user_key,assigned_user_key,team_scope) values ('Negada','other','other','personal')"),/própria responsabilidade/);
  await assert.rejects(db.query("insert into operational_tasks(title,owner_user_key,assigned_user_key,team_scope,employer_id) values ('Negada','viewer','viewer','personal','00000000-0000-0000-0000-000000000101')"),/própria responsabilidade/);
  await assert.rejects(db.exec('truncate operational_tasks'),/permission denied/);
  await asOwner();
  const other=(await db.query("insert into operational_tasks(title,status,owner_user_key,assigned_user_key,team_scope) values ('Tarefa de outro','A fazer','other','other','personal') returning id")).rows[0].id;
  await asViewer();
  assert.equal((await db.query('select id from operational_tasks where id=$1',[other])).rows.length,0);
  assert.equal((await db.query("update operational_tasks set title='Não permitido' where id=$1 returning id",[other])).rows.length,0);
  await asOwner();
  await db.query("insert into operational_task_responsibles(task_id,username) values ($1,'viewer')",[other]);
  await asViewer();
  assert.equal((await db.query("update operational_tasks set notes='Resultado fictício' where id=$1 returning id",[other])).rows.length,1);
  await asOwner();
});

test('post-hire links must match their selection and viewers cannot write them',async()=>{
  const sql="insert into candidate_post_hire_followups(talent_id,employer_id,selection_source,selection_id) values ($1,'00000000-0000-0000-0000-000000000101','talent_opportunity_matches','00000000-0000-0000-0000-000000000201')";
  await assert.rejects(db.query(sql,['T-2']),/não corresponde/);
  await asViewer();
  await assert.rejects(db.query(sql,['T-1']),/row-level security/);
  await asOwner();
  await db.query(sql,['T-1']);
  await assert.rejects(db.query(sql,['T-1']),/unique constraint/);
});

test('deadline alerts cover monthly plans, deduplicate, repeat daily and resolve on completion/rescheduling',async()=>{
  await db.exec("insert into organizational_plan_entries values ('00000000-0000-0000-0000-000000000401','2030-09-28','viewer',null,'Em andamento',null,'Plano fictício');");
  assert.equal(await count("select t4_crm_deadline_sweep('2030-09-25') n"),0);
  assert.equal(await count("select t4_crm_deadline_sweep('2030-09-26') n"),1);
  assert.equal(await count("select t4_crm_deadline_sweep('2030-09-26') n"),0);
  assert.equal(await count("select t4_crm_deadline_sweep('2030-09-29') n"),1);
  await db.exec("update crm_notifications set read_at=now();");
  assert.equal(await count("select t4_crm_deadline_sweep('2030-09-30') n"),1);
  await db.exec("update organizational_plan_entries set end_date='2030-10-10';");
  await db.query("select t4_crm_deadline_sweep('2030-09-30')");
  assert.equal(await count('select count(*) n from crm_notifications where resolved_at is null'),0);
  await db.exec("update organizational_plan_entries set status='Concluído';");
  assert.equal(await count("select t4_crm_deadline_sweep('2030-10-11') n"),0);
});

test('private deadlines notify only principal/additional responsible users and routines are not public RPCs',async()=>{
  await db.exec("update operational_tasks set due_date='2030-10-15' where title='Tarefa de outro';");
  await db.query("select t4_crm_deadline_sweep('2030-10-13')");
  assert.deepEqual((await db.query("select recipient_username from crm_notifications where deadline_source='operational_tasks.due_date' order by recipient_username")).rows.map(r=>r.recipient_username),['other','viewer']);
  await asViewer();
  await assert.rejects(db.query('select * from t4_crm_deadlines()'),/permission denied/);
  await assert.rejects(db.query('select t4_crm_deadline_sweep()'),/permission denied/);
  await asOwner();
});

test('children constraints reject contradictions and do not rewrite legacy text',async()=>{
  await assert.rejects(db.exec("update candidatos set tem_filhos=false,quantidade_filhos=2 where id='T-1'"),/check constraint/);
  await db.exec("update candidatos set tem_filhos=true,quantidade_filhos=2 where id='T-1'");
  assert.equal((await db.query("select filho from candidatos where id='T-1'")).rows[0].filho,'Texto histórico preservado');
});

test.after(async()=>db.close());
