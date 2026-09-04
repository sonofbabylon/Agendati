# Agendati — Calendar & Export Studio

A personal calendar prototype using React, TypeScript, shadcn/ui (Radix), and Lucide. Event data and design presets persist in browser local storage. Seed events are illustrative, inspired by the supplied 2026 calendar.

- Calendar and agenda views; create, edit, duplicate, and delete events; custom event types; independent weekly occurrences; manual statuses and scheduling conflict checks.
- Programme and calendar artwork, eight palettes and custom colors, typography controls, Arabic labels, and phone lock-screen spacing.
- PNG, PDF, PowerPoint, and ZIP exports for one or multiple months. Desktop (16:9) and phone (9:16); 1× or 2× resolution.
- Overflow uses continuation pages. Calendar grids switch to programme pages when individual event details cannot fit; the interface explains this fallback.
- PowerPoint slides embed images. No live integrations, multi-user approvals, or automatic AI actions.

Core implementation: `app/page.tsx`, `lib/calendar-data.ts`, `lib/artwork.ts`, and `app/globals.css`.

Run using the supplied package scripts. Deployment uses the existing Sites manifest and build tooling.
