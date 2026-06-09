# Perspective Barber – Booking System

AI-powered barber shop booking system for **Perspective Barber**, Pécs.

## Stack

- **Voice AI:** ElevenLabs (Noa receptionist agent)
- **Backend:** Base44 (Deno/TypeScript serverless functions)
- **Database:** Base44 entities (BarberShop, Barber, Appointment, Service)

## Architecture

```
Customer call
     │
     ▼
ElevenLabs "Noa" Voice Agent
     │
     ├──▶ getAvailableSlots  ──▶ Base44 API ──▶ DB
     ├──▶ bookAppointment    ──▶ Base44 API ──▶ DB
     └──▶ manageAppointment  ──▶ Base44 API ──▶ DB (cancel/reschedule)

Web booking page
     │
     ▼
bookingPage (HTML) ──▶ same Base44 API endpoints
```

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/functions/getAvailableSlots` | POST | Get free slots for a date/barber |
| `/functions/bookAppointment` | POST | Book an appointment |
| `/functions/manageAppointment` | POST | Cancel or reschedule |
| `/functions/bookingPage` | GET | Booking web UI |

## Shop Data

- **Location:** Pécs, Boszorkány utca 2/1
- **Hours:** Tue–Fri 9–19h, Sat 10–17h
- **Shop ID:** `6a27f69555573bf33956d108`
- **Barbers:** Márk, Milán, Kiki, Zalán, Matyi, Gergő, Kolo

## Services

| Service | Duration |
|---|---|
| Hajvágás | 45 min |
| Hosszú Hajvágás | 60 min |
| Hajvágás + Szakáll | 60 min |
| Hosszú haj + Szakáll | 75 min |
| Egy hossz + Szakáll | 45 min |
| Szakáll / Borotválás | 30 min |

## Note on Booking Page CSP

The `bookingPage` function is served from Base44's infrastructure which applies
`script-src: none` CSP headers. For production use, host `booking.html` on a
static host (Netlify, Vercel, GitHub Pages) and point the API calls to the
Base44 function endpoints.
