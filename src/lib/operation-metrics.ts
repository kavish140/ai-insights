import type { Operation } from "./admin-operations";
export function operationMetrics(operations: Operation[], days: number, now = Date.now()) {
  const calls = operations.filter((call) => Date.parse(call.created_at) >= now - days * 86400000);
  const durations = calls.map((call) => call.duration_ms).sort((a, b) => a - b);
  const successful = calls.filter((call) => call.outcome === "success").length;
  const tools = [...new Set(calls.map((call) => call.tool))].sort().map((tool) => {
    const subset = calls.filter((call) => call.tool === tool);
    return {
      tool,
      calls: subset.length,
      failed: subset.filter((call) => call.outcome === "failed").length,
      mean: Math.round(subset.reduce((sum, call) => sum + call.duration_ms, 0) / subset.length),
    };
  });
  return {
    calls: calls.length,
    failed: calls.length - successful,
    successRate: calls.length ? Math.round((successful / calls.length) * 100) : null,
    mean: calls.length
      ? Math.round(durations.reduce((sum, value) => sum + value, 0) / calls.length)
      : null,
    p95: durations.length ? durations[Math.ceil(durations.length * 0.95) - 1] : null,
    tools,
    last:
      [...calls].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.created_at ?? null,
  };
}
