const SUPABASE_URL='https://eynwuwakthzpbxxzvifl.supabase.co';
const SUPABASE_KEY='sb_publishable_d8wfzUDD2mBv_obeWJmDnQ_QBWD-FSL';

const drawer=document.getElementById('drawer');
document.getElementById('menuBtn').addEventListener('click',()=>drawer.classList.toggle('open'));
document.getElementById('closeMenu').addEventListener('click',()=>drawer.classList.remove('open'));
drawer.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>drawer.classList.remove('open')));

const form=document.getElementById('applicationForm');
form.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!form.reportValidity()) return;
  const fields=Object.fromEntries(new FormData(form).entries());
  const funcoes=[...form.querySelectorAll('input[name="funcao"]:checked')].map(input=>input.value).join(', ');
  if(!funcoes){
    document.getElementById('formMessage').textContent='Selecione pelo menos uma função.';
    return;
  }
  const submitButton=form.querySelector('button[type="submit"]');
  submitButton.disabled=true;
  const recruit={
    nome_completo:fields.nomeCompleto,
    idade:Number(fields.idade),
    nick_jogo:fields.nickJogo,
    id_jogo:fields.idJogo,
    whatsapp:fields.whatsapp,
    funcoes,
    disponibilidade:fields.disponibilidade,
    status:'Pendente'
  };
  try{
    const response=await fetch(`${SUPABASE_URL}/rest/v1/recruitments`,{
      method:'POST',
      headers:{
        'apikey':SUPABASE_KEY,
        'Authorization':`Bearer ${SUPABASE_KEY}`,
        'Content-Type':'application/json',
        'Prefer':'return=minimal'
      },
      body:JSON.stringify(recruit)
    });
    if(!response.ok) throw new Error(`Falha ao salvar a inscrição (${response.status}).`);
    form.reset();
    const successDialog=document.getElementById('successDialog');
    if(typeof successDialog.showModal==='function') successDialog.showModal();
  }catch(error){
    document.getElementById('formMessage').textContent='Não foi possível enviar agora. Verifique sua conexão e tente novamente.';
  }finally{
    submitButton.disabled=false;
  }
});

document.getElementById('closeSuccess').addEventListener('click',()=>{
  document.getElementById('successDialog').close();
});
