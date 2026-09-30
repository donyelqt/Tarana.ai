/**
 * Welcome header contract.
 *
 * The card is a link to profile settings, so it must be reachable and
 * labeled as one. It must not, however, move on its own: the 2s self-hover
 * timer is gone, and hover is a response to a real pointer. A reintroduced
 * timer flips the class list without input, so advancing time covers it.
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, act } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/use-toast';
import { SoundProvider } from '@/lib/sound/SoundProvider';
import { SidebarProvider } from '@/components/Sidebar';
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
      <SidebarProvider><SoundProvider><ToastProvider>
        <Dashboard />
      </ToastProvider></SoundProvider></SidebarProvider>
    </QueryClientProvider>
  );
}

function welcomeCard(): HTMLElement {
  const heading = screen.getByRole('heading', { name: /welcome back/i });
  const card = heading.closest('a');
  if (!card) throw new Error('welcome card link not found');
  return card as HTMLElement;
}

describe('welcome header motion', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('is a link to profile settings', () => {
    renderDashboard();
    const link = welcomeCard();
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/settings');
    expect(link).toHaveTextContent(/open profile settings/i);
  });

  it('does not move on its own', () => {
    renderDashboard();
    const before = welcomeCard().getAttribute('class');
    act(() => {
      jest.advanceTimersByTime(6000);
    });
    expect(welcomeCard().getAttribute('class')).toBe(before);
  });
});