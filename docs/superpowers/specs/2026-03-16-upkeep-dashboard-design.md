# Upkeep Dashboard — Design Spec

Single-file HTML app (`upkeep.html`) that tracks recurring life tasks. Hosted at `therileydaniels.com/upkeep`. No build tools, no npm, no backend. One file.

## Architecture

```
upkeep.html  ——Notion calls——>  CORS proxy (corsproxy.io)  ——>  Notion API
             ——GCal calls——>   Google Calendar API (direct, browser OAuth)
```

- **Notion** is the source of truth. No localStorage for data. Every read/write goes through Notion. (Exception: GCal OAuth token stored in sessionStorage for session persistence.)
- **CORS proxy** relays Notion API calls since Notion blocks browser CORS. Public proxy (corsproxy.io). Token is in the HTML file... acceptable for a personal single-user tool.
- **Google Calendar** supports browser CORS natively, so calls go direct using OAuth via Google Identity Services.
- **Vanilla JS** throughout. No framework, no dependencies beyond Google Fonts and GIS script tag.

## Notion Integration

- **Token:** `REDACTED_TOKEN`
- **Database ID:** `beaf32f0b4f541c9a1e50be57fe7cd62`
- **Proxy URL:** `https://corsproxy.io/?url=https://api.notion.com`

### Database Schema

| Property | Type | Notes |
|---|---|---|
| Item Name | title | Primary identifier |
| Category | multi_select | Health, Car, Beauty, Grooming, Home, Finance, Other |
| Frequency (days) | number | Stored as total days |
| Last Done | date | ISO date string |
| Notes | rich_text | Optional |
| Calendar Event ID | rich_text | GCal event ID for cleanup |

### Operations

- **Load:** POST to `/v1/databases/{id}/query`, parse all pages, display as cards
- **Add:** POST to `/v1/pages` with parent database_id and properties
- **Edit:** PATCH to `/v1/pages/{id}` with updated properties
- **Delete:** PATCH to `/v1/pages/{id}` with `archived: true`
- **Mark done:** PATCH Last Done to today, update Calendar Event ID if GCal connected

All operations use header `Authorization: Bearer {token}` and `Notion-Version: 2022-06-28`.

## Google Calendar Integration

- **Client ID:** `5655386906-q337i8k06j5s8112rvitom9fdph6po6l.apps.googleusercontent.com`
- **Auth:** Google Identity Services loaded via `<script src="https://accounts.google.com/gsi/client">`
- **Scope:** `https://www.googleapis.com/auth/calendar.events`
- **Token storage:** `sessionStorage` (persists across refreshes in same session)

### Behavior

- Header shows "Connect Google Calendar" button. When connected, shows "Calendar connected" with click-to-disconnect.
- **On mark done:** Delete old GCal event (if Calendar Event ID exists), create new all-day event on next due date. Title: `{item name}`, colorId: `"2"` (sage green), 3-day-before popup reminder. Store new event ID back in Notion.
- **On add item:** Create GCal event on first next due date immediately.
- **On delete item:** Delete GCal event (if Calendar Event ID exists) before archiving in Notion.
- **On edit item:** If frequency or name changed and GCal connected, delete old event and create new one on recalculated next due date.
- **GCal is optional.** Everything works without it... just no calendar events.

## Categories

| Category | Emoji | Color |
|---|---|---|
| Health | heart | Red |
| Car | car | Orange |
| Beauty | lipstick | Pink |
| Grooming | scissors | Purple |
| Home | house | Green |
| Finance | money bag | Yellow |
| Other | pin | Gray |

## Frequency Input

Structured input: number field + unit dropdown (days / weeks / months / years).

**Storage:** Convert to total days in Notion. Conversion: weeks x7, months x30, years x365.

**Display labels:** Daily (1d), Weekly (7d), Every 2 weeks (14d), Monthly (30d), Every 2 months (60d), Quarterly (90d), Every 6 months (180d), Yearly (365d). Anything else: prefer the largest whole unit (e.g., 21d = "Every 3 weeks", 90d = "Quarterly"). If no clean unit fits, show "Every {n} days".

## Sorting and Due Date Calculation

**Next due date formula:** `nextDue = lastDone + frequency (in days)`. Days until due = `nextDue - today`.

**Sort order:** Cards sorted by urgency... most overdue first (lowest days-until-due). Items with no Last Done date sort to the end.

**Items with no Last Done date:** Show "no date" badge. Not counted as overdue. Treated as undated/untracked until the user marks them done or sets a date.

## Due Badge Logic

