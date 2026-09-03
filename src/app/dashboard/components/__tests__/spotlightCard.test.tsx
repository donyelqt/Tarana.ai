import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SpotlightCard from '../cards/SpotlightCard';

const props = {
  name: 'Burnham Park',
  image: '/images/burnham.png',
  distance: '~0.5km',
  time: '~2 min',
  traffic: 'Low' as const,
  ctaText: 'Visit Spot',
  lat: 16.4093,
  lon: 120.595,
};

describe('SpotlightCard map facade', () => {
  it('shows a Show map button instead of an eager iframe', () => {
    const { container } = render(<SpotlightCard {...props} />);
    expect(
      screen.getByRole('button', { name: 'Load map for Burnham Park' })
    ).toBeInTheDocument();
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('loads the embed only after tap, with the right coords', () => {
    const { container } = render(<SpotlightCard {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Load map for Burnham Park' }));
    const iframe = container.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('src')).toContain('16.4093');
    expect(iframe?.getAttribute('title')).toBe('Burnham Park map');
  });

  it('renders no map UI for unmapped places', () => {
    const { container, queryByRole } = render(
      <SpotlightCard {...props} name="No Such Place Xyz" lat={undefined} lon={undefined} />
    );
    expect(container.querySelector('iframe')).toBeNull();
    expect(queryByRole('button', { name: /Load map/ })).toBeNull();
    // CTA still works without coordinates
    expect(screen.getByRole('button', { name: 'Visit Spot' })).toBeInTheDocument();
  });
});
