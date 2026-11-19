-- Cover foreign keys used by bicycle inventory and custody history.
CREATE INDEX IF NOT EXISTS bicycle_assets_apartment_id_idx
  ON public.bicycle_assets (apartment_id);
CREATE INDEX IF NOT EXISTS bicycle_assets_created_by_idx
  ON public.bicycle_assets (created_by);
CREATE INDEX IF NOT EXISTS bicycle_keys_created_by_idx
  ON public.bicycle_keys (created_by);
CREATE INDEX IF NOT EXISTS bicycle_key_movements_condominium_id_idx
  ON public.bicycle_key_movements (condominium_id);
CREATE INDEX IF NOT EXISTS bicycle_key_movements_key_id_idx
  ON public.bicycle_key_movements (bicycle_key_id);
CREATE INDEX IF NOT EXISTS bicycle_key_movements_issued_to_profile_id_idx
  ON public.bicycle_key_movements (issued_to_profile_id);
CREATE INDEX IF NOT EXISTS bicycle_key_movements_issued_by_idx
  ON public.bicycle_key_movements (issued_by);
CREATE INDEX IF NOT EXISTS bicycle_key_movements_returned_by_idx
  ON public.bicycle_key_movements (returned_by);
