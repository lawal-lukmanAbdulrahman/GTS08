-- D006 (SECURITY): any signed-in user could change their own privileged columns
-- through Supabase's public REST API, because the "users_update_own" policy
-- allows updating the whole row. A customer could set role = 'admin'.
--
-- Fix: a trigger that lets a user change only their own profile fields
-- (name, phone, avatar, marketing opt-out). Anything else, including role,
-- is_blocked, is_super_admin, must_change_password, email, order statistics and
-- any column added in future, can only be changed by server-side code (the
-- service role) or a direct database session.
--
-- Safe to apply before or after 00012: columns are compared by name.

CREATE OR REPLACE FUNCTION guard_user_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  editable CONSTANT text[] := ARRAY['full_name', 'phone', 'avatar_cloudinary_id', 'email_marketing_opt_out', 'updated_at'];
  new_row jsonb := to_jsonb(NEW);
  old_row jsonb := to_jsonb(OLD);
  col text;
BEGIN
  -- Server-side code and direct database sessions may change anything.
  IF current_user IN ('postgres', 'supabase_admin', 'service_role', 'supabase_auth_admin')
     OR COALESCE(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  FOR col IN SELECT jsonb_object_keys(new_row) LOOP
    IF (new_row -> col) IS DISTINCT FROM (old_row -> col) AND NOT (col = ANY (editable)) THEN
      RAISE EXCEPTION 'Only the server can change "%" on an account.', col USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_user_privileged_columns ON users;
CREATE TRIGGER trg_guard_user_privileged_columns
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION guard_user_privileged_columns();
