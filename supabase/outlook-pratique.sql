-- Migration additive : exécuter après schema.sql, sans supprimer les données.
BEGIN;
CREATE TABLE IF NOT EXISTS public.outlook_connection (
 id integer PRIMARY KEY CHECK(id=1), account_email text NOT NULL,
 calendar_id text NOT NULL, calendar_name text NOT NULL,
 credentials text NOT NULL, expires bigint NOT NULL, updated bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS public.outlook_oauth (
 state_hash text PRIMARY KEY, user_id text NOT NULL, verifier text NOT NULL,
 expires bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS public.practice_settings (
 id integer PRIMARY KEY CHECK(id=1), opening integer NOT NULL DEFAULT 540,
 closing integer NOT NULL DEFAULT 1200,
 CHECK(opening>=0 AND opening<closing AND closing<=1200),
 CHECK(opening%15=0 AND closing%15=0)
);
INSERT INTO public.practice_settings(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.practice_credits (
 id text PRIMARY KEY, client_email text NOT NULL, minutes integer NOT NULL CHECK(minutes>0 AND minutes%30=0),
 payment_reference text NOT NULL UNIQUE, created_by text NOT NULL, created bigint NOT NULL,
 eligible boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS practice_credit_email ON public.practice_credits(client_email);
CREATE TABLE IF NOT EXISTS public.calendar_reservations (
 id text PRIMARY KEY, source_kind text NOT NULL CHECK(source_kind IN ('practice','call')),
 source_id text NOT NULL, user_id text, client_email text NOT NULL,
 name text NOT NULL, phone text NOT NULL, topic text NOT NULL,
 starts bigint NOT NULL, ends bigint NOT NULL CHECK(ends>starts),
 minutes integer NOT NULL CHECK(minutes IN(15,60,90)),
 CHECK(ends=starts+minutes*60),
 status text NOT NULL CHECK(status IN('pending','confirmed','cancel_pending','cancelled')),
 outlook_event_id text, sync_error boolean NOT NULL DEFAULT false,
 sync_claim text, sync_until bigint NOT NULL DEFAULT 0,
 created bigint NOT NULL, updated bigint NOT NULL,
 UNIQUE(source_kind,source_id)
);
CREATE INDEX IF NOT EXISTS calendar_reservation_time ON public.calendar_reservations(starts,ends) WHERE status<>'cancelled';
CREATE INDEX IF NOT EXISTS calendar_reservation_client ON public.calendar_reservations(client_email);
ALTER TABLE public.outlook_connection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlook_oauth ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.outlook_connection,public.outlook_oauth,public.practice_settings,public.practice_credits,public.calendar_reservations FROM anon,authenticated;
COMMIT;
