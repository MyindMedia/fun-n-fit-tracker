import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { HOUSES, APP_LOGO_URL } from '../constants';
import { HouseId } from '../types';
import { Ic, IconProps } from './icons';
import { useScrollReveal, useParallaxScroll, pzDelay } from './useReveal';

/* ────────────────────────────────────────────────────────────────────────────
   Marketing landing page for Fun 'n Fit Academy.
   Standalone (rendered outside Layout) — brings its own nav + footer.
   Uses the Pubzi esports theme layer (.pz-* classes in index.html).
   ──────────────────────────────────────────────────────────────────────────── */

// Small notched cut-corner shape for inline elements (matches Layout/Leaderboard)
const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';

// Focus ring for keyboard users. Notched (.pz-btn) elements clip their own
// outline, so CTAs put this on an unclipped wrapper around the notched span.
const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBFE1C]';

// In-page anchors can't be plain href="#id" links under HashRouter, so we
// scroll programmatically (and respect prefers-reduced-motion).
const scrollToSection = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
};

/* ── Content (from funnfitacademy.com — no invented programs/prices) ──────── */

const ANCHORS = [
  { id: 'programs', label: 'Programs' },
  { id: 'houses', label: 'Houses' },
  { id: 'game-center', label: 'Game Center' },
  { id: 'visit', label: 'Visit' },
];

const BENEFITS: Array<{ title: string; copy: string; icon: React.FC<IconProps> }> = [
  { title: 'Confidence', copy: 'Kids build confidence and overcome fears, one small win at a time.', icon: Ic.Medal },
  { title: 'Teamwork', copy: 'Collaborative challenges teach kids to win — and lose — together.', icon: Ic.Users },
  { title: 'Fitness', copy: 'Physical and mental fitness in every session: strong bodies, sharp minds.', icon: Ic.Muscle },
  { title: 'Friendship', copy: 'Lasting friendships and memories, made right on the gym floor.', icon: Ic.Wave },
];

const HOUSE_ORDER: HouseId[] = [HouseId.VALOR, HouseId.SAGE, HouseId.SPARK, HouseId.UNITY];

const HOUSE_LORE: Record<HouseId, { virtue: string; line: string }> = {
  [HouseId.VALOR]: { virtue: 'Bravery', line: 'Daring to try — even when it feels scary.' },
  [HouseId.SAGE]: { virtue: 'Problem-solving', line: 'Thinking it through before the next move.' },
  [HouseId.SPARK]: { virtue: 'Creativity', line: 'Finding the fun nobody else saw.' },
  [HouseId.UNITY]: { virtue: 'Collaboration', line: 'Winning together — or not at all.' },
};

interface Program {
  name: string;
  days: string;
  time: string;
  copy: string;
  badge?: string;
  note?: string;
  wide?: boolean;
}

const PROGRAMS: Program[] = [
  {
    name: 'After School Program',
    days: 'Mon · Tue · Wed · Fri',
    time: '5:30–6:30 PM',
    copy: 'Confidence and leadership shine as kids take on mini games, team challenges, and competition in a fun, supportive space.',
    badge: 'Coming Soon',
  },
  {
    name: 'Bubble Ball & Dodgeball League',
    days: 'Thursdays',
    time: '5:30–6:30 PM',
    copy: 'One league, double the fun. Dodgeball and Bubble Ball build teamwork, confidence, and nonstop play for kids & parents, alike.',
    badge: 'Coming Soon',
  },
  {
    name: 'Neuro Diverse Program',
    days: 'Tue & Thu',
    time: '11:00–11:45 AM',
    copy: 'A safe & supportive space where kids with developmental differences shine, grow and feel celebrated for who they are!',
    badge: 'Coming Soon',
  },
  {
    name: 'Toddler Time',
    days: 'Mondays',
    time: '3:30–4:15 PM',
    copy: 'A playful space where toddlers explore, move and learn through fun games, creativity, and early friendships built on our house values.',
    badge: 'Coming Soon',
  },
  {
    name: 'Homeschoolers',
    days: 'Mon–Thu',
    time: '1:00–2:30 PM',
    copy: 'Daytime sessions for homeschool families, in partnership with AdLive Academy. Enrollment opens September 2026.',
    badge: 'Coming Soon',
    note: 'AdLive Academy Partnership',
    wide: true,
  },
];

