BEGIN;
SELECT plan(2);

SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.guard_parking_request()'::regprocedure),
  'parking request trigger runs with owner privileges so inactive listings remain inspectable'
);

SELECT ok(
  (SELECT coalesce(proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""']
   FROM pg_proc WHERE oid = 'public.guard_parking_request()'::regprocedure),
  'parking request trigger pins an empty search_path'
);

SELECT * FROM finish();
ROLLBACK;
