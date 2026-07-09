// Primary: Gemini Flash (Google). Fallback: Groq (llama).

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MAX_CHARS = 12000;

async function geminiChatInternal(prompt: string, temperature: number, system?: string, maxTokens = 2048): Promise<string | null> {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) return null;
  try {
    const contents: unknown[] = [];
    if (system) contents.push({ role: 'user', parts: [{ text: system }] }, { role: 'model', parts: [{ text: 'Understood.' }] });
    contents.push({ role: 'user', parts: [{ text: prompt }] });

    const res = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error('[gemini] HTTP', res.status, err.slice(0, 200));
      return null;
    }
    const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch (e) {
    console.error('[gemini] threw:', e);
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

export async function geminiChat(
  prompt: string,
  temperature = 0.7,
  system?: string,
  maxTokens = 2048
): Promise<string | null> {
  const result = await geminiChatInternal(prompt, temperature, system, maxTokens);
  if (result) return result;

  console.warn('[gemini] failed — falling back to Groq');
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
