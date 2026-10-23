-- A profile photo per person: a small square JPEG or PNG the app uploads, or
-- the picture Google gave. The version goes in its URL, so a new photo is a
-- new URL and the old one can be cached for good.
ALTER TABLE users
  ADD COLUMN avatar bytea,
  ADD COLUMN avatar_type text CHECK (avatar_type IN ('image/jpeg', 'image/png')),
  ADD COLUMN avatar_version integer NOT NULL DEFAULT 0;
