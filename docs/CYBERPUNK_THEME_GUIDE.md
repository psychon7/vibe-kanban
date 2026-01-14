# Cyberpunk Theme Guide

## Overview

The Vibe Kanban cyberpunk theme brings a modern, futuristic aesthetic with neon glows, glass morphism effects, and smooth animations. This guide covers everything you need to know about using and customizing the theme.

## Theme Architecture

### Color System

The cyberpunk theme uses CSS custom properties for dynamic theming:

```css
/* Light Mode */
--cp-primary: #2563eb (Blue)
--cp-secondary: #8b5cf6 (Purple)
--cp-accent: #f59e0b (Amber)

/* Dark Mode (Cyberpunk) */
--cp-primary: #00d9ff (Cyan Neon)
--cp-secondary: #ff00ff (Magenta Neon)
--cp-accent: #ffaa00 (Amber Glow)
```

### File Structure

```
frontend/src/
├── styles/
│   ├── cyberpunk/
│   │   ├── index.css       # Main entry point
│   │   ├── colors.css      # Color tokens
│   │   ├── effects.css     # Visual effects
│   │   └── animations.css  # Keyframe animations
│   └── new/
│       └── index.css       # Imports cyberpunk theme
├── components/
│   └── ui-cyberpunk/       # Cyberpunk component variants
│       ├── button-cyberpunk.tsx
│       ├── card-cyberpunk.tsx
│       ├── input-cyberpunk.tsx
│       ├── theme-toggle.tsx
│       ├── status-indicator.tsx
│       └── loading-spinner.tsx
```

## Using Cyberpunk Components

### Buttons

```tsx
import { ButtonCyberpunk } from '@/components/ui-cyberpunk';

// Neon variants
<ButtonCyberpunk variant="cyber-primary">Primary Action</ButtonCyberpunk>
<ButtonCyberpunk variant="cyber-secondary">Secondary</ButtonCyberpunk>
<ButtonCyberpunk variant="cyber-accent">Accent</ButtonCyberpunk>

// Outlined variants
<ButtonCyberpunk variant="cyber-ghost">Ghost</ButtonCyberpunk>
<ButtonCyberpunk variant="cyber-outline">Outline</ButtonCyberpunk>
<ButtonCyberpunk variant="cyber-glass">Glass Morph</ButtonCyberpunk>

// Status variants
<ButtonCyberpunk variant="cyber-success">Success</ButtonCyberpunk>
<ButtonCyberpunk variant="cyber-destructive">Delete</ButtonCyberpunk>
```

### Cards

```tsx
import {
  CardCyberpunk,
  CardCyberpunkHeader,
  CardCyberpunkTitle,
  CardCyberpunkContent,
} from '@/components/ui-cyberpunk';

// Default card with hover glow
<CardCyberpunk variant="default">
  <CardCyberpunkHeader>
    <CardCyberpunkTitle>Card Title</CardCyberpunkTitle>
  </CardCyberpunkHeader>
  <CardCyberpunkContent>Content here</CardCyberpunkContent>
</CardCyberpunk>

// Neon card with permanent glow
<CardCyberpunk variant="neon">...</CardCyberpunk>

// Glass morphism card
<CardCyberpunk variant="glass">...</CardCyberpunk>
```

### Input Fields

```tsx
import { InputCyberpunk } from '@/components/ui-cyberpunk';

// Default input
<InputCyberpunk placeholder="Enter text..." />

// Neon input with glow on focus
<InputCyberpunk variant="neon" placeholder="With glow..." />
```

### Status Indicators

```tsx
import { StatusIndicator } from '@/components/ui-cyberpunk';

<StatusIndicator status="online" label="System Online" />
<StatusIndicator status="busy" label="Processing" animated />
<StatusIndicator status="away" label="Standby" />
```

### Loading Spinners

```tsx
import { LoadingSpinner } from '@/components/ui-cyberpunk';

<LoadingSpinner size="sm" variant="primary" />
<LoadingSpinner size="md" variant="secondary" />
<LoadingSpinner size="lg" variant="accent" />
```

## Theme Toggle

The theme toggle allows users to switch between light, dark (cyberpunk), and system themes:

```tsx
import { ThemeToggle } from '@/components/ui-cyberpunk';

<ThemeToggle />
```

## Visual Effects

### Glass Morphism

```tsx
<div className="glass-morph p-6 rounded-lg">
  Frosted glass effect with backdrop blur
</div>
```

### Neon Glow

