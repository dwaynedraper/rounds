CREATE TYPE "public"."layout_kind" AS ENUM('endcap', 'plain');--> statement-breakpoint
CREATE TYPE "public"."product_kind" AS ENUM('camera', 'lens', 'accessory', 'tablet', 'display');--> statement-breakpoint
CREATE TYPE "public"."section_key" AS ENUM('endcap', 'right', 'left', 'lens');--> statement-breakpoint
CREATE TYPE "public"."surface_kind" AS ENUM('gray', 'wood');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'editor');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "brands_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"accent" text NOT NULL,
	"sort" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "brands_slug_unique" UNIQUE("slug"),
	CONSTRAINT "brands_accent_hex" CHECK ("brands"."accent" ~ '^#[0-9a-f]{6}$')
);
--> statement-breakpoint
CREATE TABLE "conditions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "conditions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"store_id" integer NOT NULL,
	"position_id" integer NOT NULL,
	"flags" text[] DEFAULT '{}'::text[] NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"shift" text DEFAULT '' NOT NULL,
	"device_hash" text NOT NULL,
	CONSTRAINT "conditions_note_length" CHECK (char_length("conditions"."note") <= 280),
	CONSTRAINT "conditions_device_hash_format" CHECK ("conditions"."device_hash" ~ '^[0-9a-f]{16,64}$')
);
--> statement-breakpoint
CREATE TABLE "fixture_brands" (
	"fixture_id" integer NOT NULL,
	"brand_id" integer NOT NULL,
	CONSTRAINT "fixture_brands_fixture_id_brand_id_pk" PRIMARY KEY("fixture_id","brand_id")
);
--> statement-breakpoint
CREATE TABLE "fixtures" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fixtures_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"layout_kind" "layout_kind" NOT NULL,
	"surface" "surface_kind" NOT NULL,
	CONSTRAINT "fixtures_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "flags" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"sort" smallint DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "positions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"section_id" integer NOT NULL,
	"idx" smallint NOT NULL,
	"product_id" integer
);
--> statement-breakpoint
CREATE TABLE "product_snapshots" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_id" integer NOT NULL,
	"content_hash" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_snapshots_content_hash_unique" UNIQUE("content_hash")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"brand_id" integer NOT NULL,
	"quick_name" text NOT NULL,
	"long_name" text NOT NULL,
	"model" text NOT NULL,
	"sku" text NOT NULL,
	"kind" "product_kind" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku"),
	CONSTRAINT "products_sku_format" CHECK ("products"."sku" ~ '^[0-9]{7}$')
);
--> statement-breakpoint
CREATE TABLE "round_items" (
	"round_id" integer NOT NULL,
	"position_id" integer NOT NULL,
	"snapshot_id" integer,
	"flags" text[] DEFAULT '{}'::text[] NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	CONSTRAINT "round_items_round_id_position_id_pk" PRIMARY KEY("round_id","position_id"),
	CONSTRAINT "round_items_note_length" CHECK (char_length("round_items"."note") <= 280)
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rounds_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"store_id" integer NOT NULL,
	"fixture_id" integer NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"shift" text DEFAULT '' NOT NULL,
	"device_hash" text NOT NULL,
	"client_key" uuid NOT NULL,
	CONSTRAINT "rounds_client_key_unique" UNIQUE("client_key"),
	CONSTRAINT "rounds_device_hash_format" CHECK ("rounds"."device_hash" ~ '^[0-9a-f]{16,64}$')
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sections_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"fixture_id" integer NOT NULL,
	"key" "section_key" NOT NULL,
	"label" text NOT NULL,
	"sort" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_positions" (
	"store_id" integer NOT NULL,
	"position_id" integer NOT NULL,
	"product_id" integer,
	CONSTRAINT "store_positions_store_id_position_id_pk" PRIMARY KEY("store_id","position_id")
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stores_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"number" text NOT NULL,
	"nickname" text,
	CONSTRAINT "stores_number_unique" UNIQUE("number"),
	CONSTRAINT "stores_number_format" CHECK ("stores"."number" ~ '^[0-9]{4}$')
);
--> statement-breakpoint
CREATE TABLE "user_brands" (
	"user_id" text NOT NULL,
	"brand_id" integer NOT NULL,
	CONSTRAINT "user_brands_user_id_brand_id_pk" PRIMARY KEY("user_id","brand_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"role" "user_role" DEFAULT 'editor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixture_brands" ADD CONSTRAINT "fixture_brands_fixture_id_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixture_brands" ADD CONSTRAINT "fixture_brands_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_snapshots" ADD CONSTRAINT "product_snapshots_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_items" ADD CONSTRAINT "round_items_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_items" ADD CONSTRAINT "round_items_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_items" ADD CONSTRAINT "round_items_snapshot_id_product_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."product_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_fixture_id_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_fixture_id_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_positions" ADD CONSTRAINT "store_positions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_positions" ADD CONSTRAINT "store_positions_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_positions" ADD CONSTRAINT "store_positions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_brands" ADD CONSTRAINT "user_brands_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_brands" ADD CONSTRAINT "user_brands_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "conditions_store_position_idx" ON "conditions" USING btree ("store_id","position_id");--> statement-breakpoint
CREATE UNIQUE INDEX "positions_section_idx_idx" ON "positions" USING btree ("section_id","idx");--> statement-breakpoint
CREATE INDEX "products_brand_idx" ON "products" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "rounds_store_time_idx" ON "rounds" USING btree ("store_id","submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sections_fixture_key_idx" ON "sections" USING btree ("fixture_id","key");