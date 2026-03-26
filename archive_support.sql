-- Add is_archived column to notifications table if it doesn't exist
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Optional: Index for performance
CREATE INDEX IF NOT EXISTS idx_notifications_is_archived ON notifications(is_archived);