const ALSO_OFFERED = ['Summer Camp', 'Little Leaders (Academy Core)', 'Fitness Results Dance', 'Leadership Program'];

const GAME_CENTER_FEATURES: Array<{ text: string; icon: React.FC<IconProps> }> = [
  { text: 'Live house leaderboard on the gym projector', icon: Ic.Projector },
  { text: 'Check in at the door with a parent QR code', icon: Ic.QrCode },
  { text: 'Kids earn points at partner businesses around Upland', icon: Ic.Store },
  { text: 'An item shop where points unlock ranked power gear', icon: Ic.Gift },
];

const FALL_HOURS = [
  { days: 'Mon – Wed', time: '12:00 – 6:00 PM' },
  { days: 'Thursday', time: '11:00 AM – 6:30 PM' },
  { days: 'Friday', time: '3:00 – 6:00 PM' },
];

const MAPS_URL = 'https://maps.google.com/?q=167+S+Third+Ave,+Upland,+CA+91786';
const INSTAGRAM_URL = 'https://instagram.com/funnfitupland';

/* ── Shared building blocks ───────────────────────────────────────────────── */

const Cta: React.FC<{
  to: string;
  variant?: 'volt' | 'ghost';
  className?: string;
  children: React.ReactNode;
}> = ({ to, variant = 'volt', className = '', children }) => (
  <Link to={to} className={`inline-flex ${FOCUS_RING}`}>
    <span
      className={`${variant === 'volt' ? 'pz-btn' : 'pz-btn-ghost'} inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm ${className}`}
    >
      {children}
    </span>
  </Link>
);

const SectionHeading: React.FC<{ eyebrow: string; title: React.ReactNode; lede?: string; className?: string }> = ({
  eyebrow,
  title,
  lede,
  className = '',
}) => (
  <div className={`max-w-3xl ${className}`}>
    <p className="pz-eyebrow mb-3">{eyebrow}</p>
    <h2 className="text-3xl sm:text-4xl lg:text-5xl text-white leading-tight">{title}</h2>
    {lede && (
      <p className="mt-4 text-base md:text-lg leading-relaxed" style={{ color: 'var(--pz-text)' }}>
        {lede}
      </p>
    )}
  </div>
);

// Decorative theme shape — purely visual, hidden from assistive tech.
// Outer span is the parallax layer (scroll-driven translate at `speed`);
// the inner img bobs on `.pz-float-slow`. They must be separate elements —
// both effects use `transform`, so on one node the animation would win.
const Deco: React.FC<{ src: string; className: string; speed?: number; float?: boolean }> = ({
  src,
  className,
  speed = -0.1,
  float = true,
}) => (
  <span
    aria-hidden="true"
    className={`pz-parallax pointer-events-none select-none absolute hidden md:block ${className}`}
    style={{ '--pz-speed': String(speed) } as React.CSSProperties}
  >
    <img src={src} alt="" className={`w-full ${float ? 'pz-float-slow' : ''}`} />
  </span>
);

/* ── 1. Sticky nav ────────────────────────────────────────────────────────── */

