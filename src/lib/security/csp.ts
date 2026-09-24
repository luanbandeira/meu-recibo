// Content Security Policy com nonce por requisição (docs do Next 16:
// guides/content-security-policy). O Next aplica o nonce sozinho aos próprios
// scripts ao ler este cabeçalho na requisição; por isso todas as páginas são
// dinâmicas (connection() no layout raiz).
//
// Escolhas:
// - script-src com nonce + 'strict-dynamic': nenhum script externo ou injetado
//   roda. 'unsafe-eval' só em desenvolvimento (depuração do React).
// - style-src 'unsafe-inline': o editor (ProseMirror), o recorte de imagem e o
//   visualizador de PDF usam atributos style, que nonce não cobre. Estilo
//   injetado não executa código.
// - img/connect: além do próprio site, o Supabase (URLs assinadas das imagens
//   e o login feito no navegador).
// - worker: o pdf.js roda num worker servido pelo próprio site.
// - Sem upgrade-insecure-requests: o site já é só HTTPS (HSTS) e todos os
//   recursos são relativos ou https; a diretiva só atrapalharia testes locais.

export function buildCsp({ nonce, isDev, supabaseUrl }: { nonce: string; isDev: boolean; supabaseUrl: string }): string {
  const supabase = new URL(supabaseUrl).origin;
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${supabase}`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabase}${isDev ? " ws: wss:" : ""}`,
    "worker-src 'self' blob:",
    "frame-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  return directives.join("; ");
}

/** Nonce imprevisível, novo a cada requisição (16 bytes, base64). */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
