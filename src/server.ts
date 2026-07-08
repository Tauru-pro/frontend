import { AngularAppEngine, createRequestHandler } from '@angular/ssr';

const angularApp = new AngularAppEngine({
  // Hosts allowed by Angular's SSR SSRF protection. `localhost` keeps local
  // `wrangler pages dev` / `ng serve` working; the pages.dev entries cover the
  // Cloudflare Pages production domain and its preview/branch subdomains. Add a
  // custom domain (and its `www.`) here once it's live.
  allowedHosts: ['localhost', 'frontend-72m.pages.dev', '*.frontend-72m.pages.dev'],
});

/**
 * This is a request handler used by the Angular CLI (dev-server and during build).
 */
export const reqHandler = createRequestHandler(async (req) => {
  const res = await angularApp.handle(req);

  return res ?? new Response('Page not found.', { status: 404 });
});

export default { fetch: reqHandler };
