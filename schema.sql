-- Run once in the Supabase SQL Editor of a NEW project.
-- Existing customer data is not imported by this file.
BEGIN;
CREATE TABLE IF NOT EXISTS public.slots (
 id text PRIMARY KEY, starts bigint NOT NULL UNIQUE,
 enabled integer NOT NULL DEFAULT 1 CHECK (enabled IN (0,1))
);
CREATE TABLE IF NOT EXISTS public.bookings (
 id text PRIMARY KEY, slot_id text NOT NULL REFERENCES public.slots(id),
 name text NOT NULL, email text NOT NULL, phone text NOT NULL, topic text NOT NULL,
 status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled')),
 cancel_hash text NOT NULL, created bigint NOT NULL,
 notification_status text NOT NULL DEFAULT 'pending', notification_attempted bigint,
 notification_error text, notification_provider_id text
);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_active_slot ON public.bookings(slot_id) WHERE status='confirmed';
CREATE TABLE IF NOT EXISTS public.purchases (
 id text PRIMARY KEY, user_id text NOT NULL, payment_intent text,
 starts bigint NOT NULL, expires bigint NOT NULL, status text NOT NULL
);
CREATE INDEX IF NOT EXISTS purchases_user ON public.purchases(user_id, expires);
CREATE INDEX IF NOT EXISTS purchases_payment ON public.purchases(payment_intent);
CREATE TABLE IF NOT EXISTS public.progress (user_id text PRIMARY KEY, data text NOT NULL, updated bigint NOT NULL);
CREATE TABLE IF NOT EXISTS public.limits (key text PRIMARY KEY, count integer NOT NULL, expires bigint NOT NULL);
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.limits ENABLE ROW LEVEL SECURITY;
-- Only the trusted Netlify server connects to these tables through DATABASE_URL.
-- No data policies or table access are granted to browser roles.
REVOKE ALL ON public.slots, public.bookings, public.purchases, public.progress, public.limits FROM anon, authenticated;
COMMIT;
