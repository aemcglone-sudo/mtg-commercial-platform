import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';

// Popular commanders by format — curated fallback list
const POPULAR_COMMANDERS: Record<string, Array<{ name: string; colors: string[]; strategy: string }>> = {
  commander: [
    { name: 'Atraxa, Praetors\' Voice', colors: ['W','U','B','G'], strategy: 'Proliferate counters and superfriends' },
    { name: 'Ur-Dragon, the', colors: ['W','U','B','R','G'], strategy: 'Dragon tribal ramp' },
    { name: 'Oloro, Ageless Ascetic', colors: ['W','U','B'], strategy: 'Lifegain value engine' },
    { name: 'Meren of Clan Nel Toth', colors: ['B','G'], strategy: 'Graveyard recursion and sacrifice' },
    { name: 'Prossh, Skyraider of Kher', colors: ['B','R','G'], strategy: 'Tokens and sacrifice combo' },
    { name: 'Breya, Etherium Shaper', colors: ['W','U','B','R'], strategy: 'Artifact combo and value' },
    { name: 'Edgar Markov', colors: ['W','B','R'], strategy: 'Vampire tribal aggro' },
    { name: 'Krenko, Mob Boss', colors: ['R'], strategy: 'Goblin tribal exponential tokens' },
    { name: 'Azami, Lady of Scrolls', colors: ['U'], strategy: 'Wizard tribal card draw combo' },
    { name: 'Rhys the Redeemed', colors: ['W','G'], strategy: 'Elf and token doubling' },
    { name: 'Kaalia of the Vast', colors: ['W','B','R'], strategy: 'Cheat angels, demons, dragons into play' },
    { name: 'Yuriko, the Tiger\'s Shadow', colors: ['U','B'], strategy: 'Ninja tribal tempo' },
    { name: 'Gishath, Sun\'s Avatar', colors: ['W','R','G'], strategy: 'Dinosaur tribal ramp' },
    { name: 'Chulane, Teller of Tales', colors: ['W','U','G'], strategy: 'Blink ETB value engine' },
    { name: 'Zur the Enchanter', colors: ['W','U','B'], strategy: 'Enchantment tutor control' },
    { name: 'Sisay, Weatherlight Captain', colors: ['W','U','B','R','G'], strategy: 'Legendary creature toolbox' },
    { name: 'Muldrotha, the Gravetide', colors: ['U','B','G'], strategy: 'Graveyard value engine' },
    { name: 'The Ur-Dragon', colors: ['W','U','B','R','G'], strategy: 'Dragon tribal ramp' },
    { name: 'Omnath, Locus of Rage', colors: ['R','G'], strategy: 'Landfall burn damage' },
    { name: 'Narset, Enlightened Master', colors: ['W','U','R'], strategy: 'Extra turns and draw combo' },
  ],
  brawl: [
    { name: 'Nicol Bolas, the Ravager', colors: ['U','B','R'], strategy: 'Value discard and control' },
    { name: 'Teferi, Temporal Archmage', colors: ['U'], strategy: 'Mono blue control' },
    { name: 'Shalai, Voice of Plenty', colors: ['W','G'], strategy: 'Protection and anthem' },
  ],
};

export async function GET(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const format = req.nextUrl.searchParams.get('format') ?? 'commander';
  const commanders = POPULAR_COMMANDERS[format] ?? POPULAR_COMMANDERS.commander;

  return NextResponse.json({ commanders });
}
