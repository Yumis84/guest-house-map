-- EXPERIMENTAL ONLY. Issue #11. Do not deploy to production.
-- Standalone proof of the allocation invariant. NOT an application migration.
-- No public/authenticated grants; application RPC and RLS still required.
BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE SCHEMA IF NOT EXISTS pms_sandbox;
REVOKE ALL ON SCHEMA pms_sandbox FROM PUBLIC;
CREATE TABLE pms_sandbox.physical_resources (
  resource_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  label text NOT NULL CHECK (length(trim(label)) > 0)
);
CREATE TABLE pms_sandbox.units (
  unit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  label text NOT NULL CHECK (length(trim(label)) > 0)
);
-- One unit can consume several resources; apartment-as-whole consumes
-- all its room resources, while a room consumes only its own resource.
CREATE TABLE pms_sandbox.unit_resources (
  unit_id uuid NOT NULL REFERENCES pms_sandbox.units ON DELETE RESTRICT,
  resource_id uuid NOT NULL REFERENCES pms_sandbox.physical_resources ON DELETE RESTRICT,
  PRIMARY KEY (unit_id, resource_id)
);
CREATE TABLE pms_sandbox.reservations (
  reservation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES pms_sandbox.units ON DELETE RESTRICT,
  stay daterange NOT NULL,
  status text NOT NULL CHECK (status IN ('requested','confirmed','cancelled')),
  CHECK (NOT isempty(stay)),
  CHECK (lower_inc(stay) AND NOT upper_inc(stay)),
  CHECK (NOT lower_inf(stay) AND NOT upper_inf(stay))
);
CREATE TABLE pms_sandbox.resource_allocations (
  allocation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES pms_sandbox.reservations ON DELETE RESTRICT,
  resource_id uuid NOT NULL REFERENCES pms_sandbox.physical_resources ON DELETE RESTRICT,
  stay daterange NOT NULL,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (reservation_id, resource_id),
  CHECK (NOT isempty(stay)),
  CHECK (lower_inc(stay) AND NOT upper_inc(stay)),
  CHECK (NOT lower_inf(stay) AND NOT upper_inf(stay)),
  EXCLUDE USING gist (resource_id WITH =, stay WITH &&) WHERE (active)
);
-- No automatic synchronization between reservations and allocations yet.
-- Do NOT allow clients to write these tables. Transactional SECURITY INVOKER/
-- carefully audited DEFINER RPC must insert all allocations atomically,
-- check memberships, lock canonical resource rows in stable order,
-- and cancel/deactivate allocations with the reservation in one transaction.
ALTER TABLE pms_sandbox.physical_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE pms_sandbox.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE pms_sandbox.unit_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE pms_sandbox.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pms_sandbox.resource_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pms_sandbox.physical_resources FORCE ROW LEVEL SECURITY;
ALTER TABLE pms_sandbox.units FORCE ROW LEVEL SECURITY;
ALTER TABLE pms_sandbox.unit_resources FORCE ROW LEVEL SECURITY;
ALTER TABLE pms_sandbox.reservations FORCE ROW LEVEL SECURITY;
ALTER TABLE pms_sandbox.resource_allocations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA pms_sandbox FROM PUBLIC, anon, authenticated;
COMMIT;
