-- Expire resident email-verification tokens after 24 hours.
ALTER TABLE public.resident_email_verifications
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL
  DEFAULT (now() + interval '24 hours');

CREATE OR REPLACE FUNCTION public.confirm_resident_email(p_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v public.resident_email_verifications%rowtype;
BEGIN
  SELECT *
  INTO v
  FROM public.resident_email_verifications
  WHERE token = p_token
    AND profile_id = (SELECT auth.uid())
    AND lower(email) = lower(coalesce(auth.jwt()->>'email',''))
    AND verified_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.resident_email_verifications
  SET verified_at = now()
  WHERE id = v.id;

  INSERT INTO public.condominium_members(condominium_id,profile_id,role,is_active)
  VALUES(v.condominium_id,v.profile_id,'resident',true)
  ON CONFLICT (condominium_id,profile_id) DO NOTHING;

  RETURN true;
END;
$function$;
