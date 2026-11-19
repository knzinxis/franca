const PIN='2026';
const SUPABASE_URL='https://eynwuwakthzpbxxzvifl.supabase.co';
const SUPABASE_KEY='sb_publishable_d8wfzUDD2mBv_obeWJmDnQ_QBWD-FSL';
const GUILD_GROUP_URL='https://chat.whatsapp.com/L2ZZ9HAqWnd2NurHhAuAiX?s=cl&p=i&iam=2';
const loginBox=document.querySelector('#login-box');
const panel=document.querySelector('#panel');
const list=document.querySelector('#candidate-list');
const approvedList=document.querySelector('#approved-list');

document.querySelector('#login-button').addEventListener('click',()=>{
  if(document.querySelector('#admin-pin').value===PIN){
    loginBox.classList.add('hidden');
    panel.classList.remove('hidden');
    render();
  }else{
    alert('PIN incorreto.');
  }
});

async function getRecords(){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/recruitments?select=*&order=created_at.desc`,{
    headers:{
      apikey:SUPABASE_KEY,
      Authorization:`Bearer ${SUPABASE_KEY}`
    }
  });
  if(!response.ok) throw new Error(`Erro ${response.status}`);
  return response.json();
}

async function render(){
  try{
    const records=await getRecords();
    if(!records.length){
      list.innerHTML='<p class="empty">Nenhum recrutamento recebido.</p>';
    }else{
      list.innerHTML=records.map(item=>`
        <article class="candidate">
          <div class="candidate-top">
            <h2>${escapeHtml(item.nome_completo||'Sem nome')}</h2>
            <strong class="candidate-status">${escapeHtml(item.status||'Pendente')}</strong>
          </div>
          <div class="candidate-grid">
            <p><strong>Nick:</strong> ${escapeHtml(item.nick_jogo||'-')}</p>
            <p><strong>ID:</strong> ${escapeHtml(item.id_jogo||'-')}</p>
            <p><strong>WhatsApp:</strong> ${escapeHtml(item.whatsapp||'-')}</p>
            <p><strong>Função:</strong> ${escapeHtml(item.funcoes||'-')}</p>
            <p><strong>Disponibilidade:</strong> ${escapeHtml(item.disponibilidade||'-')}</p>
            <p><strong>Recebido em:</strong> ${item.created_at?new Date(item.created_at).toLocaleString('pt-BR'):'-'}</p>
          </div>
          <div class="candidate-actions">
            <button class="approve" data-action="aprovar" data-id="${item.id}">APROVAR E CHAMAR</button>
            <button class="approve" data-action="whatsapp" data-id="${item.id}">WHATSAPP</button>
            <button class="reject" data-action="rejeitar" data-id="${item.id}">REJEITAR</button>
            <button class="delete" data-action="excluir" data-id="${item.id}">EXCLUIR</button>
          </div>
        </article>
      `).join('');
    }
    const approved=records.filter(item=>item.status==='Aprovado');
    if(!approved.length){
      approvedList.innerHTML='<p class="empty">Nenhum membro aprovado.</p>';
    }else{
      approvedList.innerHTML=approved.map(item=>`
        <article class="candidate">
          <div class="candidate-top">
            <h2>${escapeHtml(item.nome_completo||'Sem nome')}</h2>
            <strong class="candidate-status">APROVADO</strong>
          </div>
          <div class="candidate-grid">
            <p><strong>Nick:</strong> ${escapeHtml(item.nick_jogo||'-')}</p>
            <p><strong>WhatsApp:</strong> ${escapeHtml(item.whatsapp||'-')}</p>
            <p><strong>ID:</strong> ${escapeHtml(item.id_jogo||'-')}</p>
            <p><strong>Função:</strong> ${escapeHtml(item.funcoes||'-')}</p>
            <p><strong>Disponibilidade:</strong> ${escapeHtml(item.disponibilidade||'-')}</p>
            <p><strong>Data da aprovação:</strong> ${item.approved_at?new Date(item.approved_at).toLocaleString('pt-BR'):'-'}</p>
          </div>
          <div class="candidate-actions">
            <button class="delete" data-action="remover" data-id="${item.id}">REMOVER MEMBRO</button>
          </div>
        </article>
      `).join('');
    }
  }catch(error){
    list.innerHTML='<p class="empty">Não foi possível carregar os recrutamentos.</p>';
  }
}

list.addEventListener('click',async event=>{
  const button=event.target.closest('button[data-action]');
  if(!button)return;
  const id=button.dataset.id;
  const action=button.dataset.action;
  if(action==='whatsapp'||action==='aprovar'){
    const whatsappWindow=window.open('about:blank','_blank');
    try{
      const records=await getRecords();
      const item=records.find(record=>String(record.id)===String(id));
      if(!item)throw new Error('Inscrição não encontrada.');
      if(action==='aprovar'){
        await updateRecord(id,{status:'Aprovado',approved_at:new Date().toISOString()});
        openWhatsapp(item,approvalMessage,whatsappWindow);
      }else{
        openWhatsapp(item,`Olá, ${item.nome_completo||'candidato'}! Estamos entrando em contato sobre sua inscrição na guilda FRANÇA.`,whatsappWindow);
      }
    }catch(error){
      if(whatsappWindow)whatsappWindow.close();
      alert(`Não foi possível concluir a ação: ${error.message}`);
    }
  }else if(action==='rejeitar'){
    await updateRecord(id,{status:'Rejeitado'});
  }else if(action==='excluir'||action==='remover'){
    await deleteRecord(id);
  }
  await render();
});

approvedList.addEventListener('click',async event=>{
  const button=event.target.closest('button[data-action="remover"]');
  if(!button)return;
  await updateRecord(button.dataset.id,{status:'Removido',approved_at:null});
  await render();
});

async function updateRecord(id,data){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/recruitments?id=eq.${id}`,{
    method:'PATCH',
    headers:{
      apikey:SUPABASE_KEY,
      Authorization:`Bearer ${SUPABASE_KEY}`,
      'Content-Type':'application/json',
      Prefer:'return=minimal'
    },
    body:JSON.stringify(data)
  });
  if(!response.ok)throw new Error(`Erro ao salvar a decisão (${response.status}).`);
}

