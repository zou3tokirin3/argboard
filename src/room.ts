import type { Op, OrderedOp } from "../ui/sync.ts";
import { parseMessage, sequenceOps } from "./room-protocol.ts";

type Row = { seq: number; oid: string; body: string };
const decode = (r: Row): OrderedOp => ({ seq: r.seq, oid: r.oid, op: JSON.parse(r.body) as Op });
export class BoardRoom {
  private ctx: DurableObjectState;
  constructor(ctx: DurableObjectState) {
    this.ctx = ctx;
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS ops(seq INTEGER PRIMARY KEY AUTOINCREMENT, oid TEXT UNIQUE, body TEXT)",
    );
  }
  fetch(): Response {
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): void {
    try {
      const message = parseMessage(raw), sql = this.ctx.storage.sql;
      if (message.t === "hello") {
        // Bound outgoing frames too; the final empty frame marks catch-up complete.
        for (const r of sql.exec<Row>("SELECT * FROM ops WHERE seq > ? ORDER BY seq", message.since)) {
          this.send(ws, [decode(r)]);
        }
        this.send(ws, []);
        return;
      }
      const count = sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM ops").one().n;
      const ordered = sequenceOps(message.ops, count, oid => {
        const row = sql.exec<Row>("SELECT * FROM ops WHERE oid = ?", oid).toArray()[0];
        return row && decode(row);
      });
      this.ctx.storage.transactionSync(() => {
        for (const o of ordered) sql.exec(
          "INSERT OR IGNORE INTO ops(seq, oid, body) VALUES (?, ?, ?)", o.seq, o.oid, JSON.stringify(o.op),
        );
      });
      for (const peer of this.ctx.getWebSockets()) {
        for (const o of ordered) this.send(peer, [o]);
      }
    } catch (e) {
      try { ws.send(JSON.stringify({ t: "error", error: String(e) })); } catch { /* disconnected */ }
    }
  }
  private send(ws: WebSocket, ops: OrderedOp[]): void {
    try { ws.send(JSON.stringify({ t: "ops", ops })); }
    catch { ws.close(1011, "send failed"); }
  }
  webSocketClose(ws: WebSocket, code: number): void { ws.close(code); }
}
