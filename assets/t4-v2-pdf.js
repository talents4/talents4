/* Dossiê: tradução local, revisão explícita e impressão sem alterar o cadastro. */
(function () {
  'use strict';
  const U = window.T4V2, W = window.T4Work, M = window.T4Models;
  const e = U.esc, a = U.attr;
  const DEFINITIONS = [
    ['nome_completo','Nome completo','Identificação','both','Vollständiger Name'],
    ['profissao_principal','Profissão','Perfil profissional','both','Beruf'],
    ['area_profissional','Área','Perfil profissional','both','Fachbereich'],
    ['cidade_atual','Cidade atual','Identificação','both','Aktueller Wohnort'],
    ['perfil_profissional_para_apresentacao','Apresentação profissional','Perfil profissional','both','Berufliches Profil'],
    ['resumo_profissional','Resumo profissional','Perfil profissional','both','Berufliche Zusammenfassung'],
    ['resumo_rh_curto','Resumo executivo de RH','Contexto interno','ceo','Zusammenfassung der Personalabteilung'],
    ['curso_de_graduacao','Formação','Perfil profissional','both','Ausbildung und Studium'],
    ['universidade','Instituição de formação','Perfil profissional','both','Bildungseinrichtung'],
    ['posgraduacao','Pós-graduação','Perfil profissional','both','Weiterführende Qualifikationen'],
    ['experiencia_profissional_tempo','Tempo de experiência','Perfil profissional','both','Dauer der Berufserfahrung'],
    ['relato_sobre_a_experiencia_profissional','Experiência profissional','Perfil profissional','both','Berufserfahrung'],
    ['nivel_alemao','Alemão informado no perfil','Idiomas e disponibilidade','both','Deutschkenntnisse'],
    ['_course','Acompanhamento de alemão','Idiomas e disponibilidade','both','Deutschunterricht'],
    ['lingua_estrangeira','Outros idiomas','Idiomas e disponibilidade','both','Weitere Sprachkenntnisse'],
    ['disponibilidade_mudanca','Disponibilidade de mudança','Idiomas e disponibilidade','both','Umzugsbereitschaft'],
    ['documentacao_completa','Situação geral da documentação','Idiomas e disponibilidade','both','Stand der Unterlagen'],
    ['status_pipeline','Etapa de acompanhamento','Contexto interno','ceo','Bearbeitungsstand'],
    ['responsavel_interno','Responsável interno','Contexto interno','ceo','Zuständige Person'],
    ['prioridade_comercial','Prioridade interna','Contexto interno','ceo','Interne Priorität'],
    ['_selections','Seleções e próximos passos','Contexto interno','ceo','Auswahlverfahren und nächste Schritte'],
    ['observacoes_internas','Observações internas','Contexto interno','ceo','Interne Anmerkungen'],
    ['pendencia_documental_critica','Pendências documentais','Contexto interno','ceo','Ausstehende Unterlagen'],
    ['email','E-mail pessoal','Dados pessoais opcionais','none','E-Mail-Adresse'],
    ['telefone','Telefone pessoal','Dados pessoais opcionais','none','Telefonnummer'],
    ['cpf','CPF','Dados pessoais opcionais','none','Brasilianische Steuernummer (CPF)'],
    ['numero_do_passaporte','Número do passaporte','Dados pessoais opcionais','none','Reisepassnummer'],
    ['passaporte_numero','Passaporte (registro estruturado)','Dados pessoais opcionais','none','Reisepassnummer (Register)'],
    ['idade','Idade','Dados pessoais opcionais','none','Alter']
  ];
  const GROUPS = {'Identificação':'Persönliche Angaben','Perfil profissional':'Berufliches Profil','Idiomas e disponibilidade':'Sprachkenntnisse und Verfügbarkeit','Contexto interno':'Interner Kontext','Dados pessoais opcionais':'Weitere persönliche Angaben'};
  const IDENTIFIERS = new Set(['nome_completo','cidade_atual','universidade','email','telefone','cpf','numero_do_passaporte','passaporte_numero','idade','responsavel_interno']);
  const FIXED = Object.freeze({'sim':'Ja','nao':'Nein','true':'Ja','false':'Nein','completa':'Vollständig','completo':'Vollständig','incompleta':'Unvollständig','incompleto':'Unvollständig','pendente':'Ausstehend','nao informado':'Nicht angegeben','pre-a1':'Vor A1'});
  function germanValue(key, value) {
    if (!M.present(value)) return null;
    if (IDENTIFIERS.has(key) || typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
    if (key === 'nivel_alemao' && /^(A[12]|B[12]|C[12])$/i.test(String(value).trim())) return String(value).toUpperCase();
    return FIXED[M.norm(value)] ?? null;
  }
  function profile(row, state) {
    const course = (state.enrollments || []).filter(r=>M.same(r.candidate_id,row.id) && ['Matriculado','Ativo','Pausado'].includes(r.status));
    const matches = (state.selections?.rows || []).filter(r=>M.same(r.talent_id,row.id));
    return {...row,
      _course:course.map(r=>`${W.find(state.classes,r.class_id)?.name || 'Curso'} · Nível ${r.current_level || 'não avaliado'} · Meta ${r.target_level || 'não definida'}`).join('\n'),
      _selections:matches.map(r=>`${W.find(state.employers,r.employer_id)?.nome || 'Empregador'} · ${r.stage}${r.next_action ? ` · ${r.next_action}` : ''}`).join('\n')};
  }
  async function createTranslator(sourceLanguage, progress) {
    if (!window.Translator?.create || !window.Translator?.availability) throw new Error('A tradução local não está disponível neste navegador. Abra o CRM no Chrome atualizado em um computador ou preencha a tradução alemã nos campos de revisão.');
    const options = {sourceLanguage,targetLanguage:'de'};
    if (await window.Translator.availability(options) === 'unavailable') throw new Error('Este navegador não oferece a tradução local do idioma escolhido para alemão. Preencha a tradução nos campos de revisão.');
    return window.Translator.create({...options,monitor(m){m.addEventListener('downloadprogress',ev=>progress?.(`Baixando idioma: ${Math.round(ev.loaded*100)}%`));}});
  }
  function open(row, state) {
    const values = profile(row,state), translations = new Map(), reviewed = new Set();
    DEFINITIONS.forEach(([key])=>{const value=germanValue(key,values[key]);if(value !== null){translations.set(key,value);reviewed.add(key);}});
    const selected = new Set(DEFINITIONS.filter(([key,,,preset])=>preset==='both' && M.present(values[key])).map(([key])=>key));
    let employer = true, translating = false;
    const modal = U.openModal({title:'Preparar dossiê em PDF',subtitle:'Dossiê do empregador em alemão. Revise os textos antes de imprimir.',wide:true,
      body:`<div class="t4-pdf-toolbar"><label>Destinatário<select data-pdf-preset><option value="employer">Empregador · alemão</option><option value="ceo">CEO / uso interno</option></select></label><span data-pdf-count></span><button type="button" class="t4-btn sm" data-pdf-none>Desmarcar tudo</button></div>
      <div class="t4-pdf-translation" data-pdf-translation><label>Idioma original predominante<select data-pdf-source><option value="pt">Português</option><option value="en">Inglês</option><option value="es">Espanhol</option><option value="fr">Francês</option><option value="de">Alemão</option></select></label><button type="button" class="t4-btn sm" data-pdf-translate>Traduzir textos para alemão</button><p data-pdf-status role="status">A tradução usa o modelo local do navegador. Revise cargos, qualificações, datas e números.</p></div>
      ${W.note('Dados pessoais identificadores vêm desmarcados. A tradução e a seleção não alteram a ficha do candidato.')}
      <div class="t4-pdf-print-block">Dieses Bewerberprofil ist noch nicht zur Ausgabe freigegeben. Bitte prüfen Sie die deutschen Texte.</div>
      <div class="t4-print-sheet" data-pdf-sheet lang="de"><header class="t4-print-header"><div><strong>Talents 4<span>.</span></strong><small data-pdf-brand>INTERNATIONALE PERSONALVERMITTLUNG</small></div><div><span data-pdf-heading>BEWERBERPROFIL</span><small data-pdf-date>${e(new Date(`${M.today()}T12:00:00`).toLocaleDateString('de-DE'))}</small></div></header>
      <div class="t4-print-intro"><span class="t4-overline" data-pdf-overline>BERUFLICHES PROFIL</span><h1 data-pdf-title>${e(values.nome_completo || 'Berufliche Vorstellung')}</h1><p data-pdf-audience>Unterlagen zur Vorstellung beim Arbeitgeber</p></div>
      ${Object.keys(GROUPS).map(group=>`<section class="t4-print-section" data-pdf-section><h2 data-pdf-group="${a(group)}">${e(GROUPS[group])}</h2>${DEFINITIONS.filter(d=>d[2]===group).map(([key,label,,,de])=>`<div class="t4-print-field ${String(values[key] || '').length>1000 ? 'is-long' : ''}" data-pdf-field="${a(key)}" data-selected="${selected.has(key)}"><label><input type="checkbox" data-pdf-check="${a(key)}" ${selected.has(key)?'checked':''} ${!M.present(values[key])?'disabled':''}><span data-pdf-label="${a(key)}">${e(de)}</span></label><div data-pdf-value="${a(key)}">${e(translations.get(key) || (M.present(values[key])?'Deutsche Übersetzung noch nicht geprüft.':'Nicht angegeben'))}</div>${M.present(values[key]) && !reviewed.has(key) ? `<details class="t4-pdf-editor" data-pdf-edit><summary>Traduzir / revisar este campo</summary><p><strong>Original:</strong> ${e(String(values[key]))}</p><label>Texto em alemão<textarea rows="4" data-pdf-german="${a(key)}"></textarea></label><label><input type="checkbox" data-pdf-reviewed="${a(key)}">Revisei este texto em alemão e confirmei os dados.</label></details>`:''}</div>`).join('')}</section>`).join('')}
      <footer class="t4-print-footer"><span data-pdf-footer-brand>Talents 4 · Internationale Personalvermittlung</span><span data-pdf-footer-note>Vertraulich · Angaben aus dem Bewerberprofil</span></footer></div>`,
      footer:'<span class="t4-save-hint">Escolha “Salvar como PDF” na impressão. O dossiê do empregador exige revisão de todos os textos selecionados.</span><button type="button" class="t4-btn" data-pdf-close>Voltar</button><button type="button" class="t4-btn primary" data-pdf-export>Imprimir / salvar PDF</button>'});
    modal.classList.add('t4-pdf-modal'); const backdrop=modal.parentElement; backdrop.classList.add('t4-print-root');
    const sync = ()=>{
      let pending=0;
      modal.querySelectorAll('[data-pdf-check]').forEach(input=>{input.checked=selected.has(input.dataset.pdfCheck);input.closest('[data-pdf-field]').dataset.selected=String(input.checked);});
      DEFINITIONS.forEach(([key,label,, ,de])=>{
        const node=modal.querySelector(`[data-pdf-value="${key}"]`), title=modal.querySelector(`[data-pdf-label="${key}"]`);
        if(node) node.textContent=employer ? translations.get(key) || (M.present(values[key])?'Deutsche Übersetzung noch nicht geprüft.':'Nicht angegeben') : M.present(values[key])?String(values[key]):'Não informado';
        if(title) title.textContent=employer?de:label;
        if(employer && selected.has(key) && !reviewed.has(key)) pending++;
      });
      modal.querySelectorAll('[data-pdf-section]').forEach(section=>{section.dataset.printEmpty=String(!section.querySelector('[data-selected="true"]'));});
      modal.querySelectorAll('[data-pdf-group]').forEach(node=>{node.textContent=employer?GROUPS[node.dataset.pdfGroup]:node.dataset.pdfGroup;});
      modal.querySelector('[data-pdf-count]').textContent=`${selected.size} campos selecionados${pending?` · ${pending} aguardando revisão`:''}`;
      modal.querySelector('[data-pdf-export]').disabled=!selected.size || !!pending || translating;
      backdrop.dataset.pdfBlocked=String(!selected.size || !!pending || translating); modal.querySelector('[data-pdf-sheet]').lang=employer?'de':'pt-BR';
      modal.querySelector('[data-pdf-translation]').hidden=!employer;
      const copy={brand:employer?'INTERNATIONALE PERSONALVERMITTLUNG':'RECRUTAMENTO INTERNACIONAL',heading:employer?'BEWERBERPROFIL':'DOSSIÊ PROFISSIONAL',overline:employer?'BERUFLICHES PROFIL':'PERFIL DO TALENTO',audience:employer?'Unterlagen zur Vorstellung beim Arbeitgeber':'Uso interno · apoio à decisão','footer-brand':employer?'Talents 4 · Internationale Personalvermittlung':'Talents 4 · Recrutamento internacional','footer-note':employer?'Vertraulich · Angaben aus dem Bewerberprofil':'Uso interno · informações fornecidas no cadastro'};
      for(const [key,value] of Object.entries(copy)) modal.querySelector(`[data-pdf-${key}]`).textContent=value;
      modal.querySelector('[data-pdf-date]').textContent=new Date(`${M.today()}T12:00:00`).toLocaleDateString(employer?'de-DE':'pt-BR');
    };
    modal.querySelector('[data-pdf-preset]').addEventListener('change',event=>{
      employer=event.target.value!=='ceo'; selected.clear();
      DEFINITIONS.forEach(([key,,,preset])=>{if(M.present(values[key]) && (preset==='both' || preset==='ceo' && !employer))selected.add(key);});sync();
    });
    modal.addEventListener('input',event=>{const key=event.target.dataset.pdfGerman;if(key){translations.set(key,event.target.value.trim());reviewed.delete(key);modal.querySelector(`[data-pdf-reviewed="${key}"]`).checked=false;sync();}});
    modal.addEventListener('change',event=>{
      const key=event.target.dataset.pdfCheck, reviewKey=event.target.dataset.pdfReviewed;
      if(key && M.present(values[key])){event.target.checked?selected.add(key):selected.delete(key);sync();}
      if(reviewKey){if(event.target.checked && translations.get(reviewKey)?.trim()) reviewed.add(reviewKey);else {reviewed.delete(reviewKey);event.target.checked=false;}sync();}
    });
    modal.querySelector('[data-pdf-translate]').addEventListener('click',async()=>{
      if(translating)return;translating=true;sync();const button=modal.querySelector('[data-pdf-translate]'),status=modal.querySelector('[data-pdf-status]');button.disabled=true;let translator;
      try{
        const source=modal.querySelector('[data-pdf-source]').value || 'pt';
        if(source!=='de')translator=await createTranslator(source,text=>{status.textContent=text;});
        for(const key of selected){if(reviewed.has(key))continue;const text=source==='de'?String(values[key]):await translator.translate(String(values[key]));if(!text?.trim())throw new Error('A tradução retornou um texto vazio. Revise este campo manualmente.');translations.set(key,text.trim());const field=modal.querySelector(`[data-pdf-german="${key}"]`);if(field)field.value=text.trim();}
        status.textContent='Tradução preparada. Abra os campos de revisão e confirme cada texto em alemão antes de imprimir.';
      }catch(error){status.textContent=error.message || 'Não foi possível traduzir. Preencha a tradução alemã nos campos de revisão.';}
      finally{translator?.destroy?.();translating=false;button.disabled=false;sync();}
    });
    modal.querySelector('[data-pdf-none]').addEventListener('click',()=>{selected.clear();sync();});
    modal.querySelector('[data-pdf-close]').addEventListener('click',U.closeModal);
    modal.querySelector('[data-pdf-export]').addEventListener('click',()=>{
      sync();if(modal.querySelector('[data-pdf-export]').disabled)return;
      const previous=document.title, identity=selected.has('nome_completo')?row.nome_completo:'Profil';
      document.title=`Talents4_${String(identity || 'Profil').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w]+/g,'_')}_dossie`;
      window.addEventListener('afterprint',()=>{document.title=previous;},{once:true});window.print();
    });
    sync(); return modal;
  }
  window.T4PDF=Object.freeze({open,profile,DEFINITIONS,germanValue,createTranslator});
})();
