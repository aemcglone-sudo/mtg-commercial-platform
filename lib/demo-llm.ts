// Demo mode: routes all LLM calls through Claude Sonnet when DEMO_MODE=true.
// Set DEMO_MODE=true on Fly before a demo, unset after.

const CLAUDE_MODEL = 'claude-sonnet-5';

interface AnthropicResponse {
  content?: Array<{ type: string; text: string }>;
  error?: { type: string; message: string };
}

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === 'true';
}

export async function chatWithClaude(
  prompt: string,
  options: { system?: string; maxTokens?: number; temperature?: number } = {}
): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error('[demo-llm] ANTHROPIC_API_KEY not set');
    return null;
  }

  const body: Record<string, unknown> = {
    model: CLAUDE_MODEL,
    max_tokens: options.maxTokens ?? 2048,
    messages: [{ role: 'user', content: prompt }],
  };
  if (options.system) body.system = options.system;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[demo-llm] Claude HTTP', res.status, err.slice(0, 200));
      return null;
    }

    const data = await res.json() as AnthropicResponse;
    if (data.error) {
      console.error('[demo-llm] Claude error:', data.error.message);
      return null;
    }

    const raw = data.content?.find(b => b.type === 'text')?.text ?? null;
    if (!raw) return null;
    // Strip markdown code fences if present (e.g. ```json ... ```)
    const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
    return stripped;
  } catch (e) {
    console.error('[demo-llm] threw:', e);
    return null;
  }
}
