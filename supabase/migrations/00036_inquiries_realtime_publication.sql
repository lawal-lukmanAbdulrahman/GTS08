-- Migration 00036: Enable Supabase Realtime for customer support inquiries and messages
-- Enables instant WebSocket broadcasts and Postgres CDC for ticket_messages and support_tickets

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'ticket_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ticket_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'support_tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE support_tickets;
  END IF;
END $$;

-- Enable REPLICA IDENTITY FULL so realtime WebSocket payloads contain complete record fields
ALTER TABLE ticket_messages REPLICA IDENTITY FULL;
ALTER TABLE support_tickets REPLICA IDENTITY FULL;

-- Ensure RLS allows subscribers to receive realtime changes
DROP POLICY IF EXISTS "allow_read_ticket_messages" ON ticket_messages;
CREATE POLICY "allow_read_ticket_messages" ON ticket_messages
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_read_support_tickets" ON support_tickets;
CREATE POLICY "allow_read_support_tickets" ON support_tickets
  FOR SELECT USING (true);
