# Design System Check

Run this checklist before shipping any UI change to ensure it stays within the Liquid Glass design language.

## Color tokens — always use CSS variables, never hardcoded hex

| Token | Usage |
|---|---|
| `var(--t1)` | Primary text `rgba(255,255,255,0.96)` |
| `var(--t2)` | Secondary text `rgba(255,255,255,0.62)` |
| `var(--t3)` | Muted / placeholder `rgba(255,255,255,0.36)` |
| `var(--accent)` | Violet `#a78bfa` |
| `var(--accent-2)` | Purple `#c084fc` |
| `var(--accent-3)` | Blue `#60a5fa` |
| `var(--accent-green)` | Green `#34d399` |
| `var(--accent-red)` | Red `#f87171` |
| `var(--accent-amber)` | Amber `#fbbf24` |
| `var(--grad-primary)` | Violet→Indigo→Blue gradient |
| `var(--grad-violet)` | Violet gradient (avatar fills, active states) |

## Glass surface recipe

```css
background: var(--lg-surface);           /* rgba(255,255,255,0.07) */
backdrop-filter: var(--lg-blur);         /* blur(48px) saturate(200%) brightness(105%) */
border: 1px solid var(--lg-border);      /* rgba(255,255,255,0.18) */
border-top-color: var(--lg-border-top);  /* rgba(255,255,255,0.40) — specular top edge */
box-shadow: var(--lg-shadow), var(--lg-specular);
```

Or just use `.glass` utility class for standard panels.

## Radius scale

| Variable | Value | Use for |
|---|---|---|
| `var(--r-sm)` | 12px | Buttons, tags, small cards |
| `var(--r-md)` | 18px | Input fields, medium cards |
| `var(--r-lg)` | 24px | Large panels, modals |
| `var(--r-xl)` | 32px | Login card, hero sections |

## Interactive states

- **Hover**: increase surface opacity by ~4%, add subtle border glow, `transition: all 0.18s ease`
- **Active / selected**: `background: #1e1533`, violet border `rgba(167,139,250,0.30)`, top specular `rgba(255,255,255,0.28)`
- **Focus ring**: `box-shadow: 0 0 0 2px rgba(139,92,246,0.30)`

## Badge classes (status colors)

Use `<span class="badge badge-{value}">` — do NOT add inline background colors.

| badge-open | badge-in_progress | badge-done | badge-overdue |
| badge-low | badge-medium | badge-high |
| badge-draft | badge-submitted | badge-received | badge-cancelled |
| badge-not_started | badge-completed | badge-blocked |

## Checklist before every UI commit

- [ ] No hardcoded `#hex` or `rgb()` colors — only CSS variables
- [ ] All new text uses `var(--t1)` / `var(--t2)` / `var(--t3)`
- [ ] New interactive elements have hover + focus states
- [ ] Backdrop-filter added to all new floating surfaces
- [ ] No `alert()` or `confirm()` calls added — use `showToast()` instead
- [ ] No new `prompt()` calls for config — config lives in `config.js` only
- [ ] Animations use `cubic-bezier(0.34, 1.56, 0.64, 1)` for bouncy reveals
- [ ] All user-supplied strings passed through `escapeHtml()` before rendering as HTML
