import React from 'react';

const Svg = ({ children, size = 28, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>
);

export const HeatIcon = ({ size }) => <Svg size={size}><path d="M7 20c-4-5 4-7 0-12M12 20c-4-5 4-7 0-12M17 20c-4-5 4-7 0-12" /></Svg>;
export const SnowIcon = ({ size }) => <Svg size={size}><path d="M12 2v20M4.2 6.5l15.6 11M4.2 17.5l15.6-11M8.8 4l3.2 2 3.2-2M8.8 20l3.2-2 3.2 2" /></Svg>;
export const CheckIcon = ({ size }) => <Svg size={size}><path d="m5 12 4 4L19 6" /></Svg>;
export const UndoIcon = ({ size }) => <Svg size={size}><path d="M9 7 4 12l5 5"/><path d="M5 12h8a6 6 0 0 1 6 6"/></Svg>;
export const BackIcon = ({ size }) => <Svg size={size}><path d="m15 18-6-6 6-6" /></Svg>;
export const PlusIcon = ({ size }) => <Svg size={size}><path d="M12 5v14M5 12h14" /></Svg>;
export const EditIcon = ({ size }) => <Svg size={size}><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/><path d="m14 7 3 3"/></Svg>;
export const UpIcon = ({ size }) => <Svg size={size}><path d="m6 14 6-6 6 6" /></Svg>;
export const DownIcon = ({ size }) => <Svg size={size}><path d="m6 10 6 6 6-6" /></Svg>;
export const PauseIcon = ({ size }) => <Svg size={size}><path d="M8 5v14M16 5v14" /></Svg>;
export const PlayIcon = ({ size }) => <Svg size={size}><path d="m8 5 11 7-11 7V5Z" /></Svg>;
export const LockIcon = ({ size }) => <Svg size={size}><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></Svg>;
export const AlertIcon = ({ size }) => <Svg size={size}><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v4M12 17h.01"/></Svg>;
export const ClipboardIcon = ({ size }) => <Svg size={size}><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/></Svg>;
export const DownloadIcon = ({ size }) => <Svg size={size}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></Svg>;
export const MinusIcon = ({ size }) => <Svg size={size}><path d="M5 12h14" /></Svg>;
export const CupLogo = ({ size = 42 }) => <Svg size={size}><path d="M4 9h14v5a6 6 0 0 1-12 0V9Z"/><path d="M18 10h1a3 3 0 0 1 0 6h-1M7 21h10M8 6c-2-2 2-3 0-5M13 6c-2-2 2-3 0-5"/></Svg>;

export function DrinkIcon({ type = 'latte', temperature = 'hot' }) {
  const accent = temperature === 'hot' ? '#d88713' : '#17608b';
  if (type === 'treat') return (
    <svg viewBox="0 0 92 80" className="drink-illustration" aria-hidden="true">
      <path d="M25 35h42l-5 36H30l-5-36Z" fill="#d88713" opacity=".7" stroke="#6b3e25" strokeWidth="4"/>
      <path d="M24 36c-2-10 7-15 15-12 1-9 16-11 20-2 10-2 16 5 12 14H24Z" fill="#fff3df" stroke="#6b3e25" strokeWidth="4"/>
      <path d="M36 44v19M47 44v19M58 44v19" stroke="#fff3df" strokeWidth="3" opacity=".8"/>
      <circle cx="46" cy="18" r="5" fill="#b44040"/>
    </svg>
  );
  if (type === 'tea') return (
    <svg viewBox="0 0 92 80" className="drink-illustration" aria-hidden="true">
      <path d="M17 27h52v23c0 16-11 25-26 25S17 66 17 50V27Z" fill="#fff" stroke="#6b3e25" strokeWidth="4"/>
      <path d="M68 34h8c14 0 14 21 0 21h-8" fill="none" stroke="#6b3e25" strokeWidth="4"/>
      <path d="M21 42h44v9c0 13-9 20-22 20S21 64 21 51v-9Z" fill="#d89628" opacity=".9"/>
      <path d="M12 58c12-7 18 0 22 13-13 2-21-2-22-13Z" fill="#6c8f47"/>
    </svg>
  );
  if (type === 'black') return (
    <svg viewBox="0 0 92 80" className="drink-illustration" aria-hidden="true">
      <path d="M17 25h52v27c0 15-11 23-26 23S17 67 17 52V25Z" fill="#4a2919" stroke="#4a2919" strokeWidth="4"/>
      <path d="M68 33h8c14 0 14 22 0 22h-8" fill="none" stroke="#4a2919" strokeWidth="5"/>
      <ellipse cx="43" cy="26" rx="26" ry="7" fill="#f4e2ca" stroke="#4a2919" strokeWidth="4"/><ellipse cx="43" cy="27" rx="20" ry="4" fill="#2b1710"/>
    </svg>
  );
  return (
    <svg viewBox="0 0 92 80" className="drink-illustration" aria-hidden="true">
      <path d="M18 30h52v22c0 15-11 23-26 23S18 67 18 52V30Z" fill="#fffdfa" stroke="#6b3e25" strokeWidth="4"/>
      <path d="M69 36h7c14 0 14 20 0 20h-7" fill="none" stroke="#6b3e25" strokeWidth="4"/>
      <path d="M22 44h44v9c0 11-9 18-22 18s-22-7-22-18v-9Z" fill={accent} opacity=".55"/>
      <path d="M25 31c4-14 10-9 14-19 5 8 7 9 11 1 2 9 12 9 14 18" fill="#f5eadc" stroke="#6b3e25" strokeWidth="3"/>
      {type === 'mocha' && <path d="M31 24c8 5 18-4 27 2" stroke="#4a2919" strokeWidth="3"/>}
      {type === 'caramel' && <path d="M31 22c9 8 17-5 27 4" stroke="#d88713" strokeWidth="3"/>}
    </svg>
  );
}
