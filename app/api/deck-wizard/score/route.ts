import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { geminiChat, extractJson } from '@/lib/gemini';

export const maxDuration = 60;

interface ScryfallCard {
  name: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  color_identity: string[];
  legalities?: Record<string, string>;
}

async function fetchScryfallData(names: string[]): Promise<Map<string, ScryfallCard>> {
  const result = new Map<string, ScryfallCard>();
  const CHUNK = 75;
  for (let i = 0; i < names.length; i += CHUNK) {
    const chunk = names.slice(i, i + CHUNK);
    try {
      const res = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Grimoire/1.0' },
        body: JSON.stringify({ identifiers: chunk.map(name => ({ name })) }),
      });
      if (!res.ok) continue;
      const data = await res.json() as { data: ScryfallCard[] };
      for (const card of data.data) {
        result.set(card.name.toLowerCase(), card);
        if (card.name.includes('//')) {
          result.set(card.name.split('//')[0].trim().toLowerCase(), card);
        }
      }
    } catch { /* best effort */ }
    if (i + CHUNK < names.length) await new Promise(r => setTimeout(r, 100));
  }
  return result;
}

export interface CategoryScore {
  score: number;
  max: number;
  label: string;
  notes: string;
  pass?: boolean; // for validity (pass/fail only)
}

export interface DeckScore {
  validity: CategoryScore;
  manaBase: CategoryScore;
  deckStructure: CategoryScore;
  removal: CategoryScore;
  synergy: CategoryScore;
  cardAdvantage: CategoryScore;
  manaCurve: CategoryScore;
  formatCompliance: CategoryScore;
  powerLevel: { score: number; tier: string; notes: string };
  recommendations: Array<{ priority: 'CRITICAL' | 'MAJOR' | 'MODERATE' | 'NICE-TO-HAVE'; issue: string; action: string }>;
  totalScore: number;
  maxScore: number;
  percentage: number;
  grade: string;
}

const BASIC_LANDS = new Set(['Plains','Island','Swamp','Mountain','Forest','Wastes',
  'Snow-Covered Plains','Snow-Covered Island','Snow-Covered Swamp','Snow-Covered Mountain','Snow-Covered Forest']);

function grade(pct: number): string {
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  return 'F';
}

