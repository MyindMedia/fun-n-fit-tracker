# Fun N' Fit Tracker - Quick Reference Card

---

## Project Overview

**Type:** Full-stack fitness gamification application
**Frontend:** React 19 + TypeScript + Tailwind CSS
**Backend:** Supabase (PostgreSQL + Real-time)
**AI:** Google Gemini API (optional)
**Build Tool:** Vite

---

## Quick Start Commands

```bash
# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Application Routes

| Route | Purpose | Intended Use |
|-------|---------|--------------|
| `/` | Redirect to `/live` | - |
| `/live` | Public Leaderboard View | Display on projector/TV during training |
| `/admin` | Coach Dashboard | Manage students, launch drills, award points |

**Keyboard Shortcuts:**
- Press **P** on `/live` view to toggle Projector Mode (hides UI chrome)

---

## Database Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `students` | Athlete profiles | `fullName`, `houseId`, `points`, `rankId` |
| `game_sessions` | Drill instances | `gameKey`, `title`, `isActive`, `roster`, `results` |
| `transactions` | Point change audit trail | `studentId`, `amount`, `sourceType` |
| `notifications` | Activity feed | `type`, `message`, `timestamp` |
| `game_library` | Drill definitions | `game_key`, `display_name`, `template_id` |
| `badges` | Achievements | `id`, `name`, `icon` |
| `rewards` | Shop items | `id`, `name`, `cost` |
| `ranks` | Progression levels | `id`, `name`, `threshold` |
| `app_settings` | Config key-value store | `id`, `value` |

---

## Environment Variables

All environment variables must be prefixed with `VITE_` to be accessible in the client-side code.

**Required:**
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

**Optional:**
```bash
VITE_GEMINI_API_KEY=your_gemini_api_key  # For AI drill suggestions
```

**Where to find these:**
- Supabase: Project Settings > API
- Gemini: https://ai.google.dev/

---

## House Factions

| House | Color Hex | Mascot | Trait |
|-------|-----------|--------|-------|
| Unity | `#8B52A2` | Wolf | Teamwork |
| Sage | `#008080` | Owl | Intelligence |
| Spark | `#EC721B` | Fox | Agility |
| Valor | `#FFC750` | Honey Badger | Courage |

---

## Rank Progression

| Rank | Threshold | Icon Color |
|------|-----------|------------|
| Noob | 0 pts | Gray |
| Rookie | 100 pts | Green |
| Challenger | 250 pts | Orange |
| Striker | 500 pts | Cyan |
| Warrior | 1,000 pts | Red |
| Captain | 2,000 pts | Blue |
| Elite | 3,500 pts | Indigo |
| Champion | 5,000 pts | Gold |
| Legend | 7,500 pts | Purple |
| Apex | 10,000 pts | Pink |

---

## Scoring Templates

| Template ID | Best For | UI Features |
|-------------|----------|-------------|
| `TEMPLATE_TIME_TRIAL` | Races, sprints | Global stopwatch, lap timing |
| `TEMPLATE_H2H_ROUNDS` | Head-to-head games | Round winners, elimination |
| `TEMPLATE_REP_COUNTER` | Exercises, reps | Quick +10 buttons per student |
| `TEMPLATE_ACCURACY` | Target games | Hit/miss buttons |
| `TEMPLATE_QUIZ` | Trivia, cognitive | Correct/incorrect tracking |

---

## Common Workflows

### Enroll a New Student

1. Go to `/admin`
2. Click "Enroll New Athlete"
3. Fill in name, house, gender
4. (Optional) Take photo
5. Click "Enroll"

### Launch a Drill

1. Go to `/admin` > "Live Sessions"
2. Click "Launch New Drill"
3. Select drill from library
4. Check students participating
5. Set duration (minutes)
6. Click "Start Drill"

### Award Points Manually

1. Go to `/admin` > "Athlete Roster"
2. Find student
3. Click "Edit" or use quick actions
4. Enter points (positive or negative)
5. Add description
6. Save

### View Leaderboard on Big Screen

