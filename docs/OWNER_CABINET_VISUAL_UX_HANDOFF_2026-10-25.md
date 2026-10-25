# HANDOFF: Owner Cabinet Visual UX Research

**Author/Agent:** GROK  
**Date:** 2026-10-25 UTC  
**ACTIVE_SCOPE:** `GROK / guest-house-map / booking-owner-cabinet-visual-ux`  
**Priority:** HIGH  
**Request reference:** 360a2fa5-d533-4325-88cf-d4bf57b1a758 (as stated by YUMIS-OWNER)  
**Addressed to:** CHATGPT-COORD  
**For downstream:** WORK (implementation), Claude (functional architecture / security remains separate)

---

## 1. Scope and constraints (verified)

- **In scope:** visual concept, information hierarchy, calendar/request-card/occupancy UI patterns, design system direction, comparison of professional PMS interfaces and modern design tooling.
- **Out of scope for this HANDOFF:** production code, main, real bookings, OAuth, Supabase schema/migrations, RLS, iCal adapters, Turnstile, Otzovik, Remote Computers, Hub V2 architecture.
- **Current product baseline read:**
  - `owner.html` + `owner.css` (main) — light dashboard shell, sidebar nav (Мои объекты / Бронирования / Календарь / Настройки), month grid calendar with range selection + block dialog, property cards, stage notes for unfinished modules.
  - `docs/BOOKING_SYSTEM_V1.md` — guest request → pending → owner confirm/decline; public calendar must never expose PII or block reasons.
  - `docs/owner-onboarding-ux-v1.md` (feature/owner-login-shell-v1) — progressive mobile-first wizard principles already approved directionally.
  - Open product issues #8, #16, #17, #20, #21 (cabinet, mobile, calendar PMS, complex Codex stage, discoverable login link).
- **Preview URL** (`krasnolesye-owner-cabinet-preview-…`) requires Vercel auth; visual claims below are grounded in repository source, not live authenticated screenshot.

---

## 2. Research method

Sources (public docs / marketing / help centers, 2025–2026):

| System | Why relevant | Key visual patterns observed |
|--------|--------------|------------------------------|
| **Smoobu** | European vacation-rental PMS, strong multi-calendar | Multi (all properties as rows × horizontal timeline), Single Monthly, Single Yearly; customizable booking-bar details (channel logo, guest name, nights, price); anchored property column |
| **Lodgify** | Small-host friendly | Single vs Multi unit calendar; filters for rental details / price / min-stay; mobile app calendar parity |
| **Hostaway** | Mid-size operators | Multi / Monthly views; strong color coding by status; owner-facing mobile app with financial + calendar tabs |
| **Guesty** | Larger portfolios | Multi-calendar as control center; filters by city/tag/status; color + icons for confirmed / reserved / blocked / cleaning |
| **Cloudbeds** | Hotel-leaning modern calendar | Responsive grid, in-place reservation panels, status/source filters, per-user calendar preferences |
| **Sirvoy / Prostay / Mews** (secondary) | Real-time front-desk calendars | Drag-and-drop, keyboard-first, live occupancy KPIs |
| **UI kits** | Implementation references | Hotelify, Hotella, Shadcn Hotel kit, OmniStay — card layouts, calm palettes, desktop+mobile frames |

Design tools evaluated for WORK handoff: Figma (primary), Penpot (open), Relume / Untitled UI / shadcn + Tailwind (implementation speed), Framer (optional high-fidelity prototype only).

---

## 3. Comparative findings (UX, not architecture)

### 3.1 Calendar patterns that work for small multi-unit owners

1. **Multi-unit timeline (horizontal)** — default for 2–15 units (Smoobu/Guesty/Hostaway). Rows = units, columns = days/weeks. Best for spotting gaps and double-book risk at a glance.
2. **Single-unit month grid** — current Krasnolesye approach. Excellent for one house; weak when owner manages several units or needs cross-unit view.
3. **Hybrid (recommended):** Multi timeline as primary “Календарь” view + one-tap switch to Single month for deep edit of one unit. Preserve existing two-tap range select for blocks.
4. **Color system (status, not decoration):**
   - Confirmed / occupied → solid green or brand primary
   - Pending request → amber / outlined
   - Owner block → muted gray or soft red (current `#e6b7b4` is readable; keep high contrast)
   - Available → empty or light wash
   - External channel logo or small badge on bar (optional later)
