'use client';

import { useState, useEffect } from 'react';

interface NewsArticle {
  title: string;
  url: string;
  description: string;
  source: string;
  date: string;
}

interface YouTubeVideo {
  id: string;
  title: string;
  channel: string;
  publishedAt: string;
  thumbnail: string;
}

export default function MTGNewsTab() {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadNews();
  }, []);

  async function loadNews() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/mtg-news');
      if (res.ok) {
        const data = await res.json();
        setNews(data.articles || []);
        setVideos(data.videos || []);
      } else {
        setError('Failed to load MTG news');
      }
    } catch (err) {
      setError('Error loading news');
      console.error(err);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-100">MTG News & Videos</h2>
        <button
          type="button"
          onClick={loadNews}
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          title="Refresh news"
        >
          ↺ Refresh
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* News Articles - Left Column (2 cols) */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
            <span title="Latest news">📰</span> Latest News
          </h3>
          {news.length === 0 ? (
            <div className="text-center py-12 text-zinc-600">
              No news articles found
            </div>
          ) : (
            <div className="space-y-3">
              {news.map((article, i) => (
                <a
                  key={i}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-amber-400 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-zinc-100 group-hover:text-amber-400 transition-colors line-clamp-2">
                        {article.title}
                      </h4>
                      {article.description && (
                        <p className="text-sm text-zinc-400 mt-1 line-clamp-2">
                          {article.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                        <span>{article.source}</span>
                        {article.date && <span>•</span>}
                        {article.date && <span>{article.date}</span>}
                      </div>
                    </div>
                    <div className="text-xl shrink-0">→</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* YouTube Videos - Right Column */}
        <div className="space-y-3">
          <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
            <span title="YouTube videos">🎥</span> Videos
          </h3>
          {videos.length === 0 ? (
            <div className="text-center py-12 text-zinc-600 text-sm">
              No videos found
            </div>
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
