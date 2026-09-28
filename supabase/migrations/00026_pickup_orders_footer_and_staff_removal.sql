-- Pay on pickup, the footer CMS, and removing staff.

-- 1. How long a pay-on-pickup order holds its items before it cancels itself (set by the admin in Store Details).
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS pickup_hold_hours INTEGER NOT NULL DEFAULT 48;
ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_pickup_hold_hours_check;
ALTER TABLE public.settings ADD CONSTRAINT settings_pickup_hold_hours_check CHECK (pickup_hold_hours BETWEEN 1 AND 336);

-- 2. The storefront footer, edited from Store Details. Empty means "don't show".
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS footer_about TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS instagram_url VARCHAR(255);
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS facebook_url VARCHAR(255);
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS tiktok_url VARCHAR(255);
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS x_url VARCHAR(255);
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(255);

-- The public key may read the footer fields like the rest of the store details (see 00015); the hold time stays private.
GRANT SELECT (footer_about, instagram_url, facebook_url, tiktok_url, x_url, linkedin_url) ON public.settings TO anon, authenticated;

-- 3. Pay-on-pickup orders: a storefront order that holds its items until the customer pays at the till,
--    or until its deadline passes and it is cancelled.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_channel_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_channel_check CHECK (channel IN ('online', 'walk_in', 'whatsapp', 'pickup'));
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pickup_deadline TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_orders_pickup_deadline ON public.orders (pickup_deadline) WHERE channel = 'pickup' AND status = 'pending_payment';

-- 4. Removed staff: their login is gone for good, but the account row stays so their sales and logs keep their name.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
