-- CANDIDATE FAIL-CLOSED DISABLE. Not a destructive rollback; no data deletion.
-- Review and explicitly approve separately before any use outside synthetic DB.
begin;
update widget_private.activation set enabled=false;
create or replace function widget_private.ledger_ready() returns boolean language sql set search_path='' as $$select false$$;
revoke execute on function public.booking_submit(text,jsonb,uuid,text,text) from service_role;
-- Keep worker, history, contacts and all reservation/hold records for reconciliation.
-- Do not restore old submit grants or remove exclusion constraints/triggers.
commit;
