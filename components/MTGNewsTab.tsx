'use client';

import { useState, useEffect } from 'react';

interface NewsArticle {
  title: string;
  url: string;
  description: string;
  source: string;
  date: string;
}

interface UpcomingRelease {
  name: string;
  code: string;
  releaseDate: string;
  setType: string;
  iconUrl: string | null;
  scryfallUri: string;
  cardCount: number | null;
}

interface YouTubeVideo {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
}

const SET_TYPE_LABELS: Record<string, string> = {
  commander: 'Commander',
  expansion: 'Expansion',
  box: 'Box Set',
  masters: 'Masters',
  draft_innovation: 'Draft',
  core: 'Core Set',
};

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(dateStr: string) {
  const release = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((release.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function MTGNewsTab() {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingRelease[]>([]);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadNews(); }, []);

  async function loadNews() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/mtg-news');
      if (res.ok) {
        const data = await res.json();
        setNews(data.articles ?? []);
        setUpcoming(data.upcoming ?? []);
        setVideos(data.videos ?? []);
      } else {
        setError('Failed to load MTG news');
      }
    } catch {
      setError('Error loading news');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-32 space-y-4">
        <div className="text-5xl animate-pulse">📰</div>
        <p className="text-zinc-300">Loading MTG news…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-100">MTG News</h2>
        <button
          type="button"
          onClick={loadNews}
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          ↺ Refresh
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Column 1 — News */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">📰 Latest News</h3>
          {news.length === 0 ? (
            <p className="text-zinc-600 text-sm">No news articles found.</p>
          ) : (
            <div className="space-y-2">
              {news.map((article, i) => (
                <a
                  key={i}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-amber-400 transition-colors group"
                >
                  <h4 className="font-semibold text-zinc-100 group-hover:text-amber-400 transition-colors line-clamp-2 text-sm">
                    {article.title}
                  </h4>
                  {article.description && (
                    <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{article.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-xs text-zinc-600">
                    <span>{article.source}</span>
                    {article.date && <><span>·</span><span>{article.date}</span></>}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Column 2 — Upcoming Releases */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">🗓 Coming Soon</h3>
          {upcoming.length === 0 ? (
            <p className="text-zinc-600 text-sm">No upcoming releases found.</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((release) => {
                const days = daysUntil(release.releaseDate);
                const typeLabel = SET_TYPE_LABELS[release.setType] ?? release.setType;
                const isCommander = release.setType === 'commander';
                return (
                  <a
                    key={release.code}
                    href={release.scryfallUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-amber-400 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-zinc-100 group-hover:text-amber-400 transition-colors text-sm leading-snug">
                          {release.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            isCommander
                              ? 'bg-purple-900/60 text-purple-300'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}>
                            {typeLabel}
                          </span>
                          <span className="text-xs text-zinc-500">{release.code}</span>
                          {release.cardCount ? (
                            <span className="text-xs text-zinc-600">{release.cardCount} cards</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold text-amber-400">
                          {days === 1 ? 'Tomorrow' : `${days}d`}
                        </p>
                        <p className="text-xs text-zinc-600 mt-0.5">{formatDate(release.releaseDate)}</p>
                      </div>
                    </div>
                    <a
                      href={`https://www.tcgplayer.com/search/magic/product?productLineName=magic&q=${encodeURIComponent(release.name)}&view=grid`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors font-medium"
                    >
                      🛒 Pre-order on TCGPlayer →
                    </a>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* Column 3 — YouTube Videos */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">🎥 Videos</h3>
          {videos.length === 0 ? (
            <p className="text-zinc-600 text-sm">No videos found.</p>
          ) : (
            <div className="space-y-3">
              {videos.map((video) => (
                <a
                  key={video.id}
                  href={`https://youtube.com/watch?v=${video.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-red-500 transition-colors group"
                >
                  <div className="relative aspect-video overflow-hidden bg-black">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50">
                      <div className="text-4xl">▶</div>
                    </div>
                  </div>
                  <div className="p-3">
                    <h4 className="text-sm font-semibold text-zinc-100 group-hover:text-red-400 transition-colors line-clamp-2">
                      {video.title}
                    </h4>
                    <p className="text-xs text-zinc-500 mt-1">{video.channel}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
