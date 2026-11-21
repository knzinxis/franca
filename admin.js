const SUPABASE_URL='https://eynwuwakthzpbxxzvifl.supabase.co';
const SUPABASE_KEY='sb_publishable_d8wfzUDD2mBv_obeWJmDnQ_QBWD-FSL';
const GUILD_GROUP_URL='https://chat.whatsapp.com/L2ZZ9HAqWnd2NurHhAuAiX?s=cl&p=i&iam=2';
const SESSION_STORAGE_KEY='franca-admin-session';
const loginBox=document.querySelector('#login-box');
const loginForm=document.querySelector('#login-form');
const loginMessage=document.querySelector('#login-message');
const passwordResetBox=document.querySelector('#password-reset-box');
const passwordResetForm=document.querySelector('#password-reset-form');
const passwordResetMessage=document.querySelector('#password-reset-message');
const panel=document.querySelector('#panel');
const panelMessage=document.querySelector('#panel-message');
const rosterMessage=document.querySelector('#guild-roster-message');
const rosterBody=document.querySelector('#guild-roster-body');
const list=document.querySelector('#candidate-list');
const approvedList=document.querySelector('#approved-list');
const rejectedList=document.querySelector('#rejected-list');
const searchInput=document.querySelector('#candidate-search');
const statusFilter=document.querySelector('#status-filter');
const ageFilter=document.querySelector('#age-filter');
const sortFilter=document.querySelector('#sort-filter');
const noteDrafts=new Map();
let session=loadSession();
let records=[];

