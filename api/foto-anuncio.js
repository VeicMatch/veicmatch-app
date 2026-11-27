const fontes = new Map([
  ['betiolo.com.br', /^\/estoque\/(?:novos|seminovos)\/[a-z0-9-]+-\d+\/?$/i],
  ['betioloseminovos.com.br', /^\/estoque\/(?:novos|seminovos)\/[a-z0-9-]+-\d+\/?$/i],
  ['drsulseminovos.com.br', /^\/estoque\/[a-z0-9-]+-\d+\/?$/i],
  ['seminovoscarburgo.com.br', /^\/[a-z0-9-]+-id-\d+\/?$/i]
]);

function lerTag(tag) {
  return Object.fromEntries(Array.from(
    tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g),
    ([, nome, aspasDuplas, aspasSimples]) => [nome.toLowerCase(), (aspasDuplas ?? aspasSimples).replace(/&amp;/g, '&')]
  ));
}

function extrairFotos(html, anuncio) {
  const fotos = [];
  const carburgo = anuncio.hostname.replace(/^www\./, '') === 'seminovoscarburgo.com.br';
  const id = anuncio.pathname.match(/-(\d+)\/?$/)?.[1];
  for (const tag of html.match(/<(?:meta|img)\s[^>]+>/gi) ?? []) {
    const attrs = lerTag(tag);
    if (carburgo) {
      if (attrs.class?.split(/\s+/).includes('detail-gallery-img')) fotos.push(attrs.src);
    } else {
      if (['og:image', 'og:image:secure_url', 'twitter:image'].includes(attrs.property ?? attrs.name)) {
        fotos.push(attrs.content);
      }
      if (attrs['data-src']) fotos.push(attrs['data-src']);
    }
  }
  return [...new Set(fotos.flatMap(foto => {
    if (!foto) return [];
    try {
      const url = new URL(foto, anuncio);
      const img = url.pathname;
      if (url.protocol !== 'https:' || url.username || url.password || url.port ||
          !/\.(?:jpe?g|webp|png|avif)$/i.test(img)) return [];
      const daUnidade = carburgo
        ? url.hostname.replace(/^www\./, '') === 'seminovoscarburgo.com.br' &&
          /^\/upload\/service\/import-[a-f0-9]+\./i.test(img)
        : url.hostname === 's3.agsistema.net' && img.includes('/vehicles/' + id + '/photos/');
      return daUnidade ? [url.href] : [];
    } catch {
      return [];
    }
  }))].slice(0, 3);
}

module.exports = async function fotoAnuncio(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ fotos: [] });
  if (typeof req.query.anuncio !== 'string' || req.query.anuncio.length > 350) {
    return res.status(400).json({ fotos: [] });
  }
  let anuncio;
  try {
    anuncio = new URL(req.query.anuncio);
  } catch {
    return res.status(400).json({ fotos: [] });
  }
  const caminho = fontes.get(anuncio.hostname.replace(/^www\./, ''));
  if (anuncio.protocol !== 'https:' || anuncio.username || anuncio.password || anuncio.port ||
      !caminho?.test(anuncio.pathname)) return res.status(400).json({ fotos: [] });

  anuncio.search = anuncio.hash = '';
  try {
    const pagina = await fetch(anuncio, {
      redirect: 'manual',
      signal: AbortSignal.timeout(4500),
      headers: { Accept: 'text/html' }
    });
    const fotos = pagina.ok && /^text\/html/i.test(pagina.headers.get('content-type') ?? '')
      ? extrairFotos(await pagina.text(), anuncio)
      : [];
    res.setHeader('Cache-Control', fotos.length ? 'public, s-maxage=3600' : 'public, s-maxage=300');
    return res.status(200).json({ fotos });
  } catch {
    return res.status(200).json({ fotos: [] });
  }
};
