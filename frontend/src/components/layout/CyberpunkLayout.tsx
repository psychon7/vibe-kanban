import { Outlet } from 'react-router-dom';
import { DevBanner } from '@/components/DevBanner';
import { CyberpunkNavbar } from './CyberpunkNavbar';

export function CyberpunkLayout() {
  return (
    <div className="flex flex-col h-screen bg-cp-background text-cp-foreground">
      <DevBanner />
      <CyberpunkNavbar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}