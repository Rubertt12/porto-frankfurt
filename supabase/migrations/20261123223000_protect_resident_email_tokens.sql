-- Do not expose resident email-verification bearer tokens through the Data API.
-- Residents may read only the non-secret status fields needed by the portal.
REVOKE SELECT ON TABLE public.resident_email_verifications FROM PUBLIC, anon, authenticated;

GRANT SELECT (id, condominium_id, profile_id, verified_at)
ON TABLE public.resident_email_verifications
TO authenticated;

DROP POLICY IF EXISTS resident_email_verifications_admin_select
ON public.resident_email_verifications;

CREATE POLICY resident_email_verifications_admin_select
ON public.resident_email_verifications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role = 'super_admin'::public.condo_role
      AND p.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.condominium_members m
    WHERE m.condominium_id = resident_email_verifications.condominium_id
      AND m.profile_id = (SELECT auth.uid())
      AND m.is_active = true
      AND m.role = ANY(ARRAY['syndic'::public.condo_role, 'administrator'::public.condo_role])
  )
);
