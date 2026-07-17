import React from 'react';
import {
  VOLT_SPECIALTY_META,
  VoltPerkDef,
  VoltSpecialty,
  VoltWildcardDef,
} from '../../voltCatalog';
import { Ic, IconProps } from '../icons';

// BO6-style perk medallion, drawn entirely in SVG (zero image assets, same
// philosophy as components/avatar/AvatarRig.tsx). Pointy-top hexagon with a
// beveled double rim in the specialty color, a dark engraved center plate,
// and the perk's brand icon tinted parchment like BO6's engravings.

const NOTCH_XS = 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)';
const WILDCARD_GOLD = '#D9A441';
const PARCHMENT = '#E8DCC0';

// Pointy-top hexagon points around (cx, cy) with radius r.
const hexPoints = (cx: number, cy: number, r: number): string =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (90 - i * 60);
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy - r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');

const iconFor = (name: string): React.FC<IconProps> =>
  (Ic as Record<string, React.FC<IconProps>>)[name] ?? Ic.Bolt;

export interface VoltMedallionProps {
  perk?: VoltPerkDef;
  wildcard?: VoltWildcardDef;
  /** Renders the Combat Specialty medallion for this color family. */
  specialtyKey?: VoltSpecialty;
  size?: number;
  state: 'equipped' | 'unlocked' | 'locked';
  /** BO6-style skewed name bar under the hexagon. */
  showLabel?: boolean;
  unlockLevel?: number;
}

const VoltMedallion: React.FC<VoltMedallionProps> = ({
  perk,
  wildcard,
  specialtyKey,
  size = 84,
  state,
  showLabel = false,
  unlockLevel,
}) => {
  const rawId = React.useId();
  const plateId = `volt-plate-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;

  // Resolve rim color, icon, and name from whichever def was passed.
  const specMeta = specialtyKey ? VOLT_SPECIALTY_META[specialtyKey] : undefined;
  const rim = specMeta
    ? specMeta.color
    : wildcard
      ? WILDCARD_GOLD
      : perk
        ? VOLT_SPECIALTY_META[perk.specialty].color
        : 'var(--pz-volt)';
  const iconName = specMeta?.icon ?? wildcard?.icon ?? perk?.icon ?? 'Bolt';
  const name = specMeta?.bonusName ?? wildcard?.name ?? perk?.name ?? '';
  const lvl = unlockLevel ?? perk?.unlockLevel ?? wildcard?.unlockLevel;
  const IconComp = iconFor(iconName);

  const locked = state === 'locked';
  const equipped = state === 'equipped';

  // NOTE: outer box-shadows get clipped by notch clip-paths in this codebase;
  // filter: drop-shadow hugs the hexagon silhouette instead.
  const glow = equipped
    ? `drop-shadow(0 0 ${Math.max(5, size * 0.1)}px ${rim}) drop-shadow(0 0 2px ${rim})`
    : specMeta
      ? `drop-shadow(0 0 ${Math.max(3, size * 0.05)}px ${rim}66)`
      : undefined;

  const svgH = 112;
  const iconSize = 38;

  return (
    <div className="relative" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: (size * svgH) / 100 }}>
        <svg
          width={size}
          height={(size * svgH) / 100}
          viewBox={`0 0 100 ${svgH}`}
          aria-hidden="true"
          style={{
            display: 'block',
            filter: locked ? 'grayscale(1)' : glow,
            opacity: locked ? 0.4 : 1,
          }}
        >
          <defs>
            <radialGradient id={plateId} cx="50%" cy="36%" r="80%">
              <stop offset="0%" stopColor="#14171E" />
              <stop offset="100%" stopColor="#0B0E13" />
            </radialGradient>
          </defs>
          {/* Specialty medallions get a doubled outer rim ring */}
          {specMeta && (
            <polygon points={hexPoints(50, 56, 55)} fill="none" stroke={rim} strokeWidth={2} opacity={0.75} />
          )}
          {/* Beveled double rim: bright outer ring, darkened inner ring */}
          <polygon points={hexPoints(50, 56, 51)} fill={rim} />
          <polygon points={hexPoints(50, 56, 46)} fill="#0B0E13" opacity={0.55} />
          {/* Dark engraved center plate */}
          <polygon
            points={hexPoints(50, 56, 41)}
            fill={`url(#${plateId})`}
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={1}
          />
          {/* Subtle inner hex outline */}
          <polygon points={hexPoints(50, 56, 32.5)} fill="none" stroke={rim} strokeWidth={1} opacity={0.22} />
          {/* Engraved icon, parchment tint */}
          <IconComp
            x={50 - iconSize / 2}
            y={56 - iconSize / 2}
            size={iconSize}
            style={{ color: PARCHMENT, opacity: 0.95 }}
          />
        </svg>

        {/* Equipped: small volt check chip */}
        {equipped && (
          <span
            className="absolute flex items-center justify-center"
            style={{
              top: '2%',
              right: '2%',
              width: Math.max(14, size * 0.24),
              height: Math.max(14, size * 0.24),
              background: 'var(--pz-volt)',
              color: '#0B0E13',
              clipPath: NOTCH_XS,
            }}
          >
            <Ic.Check size={Math.max(9, size * 0.15)} />
          </span>
        )}

        {/* Locked: centered lock + unlock level tag */}
        {locked && (
          <>
            <span
              className="absolute inset-0 flex items-center justify-center"
              style={{ color: 'rgba(232,220,192,0.9)' }}
            >
              <Ic.Lock size={Math.max(14, size * 0.3)} />
            </span>
            {lvl != null && (
              <span
                className="absolute left-1/2 -translate-x-1/2 font-black uppercase tracking-widest whitespace-nowrap"
                style={{
                  bottom: '6%',
                  fontSize: Math.max(7, size * 0.11),
                  padding: '1px 5px',
                  background: 'rgba(0,0,0,0.78)',
                  border: '1px solid rgba(255,255,255,0.22)',
                  color: '#fff',
                  clipPath: NOTCH_XS,
                }}
              >
                LVL {lvl}
              </span>
            )}
          </>
        )}
      </div>

      {/* BO6-style skewed name bar */}
      {showLabel && name && (
        <div
          className="mx-auto"
          style={{
            width: '94%',
            marginTop: 2,
            transform: 'skewX(-10deg)',
            background: rim,
            filter: locked ? 'grayscale(1)' : undefined,
            opacity: locked ? 0.4 : 1,
          }}
        >
          <div
            className="font-black uppercase text-center"
            style={{
              transform: 'skewX(10deg)',
              color: '#0B0E13',
              fontSize: Math.max(8, size * 0.115),
              letterSpacing: '0.03em',
              lineHeight: 1.15,
              padding: '3px 2px',
            }}
          >
            {name}
          </div>
        </div>
      )}
    </div>
  );
};

