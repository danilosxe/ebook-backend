async function criarLinkDownloadTemporario(expiresInSeconds = 120) {
  const baseUrl = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_EBOOK_BUCKET || 'ebooks-privados';
  const filePath = process.env.SUPABASE_EBOOK_PATH || 'meu-ebook.pdf';

  if (!baseUrl || !serviceKey) {
    // Fallback caso você use apenas EBOOK_DOWNLOAD_URL no servidor
    return process.env.EBOOK_DOWNLOAD_URL || null;
  }

  const encodedPath = filePath
    .split('/')
    .map(encodeURIComponent)
    .join('/');

  const endpoint = `${baseUrl}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodedPath}`;

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ expiresIn: expiresInSeconds })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Falha ao gerar URL assinada do PDF: ${resp.status} ${errText}`);
  }

  const data = await resp.json();
  // O Supabase retorna signedURL (relativo a /storage/v1) ou signedUrl
  const signedPath = data.signedURL || data.signedUrl;
  if (!signedPath) return null;

  return signedPath.startsWith('http')
    ? signedPath
    : `${baseUrl}/storage/v1${signedPath.startsWith('/') ? '' : '/'}${signedPath}`;
}

module.exports = { criarLinkDownloadTemporario };