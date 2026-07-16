import React from 'react';
import { AvatarLook, DEFAULT_LOOK, SKIN_TONES } from '../../avatarCatalog';

// Code-drawn layered avatar in the app's flat esports style: one base
// silhouette, recolorable skin + hair, and item layers keyed by wearable key.
// Layer order (bottom → top): hairBack → topBack → torso → neck → head/face
// → hairFront → accessory. Everything is geometry — crisp at any size.

const INK = '#1E2128'; // outlines, eyes, mouth
const GRAPHITE = '#171C27';
const VOLT = '#CBFE1C';
const WHITE = '#F4F5F7';
const GOLD = '#E9B44C';

const HOUSE_JERSEY: Record<string, string> = {
  top_jersey_unity: '#0ea5e9',
  top_jersey_sage: '#10b981',
  top_jersey_spark: '#f97316',
  top_jersey_valor: '#8b5cf6',
};

interface AvatarRigProps {
  look?: AvatarLook | null;
  size?: number | string; // css size; SVG scales
  className?: string;
  style?: React.CSSProperties;
  idle?: boolean; // character-select idle bob
}

// A hair "shade" pass: same silhouette, translucent black — depth for any color.
const Shade: React.FC<{ d: string }> = ({ d }) => <path d={d} fill="#000" opacity={0.16} />;

const HairBack: React.FC<{ hair: string; color: string }> = ({ hair, color }) => {
  switch (hair) {
    case 'hair_long':
      return (
        <g>
          <path d="M66 96 Q64 46 120 42 Q176 46 174 96 L176 168 Q176 186 158 186 L82 186 Q64 186 64 168 Z" fill={color} />
          <Shade d="M66 120 L64 168 Q64 186 82 186 L98 186 L98 120 Z" />
        </g>
      );
    case 'hair_locs':
      return (
        <g fill={color}>
          {[72, 90, 108, 126, 144, 158].map((x, i) => (
            <rect key={x} x={x} y={88 + (i % 2) * 8} width={13} height={78} rx={6.5} />
          ))}
          <Shade d="M72 96 h13 v70 h-13 Z M108 104 h13 v62 h-13 Z M144 96 h13 v70 h-13 Z" />
        </g>
      );
    default:
      return null;
  }
};

const HairFront: React.FC<{ hair: string; color: string }> = ({ hair, color }) => {
  switch (hair) {
    case 'hair_buzz':
      return (
        <g>
          <path d="M76 84 Q74 32 120 30 Q166 32 164 84 Q160 56 120 52 Q80 56 76 84 Z" fill={color} />
        </g>
      );
    case 'hair_short':
      return (
        <g>
          <path d="M72 94 Q70 28 120 26 Q170 28 168 94 Q168 60 150 54 Q135 50 120 53 Q100 49 88 56 Q74 62 72 94 Z" fill={color} />
          <Shade d="M120 53 Q100 49 88 56 Q74 62 72 94 Q70 28 120 26 Z" />
        </g>
      );
    case 'hair_spiky':
      return (
        <g fill={color}>
          <path d="M76 90 Q74 46 120 42 Q166 46 164 90 Q160 64 120 62 Q80 64 76 90 Z" />
          <path d="M84 58 L92 26 L102 52 L112 18 L122 50 L132 22 L142 52 L152 30 L158 58 Q140 44 120 46 Q100 44 84 58 Z" />
        </g>
      );
    case 'hair_curls':
      return (
        <g fill={color}>
          <circle cx={88} cy={62} r={19} />
          <circle cx={108} cy={50} r={20} />
          <circle cx={132} cy={50} r={20} />
          <circle cx={152} cy={62} r={19} />
          <circle cx={120} cy={58} r={22} />
          <circle cx={74} cy={82} r={13} />
          <circle cx={166} cy={82} r={13} />
          <Shade d="M74 82 a13 13 0 0 0 26 0 Z M120 58 a22 22 0 0 1-22 8 Z" />
        </g>
      );
    case 'hair_long':
      return (
        <g>
          <path d="M74 96 Q72 40 120 38 Q168 40 166 96 Q164 66 144 62 L120 58 L96 62 Q76 66 74 96 Z" fill={color} />
          <path d="M74 96 Q78 74 96 66 L90 108 Q78 106 74 96 Z" fill={color} />
          <path d="M166 96 Q162 74 144 66 L150 108 Q162 106 166 96 Z" fill={color} />
        </g>
      );
    case 'hair_locs':
      return (
        <g fill={color}>
          <path d="M76 88 Q74 42 120 40 Q166 42 164 88 Q160 62 120 60 Q80 62 76 88 Z" />
          <rect x={78} y={70} width={12} height={40} rx={6} />
          <rect x={150} y={70} width={12} height={40} rx={6} />
          <Shade d="M76 88 Q74 42 120 40 L120 60 Q80 62 76 88 Z" />
        </g>
      );
    case 'hair_bun':
      return (
        <g fill={color}>
          <circle cx={120} cy={30} r={16} />
          <rect x={108} y={40} width={24} height={8} rx={4} fill={INK} opacity={0.35} />
          <path d="M76 90 Q74 42 120 40 Q166 42 164 90 Q160 62 120 60 Q80 62 76 90 Z" />
        </g>
      );
    case 'hair_mohawk':
      return (
        <g>
          <path d="M104 62 L106 26 L114 48 L120 14 L126 48 L134 26 L136 62 Q128 56 120 56 Q112 56 104 62 Z" fill={color} />
          <path d="M80 84 Q80 56 104 50 L104 62 Q88 68 84 86 Z M160 84 Q160 56 136 50 L136 62 Q152 68 156 86 Z" fill={color} opacity={0.45} />
        </g>
      );
    default:
      return null;
  }
};

