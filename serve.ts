const root = new URL("./dist/", import.meta.url);
const port = Number(Deno.env.get("PORT") ?? "8000");

Deno.serve({ port }, async (request) => {
  const pathname = new URL(request.url).pathname;
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const fileUrl = new URL(relativePath, root);

  try {
    const file = await Deno.readFile(fileUrl);
    const extension = relativePath.split(".").pop();
    const contentType = extension === "html"
      ? "text/html; charset=utf-8"
      : extension === "css"
      ? "text/css; charset=utf-8"
      : "text/javascript; charset=utf-8";
    return new Response(file, { headers: { "content-type": contentType } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
});
