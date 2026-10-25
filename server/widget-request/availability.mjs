export async function handleAvailability(request, deps) {
  const origin = request.headers.get("origin"),
    headers = {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      Vary: "Origin",
    };
  const reply = (status, data) => Response.json(data, { status, headers });
  if (origin !== deps.origin)
    return reply(403, { error: "origin_not_allowed" });
  headers["Access-Control-Allow-Origin"] = origin;
  if (request.method === "OPTIONS")
    return new Response(null, {
      status: 204,
      headers: {
        ...headers,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type",
      },
    });
  if (!deps.enabled) return reply(503, { error: "not_activated" });
  if (request.method !== "POST")
    return reply(405, { error: "method_not_allowed" });
  try {
    const ip = deps.clientIp(request);
    if (!ip) return reply(503, { error: "gateway_not_configured" });
    if (!(await deps.rateLimit(await deps.hash("availability:" + ip), 60, 60)))
      return reply(429, { error: "rate_limited" });
    // Bounded streaming read, before JSON parse.
    const reader = request.body?.getReader();
    if (!reader) return reply(400, { error: "invalid_payload" });
    let text = "",
      size = 0;
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 1024) {
          await reader.cancel();
          return reply(413, { error: "invalid_payload" });
        }
        text += decoder.decode(value, { stream: true });
      }
    } finally {
      reader.releaseLock();
    }
    const b = JSON.parse(text);
    if (
      !b ||
      !/^[a-f0-9]{32}$/.test(b.widgetId) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(b.start) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(b.end) ||
      Object.keys(b).some((k) => !["widgetId", "start", "end"].includes(k))
    )
      return reply(400, { error: "invalid_payload" });
    return reply(200, await deps.availability(b.widgetId, b.start, b.end));
  } catch (e) {
    if (e?.code === "22023") return reply(400, { error: "invalid_payload" });
    return reply(503, { error: "availability_unavailable" });
  }
}