| Condition | Color | Label |
|---|---|---|
| days < 0 | Red | "{n}d overdue" |
| days = 0 | Amber | "due today!" |
| days 1-7 | Yellow | "in {n}d" |
| days 8-30 | Green | "in {n} days" |
| days > 30 | Purple | "in {n} days" |
| No date | Gray | "no date" |

## Card Actions

- **Mark as Done** — primary button, full width
- **Edit** — pencil icon, opens pre-filled modal
- **Delete** — X icon, two-tap confirm pattern. First tap turns button red with "Confirm?" text. Resets after 3 seconds if not confirmed. No browser `confirm()` dialogs.

## Modal

Shared between Add and Edit. Title changes: "Add new item" vs "Edit item".

**Fields:**
- Item name (text input, required)
- Category (select dropdown, defaults to "Other" for new items)
- Frequency (number input + unit select, required, defaults to 1 month. Unit defaults to "months")
- Last done (date input, optional... can be left blank for undated items)
- Notes (textarea, optional)

**Validation:** Item name and frequency are required. Frequency must be > 0. Last Done is optional (allows adding items you haven't done yet).

**Behavior:**
- Close on backdrop click
- Loading state on submit button while saving
- Pre-filled when editing

## Loading and Error States

- **Initial load:** Spinner while fetching from Notion
- **Notion fetch fail:** Error message with retry button
- **Card updates:** Individual card loading state
- **Toasts:** Bottom center, auto-dismiss after 3.5 seconds. Success and error variants.

## Design System — Riley Daniels Brand

### Colors

| Token | Hex | Usage |
|---|---|---|
| Primary | #C0396B | Raspberry. CTAs, active states, accents |
| Text | #4A3033 | Charcoal rose. All body text |
| Background | #F5E6E8 | Blush. Page background |
| Secondary BG | #E8C4CF | Dusty pink. Borders, secondary surfaces |
| Cards | #FFFFFF | White. Card backgrounds |

### Typography

- **Pacifico** — Logo only
- **Fredoka SemiBold** — Headings, card item names, modal titles
- **Quicksand** — All body text, buttons, labels, inputs

All loaded from Google Fonts.

### Spacing and Radius

- Cards: 16px border radius
- Inputs/buttons: 10px border radius
- Modals: 24px border radius
- Card grid: `auto-fill, minmax(275px, 1fr)`, 14px gap

### Card Design

- White background, subtle box shadow
- Lift slightly on hover (translateY + shadow increase)
- Overdue cards get red border tint
- Stat boxes inside card: 2x2 grid, blush background, uppercase 10px label, bold value

### Header

- Sticky
- Logo (Pacifico), stats pills, GCal button, Add item button
- Stats pills: total (gray), overdue/days < 0 (red, if any), soon/days 0-14 (amber, if any), on track/days > 14 (green, if any). Overdue items are NOT counted in "soon".

### Filter Bar

- Below header
- "All" + one button per category (always show all categories even if empty)
- Pill style, raspberry when active
- Empty category shows empty state: "No {category} items yet"

### Responsive

- Single column on small screens
- Reduced padding on mobile

### Text Rules

- No em dashes anywhere... use ellipses instead

## File Structure

```
upkeep.html
  <head>
    Google Fonts (Pacifico, Fredoka, Quicksand)
    Google Identity Services script
    <style> ~400 lines </style>
  </head>
  <body>
    Header (logo, stats pills, GCal btn, Add btn)
    Filter bar
    Card grid container
    Loading spinner
    Error state
    Modal (shared add/edit)
    Toast container
    <script> ~1200 lines
      // Config (proxy URL, GCal client ID, categories)
      // State (items array, active filter, gcal token)
      // Notion API helpers (query, create, update, archive)
      // Google Calendar helpers (auth, create event, delete event)
      // UI rendering (cards, stats, filters, badges)
      // Modal logic (open, close, populate, submit)
      // Toast system (show, auto-dismiss)
      // Delete confirmation (two-tap with timeout)
      // Frequency conversion (units to days, days to label)
      // Event handlers
      // Init (fetch + render)
    </script>
  </body>
```

## Deliverable

One file: `upkeep.html`. Drop it on the server at `/upkeep`. Done.

## Error Handling

- All Notion API calls wrapped in try/catch with error toasts
- All GCal API calls wrapped in try/catch... failures don't block Notion operations
- Retry button on initial load failure
- Network errors show user-friendly messages, not raw API errors
- Notion pagination handled (if >100 items, follow `has_more` / `next_cursor`)
