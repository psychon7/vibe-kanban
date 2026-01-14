# Migration Guide: Legacy Design → Cyberpunk Theme

This guide helps you migrate existing pages from the legacy design system to the new cyberpunk-themed shadcn UI.

## Overview

The migration involves:
1. Updating imports to use new components
2. Replacing legacy components with shadcn equivalents
3. Applying cyberpunk styling
4. Testing in both light and dark modes

## Step-by-Step Migration

### 1. Update Layout Wrapper

**Before:**
```tsx
import { LegacyDesignScope } from '@/components/legacy-design/LegacyDesignScope';

function MyPage() {
  return (
    <LegacyDesignScope>
      <div className="legacy-design">
        {/* content */}
      </div>
    </LegacyDesignScope>
  );
}
```

**After:**
```tsx
import { NewDesignScope } from '@/components/ui-new/scope/NewDesignScope';

function MyPage() {
  return (
    <NewDesignScope>
      <div className="new-design">
        {/* content */}
      </div>
    </NewDesignScope>
  );
}
```

### 2. Migrate Buttons

**Before:**
```tsx
<button className="btn btn-primary">Click Me</button>
```

**After:**
```tsx
import { ButtonCyberpunk } from '@/components/ui-cyberpunk';

<ButtonCyberpunk variant="cyber-primary">Click Me</ButtonCyberpunk>
```

### 3. Migrate Cards

**Before:**
```tsx
<div className="card">
  <div className="card-header">
    <h3>Title</h3>
  </div>
  <div className="card-body">Content</div>
</div>
```

**After:**
```tsx
import {
  CardCyberpunk,
  CardCyberpunkHeader,
  CardCyberpunkTitle,
  CardCyberpunkContent,
} from '@/components/ui-cyberpunk';

<CardCyberpunk variant="neon">
  <CardCyberpunkHeader>
    <CardCyberpunkTitle>Title</CardCyberpunkTitle>
  </CardCyberpunkHeader>
  <CardCyberpunkContent>Content</CardCyberpunkContent>
</CardCyberpunk>
```

### 4. Migrate Forms

**Before:**
```tsx
<input type="text" className="form-control" />
```

**After:**
```tsx
import { InputCyberpunk } from '@/components/ui-cyberpunk';

<InputCyberpunk variant="neon" />
```

### 5. Migrate Modals/Dialogs

**Before:**
```tsx
<div className="modal">...</div>
```

**After:**
```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent className="glass-morph">
    <DialogHeader>
      <DialogTitle className="font-[Orbitron] text-cp-primary">
        Title
      </DialogTitle>
    </DialogHeader>
    {/* content */}
  </DialogContent>
</Dialog>
```

### 6. Add Animations

Enhance your migrated components with animations:

```tsx
<div className="animate-fade-in">
  <CardCyberpunk variant="neon" className="animate-slide-in-left">
    ...
  </CardCyberpunk>
</div>
```

## Component Mapping Reference

| Legacy Component | Cyberpunk Replacement | Notes |
|-----------------|----------------------|-------|
| `.btn` | `ButtonCyberpunk` | Use variant prop |
| `.card` | `CardCyberpunk` | Multiple sub-components |
| `.form-control` | `InputCyberpunk` | Add `variant="neon"` for glow |
| `.badge` | `Badge` from shadcn | Style with CP colors |
| `.alert` | `Alert` from shadcn | Style with CP colors |
| `.table` | `Table` from shadcn | Add neon-card class |
| `.modal` | `Dialog` from shadcn | Use glass-morph |

## Common Patterns

### Pattern 1: List of Cards

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {items.map((item, index) => (
    <CardCyberpunk 
      key={item.id} 
      variant="neon"
      className={`animate-fade-in animation-delay-${index * 100}`}
    >
      <CardCyberpunkHeader>
        <CardCyberpunkTitle>{item.title}</CardCyberpunkTitle>
      </CardCyberpunkHeader>
      <CardCyberpunkContent>{item.content}</CardCyberpunkContent>
    </CardCyberpunk>
  ))}
</div>
```

### Pattern 2: Form with Neon Inputs

```tsx
<form className="space-y-4">
  <div>
    <label className="text-sm font-medium mb-2 block">Email</label>
    <InputCyberpunk 
      variant="neon" 
      type="email" 
      placeholder="Enter email..."
    />
  </div>
  <ButtonCyberpunk variant="cyber-primary" type="submit">
    Submit
  </ButtonCyberpunk>
</form>
```

### Pattern 3: Status Dashboard

```tsx
import { StatusIndicator } from '@/components/ui-cyberpunk';

<CardCyberpunk variant="glass">
  <CardCyberpunkHeader>
    <CardCyberpunkTitle>System Status</CardCyberpunkTitle>
  </CardCyberpunkHeader>
  <CardCyberpunkContent className="space-y-3">
    <StatusIndicator status="online" label="API Server" />
    <StatusIndicator status="busy" label="Database" animated />
    <StatusIndicator status="away" label="Cache" />
  </CardCyberpunkContent>
</CardCyberpunk>
```

## Testing Checklist

After migration, verify:

- [ ] Component renders in light mode
- [ ] Component renders in dark (cyberpunk) mode
- [ ] Animations work smoothly
- [ ] Interactive states (hover, focus, active) work
- [ ] Responsive design works on mobile, tablet, desktop
- [ ] Accessibility (keyboard navigation, screen readers)
- [ ] No console errors or warnings
- [ ] TypeScript types are correct

## Troubleshooting

### Issue: Components not getting cyberpunk styles

**Solution:** Ensure the component is wrapped in `<div className="new-design">`:

```tsx
<div className="new-design">
  <YourComponent />
</div>
```

### Issue: Glow effects not appearing

**Solution:** Glow effects only appear in dark mode. Test with:

```tsx
<html className="dark">
```

### Issue: Fonts not loading

**Solution:** Check that fonts are imported in `cyberpunk/index.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400..900&display=swap');
```

## Gradual Migration Strategy

1. **Phase 1**: Migrate layout and navigation
2. **Phase 2**: Migrate most-used pages (Projects, Tasks)
3. **Phase 3**: Migrate settings and secondary pages
4. **Phase 4**: Migrate modals and dialogs
5. **Phase 5**: Remove legacy code

## Getting Help

- Check the [Cyberpunk Theme Guide](./CYBERPUNK_THEME_GUIDE.md)
- Review the [showcase page](/showcase/cyberpunk) for examples
- Open an issue on GitHub