5. **In-place detail:** click bar → side panel or bottom sheet with guest (owner-only), dates, actions Confirm / Decline / Message — without leaving the calendar grid (Cloudbeds pattern).

### 3.2 Request / booking cards

Professional systems treat a **request card** as a dense, scannable object:

- Primary line: guest display name + nights count + unit name  
- Secondary: date range, source (сайт / ручная / iCal), status pill  
- Actions: primary CTA (Подтвердить), secondary (Отклонить / Открыть), overflow menu  
- Never show phone/email on the public calendar; only in authenticated owner card  
- Pending cards should surface at top of “Бронирования” and as amber bars on calendar

Current placeholder “Скоро” on Reservations view is correct until backend is ready; visual design should already define the card so WORK does not invent layout later.

### 3.3 Occupancy / properties overview

- Property card: photo/thumbnail, name, locality, occupancy % or next free night, status pill (Опубликован / Черновик / Скрыт).
- Empty state: illustration + single primary CTA (Добавить объект) — already sketched in CSS (`.empty-illustration`).
- Desktop ≥900px: sticky sidebar (already present). Mobile: bottom or top horizontal nav (current horizontal scroll nav is acceptable; consider fixed bottom bar for 4 items if usage shows friction).

### 3.4 What NOT to copy from large hotel PMS

- Heavy KPI walls (RevPAR, ADR charts) on first screen — wrong for 1–7 house owners in Краснолесье.
- Housekeeping board, POS, night audit — out of product scope.
- Dark “executive” themes for daily operations — current light green/forest palette matches the eco / rural brand and outdoor context; keep light as default.

---

## 4. Three visual concepts (for owner decision)

### Concept A — «Лесной оператор» (evolution of current shell) — **RECOMMENDED default**

- **Positioning:** calm, local, trustworthy; extends existing `owner.css` tokens (`--accent: #226b50`, soft panels, rounded 12–20px cards).
- **Calendar:** Multi-unit horizontal timeline as default; Single month retained as secondary mode; status colors aligned with current selected/occupied buttons.
- **Cards:** soft elevation, status pills already in system, clear primary green actions.
- **Pros:** minimal rebrand cost, consistent with public catalog and eco-museum adjacency, already partially implemented.
- **Cons:** less “SaaS wow”; multi-calendar requires new component.
- **Best for:** MVP → first production owners in Краснолесье.

### Concept B — «Чистое полотно» (Lodgify / Sirvoy simplicity)

- White dominant, one strong accent (teal or forest), larger type, fewer borders, more whitespace.
- Calendar: Single month first; Multi only when ≥3 units.
- Pros: fastest cognitive load for non-technical owners; excellent mobile.
- Cons: weaker multi-unit overview; may feel too generic.
- **Best for:** if primary persona is single-house owner for the next 12 months.

### Concept C — «Плотный контроль» (Guesty / Hostaway density)

- Multi-calendar always primary, denser bars, more badges (source, cleaning, notes).
- Side panel for every selection; keyboard shortcuts later.
- Pros: scales if portfolio grows; power-user friendly.
- Cons: higher design + implementation cost; risk of clutter on phone.
- **Best for:** later phase after Multi is proven.

**Recommendation:** ship **Concept A** visual system now; implement Multi calendar as the main visual upgrade; keep density closer to B on mobile breakpoints.

---

## 5. Design-system specification (for WORK)

### 5.1 Tokens (extend current light owner theme)

```
--bg:            #f4f7f3
--panel:         #ffffff
--line:          #dfe8e0
--text:          #17372d
--muted:         #6d7f77
--accent:        #226b50
--accent-hover:  #194b3b
--danger:        #b6423c
--warning:       #c9872a
--success:       #236a4e
--pending:       #d4a017
--radius-sm:     10px
--radius-md:     14px
--radius-lg:     20px
--shadow-card:   0 12px 42px #183c2f0b
--focus:         #bb914a (existing focus-visible)
```

Typography: system-ui / Inter fallback; page title clamp 28–40px; body 16px; meta 13px; eyebrow 11px uppercase tracking.

Touch targets: min 44×44px (already present).

### 5.2 Core components to design (Figma or equivalent)

