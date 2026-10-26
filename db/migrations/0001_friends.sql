-- People, the friendships between them, and what each shares with friends.

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The identity provider and its stable user id: ('apple', sub) or ('google', sub).
  provider text NOT NULL CHECK (provider IN ('apple', 'google', 'dev')),
  provider_sub text NOT NULL,
  name text NOT NULL DEFAULT '',
  -- The code in this person's invite link, https://hvor.app/venn/<code>.
  invite_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_sub)
);

-- App sessions. Only the SHA-256 of a token is stored.
CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- A request from someone who opened another person's invite link, waiting for
-- that person to accept.
CREATE TABLE friend_requests (
  from_user uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (from_user, to_user),
  CHECK (from_user <> to_user)
);

-- A friendship is mutual and stored once, with the smaller id first.
CREATE TABLE friendships (
  user_a uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)
);

-- What a person currently shares with all their friends, one row per kind,
-- visible until expires_at. A seat is {"arena", "gridX", "gridY"}; a hotel
-- room will be its own kind on the same table.
CREATE TABLE shares (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('seat')),
  place jsonb NOT NULL,
  shared_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, kind)
);

CREATE INDEX friend_requests_to_user ON friend_requests (to_user);
CREATE INDEX friendships_user_b ON friendships (user_b);
