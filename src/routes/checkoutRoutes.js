const express = require('express');
const { criarCheckoutPagBank } = require('../services/pagbankCheckoutService');
const { criarPedidoPixDireto } = require('../services/pagbankPixService');

const router = express.Router();

// Opção 1: Checkout hospedado (Pix + Cartão)
router.post('/', async (req, res) => {
  try {
    const { nome, email, cpf } = req.body || {};

    if (!nome || !email || !cpf) {
      return res.status(400).json({
        ok: false,
        error: 'Nome, e-mail e CPF são obrigatórios.'
      });
    }

    const resultado = await criarCheckoutPagBank({ nome, email, cpf });

    return res.status(200).json({
      ok: true,
      referenceId: resultado.referenceId,
      checkoutId: resultado.checkoutId,
      paymentUrl: resultado.paymentUrl
    });
  } catch (err) {
    console.error('[CHECKOUT] Erro:', err.detalhes || err);
    return res.status(err.statusHttp || 500).json({
      ok: false,
      error: err.message || 'Erro ao iniciar checkout.',
      detalhes: err.detalhes || null
    });
  }
});

// Opção 2: Pix direto (QR Code + Copia e Cola na própria página)
router.post('/pix', async (req, res) => {
  try {
    const { nome, email, cpf } = req.body || {};

    if (!nome || !email || !cpf) {
      return res.status(400).json({
        ok: false,
        error: 'Nome, e-mail e CPF são obrigatórios.'
      });
    }

    const pix = await criarPedidoPixDireto({ nome, email, cpf });

    return res.status(200).json({
      ok: true,
      referenceId: pix.referenceId,
      orderId: pix.orderId,
      qrCodeText: pix.qrCodeText,
      qrCodeImageUrl: pix.qrCodeImageUrl,
      expirationDate: pix.expirationDate
    });
  } catch (err) {
    console.error('[CHECKOUT PIX] Erro:', err.detalhes || err);
    return res.status(err.statusHttp || 500).json({
      ok: false,
      error: err.message || 'Erro ao gerar Pix.',
      detalhes: err.detalhes || null
    });
  }
});

module.exports = router;