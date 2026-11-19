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
  data.status='Pendente';
  data.data=new Date().toISOString();
  const records=JSON.parse(localStorage.getItem('francaRecrutamentos')||'[]');
  records.unshift(data);
  localStorage.setItem('francaRecrutamentos',JSON.stringify(records));
  document.getElementById('formMessage').textContent='Inscrição enviada! Aguarde o contato da liderança.';
  form.reset();
});
