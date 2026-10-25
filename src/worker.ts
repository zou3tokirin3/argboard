interface Env {
  ASSETS: Fetcher;
}

const CORS = { "Access-Control-Allow-Origin": "*" };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/ogp") {
      return handleOgp(url.searchParams.get("url"));
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

async function handleOgp(target: string | null): Promise<Response> {
  if (!target) {
    return Response.json({ title: null }, { headers: CORS });
  }

  try {
    const res = await fetch(target, {
      headers: { "User-Agent": "ARGBoard/1.0 (+https://argboard.zou3tokirin3.workers.dev)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return Response.json({ title: null }, { headers: CORS });

    const html = await res.text();
    const title = parseOgTitle(html);
    return Response.json({ title }, { headers: CORS });
  } catch {
    return Response.json({ title: null }, { headers: CORS });
  }
}

function parseOgTitle(html: string): string | null {
  // og:title (property before content, or content before property)
  const m =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ??
    html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : null;
}
