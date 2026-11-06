import { roomValid } from "./room-protocol.ts";

export { BoardRoom } from "./room.ts";

interface Env {
  ASSETS: Fetcher;
  ROOMS: DurableObjectNamespace;
}

const CORS = { "Access-Control-Allow-Origin": "*" };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/rooms/")) {
      const room = url.pathname.slice("/api/rooms/".length);
      if (!roomValid(room)) return new Response(null, { status: 400 });
      const origin = request.headers.get("Origin");
      if (origin !== null) {
        try {
          if (new URL(origin).host !== url.host)
            return new Response(null, { status: 403 });
        } catch {
          return new Response(null, { status: 403 });
        }
      }
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
        return new Response(null, { status: 426 });
      return env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(request);
    }

    if (url.pathname === "/api/ogp") {
      return handleOgp(url.searchParams.get("url"));
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

async function handleOgp(target: string | null): Promise<Response> {
  if (!target) {
    return Response.json({ title: null, image: null }, { headers: CORS });
  }

  try {
    const res = await fetch(target, {
      headers: {
        "User-Agent":
          "ARGBoard/1.0 (+https://argboard.zou3tokirin3.workers.dev)",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok)
      return Response.json({ title: null, image: null }, { headers: CORS });

    const html = await res.text();
    const title = parseMeta(html, "og:title") ?? parseTitle(html);
    const image = parseMeta(html, "og:image");
    return Response.json({ title, image }, { headers: CORS });
  } catch {
    return Response.json({ title: null, image: null }, { headers: CORS });
  }
}

function parseMeta(html: string, property: string): string | null {
  const m =
    html.match(
      new RegExp(
        `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
        "i",
      ),
    ) ??
    html.match(
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
        "i",
      ),
    );
  return m ? m[1].trim() : null;
}

function parseTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : null;
}