const LandingNav: React.FC<{ solid: boolean }> = ({ solid }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  // Transparent while riding the hero; solid + shadow once scrolled past ~40px
  // (or whenever the mobile menu needs a readable backdrop).
  const detached = solid || menuOpen;

  const handleAnchor = (id: string) => {
    setMenuOpen(false);
    // Defer one tick so the collapsed mobile menu's layout shift lands
    // before the scroll position is computed.
    window.setTimeout(() => scrollToSection(id), 0);
  };

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: detached ? 'rgba(11, 14, 19, 0.92)' : 'rgba(11, 14, 19, 0)',
        backdropFilter: detached ? 'blur(10px)' : 'none',
        WebkitBackdropFilter: detached ? 'blur(10px)' : 'none',
        borderBottom: `1px solid ${detached ? 'var(--pz-border)' : 'transparent'}`,
        boxShadow: detached ? '0 14px 34px -18px rgba(0, 0, 0, 0.7)' : 'none',
        transition: 'background-color 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease',
      }}
    >
      <nav aria-label="Main" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Brand */}
          <Link to="/" className={`flex items-center gap-3 group shrink-0 ${FOCUS_RING}`}>
            <span
              className="w-10 h-10 bg-white flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105"
              style={{ clipPath: NOTCH_SM }}
            >
              <img src={APP_LOGO_URL} alt="Fun 'n Fit Academy logo" className="w-full h-full object-contain p-1" />
            </span>
            <span className="leading-tight">
              <span className="pz-display block text-white text-sm md:text-base">Fun 'n Fit</span>
              <span
                className="block text-[9px] font-bold uppercase tracking-[0.3em]"
                style={{ color: 'var(--pz-volt)' }}
              >
                Academy
              </span>
            </span>
          </Link>

          {/* Anchor links (desktop) */}
          <div className="hidden lg:flex items-center gap-1">
            {ANCHORS.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => handleAnchor(a.id)}
                className={`px-3 py-2 text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white transition-colors ${FOCUS_RING}`}
              >
                {a.label}
              </button>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <Link to="/parents" className={`hidden md:inline-flex ${FOCUS_RING}`}>
              <span className="pz-btn-ghost inline-flex items-center px-4 py-2.5 text-xs">For Parents</span>
            </Link>
            <Link to="/live" className={`hidden sm:inline-flex ${FOCUS_RING}`}>
              <span className="pz-btn-ghost inline-flex items-center px-4 py-2.5 text-xs">Live Board</span>
            </Link>
            <Link to="/parent-login" className={`inline-flex ${FOCUS_RING}`}>
              <span className="pz-btn inline-flex items-center px-4 py-2.5 text-xs">Enroll Now</span>
            </Link>

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMenuOpen(o => !o)}
              aria-expanded={menuOpen}
              aria-controls="landing-mobile-menu"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className={`lg:hidden touch-btn flex flex-col items-center justify-center gap-1 w-10 h-10 text-white ${menuOpen ? 'hamburger-open' : ''} ${FOCUS_RING}`}
            >
              <span className="hamburger-line" />
              <span className="hamburger-line" />
              <span className="hamburger-line" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          id="landing-mobile-menu"
          className="lg:hidden px-4 pb-4 pt-1 flex flex-col"
          style={{ background: 'var(--pz-panel)', borderTop: '1px solid var(--pz-border)' }}
        >
          {ANCHORS.map(a => (
            <button
              key={a.id}
              type="button"
              onClick={() => handleAnchor(a.id)}
              className={`text-left px-2 py-3 text-sm font-bold uppercase tracking-widest text-white/80 hover:text-white ${FOCUS_RING}`}
              style={{ borderBottom: '1px solid var(--pz-border)' }}
            >
              {a.label}
            </button>
          ))}
          <Link
            to="/live"
            onClick={() => setMenuOpen(false)}
            className={`sm:hidden px-2 py-3 text-sm font-bold uppercase tracking-widest text-white/80 hover:text-white ${FOCUS_RING}`}
          >
            Live Board
          </Link>
        </div>
      )}
    </header>
  );
};

/* ── 2. Hero ──────────────────────────────────────────────────────────────── */

