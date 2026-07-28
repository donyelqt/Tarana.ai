'use client';

import React, { useEffect, useId, useState } from 'react';

interface RouteAnalysisLoaderProps {
  showText?: boolean;
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeScales: Record<string, string> = {
  sm: 'scale-[0.55]',
  md: 'scale-100',
  lg: 'scale-[1.3]',
};

const STATUS_MESSAGES = [
  { main: 'Finding routes...', sub: 'SEARCHING NETWORK' },
  { main: 'Analyzing alternatives', sub: '3 ROUTES EVALUATED' },
  { main: 'Checking traffic...', sub: '5 INCIDENTS LOADED' },
  { main: 'Optimal route found', sub: '14 MIN · 12.3 KM' },
  { main: 'Saves 4 min vs shortest', sub: 'AVOIDS 2 INCIDENTS' },
];

const OPTIMAL_PATH_D =
  'M20,90 Q 50,75 80,65 Q 100,55 120,50 Q 140,45 165,42 L 180,40';

const OPTIMAL_SEGMENTS = [
  { d: 'M20,90 Q 50,75 80,65', color: '#22c55e', delay: 0 },
  { d: 'M80,65 Q 100,55 120,50', color: '#eab308', delay: 0.25 },
  { d: 'M120,50 Q 140,45 165,42', color: '#ef4444', delay: 0.5 },
  { d: 'M165,42 L 180,40', color: '#22c55e', delay: 0.75 },
];

const GHOST_ROUTES = [
  { d: 'M20,90 Q 30,40 80,30 T 180,40', delay: 0.2 },
  { d: 'M20,90 L 100,75 L 180,75 L 180,40', delay: 0.7 },
  { d: 'M20,90 Q 60,120 100,115 T 180,40', delay: 1.2 },
];

const WAYPOINTS = [
  { id: 'waypoint-1', cx: 80, cy: 65, label: '1', delay: 0 },
  { id: 'waypoint-2', cx: 120, cy: 50, label: '2', delay: 0.25 },
];

/**
 * Route discovery simulation mini-map.
 *
 * Iter-3 (brutal roast pass): replaces the abstract constellation with a
 * realistic, domain-specific navigation loading state.
 *
 *   - Mini-map canvas with dot grid, building blocks, a main highway, and a
 *     small park for visual texture (no more graph paper).
 *   - Three structurally different ghost routes (north / highway / south)
 *     drawn progressively and dismissed as alternatives.
 *   - Optimal route split into 4 traffic-coloured segments (green / yellow /
 *     red / green) that draw sequentially to communicate real-time traffic.
 *   - Two numbered waypoint markers pop in along the optimal route.
 *   - A glowing vehicle dot rides along the optimal path via CSS Motion Path
 *     (offset-path) after the segments are drawn.
 *   - Origin / destination use real navigation-pin SVGs with drop-shadow
 *     filter and pulse rings, not flat dots.
 *   - Glass card with backdrop-blur, subtle border, and a "FASTEST" badge
 *     that pops in once the optimal route resolves.
 *   - Data-rich status text cycles through real navigation terminology.
 *
 * Map-init state (`showText={false}`) renders a tiny mini-map card with two
 * pulsing endpoint markers — keeps both contexts intact, just leaner.
 */
export default function RouteAnalysisLoader({
  showText = true,
  text,
  size = 'md',
  className = '',
}: RouteAnalysisLoaderProps) {
  const uid = useId();
  const gridId = `mini-grid-${uid}`;
  const shadowId = `pin-shadow-${uid}`;

  const [autoMsg, setAutoMsg] = useState(text ? { main: text, sub: '' } : STATUS_MESSAGES[0]);

  useEffect(() => {
    if (text) {
      setAutoMsg({ main: text, sub: '' });
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % STATUS_MESSAGES.length;
      setAutoMsg(STATUS_MESSAGES[i]);
    }, 1100);
    return () => clearInterval(id);
  }, [text]);