const TopBack: React.FC<{ top: string }> = ({ top }) => {
  if (top === 'top_hoodie') {
    // hood bunched behind the neck/shoulders
    return <path d="M70 176 Q66 138 96 130 L120 140 L144 130 Q174 138 170 176 Q146 164 120 164 Q94 164 70 176 Z" fill="#232936" />;
  }
  return null;
};

// Shared torso silhouette: shoulders sloping into the frame bottom.
const TORSO = 'M34 240 L34 206 Q34 174 68 163 L98 152 Q120 168 142 152 L172 163 Q206 174 206 206 L206 240 Z';
// Ribbed crew collar following the neckline.
const COLLAR = 'M96 154 Q120 172 144 154 L146 163 Q120 182 94 163 Z';

const TopFront: React.FC<{ top: string }> = ({ top }) => {
  const jersey = HOUSE_JERSEY[top];
  if (jersey) {
    return (
      <g>
        <path d={TORSO} fill={jersey} />
        <Shade d="M34 240 L34 206 Q34 174 68 163 L82 158 L82 240 Z" />
        {/* white shoulder chevrons */}
        <path d="M40 200 L74 168 L84 174 L48 208 Z" fill={WHITE} opacity={0.9} />
        <path d="M200 200 L166 168 L156 174 L192 208 Z" fill={WHITE} opacity={0.9} />
        <path d={COLLAR} fill={WHITE} />
        {/* volt hem */}
        <rect x={34} y={232} width={172} height={8} fill={VOLT} />
      </g>
    );
  }
  switch (top) {
    case 'top_ringer':
      return (
        <g>
          <path d={TORSO} fill={WHITE} />
          <path d={COLLAR} fill={GRAPHITE} />
          <path d="M34 206 Q34 174 68 163 L74 166 Q44 178 42 208 Z" fill={GRAPHITE} />
          <path d="M206 206 Q206 174 172 163 L166 166 Q196 178 198 208 Z" fill={GRAPHITE} />
        </g>
      );
    case 'top_hoodie':
      return (
        <g>
          <path d={TORSO} fill="#2A3140" />
          <path d={COLLAR} fill="#232936" />
          {/* drawstrings + kangaroo pocket */}
          <path d="M108 168 L106 196 M132 168 L134 196" stroke={VOLT} strokeWidth={4} strokeLinecap="round" fill="none" />
          <path d="M84 214 L156 214 L148 240 L92 240 Z" fill="#232936" />
        </g>
      );
    case 'top_track':
      return (
        <g>
          <path d={TORSO} fill="#232B38" />
          <path d="M46 186 L88 158 L96 166 L54 196 Z M194 186 L152 158 L144 166 L186 196 Z" fill={VOLT} />
          <path d="M96 152 L98 148 L142 148 L144 152 Q120 168 96 152 Z" fill="#232936" />
          <path d="M120 162 L120 240" stroke="#0B0E13" strokeWidth={5} />
          <rect x={116} y={166} width={8} height={10} fill={VOLT} />
        </g>
      );
    case 'top_champion':
      return (
        <g>
          <path d={TORSO} fill={VOLT} />
          <path d={COLLAR} fill={GRAPHITE} />
          <path d="M120 162 L120 240" stroke={GRAPHITE} strokeWidth={5} />
          {/* champion star */}
          <path d="M158 190 l4.6 9.3 10.3 1.5 -7.5 7.3 1.8 10.2 -9.2-4.8 -9.2 4.8 1.8-10.2 -7.5-7.3 10.3-1.5 Z" fill={GRAPHITE} />
          <path d="M34 226 L206 226" stroke={GRAPHITE} strokeWidth={6} />
        </g>
      );
    case 'top_tee':
    default:
      return (
        <g>
          <path d={TORSO} fill="#29313F" />
          <path d={COLLAR} fill={VOLT} />
          {/* angular chest slash — the notch motif */}
          <path d="M88 206 L118 186 L124 192 L94 212 Z" fill={VOLT} opacity={0.85} />
        </g>
      );
  }
};

