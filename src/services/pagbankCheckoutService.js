function getBaseUrl() {
  const env = (process.env.PAGBANK_ENV || 'production').toLowerCase();
  return env === 'sandbox'
    ? 'https://sandbox.api.pagseguro.com'
    : 'https://api.pagseguro.com';
}

/**
 * Cria uma sessão de checkout no PagBank e retorna o link de pagamento
 * junto com o reference_id e o id do checkout.
 */
async function criarCheckoutEbook({ title, unitAmountCentavos, referenceId, redirectUrl, notificationUrl }) {
  const token = process.env.PAGBANK_TOKEN;

  if (!token) {
    throw new Error('PAGBANK_TOKEN não configurado nas variáveis de ambiente.');
  }

  const baseUrl = getBaseUrl();
  const endpoint = `${baseUrl}/checkouts`;

  const payload = {
    reference_id: referenceId,
    items: [
      {
        name: title,
        quantity: 1,
        unit_amount: unitAmountCentavos // Valor em centavos (ex.: R$ 29,90 -> 2990)
      }
    ],
    redirect_url: redirectUrl,
    notification_urls: [notificationUrl]
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      ok: false,
      statusHttp: response.status,
      error: data
    };
  }

  // No retorno de /checkouts, o link de pagamento costuma vir em data.links (ex.: rel === "PAY")
  const payLinkObj = Array.isArray(data.links)
    ? data.links.find((link) => String(link.rel).toUpperCase() === 'PAY') || data.links[0]
    : null;

  const checkoutUrl = payLinkObj?.href || null;

  if (!checkoutUrl) {
    return {
      ok: false,
      statusHttp: 502,
      error: { message: 'Link de pagamento não encontrado na resposta do PagBank.', raw: data }
    };
  }

  return {
    ok: true,
    checkoutId: data.id,
    referenceId,
    checkoutUrl,
    raw: data
  };
}

module.exports = { criarCheckoutEbook };