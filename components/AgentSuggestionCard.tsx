'use client';

import React, { useState } from 'react';
import type { AgentCard, AgentCardItem } from '@/lib/magic-agent/chat-integration';

interface AgentSuggestionCardProps {
  card: AgentCard;
}

export function AgentSuggestionCard({ card }: AgentSuggestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleActionClick = (item: AgentCardItem) => {
    if (!item.actionType || !item.actionData) return;

    // Dispatch custom events for parent to handle
    window.dispatchEvent(
      new CustomEvent('agent-action', {
        detail: {
          type: item.actionType,
          data: item.actionData,
        },
      })
    );
  };

  return (
    <div className="my-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{card.icon}</span>
          <h3 className="font-semibold text-slate-900 dark:text-white">{card.title}</h3>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {card.items.length} {card.items.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        <span
          className={`text-slate-600 dark:text-slate-400 transition-transform inline-block ${
            isExpanded ? 'rotate-180' : ''
          }`}
        >
          ▼
        </span>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 py-3 border-t border-slate-300 dark:border-slate-700 space-y-3">
          {card.items.map((item, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-slate-800 dark:text-slate-200 flex-1">{item.text}</p>
                {item.badge && (
                  <span className="inline-block px-2 py-1 text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded whitespace-nowrap">
                    {item.badge}
                  </span>
                )}
              </div>

              {item.actionButton && (
                <button
                  type="button"
                  onClick={() => handleActionClick(item)}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  {item.actionButton} →
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Container for multiple agent cards
 */
interface AgentCardsContainerProps {
  cards: AgentCard[];
}

export function AgentCardsContainer({ cards }: AgentCardsContainerProps) {
  if (cards.length === 0) return null;

  return (
    <div className="mt-4 space-y-2 border-l-4 border-amber-400 pl-4">
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
        🤖 Agent Insights
      </p>
      {cards.map(card => (
        <AgentSuggestionCard key={card.id} card={card} />
      ))}
    </div>
  );
}
