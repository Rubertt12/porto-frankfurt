-- This legacy bucket is unused by the current app and contained no objects at audit time.
-- Keep future uploads private by default.
UPDATE storage.buckets SET public=false WHERE id='unit-profile-photos' AND public=true;
