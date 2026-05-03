alter table public.submissions
add column if not exists media_framing jsonb;
