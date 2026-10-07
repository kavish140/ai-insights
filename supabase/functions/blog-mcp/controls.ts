import type { SupabaseClient } from '@supabase/supabase-js';

export type McpControls = {
  paused: boolean; disabled_tools: string[]; calls_per_minute: number;
  max_image_bytes: number; allowed_formats: string[];
  require_cover: boolean; require_description: boolean;
};
export async function admit(database: SupabaseClient, tool: string): Promise<{ controls?: McpControls; error?: string }> {
  const { data, error } = await database.rpc('mcp_admit', { p_tool: tool }).abortSignal(AbortSignal.timeout(5000));
  if (error || !data) return { error: 'MCP controls are unavailable. Apply the Top admin migration before using tools.' };
  return data;
}
