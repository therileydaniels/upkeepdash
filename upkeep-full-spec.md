# Maintenance Tracker — Full Spec

## Overview

A personal maintenance tracker called **"Upkeep"** using Notion as the database/backend and a custom hosted HTML dashboard as the visual front-end. The dashboard connects to Notion via API, displays items with urgency color-coding, and allows marking items as done. Reminders are handled through Google Calendar synced via Google Apps Script.

---

## Architecture

```
┌─────────────┐         ┌─────────────────┐         ┌────────┐
│  Dashboard  │────────▶│ Google Apps     │────────▶│ Notion │
│ (your phone)│◀────────│ Script (proxy)  │◀────────│  DB    │
└─────────────┘         └────────┬────────┘         └────────┘
                                 │
                                 │ also creates
                                 ▼
                        ┌─────────────────┐
                        │ Google Calendar │──▶ notifications
                        └─────────────────┘
```

- **Notion Database** → source of truth for all data
- **Google Apps Script** → the single backend that does everything:
  - Acts as a secure proxy between the dashboard and Notion (holds the API token privately)
  - Handles reading items from Notion for the dashboard
  - Handles writing updates (Mark Done) to Notion
  - Runs a daily time-based trigger for reminder logic
  - Creates/updates Google Calendar events for reminders
- **Custom HTML Dashboard** → hosted on GitHub Pages, bookmarked on phone home screen. Talks ONLY to the Apps Script, never directly to Notion
- **Google Calendar** → delivers push notifications as reminders

### Why this architecture?
- **Security:** The Notion API token lives only in the Apps Script (private). The public dashboard never sees or stores the token.
- **Simplicity:** One backend to maintain, one place the token lives, one thing to debug.
- **Independence:** If the dashboard breaks, reminders still work. If reminders break, the dashboard still works (they share a backend but are separate functions).
- **Speed tradeoff:** Apps Script can take 1-2 seconds to respond (vs ~100ms for Cloudflare Workers), but this is fine for a personal dashboard.

---

## Notion Database Properties

### Required Properties

| Property | Type | Description | Example |
|---|---|---|---|
| **Item Name** | Title | Name of the maintenance task | "Oil Change" |
| **Category** | Select | Grouping for the item | Car, Health, Grooming, Home |
| **Frequency (days)** | Number | How often this should be done, in days | 90 |
| **Last Done** | Date | Date the task was last completed. If empty when created, auto-fills with today | 2026-02-15 |
| **Next Due** | Formula | Auto-calculated: Last Done + Frequency | 2026-05-16 |
| **Days Until Due** | Formula | Auto-calculated: Next Due - Today | 42 |
| **Status** | Formula | Auto-calculated urgency level | Overdue / Due Soon / Good |

### Optional Properties

| Property | Type | Description | Example |
|---|---|---|---|
| **Last Cost** | Number (currency) | What you paid last time (overwritten each completion) | $45.00 |
| **Total Cost** | Number (currency) | Running total of all costs for this item | $270.00 |
| **Notes** | Rich Text | Reminders, preferences, instructions | "Ask for the deep cleaning" |

### System Properties (managed by Apps Script, not manually edited)

| Property | Type | Description |
|---|---|---|
| **Calendar Event ID** | Text | Google Calendar event ID for the current reminder. Used by Apps Script to find and delete events when marking done. |
| **Last Reminder Sent** | Date | Date the last overdue nudge was sent. Used by Apps Script to enforce the 2-day spacing on overdue reminders. |

---

## Category Options

| Category | Color | Dashboard Accent | Icon |
|---|---|---|---|
| Car | Red | #EF4444 | 🚗 |
| Health | Blue | #3B82F6 | 🏥 |
| Grooming | Purple | #8B5CF6 | ✂️ |
| Home | Green | #22C55E | 🏠 |

More categories can be added later (Pets, Admin, Tech, etc.) — any category added in Notion that the dashboard doesn't recognize will be displayed in **gray (#6B7280)** as a fallback.

---

## Formula Properties

### Next Due
```
dateAdd(prop("Last Done"), prop("Frequency (days)"), "days")
```

