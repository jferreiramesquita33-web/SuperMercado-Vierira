// ======= STORAGE UTILS =======
const SV = {
  get(key) {
    try { return JSON.parse(localStorage.getItem('sv_' + key)) || []; }
    catch { return []; }
  },
  set(key, val) {
    localStorage.setItem('sv_' + key, JSON.stringify(val));
  },
  newId() {
    return Date.now() + '_' + Math.random().toString(36).substr(2,6);
  }
};

// ======= UTILS =======
function fmtMoney(v) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d) {
  if (!d) return '—';
  const [y,m,day] = d.split('-');
  return `${day}/${m}/${y}`;
}
function todayStr() {
  return new Date().toISOString().split('T')[0];
}
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function isSameMonth(dateStr, monthStr) {
  return dateStr && dateStr.startsWith(monthStr);
}

// Auto-status for contas pagar
function resolveStatusPagar(c) {
  if (c.status === 'paga' || c.status === 'paga após vencimento') return c.status;
  if (c.dataVencimento && c.dataVencimento < todayStr()) return 'vencida';
  return 'pendente';
}

// Auto-status for contas receber
function resolveStatusReceber(c) {
  if (c.status === 'recebida' || c.status === 'recebida em atraso') return c.status;
  if (c.dataVencimento && c.dataVencimento < todayStr()) return 'atrasada';
  return 'pendente';
}

function statusBadgePagar(status) {
  const map = {
    'pendente': 'badge-yellow',
    'paga': 'badge-green',
    'paga após vencimento': 'badge-blue',
    'vencida': 'badge-red'
  };
  return `<span class="badge ${map[status]||'badge-gray'}">${status}</span>`;
}
function statusBadgeReceber(status) {
  const map = {
    'pendente': 'badge-yellow',
    'recebida': 'badge-green',
    'recebida em atraso': 'badge-blue',
    'atrasada': 'badge-red'
  };
  return `<span class="badge ${map[status]||'badge-gray'}">${status}</span>`;
}

function initSeedData() {
  if (!SV.get('categorias').length) {
    SV.set('categorias', [
      { id: SV.newId(), nome: 'Fornecedor', tipo: 'saida' },
      { id: SV.newId(), nome: 'Energia', tipo: 'saida' },
      { id: SV.newId(), nome: 'Aluguel', tipo: 'saida' },
      { id: SV.newId(), nome: 'Manutenção', tipo: 'saida' },
      { id: SV.newId(), nome: 'Impostos', tipo: 'saida' },
      { id: SV.newId(), nome: 'Folha de Pagamento', tipo: 'saida' },
      { id: SV.newId(), nome: 'Água', tipo: 'saida' },
      { id: SV.newId(), nome: 'Internet', tipo: 'saida' },
      { id: SV.newId(), nome: 'Vendas', tipo: 'entrada' },
      { id: SV.newId(), nome: 'Recebimento de Cliente', tipo: 'entrada' },
      { id: SV.newId(), nome: 'PIX', tipo: 'entrada' },
      { id: SV.newId(), nome: 'Cartão', tipo: 'entrada' },
      { id: SV.newId(), nome: 'Dinheiro', tipo: 'entrada' },
      { id: SV.newId(), nome: 'Outros Recebimentos', tipo: 'entrada' },
    ]);
  }
  // Seed some funcionarios if none
  if (!SV.get('funcionarios').length) {
    SV.set('funcionarios', [
      { id: SV.newId(), nome: 'Carlos Vieira', cargo: 'Operador de Caixa', salario: 1800, admissao: '2023-03-01', status: 'ativo' },
      { id: SV.newId(), nome: 'Ana Paula', cargo: 'Repositora', salario: 1600, admissao: '2023-06-15', status: 'ativo' },
      { id: SV.newId(), nome: 'João Santos', cargo: 'Supervisor', salario: 2400, admissao: '2022-01-10', status: 'ativo' },
    ]);
  }
  if (!SV.get('produtos').length) {
    SV.set('produtos', [
      { id: SV.newId(), nome: 'Arroz 5kg', categoria: 'Mercearia', estoque: 8, minimo: 12, unidade: 'un', comprar: false },
      { id: SV.newId(), nome: 'Feijao 1kg', categoria: 'Mercearia', estoque: 18, minimo: 10, unidade: 'un', comprar: false },
      { id: SV.newId(), nome: 'Acucar 2kg', categoria: 'Mercearia', estoque: 6, minimo: 10, unidade: 'un', comprar: false },
      { id: SV.newId(), nome: 'Cafe 500g', categoria: 'Mercearia', estoque: 5, minimo: 8, unidade: 'un', comprar: false },
      { id: SV.newId(), nome: 'Oleo de Soja', categoria: 'Mercearia', estoque: 20, minimo: 12, unidade: 'un', comprar: false },
      { id: SV.newId(), nome: 'Macarrao', categoria: 'Mercearia', estoque: 9, minimo: 15, unidade: 'un', comprar: false },
      { id: SV.newId(), nome: 'Leite 1L', categoria: 'Laticinios', estoque: 22, minimo: 20, unidade: 'un', comprar: false },
      { id: SV.newId(), nome: 'Manteiga', categoria: 'Laticinios', estoque: 4, minimo: 8, unidade: 'un', comprar: false },
      { id: SV.newId(), nome: 'Queijo Mussarela', categoria: 'Frios', estoque: 3, minimo: 5, unidade: 'kg', comprar: false },
      { id: SV.newId(), nome: 'Presunto', categoria: 'Frios', estoque: 6, minimo: 5, unidade: 'kg', comprar: false },
      { id: SV.newId(), nome: 'Pao Frances', categoria: 'Padaria', estoque: 35, minimo: 30, unidade: 'un', comprar: false },
      { id: SV.newId(), nome: 'Refrigerante 2L', categoria: 'Bebidas', estoque: 10, minimo: 12, unidade: 'un', comprar: false },
      { id: SV.newId(), nome: 'Agua Mineral', categoria: 'Bebidas', estoque: 28, minimo: 20, unidade: 'un', comprar: false },
      { id: SV.newId(), nome: 'Detergente', categoria: 'Limpeza', estoque: 7, minimo: 10, unidade: 'un', comprar: false },
      { id: SV.newId(), nome: 'Sabao em Po', categoria: 'Limpeza', estoque: 11, minimo: 8, unidade: 'un', comprar: false },
      { id: SV.newId(), nome: 'Papel Higienico', categoria: 'Higiene', estoque: 4, minimo: 10, unidade: 'pct', comprar: false },
    ]);
  }
}