1. **App shell** — topbar + sidebar (desktop) / horizontal or bottom nav (mobile).
2. **Property card** — list + empty + loading skeletons.
3. **Status pill** — published / draft / pending / confirmed / blocked / declined.
4. **Request card** — list row + expanded detail.
5. **Calendar multi-row** — unit label sticky, day cells, booking bars, selection range, today marker.
6. **Calendar single month** — evolve current grid; keep two-tap range.
7. **Block / confirm dialogs** — extend current `blockDialog` pattern; never put guest PII in block notes (per BOOKING_SYSTEM_V1).
8. **Empty / error / offline** states with single recovery action.
9. **Owner CTA strip** for public catalog / widget (issue #21) — subtle, not mixed with guest booking flow.

### 5.3 Key screens (priority order for visual delivery)

| Priority | Screen | Notes |
|----------|--------|-------|
| P0 | Calendar (Multi + Single) | Heart of daily use |
| P0 | Request / booking list + card | Even if data still mock |
| P1 | Properties list + card | Already partially done |
| P1 | Request detail / confirm-decline | Side panel or full mobile sheet |
| P2 | Settings / account | Minimal |
| P2 | Onboarding wizard frames | Align with owner-onboarding-ux-v1.md |

Mobile breakpoints to lock: 320 / 390 / 430 / 760 / 900+ (match existing media queries).

### 5.4 Accessibility & safety visual rules

- Color is never the only status signal (icon + text + pill).
- Focus rings visible on all interactive calendar cells and cards.
- Dialogs trap focus; Escape closes (standard).
- Public-facing calendar widget remains PII-free by design (no guest names on public embed).

---

## 6. Tooling recommendation for WORK

| Tool | Role | GO / NO-GO |
|------|------|------------|
| **Figma** | Canonical visual source, components, variants, mobile frames | **GO** — industry standard, easy handoff to Claude/WORK |
| **Penpot** | Open-source alternative if license cost is a concern | GO as fallback |
| **shadcn/ui + Tailwind** | Implementation system aligned with modern web | **GO** for code phase (matches many hotel kits) |
| **Untitled UI / Relume** | Optional starter kit to accelerate Figma | Optional |
| **Framer** | Marketing-site prototypes only | Not for owner ops UI |
| **Heavy admin templates (Hotelify, etc.)** | Inspiration only | Do **not** import whole kits — extract patterns, keep local brand |

Suggested workflow: Figma library of 9 components above → annotated frames for P0 screens → WORK implements against tokens; Claude owns data contracts and RLS separately.

---

## 7. Mapping to existing codebase (no code changes in this HANDOFF)

- Reuse `.owner-dashboard` light theme; do not revive the old dark `:root` for the authenticated cabinet.
- Multi calendar is **new**; Single month can evolve from `#ownerDays` / `.owner-cal-days`.
- Reservations view currently `coming-next` — replace placeholder with designed request list when data path is ready (Claude/WORK), not before.
- Issue #21 (visible login link) is pure discoverability; keep CTA quiet and co-branded, not a second booking button.

---

## 8. Risks and open questions for ChatGPT-COORD / Owner

1. Confirm **Concept A** as the visual baseline (or explicitly choose B/C).
2. Confirm whether Multi-calendar is required in first production cut or can follow Single-month hardening.
3. Max expected units per owner in year-1 (drives density of Multi view).
4. Whether channel logos (Суточно / Авито / site) should appear on bars in v1 or later.
5. Figma ownership: who creates the library (GROK can draft structure; dedicated designer / WORK executes pixels)?

---

## 9. Deliverables checklist (this HANDOFF)

- [x] Read current owner shell, booking UX docs, open issues  
- [x] Study Smoobu / Lodgify / Hostaway / Guesty / Cloudbeds calendar UX  
- [x] Study modern hotel/vacation UI kits and design tools  
- [x] 3 concepts with recommendation  
- [x] Token + component + screen priority spec for WORK  
- [x] Explicit non-goals and separation from Claude functional track  
- [ ] Owner acceptance of Concept A (or alternative) — **awaiting YUMIS-OWNER / CHATGPT-COORD**

---

## 10. Next exact action

**CHATGPT-COORD:** review this HANDOFF, confirm Concept A (or select B/C), open a scoped task for WORK to produce Figma frames for P0 screens under the approved concept, and keep Claude on architecture/security without redesigning visuals.

**GROK:** available for follow-up visual critique of Figma drafts or mobile edge cases within the same `ACTIVE_SCOPE`.

---

**CONTEXT HANDOFF READY: YES**  
**Production unchanged. Main unchanged. No migrations. No real booking data touched.**

Author/Agent: GROK  
Date: 2026-10-25 UTC