export async function scoreDeck(params: {
  cards: Record<string, number>;
  commander?: string;
  commanderColorIdentity?: string[];
  format: string;
  archetype?: string;
  themes?: string[];
  tribalType?: string;
}): Promise<DeckScore | null> {
  const { cards, commander, commanderColorIdentity, format, archetype, themes, tribalType } = params;

  const cardEntries = Object.entries(cards);
  const totalCards = cardEntries.reduce((s, [, q]) => s + q, 0);
  const nonLandEntries = cardEntries.filter(([n]) => !BASIC_LANDS.has(n));
  const nonLandNames = nonLandEntries.map(([n]) => n);

  const scryfallData = await fetchScryfallData(nonLandNames);

  const cardListWithData = cardEntries.map(([name, qty]) => {
    const data = scryfallData.get(name.toLowerCase());
    if (data) {
      return `${qty}x ${name} | CMC:${data.cmc} | ${data.type_line} | Identity:${data.color_identity.join('') || 'C'}`;
    }
    return `${qty}x ${name} | (unverified)`;
  }).join('\n');

  const landCount = cardEntries.filter(([n]) => BASIC_LANDS.has(n) ||
    (scryfallData.get(n.toLowerCase())?.type_line ?? '').includes('Land'))
    .reduce((s, [, q]) => s + q, 0);

  const creatureCount = nonLandEntries.filter(([n]) =>
    (scryfallData.get(n.toLowerCase())?.type_line ?? '').includes('Creature'))
    .reduce((s, [, q]) => s + q, 0);

  const cmcValues: number[] = [];
  for (const [name, qty] of nonLandEntries) {
    const cmc = scryfallData.get(name.toLowerCase())?.cmc ?? 0;
    for (let i = 0; i < qty; i++) cmcValues.push(cmc);
  }
  const avgCmc = cmcValues.length ? (cmcValues.reduce((a, b) => a + b, 0) / cmcValues.length).toFixed(2) : '0';

  const prompt = buildScoringPrompt({ commander, commanderColorIdentity, format, archetype, themes, tribalType, totalCards, landCount, creatureCount, avgCmc, cardListWithData });

  try {
    const raw = await geminiChat(prompt, 0.2, undefined, 4096);
    if (!raw) return null;

    const parsed = JSON.parse(extractJson(raw)) as Omit<DeckScore, 'totalScore' | 'maxScore' | 'percentage' | 'grade'> & {
      validity: { pass: boolean; notes: string };
    };

    const scores = [
      parsed.manaBase?.score ?? 0,
      parsed.deckStructure?.score ?? 0,
      parsed.removal?.score ?? 0,
      parsed.synergy?.score ?? 0,
      parsed.cardAdvantage?.score ?? 0,
      parsed.manaCurve?.score ?? 0,
      parsed.formatCompliance?.score ?? 0,
    ];
    const totalScore = scores.reduce((a, b) => a + b, 0);
    const maxScore = 120;
    const percentage = Math.round((totalScore / maxScore) * 100);

    return {
      validity: { score: 0, max: 0, label: 'Validity', pass: parsed.validity?.pass ?? true, notes: parsed.validity?.notes ?? '' },
      manaBase: { score: parsed.manaBase?.score ?? 0, max: 25, label: 'Mana Base', notes: parsed.manaBase?.notes ?? '' },
      deckStructure: { score: parsed.deckStructure?.score ?? 0, max: 15, label: 'Deck Structure', notes: parsed.deckStructure?.notes ?? '' },
      removal: { score: parsed.removal?.score ?? 0, max: 20, label: 'Removal & Interaction', notes: parsed.removal?.notes ?? '' },
      synergy: { score: parsed.synergy?.score ?? 0, max: 25, label: 'Synergy & Commander Alignment', notes: parsed.synergy?.notes ?? '' },
      cardAdvantage: { score: parsed.cardAdvantage?.score ?? 0, max: 15, label: 'Card Advantage & Draw', notes: parsed.cardAdvantage?.notes ?? '' },
      manaCurve: { score: parsed.manaCurve?.score ?? 0, max: 10, label: 'Mana Curve', notes: parsed.manaCurve?.notes ?? '' },
      formatCompliance: { score: parsed.formatCompliance?.score ?? 0, max: 10, label: 'Format Compliance', notes: parsed.formatCompliance?.notes ?? '' },
      powerLevel: { score: parsed.powerLevel?.score ?? 5, tier: parsed.powerLevel?.tier ?? 'Casual', notes: parsed.powerLevel?.notes ?? '' },
      recommendations: parsed.recommendations ?? [],
      totalScore,
      maxScore,
      percentage,
      grade: grade(percentage),
    };
  } catch (e) {
    console.error('[deck-score]', e);
    return null;
  }
}

