import { isDemoMode, chatWithClaude } from './demo-llm';

const BASE_URL = 'https://integrate.api.nvidia.com/v1';
const MODEL = 'meta/llama-3.3-70b-instruct';

interface NimResponse {
  choices?: Array<{ message: { content: string } }>;
  error?: { message: string };
}

export async function nimChat(prompt: string, temperature = 0.7): Promise<string | null> {
  if (isDemoMode()) return chatWithClaude(prompt, { temperature });
  const key = process.env.NVIDIA_API_KEY;
  if (!key) {
    console.error('[nvidia-nim] NVIDIA_API_KEY not set');
    return null;
  }
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: 2048,
      }),
    });
    if (!res.ok) {
      console.error('[nvidia-nim] HTTP', res.status);
      return null;
    }
    const data = await res.json() as NimResponse;
    if (data.error) {
      console.error('[nvidia-nim] error:', data.error.message);
      return null;
    }
    return data.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.error('[nvidia-nim] threw:', e);
    return null;
  }
}

// DeepSeek R1 wraps answers in <think>...</think> tags before the real response.
// Strip them so callers get clean output.
export function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

// Extract the first JSON object from a response that may contain prose around it.
export function extractJson(text: string): string {
  const clean = stripThinkTags(text);
  const match = clean.match(/\{[\s\S]*\}/);
  return match ? match[0] : clean;
}
