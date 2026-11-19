const PIN = '2026';
const loginBox = document.querySelector('#login-box');
const panel = document.querySelector('#panel');
const list = document.querySelector('#candidate-list');
const approvedList = document.querySelector('#approved-list');

document.querySelector('#login-button').addEventListener('click', () => {
  if (document.querySelector('#admin-pin').value === PIN) {
    loginBox.classList.add('hidden');
    panel.classList.remove('hidden');
    render();
  } else {
    alert('PIN incorreto.');
  }
});

function getRecords() {
  return JSON.parse(localStorage.getItem('francaRecrutamentos') || '[]');
}

function saveRecords(records) {
  localStorage.setItem('francaRecrutamentos', JSON.stringify(records));
  render();
}

function render() {
  const records = getRecords();
  if (!records.length) {
    list.innerHTML = '<p class="empty">Nenhum recrutamento recebido.</p>';
    renderApproved();
    return;
  }
  list.innerHTML = records.map((item, index) => `
    <article class="candidate">
      <div class="candidate-top">
        <h2>${escapeHtml(item.nome || 'Sem nome')}</h2>
        <strong class="candidate-status">${escapeHtml(item.status || 'Pendente')}</strong>
      </div>
      <div class="candidate-grid">
        <p><strong>Idade:</strong> ${escapeHtml(item.idade || '-')}</p>
        <p><strong>ID:</strong> ${escapeHtml(item.idJogo || '-')}</p>
        <p><strong>WhatsApp:</strong> ${escapeHtml(item.whatsapp || '-')}</p>
        <p><strong>Competitivo:</strong> ${escapeHtml(item.competitivo || '-')}</p>
        <p><strong>Disponibilidade:</strong> ${escapeHtml(item.disponibilidade || '-')}</p>
        <p><strong>Sobre:</strong> ${escapeHtml(item.sobre || '-')}</p>
      </div>
      <div class="candidate-actions">
        <button class="approve" data-action="aprovar" data-index="${index}">APROVAR E CHAMAR</button>
        <button class="approve" data-action="whatsapp" data-index="${index}">WHATSAPP</button>
        <button class="reject" data-action="rejeitar" data-index="${index}">REJEITAR</button>
        <button class="delete" data-action="excluir" data-index="${index}">EXCLUIR</button>
      </div>
    </article>
  `).join('');
  renderApproved();
}

function renderApproved() {
  const records = getRecords();
  const approved = records.filter((item) => item.status === 'Aprovado');
  if (!approved.length) {
    approvedList.innerHTML = '<p class="empty">Nenhum membro aprovado.</p>';
    return;
  }
  approvedList.innerHTML = approved.map((item) => {
    const index = getRecords().indexOf(item);
    const approvedAt = item.approvedAt ? new Date(item.approvedAt).toLocaleString('pt-BR') : '-';
    return `
      <article class="candidate">
        <div class="candidate-top">
          <h2>${escapeHtml(item.nome || 'Sem nome')}</h2>
          <strong class="candidate-status">APROVADO</strong>
        </div>
        <div class="candidate-grid">
          <p><strong>WhatsApp:</strong> ${escapeHtml(item.whatsapp || '-')}</p>
          <p><strong>Data da aprovação:</strong> ${approvedAt}</p>
          <p><strong>ID:</strong> ${escapeHtml(item.idJogo || '-')}</p>
        </div>
        <div class="candidate-actions">
          <button class="delete" data-approved-index="${index}">REMOVER MEMBRO</button>
        </div>
      </article>
    `;
  }).join('');
}

list.addEventListener('click', (event) => {
  const approvedButton = event.target.closest('button[data-approved-index]');
  if (approvedButton) {
    const records = getRecords();
    const index = Number(approvedButton.dataset.approvedIndex);
    records[index].status = 'Removido';
    saveRecords(records);
    return;
  }
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const records = getRecords();
  const index = Number(button.dataset.index);
  if (button.dataset.action === 'aprovar') {
    records[index].status = 'Aprovado';
    records[index].approvedAt = new Date().toISOString();
    saveRecords(records);
    openWhatsapp(records[index], 'Olá, ${nome}! Sua inscrição na guilda FRANÇA foi aprovada. Seja bem-vindo(a) à família! Entre no grupo oficial aqui: https://chat.whatsapp.com/L2ZZ9HAqWnd2NurHhAuAiX?s=cl&p=i&iam=2');
  }
  if (button.dataset.action === 'whatsapp') openWhatsapp(records[index], 'Olá, ${nome}! Estamos entrando em contato sobre sua inscrição na guilda FRANÇA.');
  if (button.dataset.action === 'rejeitar') records[index].status = 'Rejeitado';
  if (button.dataset.action === 'excluir') records.splice(index, 1);
  if (button.dataset.action !== 'aprovar') saveRecords(records);
});

approvedList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-approved-index]');
  if (!button) return;
  const records = getRecords();
  const index = Number(button.dataset.approvedIndex);
  records[index].status = 'Removido';
  saveRecords(records);
});

function openWhatsapp(record, template) {
  const phone = String(record.whatsapp || '').replace(/\D/g, '');
  if (!phone) {
    alert('Este candidato não informou um WhatsApp válido.');
    return;
  }
  const nome = String(record.nome || 'candidato');
  const message = template.replace('${nome}', nome);
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

document.querySelector('#export-button').addEventListener('click', () => {
  const records = getRecords();
  if (!records.length) return;
  const fields = ['nome','idade','idJogo','whatsapp','competitivo','disponibilidade','sobre','status','data'];
  const rows = [fields.join(';'), ...records.map(row => fields.map(field => `"${String(row[field] || '').replaceAll('"','""')}"`).join(';'))];
  const blob = new Blob([rows.join('\n')], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'recrutamentos-franca.csv';
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelector('#clear-button').addEventListener('click', () => {
  if (confirm('Excluir todos os recrutamentos?')) saveRecords([]);
});

function escapeHtml(value) {
  const element = document.createElement('div');
  element.textContent = String(value);
  return element.innerHTML;
}
