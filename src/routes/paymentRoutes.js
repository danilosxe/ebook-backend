const express = require('express');
const path = require('path');
const { consultarPagamento } = require('../services/pagbankService');

const router = express.Router();

// Em produção, substitua este Set por um banco (ex.: Supabase/Postgres ou Upstash Redis)
const pagamentosUtilizados = new Set();

router.get('/validar/:paymentId', async (req, res) => {
  const { paymentId } = req.params;

  if (!/^\d+$/.test(paymentId)) {
    return res.status(400).json({ valid: false, reason: 'ID de pagamento inválido.' });
  }

  if (pagamentosUtilizados.has(paymentId)) {
    return res.status(409).json({ valid: false, reason: 'Pagamento já utilizado para resgate.' });
  }

  try {
    const pagamento = await consultarPagamento(paymentId);

    if (!pagamento || pagamento.status !== 'approved') {
      return res.status(402).json({ valid: false, reason: 'Pagamento não aprovado.' });
    }

    // Opcional: conferir valor mínimo do e-book (ex.: 29.90)
    // if (Number(pagamento.transaction_amount) < 29.9) { ... }

    pagamentosUtilizados.add(paymentId);

    return res.status(200).json({
      valid: true,
      downloadUrl: `/api/payments/download/${paymentId}`
    });
  } catch (err) {
    console.error('Erro ao validar pagamento:', err);
    return res.status(500).json({ valid: false, reason: 'Erro interno na validação.' });
  }
});

router.get('/download/:paymentId', (req, res) => {
  const { paymentId } = req.params;

  if (!pagamentosUtilizados.has(paymentId)) {
    return res.status(403).send('Acesso negado.');
  }

  const filePath = path.join(__dirname, '../../ebooks/meu-ebook.pdf');
  return res.download(filePath, 'ebook.pdf');
});

module.exports = router;