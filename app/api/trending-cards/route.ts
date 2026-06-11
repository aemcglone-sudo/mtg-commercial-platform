import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface TrendingCard {
  name: string;
  discussionCount: number;
  trend: number; // percentage change
  arrow: '▲' | '▼'; // triangle up or down
  trendColor: 'text-green-500' | 'text-red-500';
}

const TRENDS_FILE = path.join(process.cwd(), '.trends', 'cards.json');

interface TrendRecord {
  name: string;
  count: number;
  date: string;
}

function ensureTrendsDir() {
  const dir = path.dirname(TRENDS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getTrendRecords(): TrendRecord[] {
  ensureTrendsDir();
  if (!fs.existsSync(TRENDS_FILE)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(TRENDS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveTrendRecords(records: TrendRecord[]) {
  ensureTrendsDir();
  fs.writeFileSync(TRENDS_FILE, JSON.stringify(records, null, 2));
}

/**
 * Fetch trending/most discussed Magic cards using Tavily
 * Returns cards ranked by discussion frequency with trend arrows
 */
export async function GET(req: NextRequest) {
  try {
    // Mock data for now - can be replaced with real Tavily fetches later
    const trendingCards: TrendingCard[] = [
      { name: 'Sol Ring', discussionCount: 1243, trend: 15, arrow: '▲', trendColor: 'text-green-500' },
      { name: 'Counterspell', discussionCount: 987, trend: 8, arrow: '▲', trendColor: 'text-green-500' },
      { name: 'Cyclonic Rift', discussionCount: 856, trend: -5, arrow: '▼', trendColor: 'text-red-500' },
      { name: 'Lightning Bolt', discussionCount: 723, trend: 12, arrow: '▲', trendColor: 'text-green-500' },
      { name: 'Doubling Season', discussionCount: 654, trend: 0, arrow: '▲', trendColor: 'text-green-500' },
      { name: 'Mana Crypt', discussionCount: 623, trend: 6, arrow: '▲', trendColor: 'text-green-500' },
      { name: 'Rhystic Study', discussionCount: 598, trend: -3, arrow: '▼', trendColor: 'text-red-500' },
      { name: 'Tireless Provisioner', discussionCount: 567, trend: 22, arrow: '▲', trendColor: 'text-green-500' },
      { name: 'Smothering Tithe', discussionCount: 534, trend: 5, arrow: '▲', trendColor: 'text-green-500' },
      { name: 'Atraxa, Praetor\'s Voice', discussionCount: 502, trend: -8, arrow: '▼', trendColor: 'text-red-500' },
    ];

    return NextResponse.json({ cards: trendingCards });
  } catch (error) {
    console.error('Trending cards error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
