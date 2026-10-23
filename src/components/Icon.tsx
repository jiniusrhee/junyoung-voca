import type { CSSProperties, ReactElement } from 'react';

export type IconName =
  | 'back'
  | 'close'
  | 'gear'
  | 'trophy'
  | 'heart'
  | 'heartFill'
  | 'question'
  | 'mic'
  | 'check'
  | 'book'
  | 'speaker'
  | 'rabbit'
  | 'turtle'
  | 'play'
  | 'chat'
  | 'note'
  | 'bulb'
  | 'keyboard'
  | 'search'
  | 'flame'
  | 'star'
  | 'chart'
  | 'chevron'
  | 'pencil'
  | 'wave'
  | 'backspace'
  | 'list'
  | 'caret'
  | 'bell'
  | 'hourglass'
  | 'xcircle'
  | 'bookPerson'
  | 'shield'
  | 'house'
  | 'pie'
  | 'grid'
  | 'ruby'
  | 'dict'
  | 'clock'
  | 'gbook'
  | 'talk'
  | 'headphones'
  | 'bookmark';

interface Props {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export default function Icon({ name, size = 24, className, style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={style}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}

const PATHS: Record<IconName, ReactElement> = {
  back: <polyline points="15 4 7 12 15 20" strokeWidth={2.6} />,
  close: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  gear: (
    <g fill="currentColor" stroke="none">
      <path d="M10.3 2h3.4l.5 2.6a8 8 0 0 1 1.9 1.1l2.5-.9 1.7 2.9-2 1.8a8 8 0 0 1 0 2.2l2 1.8-1.7 2.9-2.5-.9a8 8 0 0 1-1.9 1.1l-.5 2.6h-3.4l-.5-2.6a8 8 0 0 1-1.9-1.1l-2.5.9-1.7-2.9 2-1.8a8 8 0 0 1 0-2.2l-2-1.8 1.7-2.9 2.5.9a8 8 0 0 1 1.9-1.1z" />
      <circle cx="12" cy="12" r="3.2" fill="#fff" fillOpacity="0.9" />
    </g>
  ),
  trophy: (
    <g fill="currentColor" stroke="none">
      <path d="M7 3h10v6a5 5 0 0 1-10 0z" />
      <path d="M7 5H4v2a4 4 0 0 0 4 4M17 5h3v2a4 4 0 0 1-4 4" fill="none" stroke="currentColor" strokeWidth={1.8} />
      <rect x="10.8" y="13" width="2.4" height="4" />
      <rect x="7.5" y="17" width="9" height="3" rx="1" />
    </g>
  ),
  heart: <path d="M12 20.5s-7.2-4.4-9-9.1C1.7 7.8 4.3 4.5 7.6 4.5c1.9 0 3.4 1 4.4 2.5 1-1.5 2.5-2.5 4.4-2.5 3.3 0 5.9 3.3 4.6 6.9-1.8 4.7-9 9.1-9 9.1z" />,
  heartFill: (
    <path
      d="M12 20.5s-7.2-4.4-9-9.1C1.7 7.8 4.3 4.5 7.6 4.5c1.9 0 3.4 1 4.4 2.5 1-1.5 2.5-2.5 4.4-2.5 3.3 0 5.9 3.3 4.6 6.9-1.8 4.7-9 9.1-9 9.1z"
      fill="currentColor"
    />
  ),
  question: (
    <g>
      <circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" />
      <path d="M9.4 9.3a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.2-2.6 3.8" stroke="#fff" strokeWidth={2.2} />
      <circle cx="12" cy="17.2" r="1.3" fill="#fff" stroke="none" />
    </g>
  ),
  mic: (
    <g>
      <rect x="9" y="2.5" width="6" height="11.5" rx="3" fill="currentColor" stroke="none" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <line x1="12" y1="17.5" x2="12" y2="21" />
    </g>
  ),
  check: <polyline points="4 12.5 9.5 18 20 6" strokeWidth={3} />,
  book: (
    <g fill="currentColor" stroke="none">
      <path d="M2 5.2C4.8 4.1 8.3 4.3 11 6v13.2c-2.7-1.6-6.2-1.8-9-.8z" />
      <path d="M22 5.2c-2.8-1.1-6.3-.9-9 .8v13.2c2.7-1.6 6.2-1.8 9-.8z" />
    </g>
  ),
  speaker: (
    <g>
      <path d="M3 9.5h4l5-4.5v14l-5-4.5H3z" fill="currentColor" stroke="none" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </g>
  ),
  rabbit: (
    <g fill="currentColor" stroke="none">
      <ellipse cx="8.5" cy="6" rx="1.8" ry="4.6" transform="rotate(-18 8.5 6)" />
      <ellipse cx="13" cy="5.5" rx="1.8" ry="4.6" transform="rotate(12 13 5.5)" />
      <ellipse cx="11.5" cy="15" rx="7.5" ry="5.5" />
      <circle cx="5.2" cy="12.2" r="3.4" />
      <circle cx="19.4" cy="15.2" r="1.8" />
    </g>
  ),
  turtle: (
    <g fill="currentColor" stroke="none">
      <path d="M3.5 15a8.5 7 0 0 1 17 0z" />
      <circle cx="21" cy="12.6" r="2.2" />
      <rect x="5" y="15" width="3" height="3.4" rx="1.4" />
      <rect x="15" y="15" width="3" height="3.4" rx="1.4" />
      <path d="M2.2 15.2l-1.4 1.4" stroke="currentColor" strokeWidth={1.6} />
    </g>
  ),
  play: <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none" />,
  chat: (
    <g>
      <path d="M4 4h16a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 20 17h-8l-5 4v-4H4a1.5 1.5 0 0 1-1.5-1.5v-10A1.5 1.5 0 0 1 4 4z" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="10.5" r="1.2" fill="#fff" stroke="none" />
      <circle cx="12" cy="10.5" r="1.2" fill="#fff" stroke="none" />
      <circle cx="15.5" cy="10.5" r="1.2" fill="#fff" stroke="none" />
    </g>
  ),
  note: (
    <g>
      <rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" stroke="none" />
      <path d="M6.5 8l2.2 8 2.2-6 2.2 6 2.2-8" stroke="#fff" strokeWidth={1.9} />
    </g>
  ),
  bulb: (
    <g>
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V17h5.2v-1.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" fill="currentColor" stroke="none" />
      <path d="M9.6 20h4.8" />
    </g>
  ),
  keyboard: (
    <g>
      <rect x="2" y="5" width="20" height="14" rx="2.5" fill="currentColor" stroke="none" />
      <g fill="#fff" stroke="none">
        <rect x="5" y="8" width="2" height="2" rx=".5" />
        <rect x="9" y="8" width="2" height="2" rx=".5" />
        <rect x="13" y="8" width="2" height="2" rx=".5" />
        <rect x="17" y="8" width="2" height="2" rx=".5" />
        <rect x="7" y="14" width="10" height="2" rx="1" />
      </g>
    </g>
  ),
  search: (
    <g>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <line x1="15.5" y1="15.5" x2="20.5" y2="20.5" strokeWidth={2.6} />
    </g>
  ),
  flame: (
    <path
      d="M12 2.5c.6 3.2 3.8 4.9 4.9 8.2 1.4 4.4-1.6 9.3-6 9.3-3.9 0-6.8-3-6.8-6.6 0-2.7 1.5-4.4 2.8-5.6.2 1.8 1 3.1 2.2 3.6-.5-3.3 1.3-6.6 2.9-8.9z"
      fill="currentColor"
      stroke="none"
    />
  ),
  star: <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="currentColor" stroke="none" />,
  chart: (
    <g fill="currentColor" stroke="none">
      <rect x="3" y="12" width="4" height="9" rx="1.2" />
      <rect x="10" y="6" width="4" height="15" rx="1.2" />
      <rect x="17" y="2.5" width="4" height="18.5" rx="1.2" />
    </g>
  ),
  chevron: <polyline points="9 5 16 12 9 19" />,
  pencil: (
    <g>
      <path d="M4 20l1-4.5L16 4.5l3.5 3.5L8.5 19z" />
      <line x1="13.5" y1="7" x2="17" y2="10.5" />
    </g>
  ),
  wave: (
    <g strokeWidth={2.4}>
      <line x1="4" y1="10" x2="4" y2="14" />
      <line x1="8" y1="7" x2="8" y2="17" />
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="16" y1="7" x2="16" y2="17" />
      <line x1="20" y1="10" x2="20" y2="14" />
    </g>
  ),
  backspace: (
    <g>
      <path d="M8 5h12a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 20 19H8l-6-7z" />
      <line x1="11" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="11" y2="15" />
    </g>
  ),
  list: (
    <g>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </g>
  ),
  caret: <path d="M6 9l6 6 6-6z" fill="currentColor" stroke="none" />,
  bell: (
    <g fill="currentColor" stroke="none">
      <path d="M12 2.5a1.6 1.6 0 0 1 1.6 1.6v.6A6.5 6.5 0 0 1 18.5 11v4.2l1.8 2.3c.4.5 0 1.3-.7 1.3H4.4c-.7 0-1.1-.8-.7-1.3l1.8-2.3V11a6.5 6.5 0 0 1 4.9-6.3v-.6A1.6 1.6 0 0 1 12 2.5z" />
      <path d="M9.5 20h5a2.5 2.5 0 0 1-5 0z" />
    </g>
  ),
  hourglass: (
    <g fill="currentColor" stroke="none">
      <rect x="5" y="2.5" width="14" height="2.4" rx="1.2" />
      <rect x="5" y="19.1" width="14" height="2.4" rx="1.2" />
      <path d="M7 5h10c0 3.5-3 5.2-3 7s3 3.5 3 7H7c0-3.5 3-5.2 3-7S7 8.5 7 5z" />
    </g>
  ),
  xcircle: (
    <g>
      <circle cx="9" cy="10" r="6.5" stroke="#3fb67a" strokeWidth={2.4} />
      <line x1="13" y1="13" x2="21" y2="21" stroke="#f0566a" strokeWidth={2.6} />
      <line x1="21" y1="13" x2="13" y2="21" stroke="#f0566a" strokeWidth={2.6} />
    </g>
  ),
  bookPerson: (
    <g fill="currentColor" stroke="none">
      <circle cx="12" cy="5.5" r="3.2" />
      <path d="M2 10.5c3.6-1.2 7-.8 9.3 1.3v9.6c-2.4-1.8-5.7-2.1-9.3-1z" />
      <path d="M22 10.5c-3.6-1.2-7-.8-9.3 1.3v9.6c2.4-1.8 5.7-2.1 9.3-1z" />
    </g>
  ),
  house: <path d="M3 11.2 12 3.5l9 7.7V20a1.5 1.5 0 0 1-1.5 1.5H15v-6h-6v6H4.5A1.5 1.5 0 0 1 3 20z" fill="currentColor" stroke="none" />,
  pie: (
    <g fill="currentColor" stroke="none">
      <path d="M11 3.1A9 9 0 1 0 20.9 13H11z" />
      <path d="M13 2.1V11h8.9A9 9 0 0 0 13 2.1z" opacity="0.75" />
    </g>
  ),
  grid: (
    <g fill="currentColor" stroke="none">
      <rect x="3" y="3" width="8" height="8" rx="2.2" />
      <rect x="13" y="3" width="8" height="8" rx="2.2" />
      <rect x="3" y="13" width="8" height="8" rx="2.2" />
      <rect x="13" y="13" width="8" height="8" rx="2.2" />
    </g>
  ),
  ruby: (
    <g stroke="none">
      <path d="M6 4h12l4 5-10 12L2 9z" fill="#ff6b81" />
      <path d="M2 9h20L12 21z" fill="#e8475f" />
      <path d="M8.5 4 7 9h10l-1.5-5z" fill="#ffa3b1" />
    </g>
  ),
  gbook: (
    <g stroke="none">
      <path d="M5 3h12.5A1.5 1.5 0 0 1 19 4.5V19H6.5A1.5 1.5 0 0 0 5 20.5z" fill="currentColor" />
      <path d="M5 20.5A1.5 1.5 0 0 1 6.5 19H19v2H6.5A1.5 1.5 0 0 1 5 20.5z" fill="currentColor" opacity="0.6" />
      <text x="12" y="15" textAnchor="middle" fontSize="10" fontWeight="800" fill="#1d2b33" fontFamily="system-ui, sans-serif">G</text>
    </g>
  ),
  talk: (
    <g stroke="none" fill="currentColor">
      <path d="M8 3h12a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 14h-1.5v3l-3.5-3H8a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 8 3z" />
      <path d="M4 8h1.5v5.5A2.5 2.5 0 0 0 8 16h6l-2 2H7.5l-3 2.5V18H4a1.5 1.5 0 0 1-1.5-1.5v-7A1.5 1.5 0 0 1 4 8z" opacity="0.7" />
      <rect x="10" y="6.5" width="8" height="1.6" rx="0.8" fill="#2b3320" />
      <rect x="10" y="9.5" width="5.5" height="1.6" rx="0.8" fill="#2b3320" />
    </g>
  ),
  headphones: (
    <g>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" strokeWidth={2.4} />
      <rect x="2.5" y="13.5" width="5" height="7.5" rx="2" fill="currentColor" stroke="none" />
      <rect x="16.5" y="13.5" width="5" height="7.5" rx="2" fill="currentColor" stroke="none" />
    </g>
  ),
  bookmark: <path d="M6 3h12v18l-6-4.5L6 21z" fill="currentColor" stroke="none" />,
  clock: (
    <g>
      <circle cx="12" cy="12" r="9.5" fill="#cfe0f7" stroke="none" />
      <circle cx="12" cy="12" r="7.6" fill="#fff" stroke="none" />
      <path d="M12 7.5V12l3 2" stroke="#3b6fb6" strokeWidth={2} />
    </g>
  ),
  dict: (
    <g>
      <rect x="3" y="2.5" width="14" height="19" rx="2" fill="#5b8fd6" stroke="none" />
      <rect x="5.5" y="5" width="9" height="2" rx="1" fill="#cfe2ff" stroke="none" />
      <circle cx="16" cy="15.5" r="4.2" fill="#2b3a55" stroke="#cfe2ff" strokeWidth={1.8} />
      <line x1="19" y1="18.5" x2="21.5" y2="21" stroke="#cfe2ff" strokeWidth={2.2} />
    </g>
  ),
  shield: (
    <g>
      <path d="M12 2.5l7.5 3v6c0 4.6-3.2 8.4-7.5 10-4.3-1.6-7.5-5.4-7.5-10v-6z" fill="currentColor" stroke="none" />
      <polyline points="8.5 12 11 14.5 15.5 9.5" stroke="#fff" strokeWidth={2.2} />
    </g>
  ),
};
