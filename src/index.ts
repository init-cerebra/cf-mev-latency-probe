import { connect } from "cloudflare:sockets";

export default {
  async fetch(request: Request): Promise<Response> {
    const results: Record<string, any> = {};
    const cf = (request as any).cf || {};

    // Test 1: HTTP RPC до секвенсора (3.134.203.4)
    const t1 = performance.now();
    try {
      const resp = await fetch("https://arb1-sequencer.arbitrum.io/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
      });
      await resp.text();
      results.sequencer_http_ms = Math.round((performance.now() - t1) * 100) / 100;
    } catch (e: any) {
      results.sequencer_http_error = e.message;
    }

    // Test 2: TCP connect до секвенсора (raw, без HTTP overhead)
    const t2 = performance.now();
    try {
      const socket = connect({ hostname: "3.134.203.4", port: 443 });
      await socket.opened;
      results.sequencer_tcp_443_ms = Math.round((performance.now() - t2) * 100) / 100;
      socket.close();
    } catch (e: any) {
      results.sequencer_tcp_443_error = e.message;
    }

    // Test 3: TCP до порту 8545 (якщо відкритий)
    const t3 = performance.now();
    try {
      const socket = connect({ hostname: "3.134.203.4", port: 8545 });
      await socket.opened;
      results.sequencer_tcp_8545_ms = Math.round((performance.now() - t3) * 100) / 100;
      socket.close();
    } catch (e: any) {
      results.sequencer_tcp_8545_error = e.message;
    }

    // Test 4: HTTP до загального RPC (anycast через CF)
    const t4 = performance.now();
    try {
      const resp = await fetch("https://arb1.arbitrum.io/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 2 }),
      });
      await resp.text();
      results.arb_rpc_anycast_ms = Math.round((performance.now() - t4) * 100) / 100;
    } catch (e: any) {
      results.arb_rpc_error = e.message;
    }

    // Placement info
    const placementHeader = request.headers.get("cf-placement") || "not-set";

    return Response.json({
      timestamp: new Date().toISOString(),
      placement_header: placementHeader,
      worker_colo: cf.colo || "unknown",
      worker_city: cf.city || "unknown",
      worker_region: cf.region || "unknown",
      latency: results,
      sequencer_ip: "3.134.203.4",
      sequencer_location: "Columbus, Ohio (AWS us-east-1)",
    }, { headers: { "Access-Control-Allow-Origin": "*" } });
  }
};