```tsx
// Automatic glow on hover (in dark mode)
<div className="neon-card p-6">
  Hover for glow effect
</div>

// Permanent glow utilities
<div className="glow-primary">Primary glow</div>
<div className="glow-secondary">Secondary glow</div>
<div className="glow-accent">Accent glow</div>
```

### Gradients

```tsx
<div className="gradient-cyan-magenta p-6 rounded-lg">
  Cyan to magenta gradient background
</div>

<div className="gradient-accent p-6 rounded-lg">
  Accent gradient
</div>
```

### Cyber Grid Background

```tsx
<div className="cyber-grid h-64 w-full">
  Grid pattern background
</div>
```

## Animations

### Built-in Animations

```tsx
// Fade in
<div className="animate-fade-in">Fades in on mount</div>

// Slide in
<div className="animate-slide-in-right">Slides from right</div>
<div className="animate-slide-in-left">Slides from left</div>

// Glow pulse (cyberpunk effect)
<div className="animate-glow-pulse">Pulsing glow</div>

// Neon flicker
<div className="animate-neon-flicker">Subtle flicker</div>

// With delays
<div className="animate-fade-in animation-delay-100">Delayed fade</div>
```

### Custom Animations with Framer Motion

```tsx
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  Animated content
</motion.div>
```

## Color Utilities

### Using Cyberpunk Colors

```tsx
// Text colors
<div className="text-cp-primary">Primary text</div>
<div className="text-cp-secondary">Secondary text</div>
<div className="text-cp-accent">Accent text</div>

// Background colors
<div className="bg-cp-primary">Primary background</div>
<div className="bg-cp-surface">Surface background</div>

// Border colors
<div className="border border-cp-primary">Primary border</div>
```

## Typography

The cyberpunk theme uses special fonts:

- **Orbitron**: Headings (cyberpunk style)
- **IBM Plex Sans**: Body text
- **IBM Plex Mono**: Code/terminal

```tsx
// Headings automatically use Orbitron
<h1 className="text-heading-1">Cyberpunk Heading</h1>

// Or force it
<div className="font-[Orbitron]">Cyberpunk text</div>

// Code/terminal font
<code className="font-[IBM_Plex_Mono]">code here</code>
```

## Best Practices

### 1. Use Variants Over Hard-coded Styles

❌ **Don't:**
```tsx
<button className="bg-[#00d9ff] shadow-[0_0_20px_rgba(0,217,255,0.5)]">
  Button
</button>
```

✅ **Do:**
```tsx
<ButtonCyberpunk variant="cyber-primary">
  Button
</ButtonCyberpunk>
```

### 2. Leverage Theme Tokens

❌ **Don't:**
```tsx
<div style={{ color: '#00d9ff' }}>Text</div>
```

✅ **Do:**
```tsx
<div className="text-cp-primary">Text</div>
```

### 3. Add Transitions for Smooth Theme Switching

```tsx
<div className="transition-theme">
  Content that smoothly transitions between themes
</div>
```

### 4. Test in Both Light and Dark Modes

Always verify your components look good in:
- Light mode
- Dark mode (cyberpunk)
- System preference mode

## Customization

### Adding New Colors

Edit `frontend/src/styles/cyberpunk/colors.css`:

```css
@layer base {
  .new-design.dark {
    --cp-custom: 280 100% 50%; /* Purple */
  }
}

@layer utilities {
  .text-cp-custom { color: hsl(var(--cp-custom)); }
  .bg-cp-custom { background-color: hsl(var(--cp-custom)); }
}
```

### Creating Custom Glow Effects

```css
.glow-custom {
  box-shadow: 
    0 0 20px rgba(155, 0, 255, 0.5),
    0 0 40px rgba(155, 0, 255, 0.3);
}
```

### Adding Custom Animations

Edit `frontend/src/styles/cyberpunk/animations.css`:

```css
@keyframes myAnimation {
  from { ... }
  to { ... }
}

.animate-my-animation {
  animation: myAnimation 1s ease-in-out infinite;
}
```

## Performance Tips

1. **Use CSS animations over JS** when possible
2. **Limit glow effects** to interactive elements
3. **Use `will-change`** for frequently animated elements
4. **Prefer `transform` and `opacity`** for animations

## Accessibility

- All color combinations meet WCAG AA contrast ratios
- Focus states are clearly visible with neon rings
- Animations respect `prefers-reduced-motion`
- Theme preference is persisted in localStorage

## Migration from Legacy

See `MIGRATION_GUIDE.md` for step-by-step instructions on migrating existing pages to the cyberpunk theme.

## Examples

Check out the showcase page for live examples:
```
/showcase/cyberpunk
```

## Support

For issues or questions about the cyberpunk theme, please open an issue on GitHub.