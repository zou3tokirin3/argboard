const root = new URL("./dist/", import.meta.url);
const port = Number(Deno.env.get("PORT") ?? "8000");

function contentTypeFor(path: string): string {
  const extension = path.split(".").pop();
  if (extension === "html") return "text/html; charset=utf-8";
  if (extension === "css") return "text/css; charset=utf-8";
  if (extension === "js") return "text/javascript; charset=utf-8";
  if (extension === "json") return "application/manifest+json";
  if (extension === "png") return "image/png";
  return "application/octet-stream";
}

Deno.serve({ port }, async (request) => {
  const pathname = new URL(request.url).pathname;
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const fileUrl = new URL(relativePath, root);

  try {
    const file = await Deno.readFile(fileUrl);
    return new Response(file, {
      headers: { "content-type": contentTypeFor(relativePath) },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
});