// Small dedicated level hexagon: volt rim, dark plate, the level number big.
export const VoltLevelHex: React.FC<{ level: number; size?: number }> = ({ level, size = 64 }) => {
  const rawId = React.useId();
  const plateId = `volt-lvlplate-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg
      width={size}
      height={size * 1.12}
      viewBox="0 0 100 112"
      aria-hidden="true"
      style={{ display: 'block', filter: `drop-shadow(0 0 ${Math.max(4, size * 0.08)}px rgba(203,254,28,0.45))` }}
    >
      <defs>
        <radialGradient id={plateId} cx="50%" cy="36%" r="80%">
          <stop offset="0%" stopColor="#14171E" />
          <stop offset="100%" stopColor="#0B0E13" />
        </radialGradient>
      </defs>
      <polygon points={hexPoints(50, 56, 51)} fill="#CBFE1C" />
      <polygon points={hexPoints(50, 56, 46)} fill="#0B0E13" opacity={0.55} />
      <polygon points={hexPoints(50, 56, 41)} fill={`url(#${plateId})`} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
      <polygon points={hexPoints(50, 56, 32.5)} fill="none" stroke="#CBFE1C" strokeWidth={1} opacity={0.22} />
      <text
        x={50}
        y={58}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#ffffff"
        style={{ fontFamily: "'Days One', system-ui, sans-serif", fontSize: 36 }}
      >
        {level}
      </text>
    </svg>
  );
};

// Dashed empty-slot hexagon with a plus, for unfilled loadout slots.
export const VoltEmptySlot: React.FC<{ size?: number }> = ({ size = 48 }) => (
  <svg width={size} height={size * 1.12} viewBox="0 0 100 112" aria-hidden="true" style={{ display: 'block' }}>
    <polygon
      points={hexPoints(50, 56, 47)}
      fill="rgba(255,255,255,0.03)"
      stroke="rgba(255,255,255,0.25)"
      strokeWidth={2.5}
      strokeDasharray="8 8"
    />
    <path d="M50 44v24M38 56h24" stroke="rgba(255,255,255,0.32)" strokeWidth={4.5} strokeLinecap="round" />
  </svg>
);

export default VoltMedallion;
