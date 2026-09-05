# MTG Simulator — UI/UX Principles

**Purpose:** This is the reference standard. Every future layout, component, or interaction
decision gets checked against these principles before being built. If a proposed design
violates one of these without a stated reason, that's a signal to stop and reconsider.

**Context that shapes these principles:** This is a 4-player Commander simulator built for
one purpose — improving the user's board awareness through a learning tool. It is not a
commercial product, not mobile, not for an audience. That context licenses design choices
a shipped product couldn't make (no onboarding, no accessibility for unknown users, no
responsive breakpoints) but raises the bar on clarity, since confusion here means the
learning goal fails.

**Prior art considered:** MTG Arena (best-in-class phase/stack/hand legibility, but never
solved multiplayer — this is a genuinely unsolved problem even at Wizards' budget). MTGO
(cautionary example — shows everything with equal weight, result is illegible). Poker
table UIs (solve N-opponent tracking via compact per-player summaries at consistent
positions, not full detail per opponent). Cockpit/dashboard design (primary instrument vs.
peripheral instruments — one thing gets full attention, everything else recedes). RTS
minimaps (compressed overview + detailed focus area, not uniform detail everywhere).

---

## The Seven Principles

### 1. Attention Follows the Decision
Whatever the player must decide *right now* — block assignment, which card to play, whether
to attack — gets primary visual weight and physical proximity to the tools needed to act on
it. Everything else recedes in size, position, or default visibility.

*Check:* Can the player act on the current decision without moving their eyes far or
scrolling? If not, this principle is violated.

### 2. Spatial Consistency
The player's own zone, and each opponent's zone, occupies a fixed position that never moves
based on game state. No re-layout when a player's turn changes, when board size grows, or
when zones empty out.

*Check:* If you rewound and replayed the last 5 turns, would anything the player already
learned to find have moved?

### 3. Minimize Working Memory Load
Never require the player to scroll, remember a number, or hold state in their head to
compare two things. If two pieces of information must be evaluated together, they must be
visible simultaneously, not sequentially.

*Check:* Does using this feature ever require "remember what you just saw, then go look at
something else"? If yes, redesign so both are visible at once.

### 4. Progressive Disclosure
The default view shows only what's needed for a glance-level assessment. Full detail
(exact hand contents where visible, graveyard contents, full oracle text, complete game
log) is one click/hover away, not rendered by default.

*Check:* Is everything on screen by default something the player needs to glance at every
single turn? If not, it belongs behind a click.

### 5. Preview Before Commit
Any action with consequences (casting a spell, declaring attackers, activating an ability)
shows what will happen — triggers, life changes, board impact — before the player locks it
in. This is the core learning mechanism.

*Check:* Does this action have a preview step, or does the player only learn its effect
after it's already resolved?

### 6. Consistent State Encoding
Every recurring game state — tapped, summoning sick, attacking, blocking, unplayable,
buffed, a token vs. a real card — gets exactly one visual treatment, used identically
everywhere it appears.

*Check:* If you see this state rendered in two different components, do they look the
same? If not, pick one and make them match.

### 7. N-Player Complexity Is Managed By Compression, Not Cramming
With up to 3 AI opponents plus the player, showing full detail for every player
simultaneously is not viable. Opponents default to compact threat summaries (life, rough
board size, a threat signal). Full per-opponent detail is opt-in (expand on click).

*Check:* As opponent count or board complexity grows, does the default view stay legible,
or does it get more cluttered? If the latter, compress further before adding more panels.

---

## How These Principles Interact With Prior Decisions

- **Advisor/hand relocation (Phase 1)** was principle #1 and #3 in action.
- **Quiz Mode's three content states in one location** is principle #6.
- **Opponent threat panel** is principle #7.
- **Card Preview Panel and Combat Preview Modal** are principle #5 directly.

---

## What This Doc Is Not

- Not a visual style guide (colors, fonts, spacing tokens) — that's downstream work.
- Not a component spec — individual components get their own specs that must satisfy
  these principles, not repeat them.
- Not fixed forever — if a future situation genuinely warrants breaking one of these,
  that's a conscious tradeoff to name explicitly, not a default to drift into silently.
