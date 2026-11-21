function getHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=representation'
  };
}

function getBaseUrl() {
  return String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
}

async function salvarPedidoAprovado({ referenceId, orderId = null, approvedAt = new Date().toISOString() }) {
  const baseUrl = getBaseUrl();
  if (!baseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  const url = `${baseUrl}/rest/v1/pedidos_ebook?on_conflict=reference_id`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify([
      {
        reference_id: referenceId,
        order_id: orderId,
        status: 'PAID',
        approved_at: approvedAt,
        updated_at: new Date().toISOString()
      }
    ])
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Falha ao salvar pedido no Supabase: ${resp.status} ${errText}`);
  }
}

async function buscarPedido(referenceId) {
  const baseUrl = getBaseUrl();
  if (!baseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  const url = `${baseUrl}/rest/v1/pedidos_ebook?reference_id=eq.${encodeURIComponent(referenceId)}&select=*&limit=1`;
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Falha ao buscar pedido no Supabase: ${resp.status} ${errText}`);
  }

  const rows = await resp.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

module.exports = {
  salvarPedidoAprovado,
  buscarPedido
};