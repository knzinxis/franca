const drawer=document.getElementById('drawer');
document.getElementById('menuBtn').addEventListener('click',()=>drawer.classList.toggle('open'));
document.getElementById('closeMenu').addEventListener('click',()=>drawer.classList.remove('open'));
drawer.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>drawer.classList.remove('open')));
const form=document.getElementById('applicationForm');
form.addEventListener('submit',e=>{
  e.preventDefault();
  if(!form.reportValidity()) return;
  const data=Object.fromEntries(new FormData(form).entries());
  data.nome=data.nomeCompleto;
  data.funcao=[...form.querySelectorAll('input[name="funcao"]:checked')].map(input=>input.value).join(', ');
  if(!data.funcao){
    document.getElementById('formMessage').textContent='Selecione pelo menos uma função.';
    return;
  }
  data.status='Pendente';
  data.data=new Date().toISOString();
  const records=JSON.parse(localStorage.getItem('francaRecrutamentos')||'[]');
  records.unshift(data);
  localStorage.setItem('francaRecrutamentos',JSON.stringify(records));
  document.getElementById('formMessage').textContent='🎉 Parabéns! Seu formulário foi enviado com sucesso! Entraremos em contato em breve para informar sobre o resultado do seu recrutamento.';
  form.reset();
});
