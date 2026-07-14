import pg from 'pg';

const DB_URL = 'postgres://mtg_deck_builder:4Zpy1Vc1WZkufR1@localhost:5433/mtg_deck_builder?sslmode=disable';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const BASIC_LANDS = new Set(['Plains','Island','Swamp','Mountain','Forest','Wastes',
  'Snow-Covered Plains','Snow-Covered Island','Snow-Covered Swamp','Snow-Covered Mountain','Snow-Covered Forest']);

async function fetchScryfallData(names) {
  const result = new Map();
  for (let i = 0; i < names.length; i += 75) {
    const chunk = names.slice(i, i + 75);
    try {
      const res = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Grimoire/1.0' },
        body: JSON.stringify({ identifiers: chunk.map(name => ({ name })) }),
      });
      if (res.ok) { const d = await res.json(); for (const c of d.data) result.set(c.name.toLowerCase(), c); }
    } catch {}
    if (i + 75 < names.length) await new Promise(r => setTimeout(r, 200));
  }
  return result;
}

async function scoreOneDeck(cards, commander, format) {
  const entries = Object.entries(cards);
  const total = entries.reduce((s,[,q])=>s+q,0);
  const nonLands = entries.filter(([n])=>!BASIC_LANDS.has(n));
  const sf = await fetchScryfallData(nonLands.map(([n])=>n));
  const cardList = entries.map(([n,q])=>{const d=sf.get(n.toLowerCase());return d?`${q}x ${n} | CMC:${d.cmc} | ${d.type_line}`:`${q}x ${n}`}).join('\n');
  const lands = entries.filter(([n])=>BASIC_LANDS.has(n)||(sf.get(n.toLowerCase())?.type_line??'').includes('Land')).reduce((s,[,q])=>s+q,0);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 2048, temperature: 0.2, messages: [{ role: 'user', content:
      `Score this MTG ${format??'commander'} deck (commander: ${commander??'none'}, ${total} cards, ${lands} lands). Return ONLY valid JSON:\n{"validity":{"pass":true,"notes":""},"manaBase":{"score":0,"max":25,"notes":""},"deckStructure":{"score":0,"max":15,"notes":""},"removal":{"score":0,"max":20,"notes":""},"synergy":{"score":0,"max":25,"notes":""},"cardAdvantage":{"score":0,"max":15,"notes":""},"manaCurve":{"score":0,"max":10,"notes":""},"formatCompliance":{"score":0,"max":10,"notes":""},"powerLevel":{"score":5,"tier":"Casual","notes":""},"recommendations":[{"priority":"MAJOR","issue":"","action":""}]}\n\nCARDS:\n${cardList}`
    }] }),
  });
  if (!res.ok) { console.error('Anthropic', res.status); return null; }
  const d = await res.json();
  const raw = d.content?.[0]?.text ?? '';
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  const p = JSON.parse(m[0]);
  const scores = [p.manaBase?.score??0,p.deckStructure?.score??0,p.removal?.score??0,p.synergy?.score??0,p.cardAdvantage?.score??0,p.manaCurve?.score??0,p.formatCompliance?.score??0];
  const totalScore = scores.reduce((a,b)=>a+b,0);
  const pct = Math.round((totalScore/120)*100);
  return { validity:{score:0,max:0,label:'Validity',pass:p.validity?.pass??true,notes:p.validity?.notes??''}, manaBase:{score:p.manaBase?.score??0,max:25,label:'Mana Base',notes:p.manaBase?.notes??''}, deckStructure:{score:p.deckStructure?.score??0,max:15,label:'Deck Structure',notes:p.deckStructure?.notes??''}, removal:{score:p.removal?.score??0,max:20,label:'Removal & Interaction',notes:p.removal?.notes??''}, synergy:{score:p.synergy?.score??0,max:25,label:'Synergy & Commander Alignment',notes:p.synergy?.notes??''}, cardAdvantage:{score:p.cardAdvantage?.score??0,max:15,label:'Card Advantage & Draw',notes:p.cardAdvantage?.notes??''}, manaCurve:{score:p.manaCurve?.score??0,max:10,label:'Mana Curve',notes:p.manaCurve?.notes??''}, formatCompliance:{score:p.formatCompliance?.score??0,max:10,label:'Format Compliance',notes:p.formatCompliance?.notes??''}, powerLevel:{score:p.powerLevel?.score??5,tier:p.powerLevel?.tier??'Casual',notes:p.powerLevel?.notes??''}, recommendations:p.recommendations??[], totalScore, maxScore:120, percentage:pct, grade:pct>=90?'A':pct>=80?'B':pct>=70?'C':pct>=60?'D':'F' };
}

const client = new pg.Client({ connectionString: DB_URL });
await client.connect();
const { rows } = await client.query(`SELECT id, name, commander, format, cards FROM decks WHERE rubric_score IS NULL AND cards IS NOT NULL`);
console.log(`Scoring ${rows.length} decks...`);
for (const deck of rows) {
  console.log(`  ${deck.name}`);
  try {
    const score = await scoreOneDeck(JSON.parse(deck.cards), deck.commander, deck.format);
    if (score) { await client.query(`UPDATE decks SET rubric_score=$1, rubric_scored_at=$2 WHERE id=$3`, [JSON.stringify(score), new Date().toISOString(), deck.id]); console.log(`    ✓ ${score.totalScore}/120 ${score.grade}`); }
    else console.log('    ✗ failed');
  } catch(e) { console.error('    ✗', e.message); }
  await new Promise(r=>setTimeout(r,500));
}
await client.end();
console.log('Done.');
