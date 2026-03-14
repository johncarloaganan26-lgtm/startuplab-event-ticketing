-- Migration to support Ticket Bundles (Multiple guests per ticket)
ALTER TABLE "ticketTypes" 
ADD COLUMN IF NOT EXISTS capacity_per_ticket INTEGER DEFAULT 1;

-- Description: This column tracks how many attendee slots one ticket covers.
-- For a standard ticket, it's 1. For a "Buy 4 Get 1" or "Group Bundle", it would be 5.
