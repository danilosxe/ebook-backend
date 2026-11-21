function getBaseUrl() {
  const env = (process.env.PAGBANK_ENV || 'production').toLowerCase();
  return env === 'sandbox'
    ? 'https://sandbox.api.pagseguro.com'
    : 'https://api.pagseguro.com';
}

/**
 * Consulta o status de um pagamento/pedido na API do PagBank.
 * Ajuste o path do endpoint e a checagem de status conforme o tipo de ID
 * (ex.: pedido/order, cobrança/charge ou transação) usado no seu fluxo.
 */
async function consultarPagamento(identificador) {
  const token = process.env.PAGBANK_TOKEN;

  if (!token) {
    throw new Error('PAGBANK_TOKEN não configurado nas variáveis de ambiente.');
  }

  if (!identificador || typeof identificador !== 'string') {
    return { approved: false, reason: 'Identificador ausente.' };
  }

  const baseUrl = getBaseUrl();

  // Exemplo de endpoint REST do PagBank (confirme o recurso exato do seu identificador)
  const endpoint = `${baseUrl}/orders/${encodeURIComponent(identificador)}`;

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    return {
      approved: false,
      statusHttp: response.status,
      reason: 'Falha ao consultar pagamento no PagBank.'
    };
  }

  const data = await response.json();

  // Exemplo genérico: valide o status real retornado pelo PagBank para o recurso consultado
  // (ex.: status do pedido / cobrança como "PAID" / "AUTHORIZED", conforme o endpoint)
  const statusPedido = data.status || data.charges?.[0]?.status || '';
  const approved = ['PAID', 'AUTHORIZED', 'APPROVED'].includes(
    String(statusPedido).toUpperCase()
  );

  return {
    approved,
    status: statusPedido,
    raw: data
  };
}

module.exports = { consultarPagamento };