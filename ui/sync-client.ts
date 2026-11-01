import { type OrderedOp, receiveOps } from "./sync.ts";
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
    for (const o of read().share!.pending)
      if (!sent.has(o.oid)) {
        socket.send(JSON.stringify({ t: "push", ops: [o] }));
        sent.add(o.oid);
      }
  };
  const connect = () => {
    if (stopped) return;
    clearTimeout(timer);
    ready = false;
    status("オフライン");
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
            status(`同期エラー: ${m.error}`);
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
            status("接続中");
            flush();
          } else {
            const result = receiveOps(base, read(), m.ops);
            base = result[0];
            write(result[1]);
            flush();
          }
        } catch {
          ready = false;
          status("同期エラー");
        }
      };
      ws.onerror = () => ws.close();
      ws.onclose = () => {
        if (stopped || socket !== ws) return;
        ready = false;
        status("オフライン");
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
