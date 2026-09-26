-- Migration: 00017_can_manage_broadcasts.sql
-- Description: Adds can_manage_broadcasts permission to employee_permissions

ALTER TABLE employee_permissions
  ADD COLUMN IF NOT EXISTS can_manage_broadcasts BOOLEAN NOT NULL DEFAULT false;
