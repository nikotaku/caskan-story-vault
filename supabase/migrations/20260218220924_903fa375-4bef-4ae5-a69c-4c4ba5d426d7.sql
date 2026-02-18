ALTER TABLE public.reservations DROP CONSTRAINT reservations_created_by_fkey;
ALTER TABLE public.reservations ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.reservations ALTER COLUMN created_by SET DEFAULT null;