const drawer=document.getElementById('drawer');
document.getElementById('menuBtn').addEventListener('click',()=>drawer.classList.toggle('open'));
document.getElementById('closeMenu').addEventListener('click',()=>drawer.classList.remove('open'));
drawer.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>drawer.classList.remove('open')));
const about=document.querySelector('textarea[name="sobre"]');
about.addEventListener('input',()=>document.getElementById('counter').textContent=about.value.length+'/200');
const form=document.getElementById('applicationForm');
form.addEventListener('submit',e=>{
  e.preventDefault();
  if(!form.reportValidity()) return;
  const data=Object.fromEntries(new FormData(form).entries());
  // Nesta versão estática, a inscrição fica apenas nesta sessão do navegador.
  // Para receber candidaturas e usar painel ADM, é necessário conectar um backend.
  document.getElementById('formMessage').textContent='Inscrição preenchida! Para enviar e receber a candidatura, conecte o site ao sistema da guilda.';
  console.log('Candidatura preenchida:',data);
});
const dialog=document.getElementById('adminDialog');
document.getElementById('adminOpen').addEventListener('click',e=>{e.preventDefault();dialog.showModal()});
document.getElementById('adminClose').addEventListener('click',()=>dialog.close());
