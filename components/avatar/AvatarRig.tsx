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
    case 'hair_bob':
      return (
        <g>
          <path d="M68 92 Q66 34 120 32 Q174 34 172 92 L172 132 Q172 146 156 144 L84 144 Q68 146 68 132 Z" fill={color} />
          <Shade d="M68 110 L68 132 Q68 146 84 144 L100 144 L100 110 Z" />
        </g>
      );
    case 'hair_ponytail':
      return (
        <g>
          <path d="M158 44 Q188 40 184 82 Q180 122 162 142 Q152 128 158 100 Q162 72 150 56 Z" fill={color} />
          <Shade d="M162 142 Q152 128 158 100 Q162 80 156 64 L164 60 Q172 84 168 108 Q166 130 162 142 Z" />
          <rect x={148} y={52} width={16} height={9} rx={4.5} fill="#1E2128" opacity={0.4} />
        </g>
      );
    case 'hair_braids':
      return (
        <g fill={color}>
          {[58, 168].map(x => (
            <g key={x}>
              <rect x={x} y={96} width={15} height={66} rx={7.5} />
              <path d={`M${x + 2} 116 h11 M${x + 2} 132 h11 M${x + 2} 148 h11`} stroke="#000" opacity={0.18} strokeWidth={4} fill="none" />
              <rect x={x + 2} y={158} width={11} height={7} rx={3.5} fill="#1E2128" opacity={0.4} />
            </g>
          ))}
        </g>
      );
    case 'hair_waves':
      return (
        <g>
          <path d="M64 96 Q62 42 120 40 Q178 42 176 96 L178 150 Q179 164 168 158 Q160 172 150 160 Q142 174 132 162 L132 120 L108 120 L108 162 Q98 174 90 160 Q80 172 72 158 Q61 164 62 150 Z" fill={color} />
          <Shade d="M64 110 L62 150 Q61 164 72 158 Q80 172 90 160 L94 120 L64 110 Z" />
        </g>
      );
    case 'hair_bangs':
    case 'hair_halfup':
      return (
        <g>
          <path d="M66 94 Q64 40 120 38 Q176 40 174 94 L175 158 Q175 174 160 172 L80 172 Q65 174 65 158 Z" fill={color} />
          <Shade d="M66 116 L65 158 Q65 174 80 172 L96 172 L96 116 Z" />
        </g>
      );
    case 'hair_sidebraid':
      return (
        <g>
          <path d="M148 92 L166 92 L166 158 Q166 172 157 172 Q148 172 148 158 Z" fill={color} />
          <path d="M150 112 h14 M150 130 h14 M150 148 h14" stroke="#000" opacity={0.18} strokeWidth={4} fill="none" />
          <rect x={150} y={164} width={14} height={8} rx={4} fill="#1E2128" opacity={0.4} />
        </g>
      );
    case 'hair_curlypony':
      return (
        <g fill={color}>
          <circle cx={168} cy={52} r={17} />
          <circle cx={180} cy={72} r={15} />
          <circle cx={170} cy={92} r={14} />
          <Shade d="M170 92 m-14 0 a14 14 0 0 0 14 14 Z" />
          <rect x={148} y={54} width={13} height={9} rx={4.5} fill="#1E2128" opacity={0.4} />
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
    case 'hair_bob':
      return (
        <g>
          <path d="M72 96 Q70 30 120 28 Q170 30 168 96 Q168 62 150 56 Q134 51 120 54 Q102 50 90 58 Q74 66 72 96 Z" fill={color} />
          <path d="M66 84 Q66 70 74 64 L86 74 L86 128 Q86 138 76 138 Q66 138 66 128 Z" fill={color} />
          <path d="M174 84 Q174 70 166 64 L154 74 L154 128 Q154 138 164 138 Q174 138 174 128 Z" fill={color} />
          <Shade d="M120 54 Q102 50 90 58 Q74 66 72 96 Q70 30 120 28 Z M66 100 L66 128 Q66 138 76 138 L76 100 Z" />
        </g>
      );
    case 'hair_ponytail':
      return (
        <g>
          <path d="M72 92 Q70 28 120 26 Q170 28 168 92 Q166 60 148 54 Q132 48 118 54 Q96 50 86 62 Q74 72 72 92 Z" fill={color} />
          <Shade d="M118 54 Q96 50 86 62 Q74 72 72 92 Q70 28 120 26 Z" />
        </g>
      );
    case 'hair_pigtails':
      return (
        <g fill={color}>
          <circle cx={62} cy={92} r={19} />
          <circle cx={178} cy={92} r={19} />
          <rect x={70} y={78} width={9} height={12} rx={4.5} fill="#1E2128" opacity={0.4} />
          <rect x={161} y={78} width={9} height={12} rx={4.5} fill="#1E2128" opacity={0.4} />
          <path d="M74 92 Q72 30 120 28 Q168 30 166 92 Q164 62 146 56 Q132 51 120 54 Q102 50 92 60 Q76 68 74 92 Z" />
          <Shade d="M62 92 m-19 0 a19 19 0 0 0 19 19 Z" />
        </g>
      );
    case 'hair_braids':
      return (
        <g>
          <path d="M74 92 Q72 30 120 28 Q168 30 166 92 Q164 62 146 56 Q132 51 120 54 Q102 50 92 60 Q76 68 74 92 Z" fill={color} />
          <path d="M120 30 L120 54" stroke="#000" opacity={0.18} strokeWidth={4} />
        </g>
      );
    case 'hair_waves':
      return (
        <g>
          <path d="M72 94 Q70 30 120 28 Q170 30 168 94 Q166 64 144 56 Q126 50 112 58 Q94 52 84 66 Q74 76 72 94 Z" fill={color} />
          <Shade d="M112 58 Q94 52 84 66 Q74 76 72 94 Q70 30 120 28 Z" />
        </g>
      );
    case 'hair_puffs':
      return (
        <g fill={color}>
          <circle cx={82} cy={40} r={21} />
          <circle cx={158} cy={40} r={21} />
          <Shade d="M82 40 m-21 0 a21 21 0 0 0 21 21 Z" />
          <path d="M76 90 Q74 42 120 40 Q166 42 164 90 Q160 62 120 60 Q80 62 76 90 Z" />
        </g>
      );
    case 'hair_sidepart':
      return (
        <g>
          <path d="M72 92 Q70 30 120 28 Q170 30 168 92 Q168 58 146 54 L98 60 Q74 66 72 92 Z" fill={color} />
          <path d="M98 32 L94 60" stroke="#000" opacity={0.22} strokeWidth={4} strokeLinecap="round" />
          <Shade d="M98 60 Q74 66 72 92 Q70 30 120 28 L98 32 Z" />
        </g>
      );
    case 'hair_bowl':
      return (
        <g>
          <path d="M70 76 Q70 26 120 24 Q170 26 170 76 Q120 86 70 76 Z" fill={color} />
          <Shade d="M70 76 Q70 26 120 24 L120 26 Q90 30 86 78 Q76 78 70 76 Z" />
        </g>
      );
    case 'hair_slickback':
      return (
        <g>
          <path d="M74 88 Q72 32 120 28 Q168 32 166 88 Q160 52 120 44 Q80 52 74 88 Z" fill={color} />
          <path d="M96 36 Q104 32 110 33 M126 32 Q134 32 142 36" stroke="#000" opacity={0.18} strokeWidth={3.5} fill="none" strokeLinecap="round" />
        </g>
      );
    case 'hair_flattop':
      return (
        <g>
          <path d="M74 84 L80 34 Q82 28 92 28 L148 28 Q158 28 160 34 L166 84 Q160 62 140 58 L100 58 Q80 62 74 84 Z" fill={color} />
          <Shade d="M74 84 L80 34 Q82 28 92 28 L100 28 L96 60 Q82 64 74 84 Z" />
        </g>
      );
    case 'hair_curtains':
      return (
        <g>
          <path d="M74 94 Q72 30 120 28 Q168 30 166 94 Q164 58 146 54 Q134 52 124 74 L120 78 L116 74 Q106 52 94 54 Q76 58 74 94 Z" fill={color} />
          <path d="M120 30 L120 76" stroke="#000" opacity={0.2} strokeWidth={4} strokeLinecap="round" />
        </g>
      );
    case 'hair_broccoli':
      return (
        <g fill={color}>
          <circle cx={98} cy={40} r={16} />
          <circle cx={120} cy={34} r={17} />
          <circle cx={142} cy={40} r={16} />
          <circle cx={108} cy={52} r={15} />
          <circle cx={132} cy={52} r={15} />
          <Shade d="M98 40 m-16 0 a16 16 0 0 0 16 16 Z" />
          <path d="M78 84 Q78 60 96 54 L144 54 Q162 60 162 84 Q120 74 78 84 Z" opacity={0.5} />
        </g>
      );
    case 'hair_cornrows':
      return (
        <g>
          <path d="M76 90 Q74 32 120 30 Q166 32 164 90 Q160 58 120 54 Q80 58 76 90 Z" fill={color} />
          <path d="M92 60 Q90 42 102 33 M108 57 Q106 38 114 31 M126 57 Q128 38 126 31 M140 60 Q144 42 138 33" stroke="#000" opacity={0.25} strokeWidth={3.5} fill="none" strokeLinecap="round" />
        </g>
      );
    case 'hair_buns':
      return (
        <g fill={color}>
          <circle cx={88} cy={32} r={16} />
          <circle cx={152} cy={32} r={16} />
          <Shade d="M88 32 m-16 0 a16 16 0 0 0 16 16 Z M152 32 m-16 0 a16 16 0 0 0 16 16 Z" />
          <path d="M74 92 Q72 30 120 28 Q168 30 166 92 Q164 62 146 56 Q132 51 120 54 Q102 50 92 60 Q76 68 74 92 Z" />
        </g>
      );
    case 'hair_bangs':
      return (
        <g>
          <path d="M76 80 Q76 32 120 30 Q164 32 164 80 Q164 86 156 86 Q120 78 84 86 Q76 86 76 80 Z" fill={color} />
          <Shade d="M76 80 Q76 32 120 30 L120 32 Q92 36 88 84 Q82 85 84 86 Q76 86 76 80 Z" />
        </g>
      );
    case 'hair_halfup':
      return (
        <g fill={color}>
          <circle cx={120} cy={26} r={14} />
          <rect x={110} y={36} width={20} height={8} rx={4} fill="#1E2128" opacity={0.35} />
          <path d="M74 92 Q72 32 120 30 Q168 32 166 92 Q164 62 146 56 Q132 51 120 54 Q102 50 92 60 Q76 68 74 92 Z" />
        </g>
      );
    case 'hair_sidebraid':
      return (
        <g>
          <path d="M72 94 Q70 28 120 26 Q170 28 168 94 Q166 58 144 54 L94 60 Q74 66 72 94 Z" fill={color} />
          <Shade d="M94 60 Q74 66 72 94 Q70 28 120 26 L94 32 Z" />
        </g>
      );
    case 'hair_curlypony':
      return (
        <g fill={color}>
          <path d="M74 92 Q72 30 120 28 Q168 30 166 92 Q164 60 146 55 Q130 50 118 55 Q98 51 88 62 Q76 70 74 92 Z" />
          <circle cx={90} cy={44} r={9} opacity={0.9} />
          <circle cx={148} cy={42} r={9} opacity={0.9} />
        </g>
      );
    case 'hair_afro':
      return (
        <g>
          <circle cx={120} cy={40} r={48} fill={color} />
          <Shade d="M120 40 m-48 0 a48 48 0 0 0 26 43 L72 40 Z" />
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

const TopFront: React.FC<{ top: string; skinFill: string; skinShade: string }> = ({ top, skinFill, skinShade }) => {
  const clipId = React.useId();
  const jersey = HOUSE_JERSEY[top];
  if (top === 'top_tank') {
    // Bare shoulders + narrow-strap tank
    return (
      <g>
        <path d={TORSO} fill={skinFill} />
        <path d="M34 240 L34 206 Q34 174 68 163 L78 159 L78 240 Z" fill={skinShade} opacity={0.5} />
        <path d="M62 240 L62 196 Q62 178 88 172 L96 152 Q120 168 144 152 L152 172 Q178 178 178 196 L178 240 Z" fill="#2A3140" />
        <path d={COLLAR} fill="#232936" />
        <path d="M88 214 L118 194 L124 200 L94 220 Z" fill={VOLT} opacity={0.85} />
      </g>
    );
  }
  if (top === 'top_stripe') {
    return (
      <g>
        <clipPath id={clipId}><path d={TORSO} /></clipPath>
        <path d={TORSO} fill="#29313F" />
        <g clipPath={`url(#${clipId})`}>
          <rect x={34} y={182} width={172} height={10} fill={WHITE} opacity={0.9} />
          <rect x={34} y={204} width={172} height={10} fill={WHITE} opacity={0.9} />
          <rect x={34} y={226} width={172} height={10} fill={WHITE} opacity={0.9} />
        </g>
        <path d={COLLAR} fill={VOLT} />
      </g>
    );
  }
  if (top === 'top_polo') {
    return (
      <g>
        <path d={TORSO} fill="#24455C" />
        <path d="M94 156 L120 172 L146 156 L152 166 L120 186 L88 166 Z" fill={WHITE} />
        <path d="M120 186 L120 214" stroke="#16303F" strokeWidth={4} />
        <circle cx={120} cy={196} r={2.5} fill={WHITE} />
        <circle cx={120} cy={206} r={2.5} fill={WHITE} />
      </g>
    );
  }
  if (top === 'top_varsity') {
    return (
      <g>
        <path d={TORSO} fill="#232B38" />
        <path d="M34 206 Q34 174 68 163 L82 158 L82 240 L34 240 Z" fill={WHITE} opacity={0.92} />
        <path d="M206 206 Q206 174 172 163 L158 158 L158 240 L206 240 Z" fill={WHITE} opacity={0.92} />
        <path d={COLLAR} fill={GRAPHITE} />
        <path d="M120 164 L120 240" stroke="#0B0E13" strokeWidth={5} />
        <circle cx={112} cy={190} r={2.5} fill={VOLT} />
        <circle cx={112} cy={210} r={2.5} fill={VOLT} />
        <rect x={82} y={230} width={76} height={10} fill={GRAPHITE} />
        <rect x={82} y={230} width={76} height={5} fill={VOLT} opacity={0.85} />
      </g>
    );
  }
  if (top === 'top_gold') {
    return (
      <g>
        <path d={TORSO} fill={GOLD} />
        <path d="M40 200 L74 168 L84 174 L48 208 Z M200 200 L166 168 L156 174 L192 208 Z" fill={GRAPHITE} />
        <path d={COLLAR} fill={GRAPHITE} />
        <path d="M120 190 l5.2 10.5 11.6 1.7 -8.4 8.2 2 11.5 -10.4-5.4 -10.4 5.4 2-11.5 -8.4-8.2 11.6-1.7 Z" fill={GRAPHITE} />
        <rect x={34} y={232} width={172} height={8} fill={GRAPHITE} />
      </g>
    );
  }
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
    case 'acc_bandana':
      return (
        <g>
          <rect x={74} y={64} width={92} height={17} rx={8} fill="#D64541" />
          <path d="M166 70 L182 62 L176 78 Z M166 74 L184 76 L172 86 Z" fill="#D64541" />
          <circle cx={92} cy={72} r={2} fill="#FFFFFF" opacity={0.8} />
          <circle cx={112} cy={72} r={2} fill="#FFFFFF" opacity={0.8} />
          <circle cx={132} cy={72} r={2} fill="#FFFFFF" opacity={0.8} />
          <circle cx={152} cy={72} r={2} fill="#FFFFFF" opacity={0.8} />
        </g>
      );
    case 'acc_goggles':
      return (
        <g>
          <rect x={70} y={94} width={100} height={11} rx={5.5} fill={GRAPHITE} />
          <circle cx={100} cy={103} r={14} fill="#38BDF8" opacity={0.9} stroke={INK} strokeWidth={3.5} />
          <circle cx={140} cy={103} r={14} fill="#38BDF8" opacity={0.9} stroke={INK} strokeWidth={3.5} />
          <path d="M114 103 L126 103" stroke={INK} strokeWidth={4} />
          <circle cx={95} cy={98} r={3.5} fill="#FFFFFF" opacity={0.85} />
          <circle cx={135} cy={98} r={3.5} fill="#FFFFFF" opacity={0.85} />
        </g>
      );
    case 'acc_eyeblack':
      return (
        <g fill={INK} opacity={0.85}>
          <rect x={90} y={115} width={17} height={6.5} rx={2.5} />
          <rect x={133} y={115} width={17} height={6.5} rx={2.5} />
        </g>
      );
    case 'acc_bucket':
      return (
        <g>
          <path d="M86 58 Q86 28 120 26 Q154 28 154 58 Z" fill="#4A5568" />
          <path d="M68 72 L86 54 L154 54 L172 72 Q120 84 68 72 Z" fill="#3D4757" />
          <path d="M88 46 L152 46" stroke={VOLT} strokeWidth={3.5} opacity={0.8} />
        </g>
      );
    case 'acc_helmet':
      return (
        <g>
          <path d="M70 82 Q70 18 120 16 Q170 18 170 82 L170 90 Q145 82 120 82 Q95 82 70 90 Z" fill="#E23A3A" />
          <path d="M112 18 L112 82 L128 82 L128 18 Q120 16 112 18 Z" fill="#FFFFFF" opacity={0.9} />
          <circle cx={88} cy={48} r={3} fill="#B02A2A" />
          <circle cx={152} cy={48} r={3} fill="#B02A2A" />
        </g>
      );
    case 'acc_volt_helmet':
      return (
        <g>
          <path d="M68 96 Q68 20 120 18 Q172 20 172 96 L172 110 Q160 114 154 108 L154 96 Q138 90 120 90 Q102 90 86 96 L86 108 Q80 114 68 110 Z" fill={VOLT} />
          <path d="M84 78 Q84 60 100 58 L140 58 Q156 60 156 78 L156 92 Q120 84 84 92 Z" fill="#14171E" />
          <path d="M92 66 L128 66" stroke={VOLT} strokeWidth={3} opacity={0.6} />
          <path d="M72 44 Q96 28 120 28" stroke={GRAPHITE} strokeWidth={4} fill="none" opacity={0.5} />
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
  const feminine = look?.body === 'F';

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
        <TopFront top={top} skinFill={skin.fill} skinShade={skin.shade} />
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
        {feminine && (
          <g stroke={INK} strokeWidth={2.6} strokeLinecap="round">
            <path d="M92 98 L86 93" />
            <path d="M90 103 L83 100" />
            <path d="M148 98 L154 93" />
            <path d="M150 103 L157 100" />
          </g>
        )}
        {/* confident smile */}
        <path d="M104 122 Q120 135 136 122" stroke={INK} strokeWidth={5} strokeLinecap="round" fill="none" />
        <HairFront hair={hair} color={hairColor} />
        {acc && <Accessory acc={acc} />}
      </g>
    </svg>
  );
};

export default AvatarRig;
