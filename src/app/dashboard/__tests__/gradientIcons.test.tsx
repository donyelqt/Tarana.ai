import React from 'react';
import { render } from '@testing-library/react';
import { Plus, Bookmark } from 'lucide-react';
import { DASHBOARD_ICON_GRADIENT_ID } from '../utils';

/**
 * Regression proof for the invisible-Plus incident: the Tailwind arbitrary
 * properties ([stroke:url(...)]) silently failed to resolve in-browser.
 * Literal SVG props are asserted on the rendered <svg> instead — if lucide
 * ever stops forwarding them, this fails loudly instead of blankly.
 */
describe('gradient icon paint contract', () => {
  it('exposes a single shared gradient id', () => {
    expect(DASHBOARD_ICON_GRADIENT_ID).toBe('dash-icon-grad');
  });

  it('Plus forwards a stroke paint server to its svg', () => {
    const { container } = render(
      <Plus stroke={`url(#${DASHBOARD_ICON_GRADIENT_ID})`} data-testid="plus" />
    );
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('stroke')).toBe('url(#dash-icon-grad)');
  });

  it('Bookmark forwards fill + stroke paint servers to its svg', () => {
    const { container } = render(
      <Bookmark
        stroke={`url(#${DASHBOARD_ICON_GRADIENT_ID})`}
        fill={`url(#${DASHBOARD_ICON_GRADIENT_ID})`}
      />
    );
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('stroke')).toBe('url(#dash-icon-grad)');
    expect(svg?.getAttribute('fill')).toBe('url(#dash-icon-grad)');
  });
});
