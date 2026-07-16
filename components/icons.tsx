// Fun 'n Fit brand icon set — hand-drawn SVG, one visual voice for the whole
// app (replaces emoji). Stroke-based, 24×24 grid, inherits `currentColor` so
// volt/house tints come from CSS. Usage: <Ic.Trophy size={18} />
// For DB-stored emoji (reward icons etc.) use <DataIcon glyph={reward.icon} />
// which maps known glyphs to brand icons and falls back to the raw glyph.
import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

const base = (
  { size = 20, ...rest }: IconProps,
  children: React.ReactNode,
  filled = false
) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke={filled ? 'none' : 'currentColor'}
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    {children}
  </svg>
);

const make = (children: React.ReactNode, filled = false): React.FC<IconProps> => {
  const C: React.FC<IconProps> = (props) => base(props, children, filled);
  return C;
};

/* ── Core game / points ────────────────────────────────────────────────────── */
export const Trophy = make(<>
  <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
  <path d="M7 5H4.5a.5.5 0 0 0-.5.5C4 8 5.5 9.5 7 9.5" />
  <path d="M17 5h2.5a.5.5 0 0 1 .5.5C20 8 18.5 9.5 17 9.5" />
  <path d="M12 14v3M8.5 20h7M10 20v-1.5a2 2 0 0 1 4 0V20" />
</>);
export const Star = make(<path d="m12 3.6 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L4.2 9.3l5.4-.8L12 3.6Z" />);
export const StarFilled = make(<path d="m12 3.6 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L4.2 9.3l5.4-.8L12 3.6Z" />, true);
export const Bolt = make(<path d="M13.2 3 5.6 13.4h5l-1 7.6L17.9 10h-5l.3-7Z" />);
export const Coin = make(<>
  <circle cx="12" cy="12" r="8.2" />
  <path d="M12 7.8v8.4M14.8 9.6c-.6-1-1.6-1.4-2.8-1.4-1.5 0-2.7.8-2.7 2.1 0 2.9 5.6 1.4 5.6 4.2 0 1.3-1.3 2.1-2.9 2.1-1.3 0-2.4-.5-3-1.5" />
</>);
export const Medal = make(<>
  <circle cx="12" cy="14.5" r="5" />
  <path d="m9.5 10.5-3-6.5M14.5 10.5l3-6.5M9 4h6" />
  <path d="m12 12.4.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3.9-1.8Z" />
</>);
export const Flag = make(<path d="M5 21V4m0 1h13l-3 4 3 4H5" />);
export const Target = make(<>
  <circle cx="12" cy="12" r="8.2" />
  <circle cx="12" cy="12" r="4.6" />
  <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
</>);
export const Controller = make(<>
  <path d="M6.8 7.5h10.4c2.6 0 4.4 2.1 4.7 4.9l.3 3.3a2.6 2.6 0 0 1-4.6 2l-1.6-2H8l-1.6 2a2.6 2.6 0 0 1-4.6-2l.3-3.3c.3-2.8 2.1-4.9 4.7-4.9Z" />
  <path d="M8.5 11v3M7 12.5h3M15.5 11.4h.01M17.5 13.4h.01" />
</>);
export const Dice = make(<>
  <rect x="4" y="4" width="16" height="16" rx="3" />
  <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
  <circle cx="15" cy="15" r="1" fill="currentColor" stroke="none" />
  <circle cx="15" cy="9" r="1" fill="currentColor" stroke="none" />
  <circle cx="9" cy="15" r="1" fill="currentColor" stroke="none" />
</>);
export const Timer = make(<>
  <circle cx="12" cy="13.5" r="7" />
  <path d="M12 10v3.8l2.5 1.5M9.5 3h5M12 3v3.5" />
</>);
export const Whistle = make(<>
  <path d="M3.5 12.5a5.5 5.5 0 1 0 11 0V11h5.5a1 1 0 0 0 1-1V8.5a1 1 0 0 0-1-1H9a5.5 5.5 0 0 0-5.5 5Z" />
  <circle cx="9" cy="12.5" r="1.2" fill="currentColor" stroke="none" />
</>);
export const Run = make(<>
  <circle cx="14.5" cy="5" r="1.8" />
  <path d="m9.5 20 2.3-4.2-2-1.8.8-4.5 3.8-1 2.6 2.8 2.5.7M10.6 9.5 7 10.8l-1.5 3M13 14.5l1.5 2 .5 3.5" />
</>);
export const Muscle = make(<path d="M6 18.5c.6-6.8 1.6-11.9 2.4-14 .3-.8 1.2-1 1.9-.6l1.5.9c.6.4.8 1.2.4 1.8L10.6 9c2.6-1.3 5.7-.8 7.4 1.2 1.6 1.9 1.9 4.6.8 6.9-.6 1.2-1.9 1.9-3.2 1.9H7.5c-.9 0-1.6-.7-1.5-1.5Z" />);