### Days Until Due
```
dateBetween(prop("Next Due"), now(), "days")
```

### Status
```
if(
  prop("Days Until Due") < 0,
  "🔴 Overdue",
  if(
    prop("Days Until Due") <= 7,
    "🟡 Due Soon",
    if(
      prop("Days Until Due") <= 30,
      "🟢 Coming Up",
      "⚪ Good"
    )
  )
)
```

---

## Dashboard Design

### General
- **App name:** Upkeep
- **Color scheme:** Light mode
- **Vibe:** Colorful & glanceable
- **Mobile-first** — designed for phone screen, works on desktop too
- **Hosted on GitHub Pages** — bookmarkable as phone home screen icon
- **Font:** DM Sans (body), Space Mono (countdowns)

### Header
- "Upkeep" title with today's date (weekday, month, day)
- Clean and minimal — no counters or badges

### Layout — Top to Bottom

**1. Overdue Section (if any)**
- Pulsing red dot + "OVERDUE" label with count
- Cards sorted by most overdue first
- Red-tinted urgency badges showing "Xd overdue"

**2. Due This Week Section (if any)**
- Yellow dot + "DUE THIS WEEK" label with count
- Cards sorted by soonest first
- Yellow-tinted urgency badges showing "Xd left"

**3. Browse by Category**
- Section header: "Browse by Category"
- Four collapsible dropdown bars, one per category
- Each bar is colored to match its category (red, blue, purple, green)
- Shows item count and overdue count in the header
- Tap to expand/collapse and see all items in that category
- Serves double duty as a color legend

### Card Design

**Collapsed (default view):**
- Category icon in a colored rounded square (left)
- Item name (bold)
- Frequency + Next Due date (e.g., "Every 3 months · Due: Mar 5")
- Urgency badge (right) — countdown pill with color coding

**Expanded (tap to open):**
- Notes (if any) in a gray rounded box with 📝
- Last Done date with 📅
- Cost info with 💰: last cost + total spent all time (e.g., "Last: $45 · Total: $312")
- "Mark Done" button — full width, colored to match category

**Mark Done flow:**
1. Tap "Mark Done"
2. An optional cost field appears above the confirm button (number input, can be left blank)
3. Tap "Confirm" to submit
4. Toast confirms "Item marked done ✓"

