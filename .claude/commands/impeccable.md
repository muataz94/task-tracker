# Impeccable Design Skill
# Based on Emil Kowalski's principles of refined micro-interactions

When applying this skill to any UI component:

## Spring Animation System
Use these exact cubic-bezier curves — never use linear or ease:
- Entrance/pop: cubic-bezier(0.34, 1.56, 0.64, 1)    — spring overshoot
- Exit/collapse: cubic-bezier(0.4, 0, 0.2, 1)          — smooth ease-out
- Hover lift:    cubic-bezier(0.2, 0, 0, 1)             — snappy settle
- Slide in:      cubic-bezier(0.32, 0.72, 0, 1)         — iOS-style decelerate

Duration scale:
- Micro (icon hover):     150ms
- Small (button press):   200ms
- Medium (modal open):    280ms
- Large (page transition): 350ms
- Never exceed 500ms for UI animations

## Spacing System (8px base)
- 4px  — gap between inline elements (badge + text)
- 8px  — gap between related items (icon + label)
- 12px — internal card padding (compact)
- 16px — standard padding
- 20px — section gaps
- 24px — between card groups
- 32px — major section breaks
- Never use odd numbers. Never use 5px, 7px, 11px, 15px.

## Typography Precision
- Page titles:   700 weight, -0.04em tracking, 20-24px
- Section heads: 600 weight, -0.02em tracking, 14-16px
- Body text:     400 weight, 0em tracking, 13-14px
- Labels/caps:   500-600 weight, +0.06em tracking, 10-11px, UPPERCASE
- Values/numbers: 700-800 weight, -0.05em tracking (tighter = more premium)
- Never mix more than 2 font weights in one component

## Interaction States (every interactive element needs ALL of these)
```css
/* Template for every button/card/item */
.element {
  transition: transform 200ms cubic-bezier(0.2,0,0,1),
              box-shadow 200ms cubic-bezier(0.2,0,0,1),
              background 150ms ease,
              border-color 150ms ease;
}
.element:hover  { transform: translateY(-1px); }
.element:active { transform: translateY(0px) scale(0.98); transition-duration: 100ms; }
.element:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

## Impeccable Details Checklist
Before finalizing any component, verify:
- [ ] Hover state is visually distinct but subtle
- [ ] Active/press state gives tactile feedback (scale down slightly)
- [ ] Focus state is visible for keyboard navigation
- [ ] Loading state is handled (skeleton or spinner)
- [ ] Empty state is designed (not just blank space)
- [ ] Error state is designed
- [ ] Transitions are consistent — same curve family throughout
- [ ] Border radius is consistent with design system (var(--r-sm/md/lg/xl))
- [ ] Shadows use rgba, never solid colors
- [ ] Text never overflows without ellipsis or wrapping strategy

## Micro-interaction Patterns
Icon hover: scale(1.15) + unique animation per icon type
Button hover: translateY(-1px) + shadow increase
Card hover: translateY(-2px) + border-color lightens
Input focus: border-color → accent + box-shadow glow ring
Modal open: scale(0.94)→scale(1) + translateY(8px)→translateY(0)
Dropdown: scale(0.96)→scale(1) + translateY(-6px)→translateY(0)
Toast/notification: translateY(100%)→translateY(0) from bottom

## What NOT to do (impeccable = restraint)
- No bounce animations on text
- No color transitions that are jarring
- No animations that last over 400ms for UI elements
- No rotation animations unless it means something (settings gear = rotate)
- No scale animations over 1.3x
- No shadows that are too dark (max rgba(0,0,0,0.4))
