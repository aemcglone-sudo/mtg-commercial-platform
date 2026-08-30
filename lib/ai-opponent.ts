import { classifyCard } from '@/lib/classify-card';

export interface AICardInfo {
  typeLine: string | null;
  oracleText: string | null;
  cmc: number | null;
  power: number | null;
  toughness: number | null;
}

export function isLand(info: AICardInfo | undefined): boolean {
  return (info?.typeLine ?? '').toLowerCase().includes('land');
}

export function isCreature(info: AICardInfo | undefined): boolean {
  return (info?.typeLine ?? '').toLowerCase().includes('creature');
}

/** Lands, plus anything with a "{T}: Add" style mana ability — mana rocks/dorks count once
 * they're on the battlefield, so a deck's ramp actually accelerates it. One mana per source,
 * regardless of colors or the exact amount it taps for — a deliberate simplification. */
export function isManaSource(info: AICardInfo | undefined): boolean {
  if (isLand(info)) return true;
  return /\{T\}[^.]*:\s*add /i.test(info?.oracleText ?? '');
}

export type AIAction =
  | { type: 'playLand'; name: string }
  | { type: 'cast'; name: string };

/**
 * Greedy turn plan: play a land if available, then spend remaining mana casting
 * spells in priority order (ramp first, removal only if the opponent has a
 * creature to answer, otherwise the most impactful affordable creature, else
 * cheapest available). No color requirements, no holding up interaction —
 * a deliberately simple heuristic, not a full strategy engine.
 */
export function planMainPhaseActions(
  hand: string[],
  untappedManaSources: number,
  landPlayedThisTurn: boolean,
  cardInfo: (name: string) => AICardInfo | undefined,
  opponentHasCreature: boolean
): AIAction[] {
  const actions: AIAction[] = [];
  let workingHand = [...hand];
  let mana = untappedManaSources;

  if (!landPlayedThisTurn) {
    const landIdx = workingHand.findIndex(n => isLand(cardInfo(n)));
    if (landIdx !== -1) {
      const [land] = workingHand.splice(landIdx, 1);
      actions.push({ type: 'playLand', name: land });
      mana += 1;
    }
  }

  let removalUsed = false;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const affordable = workingHand.filter(n => (cardInfo(n)?.cmc ?? 0) <= mana && !isLand(cardInfo(n)));
    if (affordable.length === 0) break;

    const ramp = affordable.filter(n => classifyCard(cardInfo(n) ?? { typeLine: null, oracleText: null, cmc: null }).includes('Ramp'));
    const removal = !removalUsed && opponentHasCreature
      ? affordable.filter(n => {
          const cats = classifyCard(cardInfo(n) ?? { typeLine: null, oracleText: null, cmc: null });
          return cats.includes('Removal') || cats.includes('Board Wipes');
        })
      : [];
    const creatures = affordable.filter(n => isCreature(cardInfo(n)));

    let pick: string;
    if (ramp.length > 0) {
      pick = cheapest(ramp, cardInfo);
    } else if (removal.length > 0) {
      pick = cheapest(removal, cardInfo);
      removalUsed = true;
    } else if (creatures.length > 0) {
      pick = mostExpensive(creatures, cardInfo); // maximize board impact per turn
    } else {
      pick = cheapest(affordable, cardInfo);
    }

    actions.push({ type: 'cast', name: pick });
    mana -= cardInfo(pick)?.cmc ?? 0;
    const idx = workingHand.indexOf(pick);
    workingHand.splice(idx, 1);
  }

  return actions;
}

function cheapest(names: string[], cardInfo: (name: string) => AICardInfo | undefined): string {
  return [...names].sort((a, b) => (cardInfo(a)?.cmc ?? 0) - (cardInfo(b)?.cmc ?? 0))[0];
}
function mostExpensive(names: string[], cardInfo: (name: string) => AICardInfo | undefined): string {
  return [...names].sort((a, b) => (cardInfo(b)?.cmc ?? 0) - (cardInfo(a)?.cmc ?? 0))[0];
}

export interface AttackerCandidate {
  id: string;
  name: string;
  power: number;
  toughness: number;
}
export interface BlockerCandidate {
  id: string;
  name: string;
  power: number;
  toughness: number;
}

/**
 * Attack with any eligible creature unless a human blocker would kill it for
 * free (blocker's power >= attacker's toughness, and the attacker can't kill
 * that blocker back). Otherwise attack — this is a practice tool, not a
 * perfect-information combat solver.
 */
export function declareAttackers(candidates: AttackerCandidate[], yourUntappedBlockers: BlockerCandidate[]): AttackerCandidate[] {
  return candidates.filter(atk => {
    if (atk.power <= 0) return false;
    const wouldDieForFree = yourUntappedBlockers.some(
      b => b.power >= atk.toughness && atk.power < b.toughness
    );
    return !wouldDieForFree;
  });
}

/**
 * The mirror of declareAttackers, for when the AI is the one being attacked:
 * always take a free kill (blocker survives, attacker dies); otherwise only
 * trade or chump-block if the incoming damage would meaningfully hurt them
 * (defined as: taking it all unblocked would leave them at 5 life or less) —
 * preserving board state is treated as more valuable than every single point
 * of damage. Returns a map of attacker id -> chosen blocker id (or null).
 */
export function chooseBlocks(
  attackers: AttackerCandidate[],
  defenders: BlockerCandidate[],
  defenderLife: number
): Record<string, string | null> {
  const assignments: Record<string, string | null> = {};
  const available = [...defenders];
  const totalIncoming = attackers.reduce((s, a) => s + Math.max(a.power, 0), 0);
  const inDanger = defenderLife - totalIncoming <= 5;

  const byPowerDesc = [...attackers].sort((a, b) => b.power - a.power);

  for (const atk of byPowerDesc) {
    let chosen = available.find(d => d.power >= atk.toughness && atk.power < d.toughness); // free kill
    if (!chosen && inDanger) {
      chosen = available.find(d => d.power >= atk.toughness); // trade, both may die
    }
    if (!chosen && inDanger) {
      chosen = [...available].sort((a, b) => a.power - b.power)[0]; // chump block with the weakest
    }
    assignments[atk.id] = chosen?.id ?? null;
    if (chosen) available.splice(available.indexOf(chosen), 1);
  }
  return assignments;
}
