// Small inline SVG icons (docs/ART_ASSET_LIST.md). Decorative: every icon sits next to a text
// label, so the icons are hidden from screen readers. Drawn with currentColor so they follow the
// text color in normal and high-contrast themes.

interface IconProps {
  size?: number;
}

const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true as const, focusable: 'false' as const });

export function BowlIcon({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 11h18a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8z" fill="currentColor" />
      <path d="M8 8a4 4 0 0 1 8 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  );
}

export function DropIcon({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" fill="currentColor" />
    </svg>
  );
}

export function BoltIcon({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M13 2 5 13h6l-1 9 8-11h-6z" fill="currentColor" />
    </svg>
  );
}

export function HeartIcon({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 21C4 15 2 11 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 3-2 7-10 13z" fill="currentColor" />
    </svg>
  );
}

export function BallIcon({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="9" fill="currentColor" />
      <path d="M6 9a8 8 0 0 1 6-3" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.7" />
    </svg>
  );
}

export function StarIcon({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" fill="currentColor" />
    </svg>
  );
}

export function ShinyIcon({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 2 15 9l7 3-7 3-3 7-3-7-7-3 7-3z" fill="currentColor" />
    </svg>
  );
}

export function MoonIcon({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor" />
    </svg>
  );
}

export function MenuIcon({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
    </svg>
  );
}
