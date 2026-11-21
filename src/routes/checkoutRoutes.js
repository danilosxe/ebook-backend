const express = require('express');
const crypto = require('crypto');
const { criarCheckoutEbook } = require('../services/pagbankCheckoutService');

const router = express.Router();

// Em produção, salve o pedido (referenceId) em banco para vincular ao webhook/entrega
const pedidosCriados = new Map();

router.post('/', async (req, res) => {
  try {
    const redirectUrl = process.env.REDIRECT_URL;
    const notificationUrl = process.env.NOTIFICATION_URL;

    if (!redirectUrl || !notificationUrl) {
      return res.status(500).json({
        ok: false,
        reason: 'REDIRECT_URL ou NOTIFICATION_URL não configurados no servidor.'
      });
    }

    // Você pode fixar preço e título aqui no back-end para ninguém alterar o valor no front-end
    const tituloEbook = process.env.EBOOK_TITLE || 'Meu E-book Digital';
    const precoCentavos = Number(process.env.EBOOK_PRICE_CENTS || 2990); // R$ 29,90

    const referenceId = `EBOOK-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    const resultado = await criarCheckoutEbook({
      title: tituloEbook,
      unitAmountCentavos: precoCentavos,
      referenceId,
      redirectUrl,
      notificationUrl
    });

    if (!resultado.ok) {
      return res.status(resultado.statusHttp || 400).json({
        ok: false,
        reason: 'Não foi possível criar o checkout no PagBank.',
        details: resultado.error
      });
    }

    pedidosCriados.set(referenceId, {
      checkoutId: resultado.checkoutId,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    });

    return res.status(200).json({
      ok: true,
      referenceId,
      checkoutUrl: resultado.checkoutUrl
    });
  } catch (err) {
    console.error('Erro na rota /api/checkout:', err);
    return res.status(500).json({
      ok: false,
      reason: 'Erro interno ao gerar o link de pagamento.'
    });
  }
});

module.exports = router;