# Signal Board

A production-minded review queue for an AI-assisted product team. Reviewers can scan, filter, sort, and inspect incoming items quickly without backend infrastructure.

> **Important:** Open via a local server (not `file://`). The app fetches `./public/data/review-items.json` using `fetch()`, which requires HTTP.

No install, no build step, no dependencies. Pure HTML + CSS + JS.

---

## What's Built

### Core Features
- **Queue surface** — 30 realistic review items rendered as a scannable list with color-coded priority indicators and risk scores
- **Search** — live search across titles and summaries (`⌘K` / `Ctrl+K` focuses the search box from anywhere)
- **Filters** — status (open / in-review / escalated / reviewed / snoozed), priority (high / medium / low), source, and owner
- **Sort** — by risk score (high→low, low→high), created date (newest/oldest), or priority
- **Detail drawer** — click any item to open a slide-in panel with full summary, metadata, score bar, tags, and activity history
- **Client actions** — Mark reviewed, Snooze, Escalate, In review (updates local state across the session)
- **Note-taking** — add freeform notes per item, saved in local session state
- **Loading skeleton** — 580ms simulated network delay shows a pulsing skeleton, not a blank screen
- **Empty + error states** — handled intentionally with contextual messages and recovery actions
- **Persistence** — last sort choice and density preference saved to `localStorage`, restored on reload

### Bonus touches
- **`⌘K` shortcut** — focuses and selects the search input from anywhere
- **Density toggle** — Comfortable / Compact mode (persisted to localStorage)
- **Arrow key navigation** — when a drawer is open, `←` / `→` moves to adjacent items
- **Activity log** — every action on an item is recorded with a timestamp in the drawer
- **Edge cases** — very long titles, missing owners, empty tags, duplicate tags, zero results, and error states are all handled
- **Keyboard accessible** — all interactive elements are reachable via Tab, focusable chips support Enter/Space, drawer traps focus correctly, Escape closes it

---

## File Structure

```
signal-board/
├── index.html                  # Complete app (single file)
├── public/
│   └── data/
│       └── review-items.json   # 30-item fixture dataset
└── README.md
```

---

## Tradeoffs and Intentional Omissions

**What I left out and why:**

- **No build toolchain** — The brief says "easy to run locally." A Vite + React setup would add real complexity for no user-visible benefit here. Vanilla JS with clean module-style organization achieves everything needed.
- **No pagination** — 30 items fit well in one view. Pagination would add UI complexity that works against the "fast to scan" goal. A virtual scroll would make sense at 500+ items.
- **No real persistence** — Actions and notes live in session memory. The brief explicitly says "client-only actions do not need real backend persistence." A `localStorage` mirror would be 10 lines but adds state hydration complexity and merge ambiguity.
- **No authentication** — Out of scope per the brief.
- **Single file** — Chosen deliberately for setup simplicity. A component-based structure would be appropriate for a team codebase; for an assignment that needs to be `git clone` + run, one file wins.
- **No animation library** — CSS transitions are sufficient and load instantly. Motion.js would add a 40kb dependency for marginal improvement.

**What I'd add next with more time:**
- Saved filter presets (named bookmarks)
- Keyboard-first item navigation (j/k keys in queue)
- Reduced-motion media query for all transitions
- Tag-based filtering (click a tag pill to filter by it)
- Multi-select bulk actions

---


