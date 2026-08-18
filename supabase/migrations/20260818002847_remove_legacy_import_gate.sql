-- The one-time desktop import has been claimed. Remove its privileged entry
-- point and staged payload so only the regular RLS-protected tables remain.
drop function if exists public.claim_todoai_legacy_import(text);
drop table if exists private.legacy_import_batches;
