import { useState } from 'react';
import {
  CardCyberpunk,
  CardCyberpunkHeader,
  CardCyberpunkTitle,
  CardCyberpunkDescription,
  CardCyberpunkContent,
  CardCyberpunkFooter,
  ButtonCyberpunk,
  InputCyberpunk,
  LoadingSpinner,
  StatusIndicator,
} from '@/components/ui-cyberpunk';
import { 
  Rocket, 
  Lightning, 
  Code, 
  Database,
  GitBranch,
  Terminal 
} from '@phosphor-icons/react';

export function CyberpunkShowcase() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="container mx-auto p-8 space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4 py-12">
        <h1 className="text-heading-1 font-[Orbitron] dark:text-cp-primary animate-fade-in">
          Cyberpunk Theme Showcase
        </h1>
        <p className="text-body-large text-muted-foreground max-w-2xl mx-auto animate-fade-in animation-delay-100">
          Experience the future of UI design with neon glows, glass morphism, and smooth animations.
        </p>
      </div>

      {/* Status Indicators */}
      <CardCyberpunk variant="glass" className="animate-fade-in animation-delay-200">
        <CardCyberpunkHeader>
          <CardCyberpunkTitle>Status Indicators</CardCyberpunkTitle>
          <CardCyberpunkDescription>
            Real-time system status with animated indicators
          </CardCyberpunkDescription>
        </CardCyberpunkHeader>
        <CardCyberpunkContent className="flex flex-wrap gap-6">
          <StatusIndicator status="online" label="System Online" />
          <StatusIndicator status="busy" label="Processing" animated />
          <StatusIndicator status="away" label="Standby" />
          <StatusIndicator status="offline" label="Offline" animated={false} />
        </CardCyberpunkContent>
      </CardCyberpunk>

      {/* Button Variants Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <CardCyberpunk variant="neon" className="animate-slide-in-left">
          <CardCyberpunkHeader>
            <CardCyberpunkTitle className="flex items-center gap-2">
              <Rocket className="size-6" weight="duotone" />
              Primary Actions
            </CardCyberpunkTitle>
          </CardCyberpunkHeader>
          <CardCyberpunkContent className="space-y-3">
            <ButtonCyberpunk variant="cyber-primary" className="w-full">
              <Lightning className="size-4" weight="fill" />
              Cyber Primary
            </ButtonCyberpunk>
            <ButtonCyberpunk variant="cyber-secondary" className="w-full">
              <Code className="size-4" weight="fill" />
              Cyber Secondary
            </ButtonCyberpunk>
            <ButtonCyberpunk variant="cyber-accent" className="w-full">
              <Database className="size-4" weight="fill" />
              Cyber Accent
            </ButtonCyberpunk>
          </CardCyberpunkContent>
        </CardCyberpunk>

        <CardCyberpunk variant="glass" className="animate-slide-in-left animation-delay-100">
          <CardCyberpunkHeader>
            <CardCyberpunkTitle className="flex items-center gap-2">
              <GitBranch className="size-6" weight="duotone" />
              Outlined Variants
            </CardCyberpunkTitle>
          </CardCyberpunkHeader>
          <CardCyberpunkContent className="space-y-3">
            <ButtonCyberpunk variant="cyber-ghost" className="w-full">
              Ghost Button
            </ButtonCyberpunk>
            <ButtonCyberpunk variant="cyber-outline" className="w-full">
              Outline Button
            </ButtonCyberpunk>
            <ButtonCyberpunk variant="cyber-glass" className="w-full">
              Glass Morph
            </ButtonCyberpunk>
          </CardCyberpunkContent>
        </CardCyberpunk>

        <CardCyberpunk variant="default" className="animate-slide-in-left animation-delay-200">
          <CardCyberpunkHeader>
            <CardCyberpunkTitle className="flex items-center gap-2">
              <Terminal className="size-6" weight="duotone" />
              Status Actions
            </CardCyberpunkTitle>
          </CardCyberpunkHeader>
          <CardCyberpunkContent className="space-y-3">
            <ButtonCyberpunk variant="cyber-success" className="w-full">
              Success Action
            </ButtonCyberpunk>
            <ButtonCyberpunk variant="cyber-destructive" className="w-full">
              Destructive Action
            </ButtonCyberpunk>
            <ButtonCyberpunk variant="default" className="w-full">
              Standard Button
            </ButtonCyberpunk>
          </CardCyberpunkContent>
        </CardCyberpunk>
      </div>

      {/* Form Elements */}
      <CardCyberpunk variant="neon" className="animate-fade-in">
        <CardCyberpunkHeader>
          <CardCyberpunkTitle>Input Fields</CardCyberpunkTitle>
          <CardCyberpunkDescription>
            Neon-styled input fields with glow effects on focus
          </CardCyberpunkDescription>
        </CardCyberpunkHeader>
        <CardCyberpunkContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Default Input</label>
              <InputCyberpunk placeholder="Enter text..." />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Neon Input</label>
              <InputCyberpunk variant="neon" placeholder="With glow effect..." />
            </div>
          </div>
        </CardCyberpunkContent>
        <CardCyberpunkFooter className="gap-3">
          <ButtonCyberpunk 
            variant="cyber-primary"
            onClick={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 2000);
            }}
            disabled={loading}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" variant="primary" />
                Processing...
              </>
            ) : (
              'Submit'
            )}
          </ButtonCyberpunk>
          <ButtonCyberpunk variant="cyber-ghost">
            Cancel
          </ButtonCyberpunk>
        </CardCyberpunkFooter>
      </CardCyberpunk>

      {/* Loading States */}
      <CardCyberpunk variant="glass" className="animate-fade-in">
        <CardCyberpunkHeader>
          <CardCyberpunkTitle>Loading Spinners</CardCyberpunkTitle>
          <CardCyberpunkDescription>
            Animated loading indicators with neon glow
          </CardCyberpunkDescription>
        </CardCyberpunkHeader>
        <CardCyberpunkContent className="flex items-center justify-around py-8">
          <div className="flex flex-col items-center gap-2">
            <LoadingSpinner size="sm" variant="primary" />
            <span className="text-xs text-muted-foreground">Small</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <LoadingSpinner size="md" variant="secondary" />
            <span className="text-xs text-muted-foreground">Medium</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <LoadingSpinner size="lg" variant="accent" />
            <span className="text-xs text-muted-foreground">Large</span>
          </div>
        </CardCyberpunkContent>
      </CardCyberpunk>

      {/* Visual Effects Demo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-morph p-6 rounded-lg border border-cp-primary/30 animate-glow-pulse">
          <h3 className="font-semibold mb-2">Glass Morphism</h3>
          <p className="text-sm text-muted-foreground">
            Frosted glass effect with blur
          </p>
        </div>
        <div className="neon-card p-6 rounded-lg">
          <h3 className="font-semibold mb-2">Neon Card</h3>
          <p className="text-sm text-muted-foreground">
            Hover to see the glow effect
          </p>
        </div>
        <div className="gradient-cyan-magenta p-6 rounded-lg text-white">
          <h3 className="font-semibold mb-2">Gradient</h3>
          <p className="text-sm opacity-90">
            Cyan to magenta gradient
          </p>
        </div>
      </div>
    </div>
  );
}