/* ── Check-in / attendance ────────────────────────────────────────────────── */
export const QrCode = make(<>
  <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
  <rect x="13.5" y="4" width="6.5" height="6.5" rx="1" />
  <rect x="4" y="13.5" width="6.5" height="6.5" rx="1" />
  <path d="M13.5 13.5h2.8v2.8h-2.8zM17.2 17.2h2.8v2.8h-2.8zM13.5 20h1.4M20 13.5v1.4" />
</>);
export const Scan = make(<>
  <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
  <path d="M4 12h16" />
</>);
export const Nfc = make(<>
  <path d="M6.5 8.5a6.5 6.5 0 0 1 0 7M9.8 6.8a10 10 0 0 1 0 10.4M13 5a13.5 13.5 0 0 1 0 14" />
  <circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none" />
</>);
export const CheckCircle = make(<>
  <circle cx="12" cy="12" r="8.2" />
  <path d="m8.5 12.3 2.4 2.4 4.6-5" />
</>);
export const Check = make(<path d="m5 12.5 4.5 4.5L19 7.5" />);
export const XMark = make(<path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />);
export const XCircle = make(<>
  <circle cx="12" cy="12" r="8.2" />
  <path d="m9 9 6 6M15 9l-6 6" />
</>);
export const ClipboardCheck = make(<>
  <rect x="5" y="4.5" width="14" height="16" rx="2" />
  <path d="M9 4.5V4a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4v.5M9 13l2.2 2.2L15.5 11" />
</>);
export const Wave = make(<path d="M4 15.5c1.5 0 1.5-1.2 3-1.2s1.5 1.2 3 1.2 1.5-1.2 3-1.2 1.5 1.2 3 1.2 1.5-1.2 3-1.2M4 19.5c1.5 0 1.5-1.2 3-1.2s1.5 1.2 3 1.2 1.5-1.2 3-1.2 1.5 1.2 3 1.2 1.5-1.2 3-1.2M8 9.5a4 4 0 0 1 8 0" />);

/* ── People ───────────────────────────────────────────────────────────────── */
export const User = make(<>
  <circle cx="12" cy="8" r="3.8" />
  <path d="M5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5" />
</>);
export const Users = make(<>
  <circle cx="9" cy="8.5" r="3.2" />
  <path d="M3.5 19.5c.6-3 3-4.8 5.5-4.8s4.9 1.8 5.5 4.8" />
  <path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.9c1.6.7 2.7 2.1 3 4.1" />
</>);
export const UserPlus = make(<>
  <circle cx="10" cy="8" r="3.5" />
  <path d="M3.5 19.5c.7-3.2 3.3-5 6.5-5 1.5 0 2.9.4 4 1.2M18 13.5v5M15.5 16h5" />
</>);
export const Family = make(<>
  <circle cx="8" cy="7.5" r="2.8" />
  <circle cx="16.5" cy="9.5" r="2.2" />
  <path d="M3.5 19.5c.5-2.9 2.3-4.6 4.5-4.6 1.4 0 2.6.6 3.4 1.7M12.8 19.5c.4-2.1 1.8-3.4 3.7-3.4s3.3 1.3 3.7 3.4" />
</>);
export const Coach = make(<>
  <circle cx="12" cy="8" r="3.8" />
  <path d="M5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5" />
  <path d="M8.5 3.5 12 2l3.5 1.5" />
</>);

