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

describe('SpotlightCard', () => {
  it('renders no map facade — Visit Spot is the only way onto the map', () => {
    // The Google Maps embed was the app's last external Google dependency and
    // duplicated Visit Spot. Removed: one map, one route, one privacy surface.
    const { container } = render(<SpotlightCard {...props} />);
    expect(screen.queryByRole('button', { name: /load map/i })).not.toBeInTheDocument();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.innerHTML).not.toContain('google.com');
  });

  it('renders no map UI for unmapped places', () => {
    const { container, queryByRole } = render(
      <SpotlightCard {...props} name="No Such Place Xyz" lat={undefined} lon={undefined} />
    );
    expect(container.querySelector('iframe')).toBeNull();
    expect(queryByRole('button', { name: /load map/i })).toBeNull();
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

  it('never references Google Maps anywhere in the rendered card', () => {
    // Was `<a>` hrefs only, which let the iframe slip through. The embed is
    // gone now; this guards against any future reintroduction in any element.
    const { container } = render(<SpotlightCard {...props} />);
    expect(container.innerHTML).not.toContain('google.com');
    expect(container.innerHTML).not.toContain('googleapis');
    expect(container.querySelector('iframe')).toBeNull();
  });
});
