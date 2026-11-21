const express = require('express');

const router = express.Router();

// Armazena os pedidos aprovados em memória.
// Em ambiente gratuito do Render, reinícios limpam este Map; para produção persistente,
// troque por banco externo (ex.: Supabase/Postgres ou Redis).
const pedidosAprovados = new Map();

function getBaseUrl() {
  const env = (process.env.PAGBANK_ENV || 'production').toLowerCase();
  return env === 'sandbox'
    ? 'https://sandbox.api.pagseguro.com'
    : 'https://api.pagseguro.com';
}

function extrairStatusAprovado(payload) {
  if (!payload || typeof payload !== 'object') return false;

  const candidatos = [];

  if (payload.status) candidatos.push(payload.status);

  if (Array.isArray(payload.charges)) {
    for (const charge of payload.charges) {
      if (charge?.status) candidatos.push(charge.status);
      if (charge?.payment_response?.code) candidatos.push(charge.payment_response.code);
    }
  }

  return candidatos.some((st) =>
    ['PAID', 'AUTHORIZED', 'APPROVED'].includes(String(st).toUpperCase())
  );
}

async function confirmarStatusNoPagBank(payload) {
  const token = process.env.PAGBANK_TOKEN;
  const orderId = payload?.id;

  if (!token || !orderId || !String(orderId).startsWith('ORDE_')) {
    return extrairStatusAprovado(payload);
  }

  try {
    const endpoint = `${getBaseUrl()}/orders/${encodeURIComponent(orderId)}`;
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      return extrairStatusAprovado(payload);
    }

    const dadosAtualizados = await response.json();
    return extrairStatusAprovado(dadosAtualizados);
  } catch (err) {
    console.error('[WEBHOOK PAGBANK] Falha ao consultar pedido na API:', err);
    return extrairStatusAprovado(payload);
  }
}

router.post('/pagbank', async (req, res) => {
  try {
    const body = req.body || {};
    const referenceId =
      body.reference_id ||
      body.charges?.[0]?.reference_id ||
      body.id ||
      null;

    const aprovado = await confirmarStatusNoPagBank(body);

    if (referenceId && aprovado) {
      const chave = String(referenceId).trim();
      pedidosAprovados.set(chave, {
        status: 'PAID',
        referenceId: chave,
        orderId: body.id || null,
        approvedAt: new Date().toISOString()
      });

      console.log(`[WEBHOOK PAGBANK] Pedido aprovado e liberado: ${chave}`);
    } else {
      console.log('[WEBHOOK PAGBANK] Notificação recebida sem aprovação:', {
        referenceId,
        status: body.status || body.charges?.[0]?.status || 'DESCONHECIDO'
      });
    }

    // Responde 200 para evitar reenvios repetidos por timeout
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[WEBHOOK PAGBANK] Erro ao processar webhook:', err);
    return res.status(200).json({ received: true });
  }
});

module.exports = router;
module.exports.pedidosAprovados = pedidosAprovados;