### Urgency Color Coding
| Status | Badge Color | Threshold |
|---|---|---|
| Overdue | Red (#DC2626) | Past due date |
| Due Soon | Yellow/Amber (#F59E0B) | Within 7 days |
| Coming Up | Green (#10B981) | Within 30 days |
| All Good | Gray (#9CA3AF) | 30+ days away |

### Interactions
- **PIN screen** — shown on first visit to a new device. Simple 4-digit keypad, "Upkeep" title above. After valid entry, not shown again on that device
- **Skeleton loading** — gray placeholder card shapes shown while fetching data (1-2 seconds)
- **Offline banner** — "Offline — showing last updated data" banner at top if no connection. Mark Done disabled
- Tap card → expand to show details + Mark Done button
- Tap "Mark Done" → updates Notion via Apps Script, deletes old calendar event, creates new one at new Next Due, shows confirmation toast, updates local cache
- Tap category bar → expand/collapse item list
- Toast notification appears at bottom confirming "Item marked done ✓"

---

## Reminder System

### Architecture
- **Google Apps Script** runs daily on a time-based trigger at **9:00 AM**
- Script reads all items from Notion API
- Compares Next Due dates to today
- Creates/updates Google Calendar events on the user's **main calendar**
- Google Calendar delivers push notifications to phone

### Reminder Schedule (same for all items)
| Timing | What Happens | Event Title Format |
|---|---|---|
| **7 days before due** | First reminder | "🚗 Oil Change Due" |
| **1 day before due** | Second reminder | "🚗 Oil Change Due" |
| **Every 2 days after due** | Overdue follow-ups until marked done | "⚠️ Oil Change — overdue" |

### Calendar Event Cleanup on Mark Done
When you tap "Mark Done" on the dashboard:
1. Dashboard tells Apps Script to update Notion (Last Done = today, cost if entered)
2. Apps Script reads the **Calendar Event ID** stored in Notion for that item
3. Apps Script **deletes that specific calendar event** using the stored ID
4. Apps Script **creates a new calendar event** at the new Next Due date
5. Apps Script **stores the new Calendar Event ID** back in Notion
6. Apps Script **clears Last Reminder Sent** so the overdue nudge cycle resets
7. This happens immediately — no waiting for the daily trigger

---

## Dashboard Security

### PIN Protection
- 4-digit PIN stored in Google Apps Script (as a Script Property, never in the public dashboard code)
- Dashboard shows a PIN entry screen before loading any data
- PIN is sent to Apps Script with every request — Script validates it before returning data
- **Remembers your device** — after entering the PIN once, the dashboard saves a token on your device so you don't have to re-enter it
- If someone enters the wrong PIN, they see no data

---

## Dashboard UX States

### Loading State
- **Skeleton cards** — gray placeholder shapes that mimic the card layout
- Shown for 1-2 seconds while data loads from Apps Script
- Gives the feel that content is coming rather than a blank screen

### Offline State
- Dashboard saves the last fetched data on your device
- If it can't reach Apps Script (no internet), it shows the cached data with a **warning banner** at the top: "Offline — showing last updated data"
- **Mark Done button is disabled** while offline (needs to write to Notion)
- Data refreshes automatically when connection returns

### Error Handling
- If "Mark Done" updates Notion successfully but the calendar step fails: show a small error toast ("Done — but calendar sync failed"), keep the dashboard working. The daily script will catch the calendar on its next run.
- If the entire "Mark Done" call fails: show an error toast ("Couldn't save — try again"), keep the card in its current state
- If `getItems()` fails on a returning device: fall back to cached data with "Offline" banner (same as offline behavior)

### Unknown Categories
- If a new category is added in Notion that the dashboard doesn't recognize (e.g., "Pets"), it auto-assigns a **gray** color scheme (accent: #6B7280, bg: #F9FAFB, light: #E5E7EB)
- The item still appears and works normally — just with neutral styling
- Known category colors can be updated in the dashboard code over time

---

## Progressive Web App (PWA) Setup

For the dashboard to look and feel like a real app when bookmarked on your phone home screen:

- **manifest.json** — defines app name ("Upkeep"), icon, theme color, and tells the browser to hide the URL bar
- **Meta tags** in the HTML — Apple-specific tags for iOS home screen support (status bar style, icon, splash screen)
- **App icon** — a simple icon for the home screen (can be the Upkeep logo or a checkmark in a circle)
- Without this setup, bookmarking the page opens it as a regular browser tab with the URL bar visible

---

## Starter Items

| Item | Category | Frequency (days) |
|---|---|---|
| Oil Change | Car | 90 |
| Dentist Appointment | Health | 180 |
| Haircut | Grooming | 42 |
| Hair Dye | Grooming | 56 |
| Lash Lift | Grooming | 56 |

*(Add more items as you think of them)*

### New Item Defaults
- If a new item is added to Notion **without a Last Done date**, the dashboard and Apps Script treat today as the Last Done date
- This means the item becomes due in [Frequency] days from when it was added
- No items get stuck in a "never due" state

---

## API Setup Needed (before building)

### Notion Integration
1. Create integration at https://www.notion.so/my-integrations
2. Name it "Upkeep Dashboard"
3. Copy the Internal Integration Token (starts with `ntn_`)
4. Share the database with the integration (database menu → Connections → add integration)
5. Copy the Database ID from the database URL

### Google Apps Script
1. Create new project at https://script.google.com
2. Store as **Script Properties** (private, not in the code):
   - Notion API token
   - Notion Database ID
   - 4-digit PIN
3. Create functions for:
   - `getItems(pin)` — validates PIN, reads all items from Notion, returns to dashboard
   - `markDone(pin, itemId, cost?)` — validates PIN, updates item's Last Done in Notion, updates Last Cost and increments Total Cost if cost provided, deletes old calendar event (using stored Calendar Event ID), creates new calendar event at new Next Due date, stores new Calendar Event ID in Notion, updates Last Reminder Sent to null
   - `checkReminders()` — daily trigger that checks due dates and creates/updates Google Calendar events
4. Deploy as a Web App (set access to "Anyone" so the dashboard can call it)
5. Set up daily time-based trigger for `checkReminders()` at **9:00 AM**
6. Copy the Web App URL — this is what the dashboard calls

### How the data flows

**First time opening the dashboard on a device:**
1. Browser loads HTML from GitHub Pages
2. Dashboard shows a PIN entry screen
3. You enter your 4-digit PIN
4. Dashboard sends PIN to Apps Script → Apps Script validates it
5. If valid, Apps Script returns all items from Notion
6. Dashboard saves a device token so you don't need the PIN again
7. Dashboard also caches the item data for offline use

**Opening the dashboard (returning device):**
1. Browser loads HTML from GitHub Pages
2. Dashboard sends saved device token to Apps Script → `getItems()`
3. Apps Script validates token, queries Notion, returns data
4. Dashboard renders cards
5. If offline, dashboard shows cached data with "Offline" banner

**Marking something done:**
1. You tap "Mark Done" on a card
2. Optional: enter cost in the input field
3. Tap "Confirm"
4. Dashboard calls Apps Script → `markDone(itemId, cost?)`
5. Apps Script updates the item's Last Done in Notion
6. If cost provided, Apps Script updates Last Cost and adds to Total Cost in Notion
7. Apps Script reads the Calendar Event ID from Notion and deletes that Google Calendar event
8. Apps Script creates a new Google Calendar event at the new Next Due date
9. Apps Script stores the new Calendar Event ID and clears Last Reminder Sent in Notion
10. If calendar steps fail, Notion is still updated (graceful failure)
11. Dashboard re-fetches all items and re-renders
12. Dashboard updates local cache
13. Toast confirms "Item marked done ✓" (or "Done — but calendar sync failed" if calendar step errored)

**Daily reminders (runs automatically at 9:00 AM):**
1. Google triggers `checkReminders()`
2. Script reads all items from Notion
3. For each item, checks:
   - Is it exactly 7 days from due? → create calendar event titled "🚗 Oil Change Due"
   - Is it exactly 1 day from due? → create calendar event titled "🚗 Oil Change Due"
   - Is it overdue AND Last Reminder Sent is null or 2+ days ago? → create calendar event titled "⚠️ Oil Change — overdue", update Last Reminder Sent to today
4. For any new calendar events created, stores the Calendar Event ID in Notion
5. Google Calendar sends push notifications to your phone

---

## Build Order

1. **Set up Notion database** — create all properties (including system properties), formulas, views, add starter items
2. **Set up Google Apps Script** — create proxy functions (getItems, markDone with cost support), store Notion token + PIN as Script Properties, deploy as Web App
3. **Build HTML dashboard** — PIN screen, skeleton loading, cards with cost display, Mark Done with optional cost input, offline caching, error toasts, unknown category fallback. Calls Apps Script (not Notion directly). Deploy to GitHub Pages
4. **Add PWA metadata** — manifest.json, meta tags, app icon so it looks like a real app when bookmarked on phone
5. **Add reminder logic** — add checkReminders function to Apps Script, add calendar cleanup to markDone, set up daily trigger at 9:00 AM, test calendar events
6. **Bookmark on phone** — add GitHub Pages URL to home screen for app-like access
7. **Test the full loop** — add an item in Notion, verify it shows on dashboard, mark it done with a cost, verify cost updates, verify calendar event moves, wait for daily reminder, verify notification, test offline mode, test unknown category

---

## Future Enhancements (someday/maybe)

- "Add Item" button on dashboard (so you never need to open Notion)
- Cost breakdown by category per year (bar chart or summary)
- History log of past completions with dates and costs
- Provider/location field per item
- Calendar heatmap showing maintenance patterns
- Per-item or per-category reminder customization
- Dark mode / match phone setting toggle
- React rebuild if complexity warrants it