  if (!showText) {
    return (
      <div
        className={`relative ${sizeScales[size] ?? 'scale-100'} ${className}`}
        style={{ width: 80, height: 50 }}
      >
        <svg viewBox="0 0 80 50" className="w-full h-full block rounded-md">
          <defs>
            <pattern id={`mini-grid-${uid}-mini`} width="10" height="10" patternUnits="userSpaceOnUse">
              <circle cx="0.5" cy="0.5" r="0.5" className="fill-gray-200" />
            </pattern>
          </defs>
          <rect width="80" height="50" rx="6" fill="#f9fafb" />
          <rect width="80" height="50" rx="6" fill={`url(#mini-grid-${uid}-mini)`} />
          <line x1="0" y1="25" x2="80" y2="25" stroke="#e5e7eb" strokeWidth="1" />
          <line x1="40" y1="0" x2="40" y2="50" stroke="#e5e7eb" strokeWidth="1" />
          <circle cx="15" cy="35" r="3" fill="#22c55e" className="animate-pulse" />
          <circle cx="65" cy="15" r="3" fill="#ef4444" className="animate-pulse" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center ${className}`}
      role="status"
      aria-live="polite"
      aria-label={`${autoMsg.main}${autoMsg.sub ? `. ${autoMsg.sub}` : ''}`}
    >
      <div
        className={`relative rounded-2xl overflow-hidden shadow-lg bg-white/95 backdrop-blur-sm border border-black/5 ${sizeScales[size] ?? 'scale-100'}`}
        style={{ width: 200, height: 130 }}
      >
        <svg viewBox="0 0 200 130" className="w-full h-full block">
          <defs>
            <pattern id={gridId} width="12" height="12" patternUnits="userSpaceOnUse">
              <circle cx="0.5" cy="0.5" r="0.5" className="fill-gray-200" />
            </pattern>
            <filter id={shadowId} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.28" />
            </filter>
          </defs>

          {/* Map canvas */}
          <rect width="200" height="130" rx="10" fill="#f9fafb" />
          <rect width="200" height="130" rx="10" fill={`url(#${gridId})`} />

          {/* Building blocks (city texture) */}
          <rect x="28" y="18" width="26" height="20" rx="2" fill="#e5e7eb" />
          <rect x="62" y="22" width="20" height="16" rx="2" fill="#e5e7eb" />
          <rect x="98" y="62" width="28" height="22" rx="2" fill="#e5e7eb" />
          <rect x="138" y="68" width="22" height="28" rx="2" fill="#e5e7eb" />
          <rect x="36" y="78" width="20" height="18" rx="2" fill="#d1fae5" opacity="0.55" />

          {/* Local streets */}
          <line x1="0" y1="50" x2="200" y2="50" stroke="#f3f4f6" strokeWidth="5" />
          <line x1="0" y1="100" x2="200" y2="100" stroke="#f3f4f6" strokeWidth="5" />
          <line x1="60" y1="0" x2="60" y2="130" stroke="#f3f4f6" strokeWidth="5" />
          <line x1="140" y1="0" x2="140" y2="130" stroke="#f3f4f6" strokeWidth="5" />

          {/* Main highway */}
          <path d="M 0,75 Q 100,72 200,75" stroke="#cbd5e1" strokeWidth="7" fill="none" />
          <path
            d="M 0,75 Q 100,72 200,75"
            stroke="#94a3b8"
            strokeWidth="0.8"
            fill="none"
            strokeDasharray="5 4"
            opacity="0.55"
          />

          {/* Ghost alternative routes */}
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {GHOST_ROUTES.map((g, i) => (
              <path
                key={`ghost-${i}`}
                d={g.d}
                className="ghost-route"
                style={{ animationDelay: `${g.delay}s` }}
              />
            ))}
          </g>

          {/* Optimal route — traffic-coloured segments */}
          <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5">
            {OPTIMAL_SEGMENTS.map((seg, i) => (
              <path
                key={`opt-${i}`}
                d={seg.d}
                stroke={seg.color}
                className="traffic-segment"
                style={{ animationDelay: `${seg.delay}s` }}
                filter={`url(#${shadowId})`}
              />
            ))}
          </g>

          {/* Celebratory halo over the optimal route */}
          <path
            d={OPTIMAL_PATH_D}
            className="celebrate-halo"
            filter={`url(#${shadowId})`}
          />

          {/* Vehicle dot riding the optimal path */}
          <circle
            cx="20"
            cy="90"
            r="3.5"
            fill="#0066FF"
            stroke="white"
            strokeWidth="1.5"
            className="vehicle-dot"
            filter={`url(#${shadowId})`}
          />

          {/* Waypoint markers */}
          {WAYPOINTS.map((wp) => (
            <g
              key={wp.id}
              className={wp.id}
              style={{
                transformOrigin: `${wp.cx}px ${wp.cy}px`,
                transformBox: 'view-box',
              }}
            >
              <circle
                cx={wp.cx}
                cy={wp.cy}
                r="5.5"
                fill="white"
                stroke="#0066FF"
                strokeWidth="1.8"
                filter={`url(#${shadowId})`}
              />
              <text
                x={wp.cx}
                y={wp.cy}
                fontSize="6"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#0066FF"
                fontWeight="700"
                fontFamily="ui-monospace, SFMono-Regular, monospace"
              >
                {wp.label}
              </text>
            </g>
          ))}

          {/* FASTEST badge */}
          <g
            className="badge-fastest"
            style={{ transformOrigin: '170px 13px', transformBox: 'view-box' }}
          >
            <rect x="144" y="6" width="50" height="14" rx="7" fill="#22c55e" filter={`url(#${shadowId})`} />
            <text
              x="169"
              y="13"
              fontSize="6.5"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontWeight="700"
              fontFamily="ui-monospace, SFMono-Regular, monospace"
              letterSpacing="0.6"
            >
              FASTEST
            </text>
          </g>

          {/* Origin pin */}
          <g
            className="origin-pin"
            style={{ transformOrigin: '20px 90px', transformBox: 'view-box' }}
          >
            <path
              d="M0,-6 C6,-6 6,4 0,10 C-6,4 -6,-6 0,-6 Z"
              fill="#22c55e"
              filter={`url(#${shadowId})`}
            />
            <circle cx="0" cy="-2" r="2.2" fill="white" />
            <circle cx="0" cy="-2" r="6" fill="#22c55e" className="marker-ping" />
          </g>

          {/* Destination pin */}
          <g
            className="destination-pin"
            style={{ transformOrigin: '180px 40px', transformBox: 'view-box' }}
          >
            <path
              d="M0,-6 C6,-6 6,4 0,10 C-6,4 -6,-6 0,-6 Z"
              fill="#ef4444"
              filter={`url(#${shadowId})`}
            />
            <circle cx="0" cy="-2" r="2.2" fill="white" />
            <circle cx="0" cy="-2" r="6" fill="#ef4444" className="marker-ping" />
          </g>
        </svg>
      </div>

      {showText && (
        <div className="mt-3 flex flex-col items-center gap-0.5 text-center">
          <p className="text-sm font-semibold text-gray-800 tracking-wide">{autoMsg.main}</p>
          <p className="text-[10px] text-gray-400 font-mono tracking-[0.18em]">
            {autoMsg.sub}
          </p>
        </div>
      )}
    </div>
  );
}
