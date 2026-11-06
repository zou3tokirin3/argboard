/** GitHub Pages serves static assets without the collaboration Worker. */
export function shouldShowShareButton(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host !== "github.io" && !host.endsWith(".github.io");
}
