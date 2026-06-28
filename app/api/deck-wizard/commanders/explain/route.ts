import { NextRequest, NextResponse } from 'next/server';
import { nimChat, stripThinkTags } from '@/lib/nvidia-nim';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { commander = '', format = 'commander', oracleText = '' } = await req.json() as {
    commander?: string; format?: string; oracleText?: string;
  };

  if (!commander) return NextResponse.json({ explanation: null });
  if (!process.env.GOOGLE_API_KEY) {
    console.error('[commanders/explain] GOOGLE_API_KEY is not set');
    return NextResponse.json({ explanation: null });
  }

  const prompt = `You are a Magic: The Gathering expert explaining a commander to a player considering it for their deck.

Commander: "${commander}"
Format: ${format}
ACTUAL CARD TEXT (use ONLY this — do not invent or infer abilities not listed here):
"""
${oracleText || '(oracle text not available — describe only what you know for certain about this card)'}
"""

Write 2–3 sentences (no headers, no bullet points — just prose) that explain:
1. What this commander ACTUALLY does based on the card text above
2. Why it's exciting or powerful as a commander
3. The general play pattern — what does a game with this commander look and feel like?

CRITICAL: Base your description STRICTLY on the card text provided. Do not invent abilities not listed there.

Be conversational and enthusiastic. Don't start with the commander's name.

Return ONLY valid JSON:
{ "explanation": "Two or three sentences here." }`;

  try {
    const raw = await nimChat(prompt, 0.8);
    if (!raw) return NextResponse.json({ explanation: null });
    const clean = stripThinkTags(raw);
    // Extract JSON if present, otherwise use prose directly
    const jsonMatch = clean.match(/\{[\s\S]*"explanation"\s*:\s*"([\s\S]*?)"\s*\}/);
    const explanation = jsonMatch
      ? jsonMatch[1].replace(/\\n/g, ' ').trim()
      : clean.replace(/^["']|["']$/g, '').trim();
    return NextResponse.json({ explanation: explanation || null });
  } catch (e) {
    console.error('[commanders/explain] threw:', e);
    return NextResponse.json({ explanation: null });
  }
}
