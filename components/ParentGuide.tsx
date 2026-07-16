import React from 'react';
import { Link } from 'react-router-dom';
import { APP_LOGO_URL } from '../constants';
import { Ic, IconProps } from './icons';
import { useScrollReveal, pzDelay } from './useReveal';

/* ────────────────────────────────────────────────────────────────────────────
   Parent guide — a shareable, branded walkthrough of everything the Parent
   Portal does, with real screenshots. Standalone like Landing (own nav +
   footer), Pubzi esports theme. Send this link to parents: /#/parents
   ──────────────────────────────────────────────────────────────────────────── */

const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';
const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBFE1C]';

const G = '/assets/guide';

/* Phone-framed screenshot */
const PhoneShot: React.FC<{ src: string; alt: string; className?: string }> = ({ src, alt, className = '' }) => (
  <div
    className={`relative rounded-[2.2rem] border-4 border-[#232936] bg-[#0B0E13] p-2 shadow-2xl ${className}`}
    style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(203,254,28,0.08)' }}
  >
    <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-16 h-1.5 rounded-full bg-[#232936]" aria-hidden />
    <img src={src} alt={alt} loading="lazy" className="w-full rounded-[1.6rem] border border-white/5" />
  </div>
);

const PortalCta: React.FC<{ label?: string }> = ({ label = 'Open the Parent Portal' }) => (
  <Link to="/parent-login" className={`inline-flex ${FOCUS_RING}`}>
    <span className="pz-btn px-7 py-4 text-sm inline-flex items-center gap-2">
      {label} <Ic.ArrowRight size={16} />
    </span>
  </Link>
);

interface Feature {
  id: string;
  eyebrow: string;
  title: string;
  copy: string;
  bullets: Array<{ icon: React.FC<IconProps>; text: string }>;
  shot: string;
  alt: string;
}

const FEATURES: Feature[] = [
  {
    id: 'track',
    eyebrow: 'Live tracking',
    title: 'Every point, the second they earn it',
    copy: "Your kid's points, rank, house, and badges update in real time — the moment a coach awards them on the gym floor, it's on your phone.",
    bullets: [
      { icon: Ic.Bolt, text: 'Total points, current rank, and house at a glance' },
      { icon: Ic.CheckCircle, text: 'Present / away status, live from Roll Call' },
      { icon: Ic.Chart, text: 'Progress bar to the next level, down to the point' },
    ],
    shot: `${G}/kid-detail.png`,
    alt: 'Athlete summary with points, rank, house, and badges',
  },
  {
    id: 'levels',
    eyebrow: 'Level path',
    title: 'The whole road to Apex, mapped out',
    copy: 'Kids start as a Noob and climb ten levels to Apex. The Level Path shows every level ahead, what it takes to get there, and every medal coaches have crowned them with along the way.',
    bullets: [
      { icon: Ic.Trophy, text: 'Ten levels — Noob, Rookie, Challenger… all the way to Apex' },
      { icon: Ic.Medal, text: 'Coach medals: Session Legend, MVP, Hustle, Teamwork' },
      { icon: Ic.Gift, text: 'Badges and rewards collected, all in one trophy case' },
    ],
    shot: `${G}/level-path.png`,
    alt: 'Level path ladder and coach medals',
  },
  {
    id: 'checkin',
    eyebrow: 'Check-in',
    title: 'Check in from your phone in seconds',
    copy: "Scan the front-desk QR from the portal — or let your kid tap their NFC wristband — and they're on the day's board with bonus points for showing up. Every kid gets a digital pass, too.",
    bullets: [
      { icon: Ic.QrCode, text: 'Scan the rotating gym QR right from the portal' },
      { icon: Ic.Nfc, text: 'NFC wristbands check kids in with a tap' },
      { icon: Ic.Star, text: 'Daily check-in bonus points, automatically' },
    ],
    shot: `${G}/checkin.png`,
    alt: 'Parent check-in scanner',
  },
  {
    id: 'messages',
    eyebrow: 'Communication',
    title: 'A direct line to the coaches',
    copy: "Real-time messaging with the coaching staff — session highlights, schedule questions, shout-outs. No group-chat chaos, no lost notes in a backpack.",
    bullets: [
      { icon: Ic.Chat, text: 'Live two-way chat with the academy' },
      { icon: Ic.Bell, text: 'Unread badges so nothing slips past you' },
    ],
    shot: `${G}/messages.png`,
    alt: 'Parent and coach message thread',
  },
  {
    id: 'earn',
    eyebrow: 'Earn everywhere',
    title: 'Points around town, not just in the gym',
    copy: 'Visit partner businesses and scan their QR for bonus points, or complete coach-approved special tasks at home. Fitness habits that follow kids out the door.',
    bullets: [
      { icon: Ic.Store, text: 'Local partner businesses with scannable rewards' },
      { icon: Ic.ClipboardCheck, text: 'Special tasks you submit, coaches approve' },
    ],
    shot: `${G}/earn.png`,
    alt: 'Earn Around Town partner list',
  },
  {
    id: 'perks',
    eyebrow: 'Rewards',
    title: 'Points they can actually spend',
    copy: "Earned points buy real perks from the academy's shop — and you can watch every redemption from the portal, with full history.",
    bullets: [
      { icon: Ic.Gift, text: 'Perk shop with real and virtual rewards' },
      { icon: Ic.History, text: 'Every claim and fulfillment, tracked' },
    ],
    shot: `${G}/perks.png`,
    alt: 'Perk shop and redemption history',
  },
];

const SIGNUP_STEPS = [
  {
    n: '1',
    title: 'Create your account',
    copy: 'Tap the Portal button and sign in with your email or Google account. Takes about thirty seconds.',
    icon: Ic.User,
  },
  {
    n: '2',
    title: 'Link your athlete',
    copy: 'The front desk links your kid to your account in seconds — or enroll a new athlete right from the My Kids tab.',
    icon: Ic.Family,
  },
  {
    n: '3',
    title: "You're live",
    copy: 'Points, check-ins, messages, perks — everything lights up. When you\'re ready, set a 4-digit PIN so your kid can sign in on their own.',
    icon: Ic.Bolt,
  },
];

const ParentGuide: React.FC = () => {
  const rootRef = useScrollReveal<HTMLDivElement>();

  return (
    <div ref={rootRef} className="pz-scope pz-arena min-h-screen" style={{ background: 'var(--pz-bg)' }}>
      {/* Nav */}
      <header className="sticky top-0 z-50" style={{ background: 'rgba(11,14,19,0.92)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: '1px solid var(--pz-border)' }}>
        <nav aria-label="Main" className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className={`flex items-center gap-3 shrink-0 ${FOCUS_RING}`}>
              <div className="w-9 h-9 bg-white flex items-center justify-center" style={{ clipPath: NOTCH_SM }}>
                <img src={APP_LOGO_URL} alt="Fun 'N Fit Academy" className="w-full h-full object-contain p-0.5" />
              </div>
              <span className="pz-display text-sm text-white tracking-tight hidden sm:inline">Fun 'N Fit Academy</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link to="/live" className={`hidden sm:inline-flex ${FOCUS_RING}`}>
                <span className="pz-btn-ghost px-4 py-2.5 text-xs">Live Board</span>
              </Link>
              <Link to="/parent-login" className={`inline-flex ${FOCUS_RING}`}>
                <span className="pz-btn px-5 py-2.5 text-xs">Portal</span>
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(700px 420px at 75% 0%, rgba(203,254,28,0.10), transparent 60%)' }}
        />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-16 md:pt-20 md:pb-24 grid md:grid-cols-2 gap-10 items-center">
          <div className="pz-reveal">
            <div className="pz-eyebrow mb-3">For Parents</div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl text-white leading-[0.95] tracking-tight mb-5">
              Your kid's journey,
              <br />
              <span style={{ color: 'var(--pz-volt)' }}>live in your pocket.</span>
            </h1>
            <p className="text-base sm:text-lg leading-relaxed mb-8 max-w-lg" style={{ color: 'var(--pz-text)' }}>
              The Fun 'N Fit Parent Portal puts every point, level-up, medal, check-in, and coach
              conversation on your phone — in real time, free with enrollment.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <PortalCta />
              <Link to="/live" className={`inline-flex ${FOCUS_RING}`}>
                <span className="pz-btn-ghost px-6 py-4 text-sm">See the live board</span>
              </Link>
            </div>
          </div>
          <div className="pz-reveal flex justify-center md:justify-end" style={pzDelay(150)}>
            <PhoneShot src={`${G}/parent-home.png`} alt="Parent Portal home with kid cards and live stats" className="w-64 sm:w-72" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-8 space-y-16 md:space-y-24">
        {FEATURES.map((f, idx) => (
          <div
            key={f.id}
            className={`grid md:grid-cols-2 gap-8 md:gap-14 items-center ${idx % 2 === 1 ? '' : ''}`}
          >
            <div className={`pz-reveal ${idx % 2 === 1 ? 'md:order-2' : ''}`}>
              <div className="pz-eyebrow mb-2">{f.eyebrow}</div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight mb-4">{f.title}</h2>
              <p className="text-sm sm:text-base leading-relaxed mb-6" style={{ color: 'var(--pz-text)' }}>{f.copy}</p>
              <ul className="space-y-3">
                {f.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0" style={{ color: 'var(--pz-volt)' }}><b.icon size={18} /></span>
                    <span className="text-sm font-medium text-white/85">{b.text}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={`pz-reveal flex justify-center ${idx % 2 === 1 ? 'md:order-1' : ''}`} style={pzDelay(120)}>
              <PhoneShot src={f.shot} alt={f.alt} className="w-64 sm:w-72" />
            </div>
          </div>
        ))}
      </section>

      {/* Kid corner: avatar + own login */}
      <section className="relative py-16 md:py-24 mt-8" style={{ background: 'var(--pz-panel)', borderTop: '1px solid var(--pz-border)', borderBottom: '1px solid var(--pz-border)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12 pz-reveal">
            <div className="pz-eyebrow mb-2">The kid side</div>
            <h2 className="text-3xl sm:text-4xl text-white tracking-tight mb-4">Their own player card — with your permission</h2>
            <p className="text-sm sm:text-base leading-relaxed" style={{ color: 'var(--pz-text)' }}>
              Flip on <span className="text-white font-bold">Student Login</span> and set a 4-digit PIN from your
              portal, and your kid can sign in on their own — build their avatar in the Avatar Studio, open loot
              crates with points they earned by moving, pick their gamer tag, and spend perks. Points are earned by
              exercise only. There is nothing to buy, ever.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 items-start">
            {[
              { src: `${G}/kid-login.png`, alt: 'Parent control: Student Login toggle with PIN', label: 'You set the PIN' },
              { src: `${G}/pin-pad.png`, alt: 'Kid PIN pad on the Players page', label: 'They sign in' },
              { src: `${G}/avatar-studio.png`, alt: 'Avatar Studio character screen', label: 'Build the avatar' },
              { src: `${G}/crates.png`, alt: 'Loot crates with published odds', label: 'Open crates & spend' },
            ].map((s, i) => (
              <div key={s.src} className="pz-reveal" style={pzDelay(i * 100)}>
                <PhoneShot src={s.src} alt={s.alt} />
                <div className="text-center mt-3 text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--pz-volt)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live board panorama */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <div className="text-center max-w-2xl mx-auto mb-10 pz-reveal">
          <div className="pz-eyebrow mb-2">Game night, broadcast style</div>
          <h2 className="text-3xl sm:text-4xl text-white tracking-tight mb-4">The big board runs all session</h2>
          <p className="text-sm sm:text-base leading-relaxed" style={{ color: 'var(--pz-text)' }}>
            House standings, top players, the Legends Wall, and live celebrations — on the gym projector and on
            your phone at <span className="text-white font-bold">the Live board</span>, with Today, Week, and Season views.
          </p>
        </div>
        <div className="pz-reveal" style={pzDelay(100)}>
          <div className="rounded-2xl border-4 border-[#232936] overflow-hidden shadow-2xl" style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.55)' }}>
            <img src={`${G}/live-board.png`} alt="Live house standings board" loading="lazy" className="w-full" />
          </div>
        </div>
      </section>

      {/* Sign up */}
      <section className="relative py-16 md:py-24" style={{ background: 'var(--pz-panel)', borderTop: '1px solid var(--pz-border)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12 pz-reveal">
            <div className="pz-eyebrow mb-2">Getting started</div>
            <h2 className="text-3xl sm:text-4xl text-white tracking-tight">Signed up in three steps</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4 md:gap-6 mb-12">
            {SIGNUP_STEPS.map((s, i) => (
              <div key={s.n} className="pz-card p-6 pz-reveal" style={pzDelay(i * 120)}>
                <div className="flex items-center gap-4 mb-4">
                  <span className="pz-display text-2xl w-12 h-12 flex items-center justify-center text-[#0B0E13]" style={{ background: 'var(--pz-volt)', clipPath: NOTCH_SM }}>
                    {s.n}
                  </span>
                  <span style={{ color: 'var(--pz-volt)' }}><s.icon size={26} /></span>
                </div>
                <h3 className="text-lg text-white mb-2">{s.title}</h3>
                <p className="text-sm leading-relaxed m-0" style={{ color: 'var(--pz-text)' }}>{s.copy}</p>
              </div>
            ))}
          </div>
          <div className="text-center pz-reveal">
            <PortalCta label="Set up my Parent Portal" />
            <p className="mt-5 text-xs font-medium" style={{ color: 'var(--pz-text)' }}>
              Questions? Call <a href="tel:+19516128233" className="text-white font-bold hover:underline">(951) 612-8233</a> or
              ask at the front desk — we'll link your athlete on the spot.
            </p>
          </div>
        </div>
      </section>

      {/* Footer strip */}
      <footer className="py-8" style={{ borderTop: '1px solid var(--pz-border)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white flex items-center justify-center" style={{ clipPath: NOTCH_SM }}>
              <img src={APP_LOGO_URL} alt="" className="w-full h-full object-contain p-0.5" />
            </div>
            <span className="text-xs font-bold" style={{ color: 'var(--pz-text)' }}>
              Fun 'N Fit Academy · 167 S Third Ave, Upland CA
            </span>
          </div>
          <div className="flex items-center gap-5">
            <a href="https://instagram.com/funnfitupland" target="_blank" rel="noreferrer" className={`text-xs font-black uppercase tracking-widest text-white/70 hover:text-white ${FOCUS_RING}`}>
              @funnfitupland
            </a>
            <Link to="/" className={`text-xs font-black uppercase tracking-widest ${FOCUS_RING}`} style={{ color: 'var(--pz-volt)' }}>
              funnfit home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ParentGuide;