function loadSession(){
  const saved=sessionStorage.getItem(SESSION_STORAGE_KEY);
  if(!saved)return null;
  try{
    return JSON.parse(saved);
  }catch(error){
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

function saveSession(value){
  session=value;
  sessionStorage.setItem(SESSION_STORAGE_KEY,JSON.stringify(value));
}

function clearSession(){
  session=null;
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

function showMessage(element,message,type){
  element.textContent=message;
  element.className=`notice ${type||''}`.trim();
}

async function responseError(response,fallback){
  const text=await response.text();
  let detail=text;
  if(text){
    try{
      const body=JSON.parse(text);
      detail=body.msg||body.message||body.error_description||body.error||text;
    }catch(error){
      detail=text;
    }
  }
  return new Error(`${fallback} (${response.status})${detail?`: ${detail}`:''}`);
}

async function authenticate(email,password){
  const response=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{
    method:'POST',
    headers:{
      apikey:SUPABASE_KEY,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({email,password})
  });
  if(!response.ok)throw await responseError(response,'Não foi possível entrar');
  const value=await response.json();
  if(!value.access_token||!value.refresh_token||!value.user||!value.user.id){
    throw new Error('O serviço de autenticação retornou uma sessão inválida.');
  }
  saveSession(value);
  try{
    await verifyAdmin();
  }catch(error){
    clearSession();
    throw error;
  }
}

async function requestPasswordReset(email){
  const redirectTo=new URL('https://knzinxis.github.io/franca/admin.html');
  const response=await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo.href)}`,{
    method:'POST',
    headers:{
      apikey:SUPABASE_KEY,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({email})
  });
  if(!response.ok)throw await responseError(response,'Não foi possível enviar o e-mail de recuperação');
}

function getPasswordRecoveryToken(){
  const params=new URLSearchParams(window.location.hash.replace(/^#/,''));
  if(params.get('type')==='recovery'&&params.get('access_token')){
    return params.get('access_token');
  }
  return null;
}

async function refreshSession(){
  if(!session||!session.refresh_token)throw new Error('Sua sessão expirou. Entre novamente.');
  const response=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{
    method:'POST',
    headers:{
      apikey:SUPABASE_KEY,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({refresh_token:session.refresh_token})
  });
  if(!response.ok){
    const error=await responseError(response,'Sua sessão expirou');
    clearSession();
    throw error;
  }
  const value=await response.json();
  if(!value.access_token||!value.refresh_token||!value.user){
    clearSession();
    throw new Error('Não foi possível renovar a sessão. Entre novamente.');
  }
  saveSession(value);
}

async function authenticatedFetch(path,options){
  if(!session||!session.access_token)throw new Error('Sua sessão expirou. Entre novamente.');
  const send=()=>fetch(`${SUPABASE_URL}${path}`,{
    ...options,
    headers:{
      apikey:SUPABASE_KEY,
      Authorization:`Bearer ${session.access_token}`,
      ...(options&&options.headers?options.headers:{})
    }
  });
  let response=await send();
  if(response.status===401&&session.refresh_token){
    await refreshSession();
    response=await send();
  }
  if(!response.ok)throw await responseError(response,'Falha ao acessar os dados');
  return response;
}

async function verifyAdmin(){
  if(!session||!session.user||!session.user.id)throw new Error('Entre com sua conta administrativa.');
  const params=new URLSearchParams({
    select:'user_id',
    user_id:`eq.${session.user.id}`,
    limit:'1'
  });
  const response=await authenticatedFetch(`/rest/v1/admin_users?${params}`);
  const admins=await response.json();
  if(!admins.length)throw new Error('Esta conta não tem permissão de administrador.');
}

async function getRecords(){
  const response=await authenticatedFetch('/rest/v1/recruitments?select=*&order=created_at.desc');
  return response.json();
}

async function getGuildRoster(){
  const response=await authenticatedFetch('/rest/v1/guild_roster?select=*&order=slot.asc');
  const roster=await response.json();
  if(!Array.isArray(roster)||roster.length!==55||roster.some((member,index)=>Number(member.slot)!==index+1)){
    throw new Error('A tabela precisa conter as 55 posições. Execute supabase-guild-roster.sql no SQL Editor do Supabase.');
  }
  return roster;
}

async function updateGuildRosterField(slot,field,value){
  const allowedFields=['nickname','game_id','weekly_honor','guild_war_points'];
  if(!allowedFields.includes(field))throw new Error('Campo inválido.');
  const params=new URLSearchParams({slot:`eq.${slot}`});
  const response=await authenticatedFetch(`/rest/v1/guild_roster?${params}`,{
    method:'PATCH',
    headers:{
      'Content-Type':'application/json',
      Prefer:'return=representation'
    },
    body:JSON.stringify({[field]:value})
  });
  const updated=await response.json();
  if(!Array.isArray(updated)||updated.length!==1){
    throw new Error('Nenhum espaço foi atualizado. Atualize a tabela e tente novamente.');
  }
}

async function getRecord(id){
  const params=new URLSearchParams({select:'*',id:`eq.${id}`,limit:'1'});
  const response=await authenticatedFetch(`/rest/v1/recruitments?${params}`);
  const result=await response.json();
  if(!result.length)throw new Error('Inscrição não encontrada.');
  return result[0];
}

async function updateRecord(id,data){
  const params=new URLSearchParams({id:`eq.${id}`});
  await authenticatedFetch(`/rest/v1/recruitments?${params}`,{
    method:'PATCH',
    headers:{
      'Content-Type':'application/json',
      Prefer:'return=minimal'
    },
    body:JSON.stringify(data)
  });
}

async function deleteRecord(id){
  const params=new URLSearchParams({id:`eq.${id}`});
  await authenticatedFetch(`/rest/v1/recruitments?${params}`,{method:'DELETE'});
}

async function render(){
  try{
    records=await getRecords();
    renderDashboard();
  }catch(error){
    showMessage(panelMessage,`Não foi possível carregar o painel: ${error.message}`,'error');
  }
}

async function loadGuildRoster(){
  try{
    renderGuildRoster(await getGuildRoster());
    showMessage(rosterMessage,'','');
  }catch(error){
    rosterBody.innerHTML='<tr><td colspan="3">A tabela não pôde ser carregada. Confira a configuração do Supabase.</td></tr>';
    showMessage(rosterMessage,`Não foi possível carregar a tabela: ${error.message} Execute supabase-guild-roster.sql no SQL Editor do Supabase e atualize o painel.`,'error');
  }
}

async function refreshPanel(){
  await Promise.all([render(),loadGuildRoster()]);
}

function renderGuildRoster(roster){
  rosterBody.innerHTML=roster.map(member=>{
    const slot=Number(member.slot);
    const memberNumber=String(slot).padStart(2,'0');
    const nickname=escapeAttribute(member.nickname||'');
    const gameId=escapeAttribute(member.game_id||'');
    const weeklyHonor=member.weekly_honor===null?'':escapeAttribute(member.weekly_honor);
    const guildWarPoints=member.guild_war_points===null?'':escapeAttribute(member.guild_war_points);
    return `<tr data-roster-row="${slot}">
      <td class="roster-identity-cell">
        <div class="roster-member-heading"><span>MEMBRO</span><strong>${memberNumber}</strong></div>
        <div class="roster-identity-fields">
          <label for="roster-nickname-${slot}"><span>Nick</span><input id="roster-nickname-${slot}" type="text" maxlength="80" autocomplete="off" data-roster-slot="${slot}" data-roster-field="nickname" aria-label="Nick do membro ${memberNumber}" value="${nickname}"></label>
          <label for="roster-game-id-${slot}"><span>ID</span><input id="roster-game-id-${slot}" type="text" inputmode="numeric" maxlength="24" autocomplete="off" data-roster-slot="${slot}" data-roster-field="game_id" aria-label="ID do membro ${memberNumber}" value="${gameId}"></label>
        </div>
        <span class="roster-row-status" data-roster-status aria-live="polite"></span>
      </td>
      <td><label class="roster-value-field"><span>Honra</span><input type="number" min="0" step="1" data-roster-slot="${slot}" data-roster-field="weekly_honor" aria-label="Honra semanal do membro ${memberNumber}" value="${weeklyHonor}"></label></td>
      <td><label class="roster-value-field"><span>Pontos</span><input type="number" min="0" step="1" data-roster-slot="${slot}" data-roster-field="guild_war_points" aria-label="Pontos de Guerra de Guilda do membro ${memberNumber}" value="${guildWarPoints}"></label></td>
    </tr>`;
  }).join('');
}

function renderDashboard(){
  document.querySelector('#total-count').textContent=String(records.length);
  document.querySelector('#pending-count').textContent=String(records.filter(item=>item.status==='Pendente').length);
  document.querySelector('#approved-count').textContent=String(records.filter(item=>item.status==='Aprovado').length);
  document.querySelector('#rejected-count').textContent=String(records.filter(item=>item.status==='Rejeitado').length);

  const query=searchInput.value.trim().toLocaleLowerCase('pt-BR');
  const selectedStatus=statusFilter.value;
  const selectedAgeRange=ageFilter.value;
  const sortBy=sortFilter.value;
  const readAge=item=>{
    const age=Number(item.idade);
    return Number.isInteger(age)&&age>=1&&age<=120?age:null;
  };
  const matches=item=>{
    const matchesStatus=selectedStatus==='todos'||item.status===selectedStatus;
    const age=readAge(item);
    const hasAge=age!==null;
    const matchesAge=selectedAgeRange==='all'
      ||(selectedAgeRange==='under18'&&hasAge&&age<18)
      ||(selectedAgeRange==='adult'&&hasAge&&age>=18);
    const haystack=[
      item.nome_completo,
      item.idade,
      item.nick_jogo,
      item.id_jogo,
      item.whatsapp,
      item.funcoes,
      item.disponibilidade
    ].join(' ').toLocaleLowerCase('pt-BR');
    return matchesStatus&&matchesAge&&haystack.includes(query);
  };
  const compare=(first,second)=>{
    const firstAge=readAge(first);
    const secondAge=readAge(second);
    const firstDate=Date.parse(first.created_at)||0;
    const secondDate=Date.parse(second.created_at)||0;
    if(sortBy==='age-asc'||sortBy==='age-desc'){
      if(firstAge===null&&secondAge!==null)return 1;
      if(secondAge===null&&firstAge!==null)return -1;
      if(firstAge!==null&&secondAge!==null&&firstAge!==secondAge){
        return sortBy==='age-asc'?firstAge-secondAge:secondAge-firstAge;
      }
    }
    return sortBy==='oldest'?firstDate-secondDate:secondDate-firstDate;
  };
  const candidates=records.filter(item=>item.status==='Pendente'&&matches(item)).sort(compare);
  const rejected=records.filter(item=>item.status==='Rejeitado'&&matches(item)).sort(compare);
  const approved=records.filter(item=>item.status==='Aprovado'&&matches(item)).sort(compare);

  list.innerHTML=candidates.length
    ?candidates.map(item=>renderCandidate(item,false)).join('')
    :'<p class="empty">Nenhuma inscrição corresponde à busca e aos filtros.</p>';
  approvedList.innerHTML=approved.length
    ?approved.map(item=>renderCandidate(item,true)).join('')
    :'<p class="empty">Nenhum recrutamento aprovado corresponde à busca e aos filtros.</p>';
  rejectedList.innerHTML=rejected.length
    ?rejected.map(item=>renderCandidate(item,false)).join('')
    :'<p class="empty">Nenhum recrutamento reprovado corresponde à busca e aos filtros.</p>';
}

function renderCandidate(item,isApproved){
  const id=escapeAttribute(item.id);
  const status=item.status||'Pendente';
  const note=noteDrafts.has(String(item.id))?noteDrafts.get(String(item.id)):(item.admin_notes||'');
  const actions=isApproved
    ?`<button class="delete" data-action="remover" data-id="${id}">REMOVER MEMBRO</button>`
    :`<button class="approve" data-action="aprovar" data-id="${id}">APROVAR E CHAMAR</button>
      <button class="reject" data-action="rejeitar" data-id="${id}">REJEITAR</button>
      <button class="delete" data-action="excluir" data-id="${id}">EXCLUIR</button>`;
  return `<article class="candidate">
    <div class="candidate-top">
      <h2>${escapeHtml(item.nome_completo||'Sem nome')}</h2>
      <strong class="candidate-status ${statusClass(status)}">${escapeHtml(status)}</strong>
    </div>
    <div class="candidate-grid">
      <p><strong>Nick:</strong> ${escapeHtml(item.nick_jogo||'-')}</p>
      <p><strong>Idade:</strong> ${item.idade?`${escapeHtml(item.idade)} anos`:'-'}</p>
      <p><strong>ID:</strong> ${escapeHtml(item.id_jogo||'-')}</p>
      <p><strong>WhatsApp:</strong> ${escapeHtml(item.whatsapp||'-')}</p>
      <p><strong>Função:</strong> ${escapeHtml(item.funcoes||'-')}</p>
      <p><strong>Disponibilidade:</strong> ${escapeHtml(item.disponibilidade||'-')}</p>
      <p><strong>Recebido em:</strong> ${escapeHtml(formatDate(item.created_at))}</p>
      ${isApproved?`<p><strong>Aprovado em:</strong> ${escapeHtml(formatDate(item.approved_at))}</p>`:''}
    </div>
    <label class="note-label" for="note-${id}">Observação interna (visível somente à equipe)</label>
    <textarea class="note-input" id="note-${id}" data-note-id="${id}" maxlength="1000" placeholder="Ex.: melhor horário para chamar, resultado do teste...">${escapeHtml(note)}</textarea>
    <div class="candidate-actions">
      <button class="note-save" data-action="salvar-nota" data-id="${id}">SALVAR OBSERVAÇÃO</button>
      ${actions}
    </div>
    <details class="history-details">
      <summary>Histórico de decisões</summary>
      <button class="history-load" data-action="historico" data-id="${id}">CARREGAR HISTÓRICO</button>
      <ul class="history-list" data-history-for="${id}"><li>Toque em “Carregar histórico” para consultar.</li></ul>
    </details>
  </article>`;
}

function formatDate(value){
  if(!value)return '—';
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'—':date.toLocaleString('pt-BR');
}

function statusClass(value){
  return `status-${String(value||'pendente').toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;
}

function escapeHtml(value){
  const element=document.createElement('div');
  element.textContent=String(value);
  return element.innerHTML;
}

function escapeAttribute(value){
  return escapeHtml(value).replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

async function loadHistory(id,container){
  const params=new URLSearchParams({
    select:'old_status,new_status,changed_at',
    recruitment_id:`eq.${id}`,
    order:'changed_at.desc'
  });
  const response=await authenticatedFetch(`/rest/v1/recruitment_history?${params}`);
  const history=await response.json();
  container.innerHTML=history.length?history.map(entry=>{
    const message=entry.old_status
      ?`Status alterado: ${entry.old_status} → ${entry.new_status}`
      :'Inscrição recebida';
    return `<li><strong>${escapeHtml(message)}</strong><span>${escapeHtml(formatDate(entry.changed_at))}</span></li>`;
  }).join(''):'<li>Nenhuma alteração registrada.</li>';
}

function buildApprovalMessage(candidate){
  return `PARABÉNS! VOCÊ FOI APROVADO! 🇫🇷🏆

Seja muito bem-vindo à GUILDA FRANÇA!

Você passou pelo nosso teste e agora faz parte da nossa família! 💪

Nossa guilda é focada em COMPETITIVO, então esperamos dedicação, respeito, compromisso e vontade de evoluir junto com a equipe

REGRAS DA GUILDA FRANÇA 📝

1 Respeitar todos os membros da guilda

2 Ter compromisso com os treinos e campeonatos

3 Manter a comunicação e ouvir as estratégias do time

4 Não causar brigas ou discussões desnecessárias

5 Respeitar a liderança e as decisões dos responsáveis

6 Não abandonar partidas competitivas sem justificativa

7 Manter uma boa conduta dentro e fora da guilda

8 Proibido usar hack, script ou qualquer tipo de trapaça

9 Participar dos grupos oficiais e acompanhar os avisos

10 Representar a GUILDA FRANÇA com respeito e dedicação

NOSSO OBJETIVO É CRESCER E DOMINAR O COMPETITIVO!

ENTRE NO GRUPO 📲 OFICIAL DA GUILDA

${GUILD_GROUP_URL}

Seja bem-vindo à família FRANÇA! Vamos pra cima! 🇫🇷

DADOS DO CANDIDATO

👤 Nome completo: ${candidate.nome_completo||'Não informado'}
🎂 Idade: ${candidate.idade?`${candidate.idade} anos`:'Não informada'}
🆔 ID: ${candidate.id_jogo||'Não informado'}
🎮 Nick do jogo: ${candidate.nick_jogo||'Não informado'}
📱 Número do WhatsApp: ${candidate.whatsapp||'Não informado'}
🏅 Função: ${candidate.funcoes||'Não informado'}
🕒 Horário disponível: ${candidate.disponibilidade||'Não informado'}`;
}

function normalizeWhatsAppPhone(value){
  const input=String(value||'').trim();
  let phone=input.replace(/\D/g,'');
  if(input.startsWith('00')){
    phone=phone.slice(2);
  }else if(!input.startsWith('+')){
    if(phone.startsWith('0')&&(phone.length===11||phone.length===12))phone=phone.slice(1);
    if(phone.length===10||phone.length===11)phone=`55${phone}`;
  }
  return phone.length>=10&&phone.length<=15?phone:'';
}

function openWhatsapp(phone,message,whatsappWindow){
  const url=`https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  if(whatsappWindow&&!whatsappWindow.closed){
    whatsappWindow.location.href=url;
    return;
  }
  window.location.assign(url);
}

async function handlePanelAction(event,container){
  const button=event.target.closest('button[data-action]');
  if(!button||button.disabled)return;
  const id=button.dataset.id;
  const action=button.dataset.action;
  button.disabled=true;
  try{
    if(action==='historico'){
      const history=Array.from(container.querySelectorAll('[data-history-for]'))
        .find(element=>element.dataset.historyFor===id);
      if(!history)throw new Error('Não foi possível localizar o histórico desta inscrição.');
      await loadHistory(id,history);
      return;
    }
    if(action==='salvar-nota'){
      const textarea=Array.from(container.querySelectorAll('textarea[data-note-id]'))
        .find(element=>element.dataset.noteId===id);
      if(!textarea)throw new Error('Não foi possível localizar a observação desta inscrição.');
      const note=textarea.value.trim();
      await updateRecord(id,{admin_notes:note});
      noteDrafts.delete(String(id));
      showMessage(panelMessage,'Observação salva com sucesso.','success');
      await render();
      return;
    }
    if(action==='aprovar'){
      const whatsappWindow=window.open('about:blank','_blank');
      try{
        const candidate=await getRecord(id);
        await updateRecord(id,{status:'Aprovado',approved_at:new Date().toISOString()});
        const phone=normalizeWhatsAppPhone(candidate.whatsapp);
        if(phone){
          openWhatsapp(phone,buildApprovalMessage(candidate),whatsappWindow);
          showMessage(panelMessage,'Candidato aprovado. A mensagem está pronta no WhatsApp.','success');
        }else{
          if(whatsappWindow)whatsappWindow.close();
          showMessage(panelMessage,'Candidato aprovado, mas o WhatsApp cadastrado não é válido.','error');
        }
      }catch(error){
        if(whatsappWindow)whatsappWindow.close();
        throw error;
      }
      await render();
      return;
    }
    const candidate=records.find(item=>String(item.id)===String(id));
    const name=candidate&&candidate.nome_completo?candidate.nome_completo:'este candidato';
    if(action==='rejeitar'){
      if(!confirm(`Deseja marcar ${name} como rejeitado?`))return;
      await updateRecord(id,{status:'Rejeitado',approved_at:null});
      showMessage(panelMessage,'Inscrição marcada como rejeitada.','success');
      await render();
    }else if(action==='excluir'){
      if(!confirm(`Excluir permanentemente a inscrição de ${name} e seu histórico?`))return;
      await deleteRecord(id);
      noteDrafts.delete(String(id));
      showMessage(panelMessage,'Inscrição excluída.','success');
      await render();
    }else if(action==='remover'){
      if(!confirm(`Remover ${name} da lista de membros aprovados?`))return;
      await updateRecord(id,{status:'Removido',approved_at:null});
      showMessage(panelMessage,'Membro removido da lista de aprovados.','success');
      await render();
    }
  }catch(error){
    showMessage(panelMessage,`A ação não foi concluída: ${error.message}`,'error');
  }finally{
    if(button.isConnected)button.disabled=false;
  }
}

loginForm.addEventListener('submit',async event=>{
  event.preventDefault();
  const submitButton=loginForm.querySelector('button[type="submit"]');
  submitButton.disabled=true;
  showMessage(loginMessage,'Verificando acesso...','');
  try{
    await authenticate(
      document.querySelector('#admin-email').value.trim(),
      document.querySelector('#admin-password').value
    );
    loginForm.reset();
    loginBox.classList.add('hidden');
    panel.classList.remove('hidden');
    showMessage(loginMessage,'','');
    await refreshPanel();
  }catch(error){
    showMessage(loginMessage,error.message,'error');
  }finally{
    submitButton.disabled=false;
  }
});

document.querySelector('#forgot-password-button').addEventListener('click',async()=>{
  const email=document.querySelector('#admin-email').value.trim();
  if(!email){
    showMessage(loginMessage,'Digite seu e-mail administrativo primeiro.','error');
    document.querySelector('#admin-email').focus();
    return;
  }
  const button=document.querySelector('#forgot-password-button');
  button.disabled=true;
  showMessage(loginMessage,'Enviando e-mail de recuperação...','');
  try{
    await requestPasswordReset(email);
    showMessage(loginMessage,'E-mail de recuperação enviado. Confira sua caixa de entrada e o Spam.','success');
  }catch(error){
    showMessage(loginMessage,error.message,'error');
  }finally{
    button.disabled=false;
  }
});

passwordResetForm.addEventListener('submit',async event=>{
  event.preventDefault();
  const password=document.querySelector('#new-admin-password').value;
  const confirmation=document.querySelector('#confirm-admin-password').value;
  if(password!==confirmation){
    showMessage(passwordResetMessage,'As duas senhas não coincidem.','error');
    return;
  }
  const recoveryToken=getPasswordRecoveryToken();
  if(!recoveryToken){
    showMessage(passwordResetMessage,'O link de redefinição expirou ou é inválido. Solicite outro e-mail.','error');
    return;
  }
  const button=passwordResetForm.querySelector('button[type="submit"]');
  button.disabled=true;
  showMessage(passwordResetMessage,'Salvando nova senha...','');
  try{
    const response=await fetch(`${SUPABASE_URL}/auth/v1/user`,{
      method:'PUT',
      headers:{
        apikey:SUPABASE_KEY,
        Authorization:`Bearer ${recoveryToken}`,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({password})
    });
    if(!response.ok)throw await responseError(response,'Não foi possível alterar a senha');
    passwordResetForm.reset();
    window.history.replaceState({},document.title,window.location.pathname);
    passwordResetBox.classList.add('hidden');
    loginBox.classList.remove('hidden');
    showMessage(loginMessage,'Senha alterada com sucesso. Entre com sua nova senha.','success');
  }catch(error){
    showMessage(passwordResetMessage,error.message,'error');
  }finally{
    button.disabled=false;
  }
});

document.querySelector('#cancel-password-reset').addEventListener('click',()=>{
  window.history.replaceState({},document.title,window.location.pathname);
  passwordResetBox.classList.add('hidden');
  loginBox.classList.remove('hidden');
  showMessage(loginMessage,'','');
});

document.querySelector('#logout-button').addEventListener('click',async()=>{
  const current=session;
  clearSession();
  panel.classList.add('hidden');
  loginBox.classList.remove('hidden');
  loginForm.reset();
  try{
    if(current&&current.access_token){
      const response=await fetch(`${SUPABASE_URL}/auth/v1/logout`,{
        method:'POST',
        headers:{
          apikey:SUPABASE_KEY,
          Authorization:`Bearer ${current.access_token}`
        }
      });
      if(!response.ok)throw await responseError(response,'Não foi possível encerrar a sessão no servidor');
    }
    showMessage(loginMessage,'Sessão encerrada.','success');
  }catch(error){
    showMessage(loginMessage,`Sessão encerrada neste dispositivo, mas o servidor retornou um erro: ${error.message}`,'error');
  }
});

list.addEventListener('click',event=>handlePanelAction(event,list));
approvedList.addEventListener('click',event=>handlePanelAction(event,approvedList));
rejectedList.addEventListener('click',event=>handlePanelAction(event,rejectedList));
list.addEventListener('input',event=>{
  const textarea=event.target.closest('textarea[data-note-id]');
  if(textarea)noteDrafts.set(String(textarea.dataset.noteId),textarea.value);
});
approvedList.addEventListener('input',event=>{
  const textarea=event.target.closest('textarea[data-note-id]');
  if(textarea)noteDrafts.set(String(textarea.dataset.noteId),textarea.value);
});
rejectedList.addEventListener('input',event=>{
  const textarea=event.target.closest('textarea[data-note-id]');
  if(textarea)noteDrafts.set(String(textarea.dataset.noteId),textarea.value);
});

searchInput.addEventListener('input',renderDashboard);
statusFilter.addEventListener('change',renderDashboard);
ageFilter.addEventListener('change',renderDashboard);
sortFilter.addEventListener('change',renderDashboard);

document.querySelector('#export-button').addEventListener('click',async event=>{
  const button=event.currentTarget;
  button.disabled=true;
  try{
    const exportedRecords=await getRecords();
    if(!exportedRecords.length){
      showMessage(panelMessage,'Não há inscrições para exportar.','');
      return;
    }
    const fields=['nome_completo','idade','nick_jogo','id_jogo','whatsapp','funcoes','disponibilidade','status','created_at','approved_at'];
    const rows=[fields.join(';'),...exportedRecords.map(row=>fields.map(field=>`"${String(row[field]||'').replace(/"/g,'""')}"`).join(';'))];
    const blob=new Blob(['\uFEFF',rows.join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download='recrutamentos-franca.csv';
    link.click();
    URL.revokeObjectURL(url);
    showMessage(panelMessage,'Arquivo CSV exportado.','success');
  }catch(error){
    showMessage(panelMessage,`Não foi possível exportar: ${error.message}`,'error');
  }finally{
    button.disabled=false;
  }
});

document.querySelector('#clear-button').addEventListener('click',async event=>{
  const pendingCount=records.filter(item=>item.status==='Pendente').length;
  if(!pendingCount){
    showMessage(panelMessage,'Não há recrutamentos pendentes para excluir.','');
    return;
  }
  if(!confirm(`Isso excluirá permanentemente ${pendingCount} recrutamento(s) pendente(s) e todo o histórico relacionado. Os aprovados não serão afetados. Deseja continuar?`))return;
  const button=event.currentTarget;
  button.disabled=true;
  try{
    await authenticatedFetch('/rest/v1/recruitments?status=eq.Pendente',{method:'DELETE'});
    noteDrafts.clear();
    showMessage(panelMessage,'Os recrutamentos pendentes foram excluídos. Os aprovados foram preservados.','success');
    await render();
  }catch(error){
    showMessage(panelMessage,`Não foi possível limpar as inscrições: ${error.message}`,'error');
  }finally{
    button.disabled=false;
  }
});

rosterBody.addEventListener('change',async event=>{
  const input=event.target.closest('input[data-roster-field]');
  if(!input||!input.reportValidity())return;
  const slot=Number(input.dataset.rosterSlot);
  const field=input.dataset.rosterField;
  const row=input.closest('[data-roster-row]');
  const status=row.querySelector('[data-roster-status]');
  let value=input.value;
  if(input.type==='number'){
    value=input.value===''?null:Number(input.value);
    if(value!==null&&(!Number.isSafeInteger(value)||value<0)){
      showMessage(rosterMessage,'Use um número inteiro igual ou maior que zero.','error');
      input.focus();
      return;
    }
  }else{
    value=input.value.trim();
  }
  status.className='roster-row-status';
  status.textContent='Salvando...';
  try{
    await updateGuildRosterField(slot,field,value);
    showMessage(rosterMessage,'','');
    status.classList.add('success');
    status.textContent='Salvo';
    window.setTimeout(()=>{
      if(status.isConnected&&status.textContent==='Salvo')status.textContent='';
    },1800);
  }catch(error){
    status.classList.add('error');
    status.textContent='Falha ao salvar';
    showMessage(rosterMessage,`Não foi possível salvar o membro ${String(slot).padStart(2,'0')}: ${error.message}`,'error');
  }
});

document.querySelector('#refresh-button').addEventListener('click',refreshPanel);

async function initialize(){
  if(getPasswordRecoveryToken()){
    loginBox.classList.add('hidden');
    passwordResetBox.classList.remove('hidden');
    showMessage(passwordResetMessage,'Defina sua nova senha para continuar.','');
    return;
  }
  if(!session)return;
  loginBox.classList.add('hidden');
  panel.classList.remove('hidden');
  try{
    await verifyAdmin();
    await refreshPanel();
  }catch(error){
    clearSession();
    panel.classList.add('hidden');
    loginBox.classList.remove('hidden');
    showMessage(loginMessage,`Não foi possível validar sua sessão: ${error.message}`,'error');
  }
}

initialize();
setInterval(()=>{
  if(!panel.classList.contains('hidden')&&!document.querySelector('#panel details[open]'))render();
},15000);
