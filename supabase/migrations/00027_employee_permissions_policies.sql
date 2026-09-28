-- Migration: 00027_employee_permissions_policies.sql
-- Description: RLS policies for employee_permissions so staff can read their own permissions and admins can manage them.

DROP POLICY IF EXISTS "staff_read_own_permissions" ON public.employee_permissions;
DROP POLICY IF EXISTS "admin_manage_permissions" ON public.employee_permissions;

CREATE POLICY "staff_read_own_permissions" ON public.employee_permissions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "admin_manage_permissions" ON public.employee_permissions FOR ALL
  USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin');