const Accessory: React.FC<{ acc: string }> = ({ acc }) => {
  switch (acc) {
    case 'acc_glasses':
      return (
        <g>
          <rect x={86} y={92} width={26} height={22} rx={7} fill="#FFFFFF" opacity={0.08} stroke={INK} strokeWidth={4} />
          <rect x={128} y={92} width={26} height={22} rx={7} fill="#FFFFFF" opacity={0.08} stroke={INK} strokeWidth={4} />
          <path d="M112 102 L128 102" stroke={INK} strokeWidth={4} />
          <path d="M86 100 L74 96 M154 100 L166 96" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        </g>
      );
    case 'acc_shades':
      return (
        <g>
          <rect x={82} y={90} width={76} height={24} rx={9} fill="#14171E" />
          <path d="M90 98 L122 98" stroke={VOLT} strokeWidth={4} strokeLinecap="round" opacity={0.9} />
          <path d="M82 98 L72 94 M158 98 L168 94" stroke="#14171E" strokeWidth={5} strokeLinecap="round" />
        </g>
      );
    case 'acc_cap':
      return (
        <g>
          <path d="M76 64 Q76 28 120 26 Q164 28 164 64 Z" fill="#2A3140" />
          <path d="M100 44 Q120 36 140 44 L138 60 Q120 53 102 60 Z" fill={VOLT} />
          <circle cx={120} cy={30} r={4} fill={VOLT} />
          <rect x={62} y={59} width={116} height={13} rx={6.5} fill="#232936" />
        </g>
      );
    case 'acc_beanie':
      return (
        <g>
          <path d="M76 70 Q76 26 120 24 Q164 26 164 70 Z" fill="#2A3140" />
          <rect x={74} y={58} width={92} height={16} rx={8} fill="#232936" />
          <rect x={150} y={58} width={16} height={16} rx={4} fill={VOLT} />
        </g>
      );
    case 'acc_headband':
      return (
        <g>
          <rect x={74} y={72} width={92} height={13} rx={6.5} fill={VOLT} />
          <path d="M80 78 L160 78" stroke={GRAPHITE} strokeWidth={3} />
        </g>
      );
    case 'acc_headphones':
      return (
        <g>
          <path d="M72 96 Q120 12 168 96" stroke={GRAPHITE} strokeWidth={9} fill="none" strokeLinecap="round" />
          <rect x={58} y={86} width={20} height={32} rx={9} fill={GRAPHITE} />
          <rect x={162} y={86} width={20} height={32} rx={9} fill={GRAPHITE} />
          <circle cx={68} cy={102} r={4} fill={VOLT} />
          <circle cx={172} cy={102} r={4} fill={VOLT} />
        </g>
      );
    case 'acc_scarf':
      return (
        <g>
          <rect x={94} y={148} width={52} height={17} rx={8} fill="#D64541" />
          <rect x={124} y={158} width={17} height={38} rx={7} fill="#D64541" />
          <path d="M98 156 L142 156" stroke="#B03430" strokeWidth={4} />
          <path d="M126 188 L139 188" stroke="#B03430" strokeWidth={4} />
        </g>
      );
    case 'acc_chain':
      return (
        <g>
          <path d="M94 166 Q120 194 146 166" stroke={GOLD} strokeWidth={6.5} fill="none" strokeLinecap="round" strokeDasharray="1 9" />
          <path d="M94 166 Q120 192 146 166" stroke={GOLD} strokeWidth={3} fill="none" />
          <circle cx={120} cy={190} r={8} fill={GOLD} />
          <circle cx={120} cy={190} r={3.5} fill="#B8860B" />
        </g>
      );
    case 'acc_crown':
      return (
        <g>
          <path d="M90 46 L96 18 L110 36 L120 12 L130 36 L144 18 L150 46 Z" fill={GOLD} />
          <rect x={90} y={42} width={60} height={8} rx={3} fill="#C79A2E" />
          <circle cx={120} cy={24} r={4} fill={VOLT} />
          <circle cx={99} cy={30} r={3} fill={VOLT} />
          <circle cx={141} cy={30} r={3} fill={VOLT} />
        </g>
      );
    default:
      return null;
  }
};

