# Upkeep — Maintenance Tracker

## Project Overview

A personal maintenance tracker called **"Upkeep"** that uses Notion as the database/backend, a custom HTML dashboard as the front-end, and Google Calendar for reminders. The full spec lives in `upkeep-full-spec.md`.

## Architecture

```
Dashboard (GitHub Pages) ──▶ Google Apps Script (proxy) ──▶ Notion DB
                                      │
                                      ▼
                              Google Calendar ──▶ notifications
```

- **Notion Database** — source of truth for all data
- **Google Apps Script** — single backend that does everything:
  - Secure proxy between dashboard and Notion (holds API token privately)
  - Reads items (`getItems`), writes updates (`markDone`)
  - Daily 9:00 AM trigger for reminders (`checkReminders`)
  - Creates/updates/deletes Google Calendar events
- **HTML Dashboard** — hosted on GitHub Pages, bookmarked on phone home screen. Talks ONLY to Apps Script, never directly to Notion
- **Google Calendar** — delivers push notifications as reminders

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS (single page), PWA-enabled
- **Backend:** Google Apps Script (deployed as Web App)
- **Database:** Notion API
- **Reminders:** Google Calendar via Apps Script
- **Hosting:** GitHub Pages
- **Fonts:** DM Sans (body), Space Mono (countdowns)

## Notion Database Schema

### Core Properties
| Property | Type | Notes |
|---|---|---|
| Item Name | Title | Task name |
| Category | Select | Car, Health, Grooming, Home |
| Frequency (days) | Number | Recurrence interval in days |
| Last Done | Date | Auto-fills today if empty |
| Next Due | Formula | `dateAdd(Last Done, Frequency, "days")` |
| Days Until Due | Formula | `dateBetween(Next Due, now(), "days")` |
| Status | Formula | Overdue / Due Soon / Coming Up / Good |

### Optional Properties
| Property | Type | Notes |
|---|---|---|
| Last Cost | Number (currency) | Overwritten each completion |
| Total Cost | Number (currency) | Running total |
| Notes | Rich Text | Reminders, preferences |

### System Properties (managed by Apps Script only)
| Property | Type | Notes |
|---|---|---|
| Calendar Event ID | Text | For deleting old events on Mark Done |
| Last Reminder Sent | Date | Enforces 2-day spacing on overdue nudges |

## Category System

| Category | Color | Accent | Icon |
|---|---|---|---|
| Car | Red | #EF4444 | 🚗 |
| Health | Blue | #3B82F6 | 🏥 |
| Grooming | Purple | #8B5CF6 | ✂️ |
| Home | Green | #22C55E | 🏠 |
| Unknown | Gray | #6B7280 | (fallback for unrecognized categories) |

## Dashboard Design Rules

- **Light mode only**, colorful and glanceable
- **Mobile-first** — designed for phone, works on desktop
- PIN-protected: 4-digit PIN validated server-side, device token saved after first entry
- Skeleton loading while fetching (1-2 seconds)
- Offline mode: cached data with warning banner, Mark Done disabled

### Layout (top to bottom)
1. **Header** — "Upkeep" + today's date (weekday, month, day)
2. **Overdue section** — pulsing red dot, cards sorted most overdue first, red badges "Xd overdue"
3. **Due This Week section** — yellow dot, cards sorted soonest first, yellow badges "Xd left"
4. **Browse by Category** — four collapsible colored bars, one per category, showing item/overdue counts

### Card Design
- **Collapsed:** category icon, item name, frequency + next due, urgency badge pill
- **Expanded (tap):** notes, last done date, cost info (last + total), "Mark Done" button

### Mark Done Flow
1. Tap "Mark Done" → optional cost input appears
2. Tap "Confirm" → calls Apps Script `markDone(itemId, cost?)`
3. Apps Script: updates Notion (Last Done, costs), deletes old calendar event, creates new one, stores new event ID
4. Toast: "Item marked done ✓" (or "Done — but calendar sync failed" on partial failure)

### Urgency Thresholds
| Status | Color | Condition |
|---|---|---|
| Overdue | Red #DC2626 | Past due |
| Due Soon | Amber #F59E0B | Within 7 days |
| Coming Up | Green #10B981 | Within 30 days |
| All Good | Gray #9CA3AF | 30+ days away |

## Reminder System

Daily trigger at 9:00 AM via Apps Script:

| Timing | Calendar Event Title |
|---|---|
| 7 days before due | "[icon] [Item] Due" |
| 1 day before due | "[icon] [Item] Due" |
| Every 2 days after due | "⚠️ [Item] — overdue" |

On Mark Done: old calendar event deleted immediately, new one created at new Next Due.

## Apps Script API

### `getItems(pin)`
Validates PIN, returns all items from Notion.

### `markDone(pin, itemId, cost?)`
Validates PIN, updates Last Done to today, updates costs if provided, deletes old calendar event, creates new one at new Next Due, stores new Calendar Event ID, clears Last Reminder Sent.

### `checkReminders()`
Daily trigger. Reads all items, creates calendar events at 7d/1d before due and every 2d when overdue.

## Security

- Notion API token stored ONLY in Apps Script (Script Properties)
- PIN stored ONLY in Apps Script (Script Properties)
- Dashboard never sees or stores secrets
- PIN validated server-side on every request
- Device token saved locally after first valid PIN entry

## Error Handling

- Mark Done succeeds but calendar fails → toast "Done — but calendar sync failed", daily script catches up
- Mark Done fully fails → toast "Couldn't save — try again", card stays in current state
- `getItems` fails on returning device → show cached data with "Offline" banner

## Build Order

1. Set up Notion database (all properties, formulas, starter items)
2. Set up Google Apps Script (getItems, markDone, Script Properties, deploy as Web App)
3. Build HTML dashboard (PIN screen, skeleton loading, cards, Mark Done with cost, offline caching, error toasts, unknown category fallback)
4. Add PWA metadata (manifest.json, meta tags, app icon)
5. Add reminder logic (checkReminders, calendar cleanup in markDone, daily trigger)
6. Bookmark on phone home screen
7. Test full loop end-to-end

## Starter Items

| Item | Category | Frequency |
|---|---|---|
| Oil Change | Car | 90 days |
| Dentist Appointment | Health | 180 days |
| Haircut | Grooming | 42 days |
| Hair Dye | Grooming | 56 days |
| Lash Lift | Grooming | 56 days |

## Key Conventions

- New items without a Last Done date default to today
- All dates in Notion formulas, not manually calculated
- Dashboard never calls Notion directly — always through Apps Script proxy
- Calendar Event IDs tracked in Notion so events can be deleted/recreated on Mark Done
- Unknown categories get gray fallback styling automatically
