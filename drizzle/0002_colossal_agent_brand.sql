-- Realignment (plan §1 #15): the old demo planogram geometry (fixtures /
-- sections / positions and everything hanging off it) is meaningless under
-- the fixed-floor model, and its section keys ('endcap', 'lens') violate the
-- new key format. All of it is fictional demo data (S8) — wipe it so the
-- type change + check land cleanly, then `npm run db:seed` rebuilds the
-- fixed floor + master list. Stores and CMS users are kept.
DELETE FROM "round_items";--> statement-breakpoint
DELETE FROM "rounds";--> statement-breakpoint
DELETE FROM "product_snapshots";--> statement-breakpoint
DELETE FROM "conditions";--> statement-breakpoint
DELETE FROM "store_positions";--> statement-breakpoint
DELETE FROM "positions";--> statement-breakpoint
DELETE FROM "sections";--> statement-breakpoint
DELETE FROM "fixture_brands";--> statement-breakpoint
DELETE FROM "fixtures";--> statement-breakpoint
DELETE FROM "flags";--> statement-breakpoint
ALTER TABLE "sections" ALTER COLUMN "key" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_key_format" CHECK ("sections"."key" ~ '^[a-z]+-[0-9]$');--> statement-breakpoint
DROP TYPE "public"."section_key";
