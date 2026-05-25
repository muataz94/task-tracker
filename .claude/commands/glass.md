# Liquid Glass Design Skill
# Apple iOS 26 / visionOS inspired glass morphism

## Glass Layer System
Three levels of glass — use consistently:

### Level 1 — Background glass (large areas, sidebar)
background: rgba(255,255,255,0.04);
backdrop-filter: blur(40px) saturate(200%);
border: 1px solid rgba(255,255,255,0.06);

### Level 2 — Card glass (default for all cards)
background: rgba(255,255,255,0.06);
backdrop-filter: blur(20px) saturate(180%);
border: 1px solid rgba(255,255,255,0.08);
box-shadow: 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12);

### Level 3 — Elevated glass (modals, dropdowns)
background: rgba(255,255,255,0.10);
backdrop-filter: blur(24px) saturate(200%);
border: 1px solid rgba(255,255,255,0.12);
box-shadow: 0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.18);

## Specular Highlight (the signature glass edge)
Every glass card gets a top highlight:
```css
.glass-card::after {
  content: '';
  position: absolute;
  top: 0; left: 12%; right: 12%;
  height: 1px;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(255,255,255,0.25) 50%,
    transparent 100%
  );
}
```

## Background Mesh (required for glass to work)
Glass only looks good against a colorful blurred background.
The animated blobs in body::before are essential — never remove them.

## Glass Rules
- Never use glass on plain white/black backgrounds — needs color behind it
- Never stack more than 3 glass layers (blur compounds and gets heavy)
- Light mode glass uses higher opacity (0.55-0.80) vs dark mode (0.04-0.12)
- Always add the specular highlight (::after) to glass cards
- Glass borders are rgba white in dark mode, rgba purple/blue in light mode
