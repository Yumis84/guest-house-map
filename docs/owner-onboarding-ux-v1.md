# Owner onboarding UX v1: research-backed design

Research: Airbnb host setup (https://www.airbnb.co.uk/resources/hosting-homes/a/how-to-get-started-on-airbnb-3), Airbnb listing editor (https://www.airbnb.com/resources/hosting-homes/a/introducing-the-listings-tab-638), Vrbo onboarding (https://www.vrbo.com/en-au/help/articles/How-do-I-list-my-property), Vrbo photo guidance (https://help.vrbo.com/articles/upload-photos-to-my-listing). Checked 2026-10-18.

## Decision
Use a progressive, mobile-first wizard (Airbnb's small steps), with Vrbo's precise rooms, map pin, photos and pricing, and a persistent editable listing overview. Avoid a giant form and avoid requiring registration before showing what owners will need. No misleading promises about publication or booking.

## Steps
1. Basics: house type, name, village, guests, bedrooms, beds, bathrooms. Quick draft creation.
2. Location: address, map pin (drag or coordinates), distinguish public approximate location from private arrival address.
3. Amenities: categorized searchable chips, parking, Wi-Fi, kitchen, heating, sauna, pets, accessibility.
4. Photos: multiple upload, thumbnails, cover selection, ordering, alt/captions; never upload before owner auth and property membership check.
5. Description and rules: plain-language prompts, check-in/out, pets, smoking, children.
6. Price and availability: base RUB/night, min nights, cleaning/extra fees, calendar and blocked dates; no default instant-booking.
7. Preview and publish: completeness checklist, explicit public-contact opt-in, separate publish action, exact guest preview.

## Interaction requirements
- Autosave draft on server only after authentication; before that, temporary browser-only demo state with clear disclaimer. Debounced save with visible saved/unsaved/errors state, no silent data loss.
- Back/next, step counter, resume later, editing after publication, keyboard and touch accessible controls.
- Required fields only when publishing, not on draft creation; clear validation by field and focus first error.
- Never expose imported contacts until owner separately confirms. Never reveal precise private address by default.
- Calendar availability and reservation approval remain distinct from publishing the property.
- One owner may have multiple houses; editing and publication protected by server-side membership/RLS.
- Don't make owner retype imported details: show draft prefill and request confirmation.
- Existing seven imported listings remain unchanged until authorized owner claims/edits.

## Implementation order
A. Interactive static wizard demo on owner-demo.html (no network and no real guest data).
B. Accessibility/usability tests for small screens and unsaved edits.
C. Authenticated draft creation API/RLS, image upload and metadata, server validation.
D. Guest preview and explicit publication; price/calendar/booking integration in staging.
E. Owner acceptance before production.

## Important limitations
Official documentation describes intended flows, not verified hands-on access to private dashboards. Do not assert private UI screens were personally tested.
