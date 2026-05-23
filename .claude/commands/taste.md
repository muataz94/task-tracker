# Taste Skill
# High-taste UI principles — restraint, intentionality, hierarchy

## The Core Principle
Good taste = knowing what to leave out.
Every element must earn its place. If you cannot explain why it's there, remove it.

## Visual Hierarchy Rules
1. ONE primary action per screen — everything else is secondary or tertiary
2. The eye should travel: Title → Key stat → Action → Supporting info
3. White space IS a design element — emptiness creates emphasis
4. Maximum 3 levels of visual hierarchy per section

## Color Usage Rules (taste = restraint)
- Use accent color (--accent) sparingly — max 3 elements per view
- When everything is colorful, nothing is colorful
- Background colors should recede, not compete
- Reserve red (--accent-red) for errors and genuine urgency only
- Reserve green (--accent-green) for success states only
- Gray scale does most of the work — color punctuates

## Typography Taste
- Hierarchy through weight and size, not color alone
- Body text should be comfortable to read — 13-14px, line-height 1.5-1.6
- Headlines need breathing room — margin-bottom at least 0.5em
- Never center-align body text (only headlines/cards)
- Avoid ALL CAPS except for micro-labels (10-11px)
- Numbers in data contexts: tabular-nums, monospace feel

## Component Taste Principles
### Cards
- Internal padding: consistent, generous (not cramped)
- Border radius: consistent across all cards (use --r-md)
- Shadow: one consistent shadow level per elevation tier
- Content: max 3-4 pieces of info per card (more = noise)

### Tables
- Alternating row colors: NO (subtle hover is enough)
- Column alignment: numbers right-align, text left-align
- Header: lighter than body, uppercase, slightly smaller
- Row height: generous — 44-48px feels premium, 32px feels cramped

### Forms
- One column layouts feel more intentional than two columns
- Label above input (never inline placeholder as label)
- Input padding: 10-12px vertical (not 6px — cramped)
- Error messages: below the field, red, small, immediate

### Empty States
- Never leave a blank container — design the empty state
- Empty state = illustration/icon + message + call-to-action
- Tone should be encouraging, not apologetic

## What High-Taste Looks Like
- Consistent: same pattern repeated = trust
- Intentional: every spacing choice has a reason
- Restrained: fewer things, each done better
- Alive: subtle animations that feel physical
- Readable: clear hierarchy guides the eye effortlessly

## What Low-Taste Looks Like (avoid)
- Inconsistent border-radius across components
- Shadows that are too dark or too many
- Too many colors competing for attention
- Cramped spacing (padding < 12px in cards)
- Animations that feel random or excessive
- Modal with no clear visual hierarchy
- Buttons that all look the same weight/importance

## Taste Checklist Before Finishing Any UI Change
- [ ] Is every element intentional? (remove anything decorative-only)
- [ ] Is the hierarchy clear at a glance? (1-second test)
- [ ] Is the spacing consistent with the 8px grid?
- [ ] Are there max 2 accent-colored elements visible at once?
- [ ] Does the empty state look designed?
- [ ] Does it work in both dark AND light mode?
- [ ] Does it work in both LTR AND RTL?
- [ ] Would you be proud to show this to a senior designer?