const Hero: React.FC = () => (
  <section className="relative overflow-hidden" style={{ background: 'var(--pz-bg)' }}>
    {/* 21:9 arena photo — kids sit center-left, dark sky top-right for the headline.
        Parallax layer: drifts at -0.25× scroll for depth; oversized vertically
        (112%) so the travel never exposes the section edge. */}
    <img
      src="/assets/theme/landing-hero.png"
      alt="Kids mid-game in a dodgeball match, lit by a bright volt light beam across a dark gym"
      className="pz-parallax absolute left-0 right-0 w-full object-cover"
      style={{ objectPosition: '32% center', top: '-6%', height: '112%', '--pz-speed': '-0.25' } as React.CSSProperties}
    />
    {/* Legibility overlays: fade to page bg at the bottom, deepen the dark right side */}
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={{
        background:
          'linear-gradient(to top, #0B0E13 0%, rgba(11,14,19,0.55) 34%, rgba(11,14,19,0.15) 60%, rgba(11,14,19,0.35) 100%)',
      }}
    />
    <div
      aria-hidden="true"
      className="absolute inset-0 hidden lg:block"
      style={{ background: 'linear-gradient(to left, rgba(11,14,19,0.72) 0%, rgba(11,14,19,0.25) 42%, transparent 65%)' }}
    />
    {/* Stronger scrim on small screens, where the photo sits behind the copy */}
    <div
      aria-hidden="true"
      className="absolute inset-0 lg:hidden"
      style={{
        background: 'linear-gradient(to top, #0B0E13 4%, rgba(11,14,19,0.78) 42%, rgba(11,14,19,0.45) 100%)',
      }}
    />

    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[560px] md:min-h-[640px] lg:min-h-[78vh] flex items-end lg:items-center">
      {/* Above the fold: the observer fires on mount, so this plays as a
          staggered load-in — eyebrow → headline → subline → CTAs. */}
      <div className="w-full lg:max-w-xl lg:ml-auto pb-14 pt-40 lg:py-24">
        <p className="pz-eyebrow mb-4 pz-reveal">Upland, CA — Ages 6–17</p>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl text-white leading-[0.95] pz-reveal" style={pzDelay(120)}>
          Where fitness meets <span style={{ color: 'var(--pz-volt)' }}>fun</span> and leadership
        </h1>
        <p
          className="mt-5 text-base md:text-lg leading-relaxed max-w-lg pz-reveal"
          style={{ color: '#c9c9c9', ...pzDelay(240) }}
        >
          <span className="text-white font-semibold">Empower through play.</span> Physical activity, mental growth,
          and core-values coaching — through games kids beg to come back to. We shape leaders, not just athletes.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3 pz-reveal" style={pzDelay(360)}>
          <Cta to="/parent-login">Enroll Now</Cta>
          <Cta to="/live" variant="ghost">
            Watch the Live Board
          </Cta>
        </div>
      </div>
    </div>
  </section>
);

/* ── 3. Value strip ───────────────────────────────────────────────────────── */

const ValueStrip: React.FC = () => (
  <section aria-label="Why families choose Fun 'n Fit" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-2 pb-4">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {BENEFITS.map((b, i) => (
        <div key={b.title} className="pz-card-sm relative p-5 pz-reveal" style={pzDelay(i * 80)}>
          <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-1" style={{ background: 'var(--pz-volt)', opacity: 0.85 }} />
          <h3 className="text-sm text-white mb-1.5 flex items-center gap-2">
            <span aria-hidden="true" className="shrink-0" style={{ color: 'var(--pz-volt)' }}><b.icon size={18} /></span>
            {b.title}
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--pz-text)' }}>
            {b.copy}
          </p>
        </div>
      ))}
    </div>
  </section>
);

/* ── 4. Houses (the signature section) ────────────────────────────────────── */

