async function consultarPagamento(paymentId) {
  const accessToken = process.env.PAGBANK_TOKEN;

  if (!accessToken) {
    throw new Error('PAGBANK_TOKEN não configurado nas variáveis de ambiente.');
  }

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

module.exports = { consultarPagamento };