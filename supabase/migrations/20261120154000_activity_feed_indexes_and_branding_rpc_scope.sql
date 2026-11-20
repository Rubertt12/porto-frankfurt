-- Composite indexes used by the cross-module activity timeline.
CREATE INDEX IF NOT EXISTS audit_logs_condominium_created_idx ON public.audit_logs (condominium_id, created_at DESC);
CREATE INDEX IF NOT EXISTS packages_condominium_created_idx ON public.packages (condominium_id, created_at DESC);
CREATE INDEX IF NOT EXISTS visitor_logs_condominium_created_idx ON public.visitor_logs (condominium_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reservations_condominium_created_idx ON public.reservations (condominium_id, created_at DESC);
CREATE INDEX IF NOT EXISTS occurrences_condominium_created_idx ON public.occurrences (condominium_id, created_at DESC);
CREATE INDEX IF NOT EXISTS announcements_condominium_created_idx ON public.announcements (condominium_id, created_at DESC);
CREATE INDEX IF NOT EXISTS financial_transactions_condominium_created_idx ON public.financial_transactions (condominium_id, created_at DESC);
CREATE INDEX IF NOT EXISTS resident_notifications_condominium_created_idx ON public.resident_notifications (condominium_id, created_at DESC);

-- Branding is intentionally public for the condominium login screen, but not needed by authenticated users.
REVOKE ALL ON FUNCTION public.get_public_condominium_branding(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_condominium_branding(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_condominium_branding(text) TO anon;
