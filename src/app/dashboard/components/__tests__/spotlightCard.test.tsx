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

  it('links Visit Spot to our Explore map, carrying the card content across', () => {
    // The arrival card on Explore is built from these params: photo, title and
    // measured traffic. Dropping traffic would silently hide the tag there.
    render(<SpotlightCard {...props} />);
    const link = screen.getByRole('link', { name: 'Visit Spot: Burnham Park' });
    expect(link.getAttribute('href')).toBe(
      '/tarana-explore?to=Burnham%20Park&toLat=16.4093&toLon=120.595&traffic=Low&img=%2Fimages%2Fburnham.png'
    );
    expect(link.getAttribute('target')).toBeNull();
  });

  it('omits traffic when nothing was measured and skips the placeholder photo', () => {
    // Never invent a traffic level, and never ship the coming-soon placeholder
    // as the arrival card's image.
    render(<SpotlightCard {...props} traffic={undefined} image="/images/comingsoon.png" />);
    const href = screen.getByRole('link', { name: 'Visit Spot: Burnham Park' }).getAttribute('href') ?? '';
    expect(href).not.toContain('traffic=');
    expect(href).not.toContain('img=');
  });

  it('never links Visit Spot to external Google Maps', () => {
    const { container } = render(<SpotlightCard {...props} />);
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(href).not.toContain('google.com');
  });
});