/* ── Communication ────────────────────────────────────────────────────────── */
export const Chat = make(<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H9l-4.2 3.6c-.4.3-.8 0-.8-.4V6.5Z" />);
export const Mail = make(<>
  <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
  <path d="m4.5 7 7.5 6 7.5-6" />
</>);
export const Megaphone = make(<>
  <path d="M4 10.5v3a1.5 1.5 0 0 0 1.5 1.5H7l8.5 4.5a.7.7 0 0 0 1-.6V5.1a.7.7 0 0 0-1-.6L7 9H5.5A1.5 1.5 0 0 0 4 10.5Z" />
  <path d="M19.5 10a3 3 0 0 1 0 4M8 15.5l1 4.5" />
</>);
export const Bell = make(<>
  <path d="M6 16.5v-5a6 6 0 1 1 12 0v5l1.5 2.5h-15L6 16.5Z" />
  <path d="M10 21.5a2 2 0 0 0 4 0" />
</>);

/* ── Commerce / rewards ───────────────────────────────────────────────────── */
export const Gift = make(<>
  <rect x="4" y="9" width="16" height="4" rx="1" />
  <path d="M5.5 13v6A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5v-6M12 9v11.5" />
  <path d="M12 9c-4 0-5.5-1.6-5-3.5.4-1.6 3-1.6 4 0 .7 1.2 1 3.5 1 3.5Zm0 0c4 0 5.5-1.6 5-3.5-.4-1.6-3-1.6-4 0-.7 1.2-1 3.5-1 3.5Z" />
</>);
export const Store = make(<>
  <path d="M4.5 9 6 4.5h12L19.5 9M4.5 9v10A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5V9M4.5 9h15" />
  <path d="M9.5 20.5v-6h5v6" />
</>);
export const Cart = make(<>
  <circle cx="9.5" cy="19.5" r="1.4" />
  <circle cx="17" cy="19.5" r="1.4" />
  <path d="M3.5 4.5h2.2L8 15a1.5 1.5 0 0 0 1.5 1.2h7.3a1.5 1.5 0 0 0 1.4-1L20.5 8H6.4" />
</>);
export const Tag = make(<>
  <path d="m12.7 3.5 7 7a1.7 1.7 0 0 1 0 2.4l-6.8 6.8a1.7 1.7 0 0 1-2.4 0l-7-7V4.5a1 1 0 0 1 1-1h8.2Z" />
  <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" />
</>);
export const Shirt = make(<path d="m8.5 4.5-4.6 3 1.9 3.4 2.2-1.2v9.3a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V9.7l2.2 1.2 1.9-3.4-4.6-3a3.3 3.3 0 0 1-7 0Z" />);
export const Sparkle = make(<path d="M12 3.5c.6 3.8 2.2 5.4 6 6-3.8.6-5.4 2.2-6 6-.6-3.8-2.2-5.4-6-6 3.8-.6 5.4-2.2 6-6ZM18.5 14.5c.3 1.9 1.1 2.7 3 3-1.9.3-2.7 1.1-3 3-.3-1.9-1.1-2.7-3-3 1.9-.3 2.7-1.1 3-3ZM6 15.5c.25 1.6.9 2.25 2.5 2.5-1.6.25-2.25.9-2.5 2.5-.25-1.6-.9-2.25-2.5-2.5 1.6-.25 2.25-.9 2.5-2.5Z" />);
export const Confetti = make(<>
  <path d="m6.5 10.5-3 10 10-3-7-7Z" />
  <path d="M9 8.5c0-2 1.5-2.5 1.5-4M13.5 10.5c2-.5 2-2.5 4-3M14.5 14.5c1.5.5 3 0 4.5.5" />
  <circle cx="16" cy="5" r="0.9" fill="currentColor" stroke="none" />
  <circle cx="20" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
</>);

/* ── Interface ────────────────────────────────────────────────────────────── */
export const Home = make(<path d="m4 11 8-7 8 7M6 9.5V19a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V9.5M10 20.5v-5.5h4v5.5" />);
export const Search = make(<>
  <circle cx="10.5" cy="10.5" r="6.5" />
  <path d="m15.5 15.5 5 5" />
</>);
export const Refresh = make(<>
  <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
  <path d="M19.7 3.8v3.4h-3.4" />
</>);
export const Edit = make(<path d="M4 20h4.5L20 8.5a2.1 2.1 0 0 0-3-3L5.5 17 4 20ZM14.5 8l1.5 1.5" />);
export const Trash = make(<>
  <path d="M5 7h14M9.5 7V5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7M7 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h5.4A1.5 1.5 0 0 0 16.2 19L17 7" />
  <path d="M10.2 11v5.5M13.8 11v5.5" />
</>);
export const Printer = make(<>
  <path d="M7 8V4.5h10V8M7 16.5H4.5v-6a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v6H17" />
  <rect x="7" y="14" width="10" height="6" rx="0.8" />
</>);
export const Camera = make(<>
  <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2L9 4.8A1.5 1.5 0 0 1 10.3 4h3.4A1.5 1.5 0 0 1 15 4.8L16.5 7h2A1.5 1.5 0 0 1 20 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V8.5Z" />
  <circle cx="12" cy="13" r="3.4" />
</>);
export const Chart = make(<path d="M4 4v16h16M8.5 16v-5M12.5 16V8M16.5 16v-3" />);
export const History = make(<>
  <path d="M4.5 12a7.5 7.5 0 1 1 2.5 5.6M4.3 12.6 4 9.4M4.3 12.6l3-1" />
  <path d="M12 8.5V12l2.6 1.6" />
</>);
export const Calendar = make(<>
  <rect x="4" y="5.5" width="16" height="15" rx="2" />
  <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
</>);
export const Settings = make(<>
  <circle cx="12" cy="12" r="3" />
  <path d="M10.2 3.6h3.6l.5 2.1c.6.2 1.2.6 1.8 1l2-.6 1.8 3.1-1.5 1.6c.1.7.1 1.4 0 2.1l1.5 1.6-1.8 3.1-2-.6a7 7 0 0 1-1.8 1l-.5 2.1h-3.6l-.5-2.1a7 7 0 0 1-1.8-1l-2 .6-1.8-3.1 1.5-1.6a7.2 7.2 0 0 1 0-2.1L4.1 9.2l1.8-3.1 2 .6c.6-.4 1.2-.8 1.8-1l.5-2.1Z" />
</>);
export const Key = make(<>
  <circle cx="8" cy="15.5" r="4.5" />
  <path d="m11.3 12.3 8.2-8.2M16 7.5l2.5 2.5M13.5 10l1.7 1.7" />
</>);
export const Lock = make(<>
  <rect x="5.5" y="10.5" width="13" height="10" rx="2" />
  <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
</>);
export const Logout = make(<path d="M14 4.5H7A1.5 1.5 0 0 0 5.5 6v12A1.5 1.5 0 0 0 7 19.5h7M10.5 12H20m0 0-3-3m3 3-3 3" />);
export const ArrowRight = make(<path d="M4.5 12h15m0 0-5.5-5.5M19.5 12 14 17.5" />);
export const ArrowLeft = make(<path d="M19.5 12h-15m0 0L10 6.5M4.5 12 10 17.5" />);
export const ChevronRight = make(<path d="m9 5.5 6.5 6.5L9 18.5" />);
export const Plus = make(<path d="M12 5v14M5 12h14" />);
export const Warning = make(<>
  <path d="M12 4 2.8 19.5h18.4L12 4Z" />
  <path d="M12 10v4M12 16.8h.01" />
</>);
export const Info = make(<>
  <circle cx="12" cy="12" r="8.2" />
  <path d="M12 11v5M12 7.8h.01" />
</>);
export const Note = make(<>
  <path d="M5 4.5h14v11l-4.5 4.5H5v-15.5Z" />
  <path d="M14.5 20v-4.5H19M8.5 9h7M8.5 12.5h4" />
</>);
export const Sound = make(<>
  <path d="M4 9.5v5h3l4.5 4v-13L7 9.5H4Z" />
  <path d="M15 9a4.5 4.5 0 0 1 0 6M17.8 6.5a8.5 8.5 0 0 1 0 11" />
</>);
export const Music = make(<>
  <path d="M9 18.5V6l10-2v12.5" />
  <circle cx="6.7" cy="18.5" r="2.3" />
  <circle cx="16.7" cy="16.5" r="2.3" />
</>);
export const Phone = make(<>
  <rect x="7" y="3" width="10" height="18" rx="2.2" />
  <path d="M10.8 18.5h2.4" />
</>);
export const MapPin = make(<>
  <path d="M12 21s-6.5-5.4-6.5-10.3a6.5 6.5 0 0 1 13 0C18.5 15.6 12 21 12 21Z" />
  <circle cx="12" cy="10.5" r="2.3" />
</>);
export const Projector = make(<>
  <rect x="3.5" y="5" width="17" height="12" rx="1.5" />
  <path d="M8 20.5h8M12 17v3.5" />
</>);
export const Eye = make(<>
  <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
  <circle cx="12" cy="12" r="2.6" />
</>);
export const Fire = make(<path d="M12 21c-3.8 0-6.5-2.6-6.5-6.2 0-2.5 1.4-4.4 2.7-6C9.4 7.4 10.5 6 10.5 4c2.8 1.4 3 4.1 2.6 5.8 1-.5 1.7-1.4 1.9-2.5 2.2 1.7 3.5 4.4 3.5 7.5 0 3.6-2.7 6.2-6.5 6.2Z" />);

// Everything, namespaced — `import { Ic } from './icons'`
export const Ic = {
  Trophy, Star, StarFilled, Bolt, Coin, Medal, Flag, Target, Controller, Dice,
  Timer, Whistle, Run, Muscle, QrCode, Scan, Nfc, CheckCircle, Check, XMark,
  XCircle, ClipboardCheck, Wave, User, Users, UserPlus, Family, Coach, Chat,
  Mail, Megaphone, Bell, Gift, Store, Cart, Tag, Shirt, Sparkle, Confetti,
  Home, Search, Refresh, Edit, Trash, Printer, Camera, Chart, History,
  Calendar, Settings, Key, Lock, Logout, ArrowRight, ArrowLeft, ChevronRight,
  Plus, Warning, Info, Note, Sound, Music, Phone, MapPin, Projector, Eye, Fire,
};

/* Map DB-stored emoji glyphs (reward icons, method chips…) to brand icons.
   Unknown glyphs render as-is so old data never breaks. */
const GLYPH_MAP: Record<string, React.FC<IconProps>> = {
  '🏆': Trophy, '⭐': Star, '🌟': Sparkle, '⚡': Bolt, '🎮': Controller,
  '🎁': Gift, '🧢': Tag, '👕': Shirt, '💧': Coin, '🥤': Coin, '🍕': Store,
  '🏪': Store, '🛒': Cart, '🎉': Confetti, '🏅': Medal, '🥇': Medal,
  '🥈': Medal, '🥉': Medal, '📱': Phone, '💬': Chat, '✉️': Mail, '📢': Megaphone,
  '🎯': Target, '⏱️': Timer, '🏁': Flag, '🔥': Fire, '💪': Muscle,
  '🏃': Run, '🤖': Controller, '🕹️': Controller, '🥷': User, '🦊': Sparkle,
  '⚙️': Settings, '🐉': Fire, '🎵': Music, '🔊': Sound, '📷': Camera,
  '📸': Camera, '🖨️': Printer, '📊': Chart, '📜': History, '📋': ClipboardCheck,
  '🔍': Search, '🔑': Key, '📝': Note, '👤': User, '👨‍👩‍👧‍👦': Family,
};

export const DataIcon: React.FC<{ glyph?: string | null; size?: number | string; className?: string; style?: React.CSSProperties }> = ({
  glyph,
  size = 20,
  className,
  style,
}) => {
  if (!glyph) return null;
  const Mapped = GLYPH_MAP[glyph.trim()];
  if (Mapped) return <Mapped size={size} className={className} style={style} />;
  return (
    <span className={className} style={{ fontSize: size, lineHeight: 1, ...style }}>
      {glyph}
    </span>
  );
};

export default Ic;
