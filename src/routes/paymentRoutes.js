const express = require('express');
const webhookRoutes = require('./webhookRoutes');

const router = express.Router();

const FORMATO_ID_REGEX = /^[A-Za-z0-9_-]{6,120}$/;

function desativarCache(res) {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store'
  });
  res.removeHeader('ETag');
}

router.get('/validar/:id', (req, res) => {
  desativarCache(res);

  const id = decodeURIComponent(String(req.params.id || '')).trim();

  if (!id || !FORMATO_ID_REGEX.test(id)) {
    return res.status(400).json({
      valid: false,
      approved: false,
      reason: 'ID de pagamento inválido.'
    });
  }

  const pedidosAprovados = webhookRoutes.pedidosAprovados;
  const registro = pedidosAprovados ? pedidosAprovados.get(id) : null;

  if (registro && registro.status === 'PAID') {
    const downloadUrl = process.env.EBOOK_DOWNLOAD_URL || null;

    return res.status(200).json({
      valid: true,
      approved: true,
      status: 'PAID',
      referenceId: id,
      orderId: registro.orderId || null,
      approvedAt: registro.approvedAt || null,
      downloadUrl
    });
  }

  return res.status(200).json({
    valid: true,
    approved: false,
    status: 'PENDING',
    referenceId: id,
    reason: 'Pagamento ainda não confirmado pelo webhook.'
  });
});

module.exports = router;