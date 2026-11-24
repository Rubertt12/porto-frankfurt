-- Harden the unauthenticated Data API surface without changing authenticated app grants.
-- Anonymous login branding remains available through one narrowly-scoped RPC.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;

-- Keep only the public, non-sensitive condominium login branding endpoint callable anonymously.
ALTER FUNCTION public.get_public_condominium_branding(text) SET search_path = '';
GRANT EXECUTE ON FUNCTION public.get_public_condominium_branding(text) TO anon;

-- Pin SECURITY DEFINER trigger/RPC functions to an empty search_path.
-- Their table and auth references are schema-qualified in their current definitions.
ALTER FUNCTION public.confirm_resident_email(uuid) SET search_path = '';
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.sync_profile_email_from_auth() SET search_path = '';
ALTER FUNCTION private.has_organization_role(uuid, text[]) SET search_path = '';

-- Prevent future objects from inheriting anonymous access by default.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