const HousesSection: React.FC = () => (
  <section id="houses" className="relative overflow-hidden py-20 md:py-28" style={{ scrollMarginTop: '4.5rem' }}>
    {/* Depth layers: slow background drift right, faster foreground drift left */}
    <Deco src="/assets/theme/shape-1.png" className="right-[8%] top-32 w-14 opacity-40" speed={-0.1} />
    <Deco src="/assets/theme/dot-arrow.png" className="left-[3%] top-10 w-14 opacity-25" speed={0.08} float={false} />

    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <SectionHeading
        className="pz-reveal"
        eyebrow="The house system"
        title={
          <>
            Four houses. <span style={{ color: 'var(--pz-volt)' }}>One arena.</span>
          </>
        }
        lede="Every kid joins a house. Every point counts. Games, challenges, and good character all earn points for the house — and the whole academy watches the standings move, live."
      />

      <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
        {HOUSE_ORDER.map((id, idx) => {
          const house = HOUSES[id];
          const lore = HOUSE_LORE[id];
          return (
            <div
              key={id}
              className={`pz-card relative overflow-hidden p-6 pt-8 pz-reveal ${idx % 2 === 0 ? 'pz-reveal-left' : 'pz-reveal-right'}`}
              style={pzDelay(idx * 100)}
            >
              {/* House color spine */}
              <span aria-hidden="true" className="absolute top-0 left-0 right-0 h-1" style={{ background: house.colorHex }} />
              {/* Ambient house glow */}
              <div
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none"
                style={{ background: `radial-gradient(120% 70% at 50% 0%, ${house.colorHex}24, transparent 60%)` }}
              />
              <div className="relative flex flex-col items-center text-center">
                <img
                  src={house.customIcon}
                  alt={`House ${house.name} crest`}
                  className="w-20 h-20 mb-5"
                  style={{ filter: `drop-shadow(0 0 22px ${house.colorHex}66)` }}
                />
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] mb-1" style={{ color: 'var(--pz-text)' }}>
                  House
                </p>
                <h3 className="text-2xl mb-3" style={{ color: house.colorHex }}>
                  {house.name}
                </h3>
                <span
                  className="inline-block px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/90 border mb-3"
                  style={{ clipPath: NOTCH_SM, borderColor: `${house.colorHex}66`, background: `${house.colorHex}1a` }}
                >
                  {lore.virtue}
                </span>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--pz-text)' }}>
                  {lore.line}
                </p>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">
                  The {house.mascot}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </section>
);

/* ── 5. Programs ──────────────────────────────────────────────────────────── */

const ProgramCard: React.FC<{ program: Program; delayMs: number }> = ({ program, delayMs }) => (
  <div
    className={`pz-card relative p-6 pz-reveal pz-reveal-scale ${program.wide ? 'md:col-span-2' : ''}`}
    style={pzDelay(delayMs)}
  >
    {program.badge && (
      <span
        className="absolute top-4 right-4 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em]"
        style={{ clipPath: NOTCH_SM, background: 'var(--pz-volt)', color: '#0B0E13' }}
      >
        {program.badge}
      </span>
    )}
    <div className="flex flex-wrap items-center gap-2 mb-4 pr-24">
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] border"
        style={{ clipPath: NOTCH_SM, color: 'var(--pz-volt)', borderColor: 'rgba(203, 254, 28, 0.35)', background: 'rgba(203, 254, 28, 0.08)' }}
      >
        <Ic.Calendar size={12} className="shrink-0" />
        {program.days}
      </span>
      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-white/80">
        <Ic.Timer size={14} className="shrink-0" />
        {program.time}
      </span>
    </div>
    <h3 className="text-lg text-white leading-snug">{program.name}</h3>
    {program.note && (
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: 'var(--pz-volt)' }}>
        {program.note}
      </p>
    )}
    <p className="mt-3 text-sm leading-relaxed max-w-2xl" style={{ color: 'var(--pz-text)' }}>
      {program.copy}
    </p>
  </div>
);

