-- Unified Settings Table for Platform Configurations
-- Stores SMTP, API keys, and other system-wide or user-specific settings.

CREATE TABLE
IF
  NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid()
    , user_id UUID NOT NULL
    , key TEXT NOT NULL
    , value TEXT
    , created_at TIMESTAMPTZ DEFAULT now()
    , updated_at TIMESTAMPTZ DEFAULT now()
    , UNIQUE(user_id, key)
  );

  -- Documentation of Expected Keys (as per SMTP Configuration Documentation):
  -- 'email_provider'      - e.g., 'SMTP'
  -- 'email_driver'       - e.g., 'smtp'
  -- 'email_host'         - e.g., 'mail.ribo.com.ph'
  -- 'email_port'         - e.g., '465'
  -- 'email_username'     - e.g., 'hello@ribo.com.ph'
  -- 'email_password'     - The SMTP password (should be treated as sensitive)
  -- 'email_encryption'   - e.g., 'SSL' or 'TLS'
  -- 'email_from_address' - e.g., 'hello@ribo.com.ph'
  -- 'email_from_name'   - e.g., 'Ribo Events'

  -- HitPay Payment Gateway Keys (per organizer/admin):
  -- 'hitpay_enabled'     - 'true' or 'false'
  -- 'hitpay_mode'       - 'sandbox' or 'live'
  -- 'hitpay_api_key'    - Encrypted API key
  -- 'hitpay_salt'       - Encrypted webhook salt

  -- Constraint: Link to the platform's user table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_constraint
    WHERE
      conname = 'settings_user_id_fkey'
  )
  THEN
    ALTER TABLE public.settings
    ADD CONSTRAINT settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users("userId")
    ON DELETE CASCADE;
  END IF;
END $$;

-- Indices for rapid lookup during email generation
CREATE INDEX
IF
  NOT EXISTS idx_settings_user_id
  ON public.settings(user_id);
  CREATE INDEX
  IF
    NOT EXISTS idx_settings_lookup_composite
    ON public.settings(user_id, key);

    -- Security: Enable RLS
    ALTER TABLE public.settings
    ENABLE ROW LEVEL
    SECURITY;

    -- Policies
    -- 1. Owners can manage their own settings (including SMTP passwords)
    CREATE POLICY "Manage own settings"
    ON public.settings
    FOR ALL
    USING (auth.uid() = user_id);

    -- 2. System Admins can view settings for management, but for security
    --    the backend service role usually handles the actual email dispatch.
    CREATE POLICY "Admins can view global settings"
    ON public.settings
    FOR
    SELECT
    USING (
      EXISTS (
        SELECT
          1
        FROM
          public.users
        WHERE
          "userId" = auth.uid()
          AND role = 'ADMIN'
      )
    );