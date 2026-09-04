/**
 * Welcome header motion contract (Apple-smooth hover).
 * Pins the exact properties that made hover janky before:
 * - Apple easing curve (no mechanical ease-in-out)
 * - strong motion-safe lift restored (reversal of the subtle -y-1: the aura
 *   needs the bigger travel to stay coherent)
 * - no hover:animate-none (it hard-killed the shimmer mid-hover)
 * - 2s auto-toggle pauses while hovered (no class flips mid-flight)
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/use-toast';
import { SoundProvider } from '@/lib/sound/SoundProvider';
import Dashboard from '../page';

jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'user-1', email: 'tester@example.com', name: 'Tester', image: null } },
    status: 'authenticated',
  }),
  signOut: jest.fn(),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

jest.mock('framer-motion', () => ({
  motion: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    span: (props: any) => <span {...props} />,
  },
  useReducedMotion: () => true,
}));

jest.mock('public', () => ({ noProfile: '/stub-profile.png' }), { virtual: true });

jest.mock('../../../../public/images/taranaai2.png', () => '/stub-taranaai2.png', {
  virtual: true,
});

jest.mock('@/lib/data/supabaseMeals', () => ({
  getSavedMeals: async () => [],
}));

function renderDashboard() {
  global.fetch = jest.fn(async (url: unknown) => {
    const u = String(url);
    if (u.includes('/api/weather')) {
      return {
        ok: true,
        json: async () => ({
          main: { temp: 17, feels_like: 15, humidity: 99 },
          weather: [{ id: 500, main: 'Rain', description: 'rain', icon: '10d' }],
          name: 'Baguio',
          sys: { country: 'PH' },
          dt: 1756800000,
        }),
      };
    }
    return { ok: true, json: async () => ({}) };
  }) as unknown as typeof fetch;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SoundProvider><ToastProvider>
        <Dashboard />
      </ToastProvider></SoundProvider>
    </QueryClientProvider>
  );
}

function welcomeCard(): HTMLElement {
  const heading = screen.getByRole('heading', { name: /welcome back/i });
  const card = heading.closest('div.rounded-2xl');
  if (!card) throw new Error('welcome card not found');
  return card as HTMLElement;
}

describe('welcome header motion', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('uses the Apple easing curve with a strong motion-safe lift', () => {
    renderDashboard();
    const cls = welcomeCard().getAttribute('class') ?? '';
    expect(cls).toContain('ease-[cubic-bezier(0.32,0.72,0,1)]');
    expect(cls).toContain('motion-safe:hover:-translate-y-2');
    expect(cls).not.toContain('hover:animate-none');
    expect(cls).not.toContain('ease-in-out');
  });

  it('pauses the auto-toggle while hovered (no mid-hover flips)', () => {
    renderDashboard();
    const card = welcomeCard();
    const before = card.getAttribute('class');
    fireEvent.mouseEnter(card);
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(welcomeCard().getAttribute('class')).toBe(before);
    fireEvent.mouseLeave(card);
  });
});