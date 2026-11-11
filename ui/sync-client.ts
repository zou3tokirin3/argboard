import { t } from "../src/i18n/index.ts";
import { type OrderedOp, receiveOps, type SyncOp } from "./sync.ts";
import type { Project } from "./types.ts";

/** One active project; switching closes the socket and cancels reconnects. */
export function connectRoom(
  read: () => Project,
  write: (p: Project) => void,
  status: (s: string) => void,
) {
  let socket: WebSocket | undefined,
    timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false,
    ready = false,
    delay = 500;
  let base = read(),
    replay = base.share!.pending.length > 0;
  let catchup: OrderedOp[] = [],
    sent = new Set<string>();
  const flush = () => {
    if (!ready || socket?.readyState !== WebSocket.OPEN) return;
    const pending = read().share!.pending.filter((o) => !sent.has(o.oid));
    let ops: SyncOp[] = [];
    // Keep the existing server input byte limit as well as the operation limit.
    const overhead = JSON.stringify({ t: "push", ops: [] }).length;
    let bytes = overhead;
    const send = () => {
      socket!.send(JSON.stringify({ t: "push", ops }));
      for (const o of ops) sent.add(o.oid);
      ops = [];
      bytes = overhead;
    };
    for (const o of pending) {
      const size = new TextEncoder().encode(JSON.stringify(o)).length;
      if (ops.length && (ops.length === 500 || bytes + size + 1 > 256 * 1024))
        send();
      bytes += size + (ops.length ? 1 : 0);
      ops.push(o);
    }
    if (ops.length) send();
  };
  const connect = () => {
    if (stopped) return;
    clearTimeout(timer);
    ready = false;
    status(t("sync.status.offline"));
    if (navigator.onLine === false) return;
    sent = new Set();
    catchup = [];
    try {
      const url = new URL(`/api/rooms/${read().share!.room}`, location.origin);
      url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(url);
      socket = ws;
      ws.onopen = () => {
        if (!stopped && socket === ws)
          ws.send(JSON.stringify({ t: "hello", since: read().share!.seq }));
      };
      let rebuilding = false;
      ws.onmessage = (event) => {
        if (stopped || socket !== ws) return;
        try {
          const m = JSON.parse(event.data);
          if (m.t === "error") {
            ready = false;
            status(t("sync.status.errorDetail", { error: m.error }));
            return;
          }
          if (m.t !== "ops" || !Array.isArray(m.ops)) return;
          if (replay && !rebuilding) {
            if (m.ops.length) return;
            rebuilding = true;
            ws.send(JSON.stringify({ t: "hello", since: 0 }));
            return;
          }
          if (!ready) {
            catchup.push(...m.ops);
            if (m.ops.length) return;
            let local = read();
            if (rebuilding) {
              base = {
                ...local,
                name: "",
                cards: [],
                links: [],
                boards: local.boards.map((b) => ({
                  ...b,
                  cardIds: [],
                  positions: {},
                })),
              };
              local = { ...local, share: { ...local.share!, seq: 0 } };
            }
            [base, local] = receiveOps(base, local, catchup);
            write(local);
            replay = false;
            catchup = [];
            ready = true;
            delay = 500;
            status(t("sync.status.connected"));
            flush();
          } else {
            const result = receiveOps(base, read(), m.ops);
            base = result[0];
            write(result[1]);
            flush();
          }
        } catch {
          ready = false;
          status(t("sync.status.error"));
        }
      };
      ws.onerror = () => ws.close();
      ws.onclose = () => {
        if (stopped || socket !== ws) return;
        ready = false;
        status(t("sync.status.offline"));
        timer = setTimeout(connect, delay);
        delay = Math.min(delay * 2, 30000);
      };
    } catch {
      timer = setTimeout(connect, delay);
      delay = Math.min(delay * 2, 30000);
    }
  };
  const online = () => {
    if (!ready) {
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      connect();
    }
  };
  globalThis.addEventListener("online", online);
  connect();
  return {
    flush,
    close() {
      stopped = true;
      clearTimeout(timer);
      globalThis.removeEventListener("online", online);
      socket?.close();
    },
  };
}
