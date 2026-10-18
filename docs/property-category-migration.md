# Property category and listing-role migration implications

This change is demo/UI-only. No hosted database migration was run.

The existing `public.properties` table should remain the single source for both guest houses and apartments. A future reviewed migration should add:

- `property_category text not null` with allowed values `guest_house` and `apartment`;
- a backfill of every existing row to `guest_house` before validating the constraint (the seven current top-level catalog listings remain guest houses);
- an explicit listing relationship/authority model for `owner`, `authorized_intermediary`, and `admin` instead of treating a company membership label as proof of ownership;
- public catalog/view and owner-cabinet column grants updated to include category and safe role wording;
- indexes only if category-filter query plans justify them.

Do not rename `properties`, create a second apartments table, or duplicate RLS/storage flows. `company_members.member_role='manager'` is an application permission in the current candidate schema; it must not be displayed as ownership or silently converted into `authorized_intermediary`. The exact verification, expiry, revocation and audit rules for intermediary authority are a product/legal blocker for a production migration.

Before any hosted application, re-audit the live schema and policies, write rollback SQL, test backfill counts, and verify that anonymous reads expose no authority evidence or private owner data.
