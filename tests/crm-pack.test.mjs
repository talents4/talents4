import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHarness, plain } from './harness.mjs';

test('personal fields sit together and document selectors use the production enum',async()=>{
  const h=makeHarness();for(const r of h.fixture.db.candidatos)Object.assign(r,{estado_civil:null,tem_filhos:null,quantidade_filhos:null});await h.load('talents');
  await h.action('edit-talent','DEMO-T1');
  const fields=h.fields();
  assert.ok(fields.includes('estado_civil'));assert.ok(h.modal.options.body.indexOf('name="estado_civil"')<h.modal.options.body.indexOf('name="profissao_principal"'));
  assert.ok(fields.includes('tem_filhos'));assert.ok(h.modal.options.body.indexOf('name="quantidade_filhos"')<h.modal.options.body.indexOf('name="profissao_principal"'));
  const before=JSON.stringify(h.fixture.db.candidatos[0]);
  assert.match(h.modal.options.body,/<select[^>]*name="passaporte_status"/);
  assert.match(h.modal.options.body,/value="Aprovado"/);
  assert.equal((await h.submit({passaporte_status:'Aprovado',tem_filhos:'true',quantidade_filhos:2})).error,'');
  assert.equal(h.fixture.db.candidatos[0].quantidade_filhos,2);
  assert.equal(h.fixture.db.candidatos[0].tem_filhos,true);
  assert.equal(h.fixture.db.candidatos[0].diploma_status,JSON.parse(before).diploma_status);
  await h.action('edit-talent','DEMO-T1');
  const writes=h.fixture.writes.length;
  assert.match((await h.submit({tem_filhos:'false'})).error,/contradição/);
  assert.equal(h.fixture.writes.length,writes);
});

test('new selection omits manual scores and preserves stored scores when edited',async()=>{
  const h=await makeHarness().load('talents');
  await h.action('selection-for-talent','DEMO-T1');
  assert.doesNotMatch(h.modal.options.body,/Avaliação humana|name="(?:overall|professional|language|mobility|document)_score"/);
  const row=h.fixture.db.talent_opportunity_matches[0];row.overall_score=77;
  await h.action('edit-selection',`talent_opportunity_matches:${row.id}`);
  assert.equal((await h.submit({next_action:'Confirmar agenda fictícia'})).error,'');
  assert.equal(row.overall_score,77);
});

test('hired selection starts one follow-up with twelve-month support without rewriting the talent',async()=>{
  const h=makeHarness();h.fixture.db.candidate_post_hire_followups=[];
  const selection=h.fixture.db.talent_opportunity_matches[0];selection.stage='Contratado';
  await h.load('talents');const before=JSON.stringify(h.fixture.db.candidatos);h.app.route('post-hire');
  await h.action('new-post-hire',`talent_opportunity_matches:${selection.id}`);
  assert.equal((await h.submit({support_started_at:'2026-09-01',stage:'Acompanhamento de 12 meses'})).error,'');
  const saved=h.fixture.db.candidate_post_hire_followups[0];
  assert.equal(saved.talent_id,selection.talent_id);assert.equal(saved.selection_id,selection.id);
  assert.equal(saved.support_end_date,'2027-09-01');
  assert.equal(JSON.stringify(h.fixture.db.candidatos),before);
  assert.match(h.html(),/Acompanhamento de 12 meses/);
});

test('viewer creates and updates own task while ownership, sharing and other writes stay protected',async()=>{
  const h=await makeHarness({role:'viewer'}).load('organization');
  await h.action('new-task');
  assert.equal((await h.submit({title:'Minha tarefa fictícia',due_date:'2026-09-10'})).error,'');
  const task=h.fixture.db.operational_tasks.at(-1);
  assert.equal(task.owner_user_key,'demo');assert.equal(task.team_scope,'personal');assert.equal(task.employer_id,null);
  await h.action('edit-task',task.id);
  assert.equal((await h.submit({title:'Minha tarefa revisada'})).error,'');
  assert.equal(task.owner_user_key,'demo');
  assert.equal(h.fixture.writes.filter(w=>w.table==='operational_task_responsibles').length,0);
  await assert.rejects(h.D.update(h.D.TABLES.tasks,task.id,{owner_user_key:'other'}),/responsáveis/);
  await assert.rejects(h.D.update(h.D.TABLES.candidates,'DEMO-T1',{nome_completo:'Bloqueado'}),/leitura/);
});

test('CV links reject scripts and active stages preserve selection and post-hire context',()=>{
  const h=makeHarness();
  assert.doesNotMatch(h.R.cvLink({cv_drive_web_link:'javascript:alert(1)'}),/<a/);
  assert.match(h.R.cvLink({cv_drive_web_link:'https://example.invalid/cv.pdf'}),/noopener/);
  const row={id:'T',status_pipeline:'Contratado'};
  const stages=plain(h.M.talentStages({selections:{rows:[{talent_id:'T',stage:'Contratado',status:'Ativo'}]},postHires:[{talent_id:'T',stage:'Visto e autorização',status:'Ativo'}]},row));
  assert.deepEqual(stages.map(x=>x.source),['Perfil','Seleção','Pós-contratação']);
  assert.equal(row.status_pipeline,'Contratado');
});

test('employer PDF blocks unrevised text, translates locally and prints only after review',async()=>{
  const h=await makeHarness().load('talents');
  const before=JSON.stringify(h.fixture.db.candidatos);
  await h.action('pdf','DEMO-T1');
  assert.equal(h.modal.querySelector('[data-pdf-export]').disabled,true);
  const checks=h.modal.querySelectorAll('[data-pdf-check]');
  const selected=checks.filter(x=>x.checked).map(x=>x.dataset.pdfCheck);
  const edits=selected.filter(key=>h.modal.controls.some(n=>n.dataset.pdfGerman===key));
  assert.ok(edits.length>0);
  let calls=0;
  h.window.Translator={availability:async()=> 'available',create:async()=>({translate:async()=>{calls++;return 'Geprüfter deutscher Beispieltext';},destroy(){}})};
  await h.modal.querySelector('[data-pdf-translate]').emit('click');
  assert.equal(calls,edits.length);
  assert.equal(h.modal.querySelector('[data-pdf-export]').disabled,true);
  for(const key of edits){const checkbox=h.modal.querySelector(`[data-pdf-reviewed="${key}"]`);checkbox.checked=true;await h.modal.emit('change',{target:checkbox});}
  assert.equal(h.modal.querySelector('[data-pdf-export]').disabled,false);
  await h.modal.querySelector('[data-pdf-export]').emit('click');assert.equal(h.printed,1);
  const field=h.modal.querySelector(`[data-pdf-german="${edits[0]}"]`);field.value='Geänderter Text';await h.modal.emit('input',{target:field});
  assert.equal(h.modal.querySelector('[data-pdf-export]').disabled,true);
  assert.equal(JSON.stringify(h.fixture.db.candidatos),before);assert.equal(h.network.length,0);
});
