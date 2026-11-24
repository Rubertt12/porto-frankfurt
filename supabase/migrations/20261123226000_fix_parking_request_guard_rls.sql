-- The parking-request trigger must be able to inspect its referenced listing
-- even after that listing becomes inactive. Resident SELECT policy intentionally
-- hides inactive listings, but requesters must still be able to cancel an
-- existing pending/approved request. The trigger performs its own explicit
-- authorization checks, so run it as its postgres owner and keep the path empty.
ALTER FUNCTION public.guard_parking_request() SECURITY DEFINER;
ALTER FUNCTION public.guard_parking_request() SET search_path = '';
