-- Enable the new activity center for existing condominiums. New condos receive it from the portfolio module catalog.
INSERT INTO public.condominium_modules (condominium_id,module_key,enabled)
SELECT c.id,'activity',true
FROM public.condominiums c
WHERE NOT EXISTS (
  SELECT 1 FROM public.condominium_modules m
  WHERE m.condominium_id=c.id AND m.module_key='activity'
);
