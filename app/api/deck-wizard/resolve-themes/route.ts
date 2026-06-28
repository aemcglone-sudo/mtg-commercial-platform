import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { nimChat, extractJson } from '@/lib/nvidia-nim';

export async function POST(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { themes, archetypes, tribalType, format, commander } = await req.json() as {
    themes: string[]; archetypes: string[]; tribalType?: string; format: string; commander?: string;
  };

  const isCommander = ['commander','brawl','oathbreaker'].includes(format);
  const deckSize = isCommander ? 100 : 60;

  const prompt = `You are a Magic: The Gathering deck building expert helping a player plan their deck.

Format: ${format} (${deckSize}-card ${isCommander ? 'singleton' : 'constructed'} deck)
${commander ? `Commander: ${commander}` : ''}
Selected archetypes: ${archetypes.join(', ') || 'none'}
Selected themes: ${themes.join(', ') || 'none'}
${tribalType ? `Tribal focus: ${tribalType}` : ''}

Analyze the selected themes and archetypes. Return ONLY valid JSON:
{
  "conflicts": [
    {"themes": ["Mill", "Aggro"], "message": "Mill and Aggro conflict — do you want Mill as your primary win condition or as a secondary threat?", "resolution": "ask_user"}
  ],
  "synergies": [
    {"themes": ["Tokens", "Aristocrats"], "message": "Tokens and Aristocrats work great together — more creatures to sacrifice for value."}
  ],
  "roleTargets": {
    "ramp": ${isCommander ? 10 : 4},
    "card_draw": ${isCommander ? 10 : 6},
    "removal": ${isCommander ? 7 : 10},
    "board_wipes": ${isCommander ? 3 : 0},
    "win_conditions": ${isCommander ? 5 : 6},
    "theme_pieces": ${isCommander ? 25 : 20},
    "lands": ${isCommander ? 36 : 22}
  },
  "resolvedThemes": ["${themes.join('", "')}"],
  "summary": "One sentence describing the deck strategy based on selected themes."
}

Adjust roleTargets based on the selected themes. A Ramp theme needs more ramp; a Control archetype needs more removal; etc.
Only list actual conflicts — most theme combinations are fine.`;

  try {
    const raw = await nimChat(prompt, 0.3);
    if (!raw) throw new Error('no response');
    const parsed = JSON.parse(extractJson(raw));
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({
      conflicts: [],
      synergies: [],
      roleTargets: {
        ramp: isCommander ? 10 : 4,
        card_draw: isCommander ? 10 : 6,
        removal: isCommander ? 7 : 10,
        board_wipes: isCommander ? 3 : 0,
        win_conditions: isCommander ? 5 : 6,
        theme_pieces: isCommander ? 25 : 20,
        lands: isCommander ? 36 : 22,
      },
      resolvedThemes: themes,
      summary: `A ${archetypes.join('/')} deck with ${themes.join(', ')} themes.`,
    });
  }
}