async function deleteRecord(id){
  await fetch(`${SUPABASE_URL}/rest/v1/recruitments?id=eq.${id}`,{
    method:'DELETE',
    headers:{
      apikey:SUPABASE_KEY,
      Authorization:`Bearer ${SUPABASE_KEY}`
    }
  });
}

const approvalMessage=`🏆 PARABÉNS! VOCÊ FOI APROVADO! 🇫🇷🔥

Seja muito bem-vindo à GUILDA FRANÇA!

Você passou pelo nosso teste e agora faz parte da nossa família! 💪

Nossa guilda é focada em COMPETITIVO, então esperamos dedicação, respeito, compromisso e vontade de evoluir junto com a equipe.

📜 REGRAS DA GUILDA FRANÇA

1. Respeitar todos os membros da guilda.
2. Ter compromisso com os treinos e campeonatos.
3. Manter a comunicação e ouvir as estratégias do time.
4. Não causar brigas ou discussões desnecessárias.
5. Respeitar a liderança e as decisões dos responsáveis.
6. Não abandonar partidas competitivas sem justificativa.
7. Manter uma boa conduta dentro e fora da guilda.
8. Proibido usar hack, script ou qualquer tipo de trapaça.
9. Participar dos grupos oficiais e acompanhar os avisos.
10. Representar a GUILDA FRANÇA com respeito e dedicação.

🔥 NOSSO OBJETIVO É CRESCER E DOMINAR O COMPETITIVO!

📲 ENTRE NO GRUPO OFICIAL DA GUILDA:
${GUILD_GROUP_URL}

🇫🇷 Seja bem-vindo à família FRANÇA! Vamos pra cima! 🚀`;

function openWhatsapp(record,message,whatsappWindow){
  const phone=String(record.whatsapp||'').replace(/\D/g,'');
  if(!phone){
    if(whatsappWindow)whatsappWindow.close();
    alert('Este candidato não informou um WhatsApp válido.');
    return;
  }
  if(!whatsappWindow){
    alert('Permita pop-ups para abrir o WhatsApp do candidato.');
    return;
  }
  whatsappWindow.location.href=`https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

document.querySelector('#export-button').addEventListener('click',async()=>{
  const records=await getRecords();
  if(!records.length)return;
  const fields=['nome_completo','nick_jogo','id_jogo','whatsapp','funcoes','disponibilidade','status','created_at','approved_at'];
  const rows=[fields.join(';'),...records.map(row=>fields.map(field=>`"${String(row[field]||'').replaceAll('"','""')}"`).join(';'))];
  const blob=new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;link.download='recrutamentos-franca.csv';link.click();
  URL.revokeObjectURL(url);
});

document.querySelector('#clear-button').addEventListener('click',async()=>{
  if(!confirm('Excluir todos os recrutamentos?'))return;
  await fetch(`${SUPABASE_URL}/rest/v1/recruitments`,{
    method:'DELETE',
    headers:{
      apikey:SUPABASE_KEY,
      Authorization:`Bearer ${SUPABASE_KEY}`
    }
  });
  await render();
});

function escapeHtml(value){
  const element=document.createElement('div');
  element.textContent=String(value);
  return element.innerHTML;
}

setInterval(()=>{
  if(!panel.classList.contains('hidden'))render();
},5000);
