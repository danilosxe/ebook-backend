const crypto = require('crypto');

function obterBaseUrlPagBank() {
  return process.env.PAGBANK_ENV === 'production'
    ? 'https://api.pagseguro.com'
    : 'https://sandbox.api.pagseguro.com';
}

function gerarReferenceId() {
  const aleatorio = crypto.randomBytes(3).toString('hex');
  return `EBOOK-${Date.now()}-${aleatorio}`;
}

async function criarCheckoutPagBank({ nome, email, cpf, valorCentavos = 1990 }) {
  const token = String(process.env.PAGBANK_TOKEN || '').trim();
  if (!token) {
    throw new Error('PAGBANK_TOKEN não configurado.');
  }

  const baseUrl = obterBaseUrlPagBank();
  const referenceId = gerarReferenceId();

  const frontendUrl =
    process.env.FRONTEND_URL?.trim().replace(/\/+$/, '') ||
    'https://daniloesports.workers.dev';

  const backendUrl =
    process.env.BACKEND_URL?.trim().replace(/\/+$/, '') ||
    'https://ebook-backend-vzb6.onrender.com';

  const payload = {
    reference_id: referenceId,
    customer: {
      name: nome,
      email,
      tax_id: String(cpf || '').replace(/\D/g, '')
    },
    items: [
      {
        reference_id: 'EBOOK-01',
        name: 'E-book Digital',
        quantity: 1,
        unit_amount: Number(valorCentavos)
      }
    ],
    // Garante PIX ativo no checkout (pode deixar só PIX ou PIX + CREDIT_CARD)
    payment_methods: [
      { type: 'PIX' },
      { type: 'CREDIT_CARD' }
    ],
    redirect_url: `${frontendUrl}/obrigado?ref=${encodeURIComponent(referenceId)}`,
    notification_urls: [
      `${backendUrl}/api/webhook/pagbank`
    ]
  };

  const response = await fetch(`${baseUrl}/checkouts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const erro = new Error('Falha ao criar checkout no PagBank');
    erro.statusHttp = response.status;
    erro.detalhes = data;
    throw erro;
  }

  const linkPagamento =
    Array.isArray(data.links)
      ? data.links.find((l) => l.rel === 'PAY')?.href || null
      : null;

  return {
    referenceId,
    checkoutId: data.id,
    paymentUrl: linkPagamento,
    raw: data
  };
}

module.exports = { criarCheckoutPagBank };