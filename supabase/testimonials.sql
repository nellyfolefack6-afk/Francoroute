BEGIN;
CREATE TABLE IF NOT EXISTS public.testimonials (
 id text PRIMARY KEY, name text NOT NULL,
 stars integer NOT NULL CHECK (stars BETWEEN 1 AND 5),
 course text NOT NULL DEFAULT '', message text NOT NULL, contact_email text,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','rejected')),
 created bigint NOT NULL, published bigint
);
CREATE INDEX IF NOT EXISTS testimonials_status ON public.testimonials(status, published);
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.testimonials FROM PUBLIC, anon, authenticated;
COMMIT;
