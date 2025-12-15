-- Finance Hub Tables for Plaid, QuickBooks, and P&L

-- Bank connections table for Plaid and QuickBooks OAuth
CREATE TABLE public.bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('plaid', 'quickbooks', 'xero')),
  access_token TEXT,
  refresh_token TEXT,
  institution_name TEXT,
  item_id TEXT,
  company_id TEXT,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  sync_cursor TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bank transactions table for imported Plaid transactions
CREATE TABLE public.bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  plaid_transaction_id TEXT UNIQUE,
  date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  name TEXT NOT NULL,
  merchant_name TEXT,
  category TEXT[],
  ai_category TEXT,
  ai_confidence NUMERIC,
  transaction_type TEXT CHECK (transaction_type IN ('income', 'expense', 'transfer')),
  needs_review BOOLEAN DEFAULT false,
  reviewed_at TIMESTAMPTZ,
  quickbooks_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Accounting sync log for tracking QuickBooks sync status
CREATE TABLE public.accounting_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('customer', 'invoice', 'payment', 'expense')),
  internal_id UUID NOT NULL,
  external_id TEXT,
  provider TEXT DEFAULT 'quickbooks',
  sync_direction TEXT CHECK (sync_direction IN ('to_accounting', 'from_accounting')),
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed', 'skipped')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_sync_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bank_connections
CREATE POLICY "Admins can manage bank_connections"
ON public.bank_connections FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view bank_connections"
ON public.bank_connections FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert bank_connections"
ON public.bank_connections FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update bank_connections"
ON public.bank_connections FOR UPDATE
USING (true);

-- RLS Policies for bank_transactions
CREATE POLICY "Admins can manage bank_transactions"
ON public.bank_transactions FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view bank_transactions"
ON public.bank_transactions FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert bank_transactions"
ON public.bank_transactions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update bank_transactions"
ON public.bank_transactions FOR UPDATE
USING (true);

-- RLS Policies for accounting_sync_log
CREATE POLICY "Admins can manage accounting_sync_log"
ON public.accounting_sync_log FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view accounting_sync_log"
ON public.accounting_sync_log FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert accounting_sync_log"
ON public.accounting_sync_log FOR INSERT
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_bank_transactions_connection ON public.bank_transactions(connection_id);
CREATE INDEX idx_bank_transactions_date ON public.bank_transactions(date);
CREATE INDEX idx_bank_transactions_needs_review ON public.bank_transactions(needs_review) WHERE needs_review = true;
CREATE INDEX idx_accounting_sync_log_entity ON public.accounting_sync_log(entity_type, internal_id);
CREATE INDEX idx_accounting_sync_log_status ON public.accounting_sync_log(sync_status);

-- Trigger for updated_at on bank_connections
CREATE TRIGGER update_bank_connections_updated_at
  BEFORE UPDATE ON public.bank_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();