const SUPABASE_URL='https://eynwuwakthzpbxxzvifl.supabase.co';
const SUPABASE_KEY='sb_publishable_d8wfzUDD2mBv_obeWJmDnQ_QBWD-FSL';
const GUILD_GROUP_URL='https://chat.whatsapp.com/L2ZZ9HAqWnd2NurHhAuAiX?s=cl&p=i&iam=2';
const SESSION_STORAGE_KEY='franca-admin-session';
const loginBox=document.querySelector('#login-box');
const loginForm=document.querySelector('#login-form');
const loginMessage=document.querySelector('#login-message');
const panel=document.querySelector('#panel');
const panelMessage=document.querySelector('#panel-message');
const list=document.querySelector('#candidate-list');
const approvedList=document.querySelector('#approved-list');
const searchInput=document.querySelector('#candidate-search');
const statusFilter=document.querySelector('#status-filter');
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

function renderDashboard(){
  document.querySelector('#total-count').textContent=String(records.length);
  document.querySelector('#pending-count').textContent=String(records.filter(item=>item.status==='Pendente').length);
  document.querySelector('#approved-count').textContent=String(records.filter(item=>item.status==='Aprovado').length);
  document.querySelector('#rejected-count').textContent=String(records.filter(item=>item.status==='Rejeitado').length);

  const query=searchInput.value.trim().toLocaleLowerCase('pt-BR');
  const selectedStatus=statusFilter.value;
  const matches=item=>{
    const matchesStatus=selectedStatus==='todos'||item.status===selectedStatus;
    const haystack=[
      item.nome_completo,
      item.nick_jogo,
      item.id_jogo,
      item.whatsapp,
      item.funcoes,
      item.disponibilidade
    ].join(' ').toLocaleLowerCase('pt-BR');
    return matchesStatus&&haystack.includes(query);
  };
  const candidates=records.filter(item=>item.status!=='Aprovado'&&matches(item));
  const approved=records.filter(item=>item.status==='Aprovado'&&matches(item));

  list.innerHTML=candidates.length
    ?candidates.map(item=>renderCandidate(item,false)).join('')
    :'<p class="empty">Nenhuma inscrição corresponde à busca e aos filtros.</p>';
  approvedList.innerHTML=approved.length
    ?approved.map(item=>renderCandidate(item,true)).join('')
    :'<p class="empty">Nenhum membro aprovado corresponde à busca e aos filtros.</p>';
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
    await render();
  }catch(error){
    showMessage(loginMessage,error.message,'error');
  }finally{
    submitButton.disabled=false;
  }
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
list.addEventListener('input',event=>{
  const textarea=event.target.closest('textarea[data-note-id]');
  if(textarea)noteDrafts.set(String(textarea.dataset.noteId),textarea.value);
});
approvedList.addEventListener('input',event=>{
  const textarea=event.target.closest('textarea[data-note-id]');
  if(textarea)noteDrafts.set(String(textarea.dataset.noteId),textarea.value);
});

searchInput.addEventListener('input',renderDashboard);
statusFilter.addEventListener('change',renderDashboard);

document.querySelector('#export-button').addEventListener('click',async event=>{
  const button=event.currentTarget;
  button.disabled=true;
  try{
    const exportedRecords=await getRecords();
    if(!exportedRecords.length){
      showMessage(panelMessage,'Não há inscrições para exportar.','');
      return;
    }
    const fields=['nome_completo','nick_jogo','id_jogo','whatsapp','funcoes','disponibilidade','status','created_at','approved_at'];
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
  if(!records.length){
    showMessage(panelMessage,'Não há inscrições para excluir.','');
    return;
  }
  if(!confirm(`Isso excluirá permanentemente ${records.length} inscrição(ões) e todo o histórico. Deseja continuar?`))return;
  const button=event.currentTarget;
  button.disabled=true;
  try{
    await authenticatedFetch('/rest/v1/recruitments?id=not.is.null',{method:'DELETE'});
    noteDrafts.clear();
    showMessage(panelMessage,'Todas as inscrições foram excluídas.','success');
    await render();
  }catch(error){
    showMessage(panelMessage,`Não foi possível limpar as inscrições: ${error.message}`,'error');
  }finally{
    button.disabled=false;
  }
});

document.querySelector('#refresh-button').addEventListener('click',render);

async function initialize(){
  if(!session)return;
  loginBox.classList.add('hidden');
  panel.classList.remove('hidden');
  try{
    await verifyAdmin();
    await render();
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
