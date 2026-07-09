// Primary: Claude Haiku (Anthropic). Fallback: Groq (llama).

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MAX_CHARS = 12000;

async function claudeChat(prompt: string, temperature: number, system?: string, maxTokens = 2048): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const body: Record<string, unknown> = {
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: 'user', content: prompt }],
    };
    if (system) body.system = system;

    const res = await fetch(CLAUDE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error('[claude] HTTP', res.status, err.slice(0, 200));
      return null;
    }
    const data = await res.json() as { content?: Array<{ type: string; text: string }>; stop_reason?: string; usage?: { input_tokens: number; output_tokens: number } };
    if (data.stop_reason && data.stop_reason !== 'end_turn') {
      console.warn(`[claude] stop_reason=${data.stop_reason} tokens=${JSON.stringify(data.usage)}`);
    }
    return data.content?.find(b => b.type === 'text')?.text ?? null;
  } catch (e) {
    console.error('[claude] threw:', e);
    return null;
  }
}

async function groqChat(prompt: string, temperature: number, system?: string, maxTokens = 2048): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  try {
    const truncatedSystem = system && system.length > GROQ_MAX_CHARS
      ? system.slice(0, GROQ_MAX_CHARS) + '\n\n[context truncated]'
      : system;
    const messages = [];
    if (truncatedSystem) messages.push({ role: 'system', content: truncatedSystem });
    messages.push({ role: 'user', content: prompt });
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: GROQ_MODEL, messages, temperature, max_tokens: maxTokens }),
    });
    if (!res.ok) {
      console.error('[groq] HTTP', res.status);
      return null;
    }
    const data = await res.json() as { choices?: Array<{ message: { content: string } }> };
    return data.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.error('[groq] threw:', e);
    return null;
  }
}

// geminiChat is now Claude-primary with Groq fallback.
// The name is kept for compatibility with all existing callers.
export async function geminiChat(
  prompt: string,
  temperature = 0.7,
  system?: string,
  maxTokens = 2048
): Promise<string | null> {
  const result = await claudeChat(prompt, temperature, system, maxTokens);
  if (result) return result;

  console.warn('[claude] failed — falling back to Groq');
  return groqChat(prompt, temperature, system, maxTokens);
}

// Extract JSON from a response — strips markdown fences and finds first object or array.
export function extractJson(text: string): string {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const obj = stripped.match(/\{[\s\S]*\}/);
  if (obj) return obj[0];
  const arr = stripped.match(/\[[\s\S]*\]/);
  if (arr) return arr[0];
  return stripped;
}

export function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}
