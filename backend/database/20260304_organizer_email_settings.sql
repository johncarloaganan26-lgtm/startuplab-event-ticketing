
-- Migration: Create organizerEmailSettings table
CREATE TABLE IF NOT EXISTS "organizerEmailSettings" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizerId" UUID NOT NULL REFERENCES "organizers"("organizerId") ON DELETE CASCADE,
    "emailProvider" TEXT DEFAULT 'SMTP',
    "mailDriver" TEXT DEFAULT 'smtp',
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUsername" TEXT,
    "smtpPassword" TEXT,
    "mailEncryption" TEXT DEFAULT 'TLS',
    "fromAddress" TEXT,
    "fromName" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    UNIQUE("organizerId")
);

-- Enable RLS
ALTER TABLE "organizerEmailSettings" ENABLE ROW LEVEL SECURITY;

-- Simple policy: Owners can see/edit their own settings
CREATE POLICY IF NOT EXISTS "Owners can manage their own email settings" ON "organizerEmailSettings"
    FOR ALL
    USING (
        auth.uid() IN (
            SELECT "ownerUserId" FROM "organizers" WHERE "organizerId" = "organizerEmailSettings"."organizerId"
        )
    );
