import fs from 'fs';
import path from 'path';

const PRICES_DIR = path.join(process.cwd(), '.prices');
const PRICES_FILE = path.join(PRICES_DIR, 'prices.json');
const HISTORY_FILE = path.join(PRICES_DIR, 'history.json');

interface CardPrice {
  name: string;
  set?: string;
  usd?: number;
  foil?: number;
  eur?: number;
  lastUpdated: string;
}

interface PriceSnapshot {
  cardName: string;
  usd?: number;
  foil?: number;
  timestamp: string;
}

function ensureDir() {
  if (!fs.existsSync(PRICES_DIR)) {
    fs.mkdirSync(PRICES_DIR, { recursive: true });
  }
}

export function getPrices(): Map<string, CardPrice> {
  ensureDir();
  if (!fs.existsSync(PRICES_FILE)) {
    return new Map();
  }
  const data = JSON.parse(fs.readFileSync(PRICES_FILE, 'utf-8'));
  return new Map(data);
}

export function setPrices(prices: Map<string, CardPrice>): void {
  ensureDir();
  fs.writeFileSync(PRICES_FILE, JSON.stringify(Array.from(prices.entries())));
}

export function getPrice(cardName: string): CardPrice | undefined {
  const prices = getPrices();
  return prices.get(cardName.toLowerCase());
}

export function setPrice(cardName: string, price: CardPrice): void {
  const prices = getPrices();
  prices.set(cardName.toLowerCase(), {
    ...price,
    lastUpdated: new Date().toISOString(),
  });
  setPrices(prices);
}

export function storePriceSnapshot(cardName: string, usd?: number, foil?: number): void {
  ensureDir();
  const history: PriceSnapshot[] = fs.existsSync(HISTORY_FILE)
    ? JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'))
    : [];

  history.push({
    cardName,
    usd,
    foil,
    timestamp: new Date().toISOString(),
  });

  // Keep only last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const filtered = history.filter(h => new Date(h.timestamp) > ninetyDaysAgo);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(filtered));
}

export function getCardHistory(cardName: string, days: number = 30): PriceSnapshot[] {
  ensureDir();
  if (!fs.existsSync(HISTORY_FILE)) {
    return [];
  }

  const history: PriceSnapshot[] = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return history.filter(
    h => h.cardName.toLowerCase() === cardName.toLowerCase() && new Date(h.timestamp) > cutoff
  );
}
