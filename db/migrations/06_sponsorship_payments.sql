-- ============================================================================
-- 06_sponsorship_payments.sql
-- Payment selection and tracking for sponsorship inquiries.
-- ============================================================================

alter table public.interest_submissions
  add column if not exists sponsorship_amount numeric(12, 2),
  add column if not exists payment_method text,
  add column if not exists payment_status text not null default 'not_started',
  add column if not exists payment_reference text;

alter table public.interest_submissions
  drop constraint if exists interest_sponsorship_amount_check;

alter table public.interest_submissions
  add constraint interest_sponsorship_amount_check
  check (sponsorship_amount is null or sponsorship_amount >= 0);

alter table public.interest_submissions
  drop constraint if exists interest_payment_method_check;

alter table public.interest_submissions
  add constraint interest_payment_method_check
  check (payment_method is null or payment_method in ('zelle', 'cashapp', 'venmo', 'card'));

create index if not exists interest_payment_status_idx
  on public.interest_submissions (kind, payment_status, created_at desc);
