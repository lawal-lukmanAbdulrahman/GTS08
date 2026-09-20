-- A row in auth.users with no provider in its app metadata made the profile insert fail:
-- `NEW.raw_app_meta_data->>'provider' = 'anonymous'` is NULL, and public.users.is_anonymous is NOT NULL.
-- That broke any account created without provider metadata (test fixtures, some admin/import paths).
-- Same behaviour otherwise: only a provider of exactly 'anonymous' marks the account anonymous.
-- Also pins the search_path, as a SECURITY DEFINER function should.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, is_anonymous)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_app_meta_data->>'provider' = 'anonymous', false)
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
