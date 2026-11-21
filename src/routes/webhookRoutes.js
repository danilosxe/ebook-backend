const express = require('express');

const router = express.Router();

// Em memória apenas para testes locais/rápidos (na memória do Render zera ao reiniciar).
// Para produção definitiva, persista em banco externo (ex.: Supabase/Postgres ou Redis).
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

/**
 * Opcional/recomendado: consulta o recurso no PagBank para confirmar autenticidade
 * quando houver um ID de pedido/cobrança (ex.: ORDE_... ou CHAR_...).
 */
async function confirmarNoPagBank(payload) {
  const token = process.env.PAGBANK_TOKEN;
  const orderId = payload?.id;

  if (!token || !orderId || !String(orderId).startsWith('ORDE_')) {
    return extrairStatusAprovado(payload);
  }

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
}

router.post('/pagbank', async (req, res) => {
  try {
    const body = req.body || {};
    const referenceId =
      body.reference_id ||
      body.charges?.[0]?.reference_id ||
      null;

    const aprovado = await confirmarNoPagBank(body);

    if (referenceId && aprovado) {
      pedidosAprovados.set(referenceId, {
        status: 'PAID',
        orderId: body.id || null,
        approvedAt: new Date().toISOString()
      });

      console.log(`[WEBHOOK PAGBANK] Pedido liberado: ${referenceId}`);
    } else {
      console.log('[WEBHOOK PAGBANK] Notificação recebida sem status PAID:', {
        referenceId,
        status: body.status || body.charges?.[0]?.status || 'DESCONHECIDO'
      });
    }

    // Sempre responda 200 para o PagBank considerar a notificação entregue
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[WEBHOOK PAGBANK] Erro ao processar notificação:', err);
    return res.status(200).json({ received: true });
  }
});

// Helper exportado caso você queira consultar o mapa em outra rota durante testes
router.pedidosAprovados = pedidosAprovados;

module.exports = router;