function buildScoringPrompt(p: {
  commander?: string; commanderColorIdentity?: string[]; format: string; archetype?: string;
  themes?: string[]; tribalType?: string; totalCards: number; landCount: number;
  creatureCount: number; avgCmc: string; cardListWithData: string;
}) {
  return `You are Khoa, evaluating a Magic: The Gathering ${p.format} deck against a standardized rubric. Use the verified card data below — it comes from Scryfall and is accurate.

DECK STATS (pre-computed from Scryfall data):
- Commander: ${p.commander ?? 'none'}
- Commander color identity: ${p.commanderColorIdentity?.join('') || 'C'}
- Total cards: ${p.totalCards} (target: 100)
- Land count: ${p.landCount}
- Creature count: ${p.creatureCount}
- Avg CMC (non-lands): ${p.avgCmc}
- Archetype: ${p.archetype ?? 'not specified'}
- Themes: ${p.themes?.join(', ') || 'none'}
- Tribal focus: ${p.tribalType ?? 'none'}

FULL CARD LIST (verified from Scryfall):
${p.cardListWithData}

Score this deck against the rubric below. Be strict and honest — a deck with no tribal synergy for a tribal commander should score poorly on synergy. A deck with 40 basic lands and no utility lands should score poorly on mana base.

RUBRIC:

CATEGORY 2 — MANA BASE (0-25 pts)
Score: land count (35-37=+1, <32 or >40=-1), color balance (balanced=+2, imbalanced=-3), mana rocks (8-10=+2, 6-7=+1, <6=-3), dual/utility lands (10+=+1), command tower presence (+1), early acceleration (+1), overall consistency (+1 or -1).

CATEGORY 3 — DECK SIZE & STRUCTURE (0-15 pts)
Score: card count (100=+1), category distribution (tutors 3-4=+2, draw 6-10=+2, ramp 8-12=+2, removal 8-12=+1, creatures 25-35=+1, lands 35-37=+1), synergy density (60-80%=+2, 40-60%=+1, <30%=-2).

CATEGORY 4 — REMOVAL & INTERACTION (0-20 pts)
Score: removal count (8-12=+1, <6=-2), board wipes present (2-4=+2), single-target removal (4-8=+2), counterspells if blue (2-4=+1), flexible removal like Beast Within (+1), instant-speed ratio (+1), variety of coverage (+1), early interaction T1-2 (+1).

CATEGORY 5 — SYNERGY & COMMANDER ALIGNMENT (0-25 pts)
Score: commander-specific synergy cards (+2 if many, -2 if none), synergy density (70-90%=+2, 50-70%=+1, <30%=-2), multiple win paths (3+=+1, 1=-1), internal synergies (+1), no card conflicts (+1), payoff-to-setup ratio (+1). CRITICAL: if commander is tribal (Yuriko=Ninjas, etc.) and no tribal cards exist, this category scores very low.

CATEGORY 6 — CARD ADVANTAGE & DRAW (0-15 pts)
Score: draw source count (6-10=+1, <4=-2), repeating engines present (+2 for premium like Rhystic Study, +1 for good), tutor density (4+=+1, 0=-2), synergistic draw (+1), card advantage creatures (+1), artifact/enchantment draw (+1).

CATEGORY 7 — MANA CURVE (0-10 pts)
Score: CMC distribution (peak at 2-3=+1, peak at 4+=-1), plays available T1-2 (+1), plays available T3 (+1), finishers at 5+ CMC (+1), curve smoothness (no gaps=+1), late game consistency (+1).

CATEGORY 8 — FORMAT COMPLIANCE (0-10 pts)
Score: exactly 100 cards (+1), no duplicates (+1), color identity OK (+1 or -4 if violated), no banned cards (+1), all cards Commander-legal (+1). Start at 6 and subtract for violations.

CATEGORY 9 — POWER LEVEL (1-10 scale)
Assess based on: premium staples present, draw engine quality, tutor count, mana base quality, number of win paths, turn speed estimate, overall consistency.

CATEGORY 1 — DECK VALIDITY
Check: deck size (100?), singleton, color identity, no banned cards.

Return ONLY valid JSON:
{
  "validity": { "pass": true, "notes": "one sentence" },
  "manaBase": { "score": 0, "max": 25, "notes": "specific issues" },
  "deckStructure": { "score": 0, "max": 15, "notes": "specific issues" },
  "removal": { "score": 0, "max": 20, "notes": "specific issues" },
  "synergy": { "score": 0, "max": 25, "notes": "specific issues" },
  "cardAdvantage": { "score": 0, "max": 15, "notes": "specific issues" },
  "manaCurve": { "score": 0, "max": 10, "notes": "specific issues" },
  "formatCompliance": { "score": 0, "max": 10, "notes": "specific issues" },
  "powerLevel": { "score": 5.0, "tier": "Casual", "notes": "one sentence" },
  "recommendations": [
    { "priority": "CRITICAL", "issue": "what is wrong", "action": "what to do" }
  ]
}

Provide 3-6 recommendations ordered by priority. Be specific — name actual cards to add or cut.`;
}

export async function POST(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cards, commander, commanderColorIdentity, format, archetype, themes, tribalType } =
    await req.json() as {
      cards: Record<string, number>;
      commander?: string;
      commanderColorIdentity?: string[];
      format: string;
      archetype?: string;
      themes?: string[];
      tribalType?: string;
    };

  const result = await scoreDeck({ cards, commander, commanderColorIdentity, format, archetype, themes, tribalType });
  if (!result) return NextResponse.json({ error: 'Scoring failed' }, { status: 500 });
  return NextResponse.json(result);
}