const AvatarRig: React.FC<AvatarRigProps> = ({ look, size = 96, className = '', style, idle = false }) => {
  const skin = SKIN_TONES.find(t => t.id === (look?.skin ?? DEFAULT_LOOK.skin)) ?? SKIN_TONES[2];
  const hairColor = look?.hairColor ?? DEFAULT_LOOK.hairColor;
  const hair = look?.hair ?? DEFAULT_LOOK.hair;
  const top = look?.top ?? DEFAULT_LOOK.top;
  const acc = look?.acc ?? null;

  return (
    <svg
      viewBox="0 0 240 240"
      width={size}
      height={size}
      className={className}
      style={style}
      role="img"
      aria-label="Avatar"
    >
      <g style={idle ? { animation: 'fnf-idle-bob 3.2s ease-in-out infinite', transformOrigin: '120px 240px' } : undefined}>
        <HairBack hair={hair} color={hairColor} />
        <TopBack top={top} />
        <TopFront top={top} />
        {/* neck */}
        <rect x={104} y={124} width={32} height={40} fill={skin.fill} />
        <rect x={104} y={124} width={32} height={14} fill={skin.shade} />
        {/* ears */}
        <circle cx={74} cy={102} r={11} fill={skin.fill} />
        <circle cx={166} cy={102} r={11} fill={skin.fill} />
        <circle cx={74} cy={102} r={4.5} fill={skin.shade} />
        <circle cx={166} cy={102} r={4.5} fill={skin.shade} />
        {/* head */}
        <rect x={76} y={44} width={88} height={100} rx={36} fill={skin.fill} />
        {/* brows */}
        <rect x={91} y={87} width={19} height={5.5} rx={2.75} fill={INK} opacity={0.85} />
        <rect x={130} y={87} width={19} height={5.5} rx={2.75} fill={INK} opacity={0.85} />
        {/* eyes */}
        <circle cx={100} cy={104} r={7} fill={INK} />
        <circle cx={140} cy={104} r={7} fill={INK} />
        <circle cx={97.5} cy={101.5} r={2.2} fill="#FFFFFF" />
        <circle cx={137.5} cy={101.5} r={2.2} fill="#FFFFFF" />
        {/* confident smile */}
        <path d="M104 122 Q120 135 136 122" stroke={INK} strokeWidth={5} strokeLinecap="round" fill="none" />
        <HairFront hair={hair} color={hairColor} />
        {acc && <Accessory acc={acc} />}
      </g>
    </svg>
  );
};

export default AvatarRig;
