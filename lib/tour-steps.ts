export type TourStepTarget =
  | { type: 'info' }
  | { type: 'element'; selector: string; tab?: string; fallbackSelector?: string };

export interface TourStep {
  id: string;
  title: string;
  body: string;
  target: TourStepTarget;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Grimoire',
    body: "Quick tour of the main features — takes about a minute. You can skip anytime.",
    target: { type: 'info' },
  },
  {
    id: 'collection-upload',
    title: 'Bring in your collection',
    body: 'Paste a collection export (CSV, plain text, or most other formats) here to get every card priced, imaged, and searchable.',
    target: { type: 'element', selector: '[data-tour="collection-upload"]', tab: 'collection' },
  },
  {
    id: 'add-card-input',
    title: 'Add cards one at a time',
    body: 'Already have a collection loaded? Use this to quickly add or adjust individual cards.',
    target: { type: 'element', selector: '[data-tour="add-card-input"]', tab: 'collection' },
  },
  {
    id: 'view-toggle',
    title: 'Grid or table',
    body: 'Switch between a visual card grid and a dense sortable table, whichever you prefer for browsing.',
    target: { type: 'element', selector: '[data-tour="view-toggle"]', tab: 'collection' },
  },
  {
    id: 'filter-panel',
    title: 'Filter your collection',
    body: 'Narrow down by color, type, rarity, mana value, price, and more — great for finding exactly what you need for a deck.',
    target: { type: 'element', selector: '[data-tour="filter-panel"]', tab: 'collection' },
  },
  {
    id: 'category-filter',
    title: 'Filter by strategic role',
    body: 'Cards are automatically tagged Ramp, Draw, Removal, Board Wipes, and more — filter by these to spot gaps in a deck.',
    target: { type: 'element', selector: '[data-tour="category-filter"]', tab: 'collection' },
  },
  {
    id: 'sort-control',
    title: 'Sort however you like',
    body: 'Sort by name, price, quantity, mana value, and more — works in both grid and table view.',
    target: { type: 'element', selector: '[data-tour="sort-control"]', tab: 'collection' },
  },
  {
    id: 'card-preview',
    title: 'Card details at a glance',
    body: 'Hover or click any card for full details — oracle text, price, and rules tips where relevant.',
    target: { type: 'element', selector: '[data-tour="card-preview-target"]', tab: 'collection' },
  },
  {
    id: 'combo-toast',
    title: 'Combo detection',
    body: "Grimoire watches your collection for known card combos and synergies, and pops up a heads-up when it finds new ones.",
    target: { type: 'info' },
  },
  {
    id: 'insights',
    title: 'Insights',
    body: 'See your collection value, price trends, and breakdowns over time.',
    target: { type: 'element', selector: '[data-tour="insights-panel"]', tab: 'insights' },
  },
  {
    id: 'mydecks-import',
    title: 'Import and build decks',
    body: 'Paste a decklist to import it, or start a new list from scratch — build lists using cards from your own collection.',
    target: {
      type: 'element',
      selector: '[data-tour="import-deck-button"]',
      fallbackSelector: '[data-tour="mydecks-panel"]',
      tab: 'mydecks',
    },
  },
  {
    id: 'mana-curve',
    title: 'Mana curve & composition',
    body: 'Open any deck to see its mana curve, color balance, and card type breakdown at a glance.',
    target: { type: 'info' },
  },
  {
    id: 'bracket-rating',
    title: 'Commander bracket rating',
    body: 'Commander decks get an automatic bracket rating, so you know roughly how powerful a deck is before you sit down to play.',
    target: { type: 'info' },
  },
  {
    id: 'topdecks',
    title: 'Top Decks',
    body: 'Browse trending and meta decks for inspiration, or to see what you\'re up against.',
    target: { type: 'element', selector: '[data-tour="topdecks-panel"]', tab: 'decks' },
  },
  {
    id: 'news',
    title: 'MTG News',
    body: 'Stay current on set releases, bans, and community news without leaving Grimoire.',
    target: { type: 'element', selector: '[data-tour="news-panel"]', tab: 'news' },
  },
  {
    id: 'khoa',
    title: 'Ask Khoa',
    body: "Khoa is Grimoire's AI assistant — ask it about your collection, get deckbuilding advice, or ask rules questions.",
    target: { type: 'element', selector: '[data-tour="khoa-chat-panel"]', tab: 'chat' },
  },
  {
    id: 'local-play',
    title: 'Local Play',
    body: 'Find nearby game stores, upcoming events, and who has the cards you\'re looking for in stock.',
    target: { type: 'element', selector: '[data-tour="nav-local-play"]' },
  },
  {
    id: 'shop-group',
    title: 'Shop',
    body: 'Find nearby shops, search for specific cards across local inventory, and browse MTG products.',
    target: { type: 'element', selector: '[data-tour="nav-shop-group"]' },
  },
  {
    id: 'settings-avatar',
    title: "You're set",
    body: 'Manage your profile, avatar, and account from here — including switching roles if you ever get shop access. Have fun!',
    target: { type: 'element', selector: '[data-tour="avatar-menu"]' },
  },
];
