const path = require('path');
const express = require('express');
const webhookRoutes = require('./webhookRoutes');
const { buscarPedido } = require('../services/pedidosStore');
const { criarLinkDownloadTemporario } = require('../services/ebookStorageService');

const router = express.Router();

const FORMATO_ID_REGEX = /^[A-Za-z0-9_-]{6,120}$/;

const MIME_TYPES = {
  '.json': 'application/json; charset=utf-8',
  '.zip': 'application/zip',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8'
};

function desativarCache(res) {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store'
  });
  res.removeHeader('ETag');
}

function resolverMetadadosArquivo() {
  const origemPath =
    process.env.SUPABASE_EBOOK_PATH ||
    process.env.EBOOK_DOWNLOAD_URL ||
    'ebook.pdf';

  const caminhoLimpo = String(origemPath).split('?')[0];

  const nomePadrao = path.basename(caminhoLimpo) || 'ebook.pdf';
  const nomeCustomizado = process.env.EBOOK_DOWNLOAD_FILENAME
    ? path.basename(String(process.env.EBOOK_DOWNLOAD_FILENAME).trim())
    : nomePadrao;

  const nomeSanitizado =
    nomeCustomizado.replace(/["\r\n]/g, '').trim() || 'ebook.pdf';

  const ext = path.extname(nomeSanitizado).toLowerCase();
  const contentType =
    MIME_TYPES[ext] ||
    process.env.EBOOK_CONTENT_TYPE ||
    'application/octet-stream';

  return {
    fileName: nomeSanitizado,
    contentType
  };
}

function normalizarRegistro(registroBanco, registroMemoria) {
  if (registroBanco) {
    return {
      status: registroBanco.status,
      orderId: registroBanco.order_id ?? registroBanco.orderId ?? null,
      approvedAt: registroBanco.approved_at ?? registroBanco.approvedAt ?? null
    };
  }

  if (registroMemoria) {
    return {
      status: registroMemoria.status,
      orderId: registroMemoria.orderId ?? null,
      approvedAt: registroMemoria.approvedAt ?? null
    };
  }

  return null;
}

async function obterPedidoValidado(id) {
  let registroBanco = null;
  try {
    registroBanco = await buscarPedido(id);
  } catch (dbErr) {
    console.error('[PAGAMENTOS] Erro ao consultar banco, usando fallback em memória:', dbErr);
  }

  const pedidosAprovados = webhookRoutes.pedidosAprovados;
  const registroMemoria = pedidosAprovados ? pedidosAprovados.get(id) : null;
  return normalizarRegistro(registroBanco, registroMemoria);
}

router.get('/validar/:id', async (req, res) => {
  desativarCache(res);

  const id = decodeURIComponent(String(req.params.id || '')).trim();

  if (!id || !FORMATO_ID_REGEX.test(id)) {
    return res.status(400).json({
      valid: false,
      approved: false,
      reason: 'ID de pagamento inválido.'
    });
  }

  try {
    const registro = await obterPedidoValidado(id);

    if (registro && registro.status === 'PAID') {
      const baseBackendUrl =
        process.env.BACKEND_URL?.trim().replace(/\/+$/, '') ||
        'https://ebook-backend-vzb6.onrender.com';

      const downloadUrl = `${baseBackendUrl}/api/payments/download/${encodeURIComponent(id)}`;

      return res.status(200).json({
        valid: true,
        approved: true,
        status: 'PAID',
        referenceId: id,
        orderId: registro.orderId,
        approvedAt: registro.approvedAt,
        downloadUrl
      });
    }

    return res.status(200).json({
      valid: true,
      approved: false,
      status: registro?.status || 'PENDING',
      referenceId: id,
      reason: 'Pagamento ainda não confirmado pelo webhook.'
    });
  } catch (err) {
    console.error('[VALIDAR PAGAMENTO] Erro inesperado:', err);
    return res.status(500).json({
      valid: false,
      approved: false,
      reason: 'Erro interno ao validar pagamento.'
    });
  }
});

router.get('/download/:id', async (req, res) => {
  desativarCache(res);

  const id = decodeURIComponent(String(req.params.id || '')).trim();

  if (!id || !FORMATO_ID_REGEX.test(id)) {
    return res.status(400).json({
      ok: false,
      reason: 'ID de pagamento inválido.'
    });
  }

  try {
    const registro = await obterPedidoValidado(id);

    if (!registro || registro.status !== 'PAID') {
      return res.status(403).json({
        ok: false,
        approved: false,
        reason: 'Download disponível apenas após confirmação do pagamento.'
      });
    }

    const signedUrl = await criarLinkDownloadTemporario(120);
    if (!signedUrl) {
      return res.status(500).json({
        ok: false,
        reason: 'Arquivo não configurado no servidor.'
      });
    }

    const arquivoResp = await fetch(signedUrl);
    if (!arquivoResp.ok) {
      return res.status(502).json({
        ok: false,
        reason: 'Falha ao obter o arquivo do armazenamento.'
      });
    }

    const { fileName, contentType } = resolverMetadadosArquivo();
    const buffer = Buffer.from(await arquivoResp.arrayBuffer());

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Content-Length': buffer.length
    });

    return res.status(200).send(buffer);
  } catch (err) {
    console.error('[DOWNLOAD EBOOK] Erro ao liberar download:', err);
    return res.status(500).json({
      ok: false,
      reason: 'Erro interno ao gerar download.'
    });
  }
});

module.exports = router;