1. Open `/live` on display device
2. Press **P** to enter Projector Mode
3. Select time range (Day/Week/All)
4. Leaderboard updates in real-time

---

## Real-time Features

The app automatically updates via Supabase real-time when:

- ✅ Points are awarded
- ✅ Students rank up
- ✅ Drills start or end
- ✅ New students are enrolled
- ✅ Badges are earned

**No manual refresh needed!**

---

## Audio Announcements

The app uses Web Audio API and Speech Synthesis:

- **Game Start:** Countdown "3, 2, 1, GO!"
- **Game End:** Buzzer + winner announcement
- **Rank Up:** Congratulatory fanfare
- **Badge Earned:** Achievement chime
- **Points Awarded:** Positive feedback tone

**Note:** User must interact with page first (browser security requirement).

---

## Storage Bucket Structure

Create a public bucket named `Assets` with:

```
Assets/
├── FNFLogo.png
├── team/
│   ├── unity.png
│   ├── sage.png
│   ├── spark.png
│   └── valor.png
└── levels/
    ├── Noob.png
    ├── Rookie.png
    ├── Challenger.png
    ├── ... (all 10 ranks)
```

---

## Troubleshooting Quick Fixes

### Issue: "Missing Supabase configuration"

**Fix:** Check `.env.local` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then restart dev server.

### Issue: Real-time updates not working

**Fix:**
1. Verify Supabase real-time is enabled (Project Settings > API)
2. Check browser console for WebSocket errors
3. Confirm database policies allow reads

### Issue: Images not loading

**Fix:**
1. Ensure `Assets` bucket exists and is **public**
2. Upload images to correct folders
3. Check URLs in database match storage paths

### Issue: AI suggestions always show fallback

**Fix:**
1. Set `VITE_GEMINI_API_KEY` in `.env.local`
2. Verify API key is valid at https://ai.google.dev/
3. Restart dev server

### Issue: TypeScript errors in IDE

**Fix:**
1. Run `npm install` to ensure types are installed
2. Restart TypeScript server in your IDE
3. Check `tsconfig.json` is valid

---

## Performance Tips

- **Database:** Indexes are already optimized in schema
- **Images:** Compress rank/team icons to <100KB each
- **Real-time:** Limit concurrent game sessions to 3-5
- **Charts:** Leaderboard re-renders only on data changes

---

## Security Checklist (Production)

- [ ] Enable Row Level Security (RLS) on all tables
- [ ] Create appropriate policies for public/admin access
- [ ] Remove seed data from `database.sql`
- [ ] Use environment variables (never commit `.env.local`)
- [ ] Enable HTTPS on deployment
- [ ] Rotate API keys regularly
- [ ] Review Supabase access logs

---

## Useful Constants

**Default Game Duration:** 10 minutes
**Countdown Before Start:** 5 seconds
**Winner Announcement Duration:** 15 seconds
**Activity Ticker Max Items:** 20
**Hall of Fame Top Students:** 3
**Transaction History Days:** 7
**Max Students per Drill:** 100

---

## Code Structure

```
/
├── components/
│   ├── Admin/          # Coach dashboard components
│   ├── Leaderboard/    # Public view components
│   ├── Layout.tsx      # App wrapper
│   └── ...
├── services/
│   ├── supabaseService.ts   # Database operations
│   └── geminiService.ts     # AI drill generation
├── utils/
│   └── audio.ts        # Sound effects & TTS
├── constants.ts        # Static data (Houses, Ranks, etc.)
├── types.ts            # TypeScript interfaces
├── database.sql        # Database schema
└── .env.local          # Environment variables
```

---

## Support Resources

- **Documentation:** See `SETUP_GUIDE.md` for detailed setup
- **Fixes:** See `FIXES_APPLIED.md` for issues resolved
- **Supabase Docs:** https://supabase.com/docs
- **Vite Docs:** https://vitejs.dev/
- **React Docs:** https://react.dev/

---

**Last Updated:** December 23, 2025
**Version:** 1.0 (All Critical Issues Resolved)
