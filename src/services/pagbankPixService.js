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

async function criarPedidoPixDireto({
  nome,
  email,
  cpf,
  valorCentavos = 1990,
  minutosExpiracao = 30
}) {
  const token = String(process.env.PAGBANK_TOKEN || '').trim();
  if (!token) {
    throw new Error('PAGBANK_TOKEN não configurado.');
  }

  const baseUrl = obterBaseUrlPagBank();
  const referenceId = gerarReferenceId();

  const backendUrl =
    process.env.BACKEND_URL?.trim().replace(/\/+$/, '') ||
    'https://ebook-backend-vzb6.onrender.com';

  const expiraEm = new Date(
    Date.now() + minutosExpiracao * 60 * 1000
  ).toISOString();

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
    qr_codes: [
      {
        amount: {
          value: Number(valorCentavos)
        },
        expiration_date: expiraEm
      }
    ],
    notification_urls: [
      `${backendUrl}/api/webhook/pagbank`
    ]
  };

  const response = await fetch(`${baseUrl}/orders`, {
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
    const erro = new Error('Falha ao gerar cobrança Pix no PagBank');
    erro.statusHttp = response.status;
    erro.detalhes = data;
    throw erro;
  }

  const qrCodeObj = Array.isArray(data.qr_codes) ? data.qr_codes[0] : null;
  const qrCodeImagem =
    Array.isArray(qrCodeObj?.links)
      ? qrCodeObj.links.find((l) => l.rel === 'QRCODE.PNG')?.href || null
      : null;

  return {
    referenceId,
    orderId: data.id, // Ex.: ORDE_...
    qrCodeText: qrCodeObj?.text || null, // Código Pix Copia e Cola
    qrCodeImageUrl: qrCodeImagem, // Link da imagem PNG do QR Code
    expirationDate: qrCodeObj?.expiration_date || expiraEm,
    raw: data
  };
}

module.exports = { criarPedidoPixDireto };