const ProgramsSection: React.FC = () => (
  <section id="programs" className="relative py-20 md:py-28" style={{ background: 'var(--pz-panel-2)', borderTop: '1px solid var(--pz-border)', borderBottom: '1px solid var(--pz-border)', scrollMarginTop: '4.5rem' }}>
    <Deco src="/assets/theme/shape-2.png" className="right-[6%] top-56 w-14 opacity-40" speed={-0.08} />

    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <SectionHeading
        className="pz-reveal"
        eyebrow="Weekly schedule"
        title="Programs"
        lede="Find the session that fits your family. Every program below runs on the same house points system — so every week counts."
      />

      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        {PROGRAMS.map((p, i) => (
          <ProgramCard key={p.name} program={p} delayMs={i * 80} />
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2.5 pz-reveal" style={pzDelay(160)}>
        <span className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: 'var(--pz-text)' }}>
          Also at the academy:
        </span>
        {ALSO_OFFERED.map(item => (
          <span
            key={item}
            className="pz-card-sm px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white/80"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  </section>
);

/* ── 6. Game Center ───────────────────────────────────────────────────────── */

// Illustrative preview of the live house board (sample values, not real scores)
const BOARD_PREVIEW: Array<{ id: HouseId; points: string; width: string }> = [
  { id: HouseId.SPARK, points: '12,480', width: '100%' },
  { id: HouseId.UNITY, points: '11,930', width: '92%' },
  { id: HouseId.VALOR, points: '11,210', width: '85%' },
  { id: HouseId.SAGE, points: '10,640', width: '78%' },
];

const BoardPreview: React.FC = () => (
  <div
    aria-hidden="true"
    className="pz-card relative p-5 md:p-6 pz-reveal pz-reveal-right"
    style={{ background: 'rgba(18, 22, 31, 0.92)', ...pzDelay(150) }}
  >
    {/* Standings bars fill (scaleX — compositor-only) once the board reveals:
        width is the real value inline; the transform sweeps 0 → 1 staggered. */}
    <style>{`
      .gc-bar {
        transform: scaleX(0);
        transform-origin: left center;
        transition: transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .pz-in .gc-bar { transform: scaleX(1); }
      @media (prefers-reduced-motion: reduce) {
        .gc-bar { transform: none; transition: none; }
      }
    `}</style>
    <div className="flex items-center justify-between mb-5">
      <div>
        <p className="pz-eyebrow mb-1 text-[10px]">Live from the gym floor</p>
        <p className="pz-display text-white text-lg">House standings</p>
      </div>
      <span className="pz-card-sm flex items-center gap-2 px-3 py-1.5">
        <span className="w-2 h-2 rounded-full pz-live" style={{ background: 'var(--pz-volt)' }} />
        <span className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: 'var(--pz-volt)' }}>
          Live
        </span>
      </span>
    </div>

    <div className="flex flex-col gap-3.5">
      {BOARD_PREVIEW.map((row, idx) => {
        const house = HOUSES[row.id];
        return (
          <div key={row.id} className="flex items-center gap-3">
            <span className="pz-display text-xs w-4 text-white/40">{idx + 1}</span>
            <img src={house.customIcon} alt="" className="w-8 h-8 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="pz-display text-sm" style={{ color: house.colorHex }}>
                  {house.name}
                </span>
                <span className="pz-display text-sm text-white">{row.points}</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 overflow-hidden" style={{ clipPath: NOTCH_SM }}>
                <div
                  className="gc-bar h-full"
                  style={{ width: row.width, background: house.colorHex, transitionDelay: `${350 + idx * 90}ms` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>

    <div className="mt-5 pt-4 flex items-center gap-2" style={{ borderTop: '1px solid var(--pz-border)' }}>
      <span
        className="px-2 py-0.5 text-[10px] font-black border bg-emerald-500/20 border-emerald-400 text-emerald-300"
        style={{ clipPath: NOTCH_SM }}
      >
        +25
      </span>
      <span className="text-xs font-bold truncate" style={{ color: 'var(--pz-text)' }}>
        Maya S. — Relay Races win for House Spark
      </span>
    </div>
  </div>
);

const GameCenterSection: React.FC = () => (
  <section
    id="game-center"
    className="relative overflow-hidden py-20 md:py-28"
    style={{
      scrollMarginTop: '4.5rem',
      backgroundColor: 'var(--pz-bg)',
      backgroundImage:
        'linear-gradient(to bottom, rgba(11, 14, 19, 0.88), rgba(11, 14, 19, 0.94) 70%, #0B0E13), url(/assets/theme/arena-bg.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}
  >
    {/* Authored below the section edge; the negative-speed drift raises it into
        frame as the section scrolls through the viewport. */}
    <Deco src="/assets/theme/dot-arrow.png" className="left-[4%] -bottom-24 w-16 opacity-40" speed={-0.05} />

    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
      <div className="pz-reveal pz-reveal-left">
        <p className="pz-eyebrow mb-3">The Game Center</p>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl text-white leading-tight">
          Your kid's points, <span style={{ color: 'var(--pz-volt)' }}>live on the big board</span>
        </h2>
        <p className="mt-4 text-base md:text-lg leading-relaxed" style={{ color: 'var(--pz-text)' }}>
          The academy runs on its own game platform. Points your kid earns in class go straight to the house board
          on the gym projector — and you can track everything from your phone.
        </p>

        <ul className="mt-7 flex flex-col gap-3.5">
          {GAME_CENTER_FEATURES.map(f => (
            <li key={f.text} className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-0.5 shrink-0" style={{ color: 'var(--pz-volt)' }}><f.icon size={18} /></span>
              <span className="text-sm md:text-base font-medium text-white/85">{f.text}</span>
            </li>
          ))}
        </ul>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Cta to="/parent-login">Open the Parent Portal</Cta>
          <Cta to="/live" variant="ghost">
            Watch the Live Board
          </Cta>
        </div>
      </div>

      <BoardPreview />
    </div>
  </section>
);

/* ── 7. Visit / Contact ───────────────────────────────────────────────────── */

const VisitSection: React.FC = () => (
  <section id="visit" className="relative overflow-hidden py-20 md:py-28" style={{ scrollMarginTop: '4.5rem' }}>
    <Deco src="/assets/theme/shape-1.png" className="right-[7%] top-64 w-12 opacity-30" speed={-0.04} />

    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <SectionHeading
        className="pz-reveal"
        eyebrow="Visit us"
        title="Come see a session"
        lede="Drop in during Fall hours, give us a call, or say hi on Instagram — we'd love to show you around the arena."
      />

      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {/* Hours */}
        <div className="pz-card p-6 pz-reveal">
          <h3 className="text-base text-white mb-4 flex items-center gap-2">
            <span aria-hidden="true" style={{ color: 'var(--pz-volt)' }}><Ic.Calendar size={16} /></span>
            Fall hours
          </h3>
          <dl>
            {FALL_HOURS.map(row => (
              <div
                key={row.days}
                className="flex items-center justify-between gap-4 py-3"
                style={{ borderBottom: '1px solid var(--pz-border)' }}
              >
                <dt className="text-sm font-bold text-white/90">{row.days}</dt>
                <dd className="text-sm font-semibold" style={{ color: 'var(--pz-text)' }}>
                  {row.time}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs leading-relaxed" style={{ color: 'var(--pz-text)' }}>
            Program times vary — check the schedule above for your session.
          </p>
        </div>

        {/* Contact */}
        <div className="pz-card p-6 pz-reveal" style={pzDelay(100)}>
          <h3 className="text-base text-white mb-4">Find us</h3>
          <div className="flex flex-col gap-4">
            <a
              href={MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`group text-sm leading-relaxed text-white/85 hover:text-white ${FOCUS_RING}`}
            >
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] mb-1" style={{ color: 'var(--pz-volt)' }}>
                <Ic.MapPin size={12} className="shrink-0" /> Address
              </span>
              167 S Third Ave, Upland, CA 91786
              <span className="block mt-0.5 text-xs underline underline-offset-2 opacity-70 group-hover:opacity-100">
                Open in Google Maps
              </span>
            </a>
            <a href="tel:+19516128233" className={`text-sm text-white/85 hover:text-white ${FOCUS_RING}`}>
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] mb-1" style={{ color: 'var(--pz-volt)' }}>
                <Ic.Phone size={12} className="shrink-0" /> Phone
              </span>
              (951) 612-8233
            </a>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-sm text-white/85 hover:text-white ${FOCUS_RING}`}
            >
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] mb-1" style={{ color: 'var(--pz-volt)' }}>
                <Ic.Camera size={12} className="shrink-0" /> Instagram
              </span>
              @funnfitupland
            </a>
          </div>
        </div>

        {/* Enroll CTA */}
        <div
          className="pz-card relative overflow-hidden p-6 flex flex-col md:col-span-2 lg:col-span-1 pz-reveal"
          style={pzDelay(200)}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(120% 80% at 50% 0%, rgba(203, 254, 28, 0.1), transparent 60%)' }}
          />
          <div className="relative flex flex-col h-full">
            <h3 className="text-base text-white mb-2">Ready to jump in?</h3>
            <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--pz-text)' }}>
              Create a parent account and enroll your athlete — it takes about five minutes, and your kid gets a
              house on day one.
            </p>
            <div className="mt-auto">
              <Cta to="/parent-login" className="w-full">
                Enroll Now
              </Cta>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

/* ── 8. Footer ────────────────────────────────────────────────────────────── */

const FOOTER_LINKS = [
  { label: 'Live Board', to: '/live' },
  { label: 'Parent Portal', to: '/parent-login' },
  { label: 'Student Portal', to: '/login' },
  { label: 'Coach Login', to: '/admin' },
];

const LandingFooter: React.FC = () => (
  <footer style={{ background: 'var(--pz-panel)', borderTop: '1px solid var(--pz-border)' }}>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pz-reveal">
      <div className="flex flex-col md:flex-row gap-10 md:gap-16 justify-between">
        <div className="max-w-xs">
          <Link to="/" className={`flex items-center gap-3 group ${FOCUS_RING}`}>
            <span
              className="w-10 h-10 bg-white flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105"
              style={{ clipPath: NOTCH_SM }}
            >
              <img src={APP_LOGO_URL} alt="Fun 'n Fit Academy logo" className="w-full h-full object-contain p-1" />
            </span>
            <span className="pz-display text-white text-base">Fun 'n Fit</span>
          </Link>
          <p className="mt-4 text-sm leading-relaxed" style={{ color: 'var(--pz-text)' }}>
            Where fitness meets fun and leadership — game-based coaching for kids ages 6–17 in Upland, CA.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-col gap-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] mb-1" style={{ color: 'var(--pz-volt)' }}>
            Quick links
          </p>
          {FOOTER_LINKS.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className={`text-sm font-semibold text-white/70 hover:text-white transition-colors ${FOCUS_RING}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] mb-1" style={{ color: 'var(--pz-volt)' }}>
            Contact
          </p>
          <a href="tel:+19516128233" className={`inline-flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white ${FOCUS_RING}`}>
            <Ic.Phone size={14} className="shrink-0" style={{ color: 'var(--pz-volt)' }} />
            (951) 612-8233
          </a>
          <a
            href={MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white ${FOCUS_RING}`}
          >
            <Ic.MapPin size={14} className="shrink-0" style={{ color: 'var(--pz-volt)' }} />
            167 S Third Ave, Upland, CA 91786
          </a>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white ${FOCUS_RING}`}
          >
            <Ic.Camera size={14} className="shrink-0" style={{ color: 'var(--pz-volt)' }} />
            @funnfitupland
          </a>
        </div>
      </div>

      <div
        className="mt-10 pt-6 text-xs font-semibold"
        style={{ borderTop: '1px solid var(--pz-border)', color: 'var(--pz-text)' }}
      >
        © Fun 'n Fit Academy
      </div>
    </div>
  </footer>
);

/* ── Page ─────────────────────────────────────────────────────────────────── */

const Landing: React.FC = () => {
  // One observer reveals every `.pz-reveal` on the page; one rAF scroll
  // handler drives every `.pz-parallax` layer via `--pz-scroll` on this root
  // AND feeds the nav detach state — a single scrollY read per frame.
  const rootRef = useScrollReveal<HTMLDivElement>();
  const [navSolid, setNavSolid] = useState(false);
  useParallaxScroll(rootRef, y => setNavSolid(y > 40));

  return (
    <div ref={rootRef} className="pz-scope min-h-screen" style={{ background: 'var(--pz-bg)' }}>
      <LandingNav solid={navSolid} />
      <main>
        <Hero />
        <ValueStrip />
        <HousesSection />
        <ProgramsSection />
        <GameCenterSection />
        <VisitSection />
      </main>
      <LandingFooter />
    </div>
  );
};

export default Landing;
