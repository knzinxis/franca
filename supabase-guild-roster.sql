-- Execute in the Supabase SQL Editor. Safe to rerun; filled slots are preserved.

CREATE TABLE IF NOT EXISTS public.guild_roster (
  slot smallint PRIMARY KEY CHECK (slot BETWEEN 1 AND 55),
  nickname varchar(80) NOT NULL DEFAULT '',
  game_id varchar(24) NOT NULL DEFAULT '',
  weekly_honor integer CHECK (weekly_honor >= 0),
  guild_war_points integer CHECK (guild_war_points >= 0),
  recruitment_id text
);

ALTER TABLE public.guild_roster
  ADD COLUMN IF NOT EXISTS recruitment_id text;

CREATE UNIQUE INDEX IF NOT EXISTS guild_roster_recruitment_id_unique_idx
  ON public.guild_roster (recruitment_id)
  WHERE recruitment_id IS NOT NULL;

ALTER TABLE public.guild_roster ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.guild_roster FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.guild_roster TO authenticated;

DROP POLICY IF EXISTS guild_roster_admin_read ON public.guild_roster;
CREATE POLICY guild_roster_admin_read
  ON public.guild_roster
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS guild_roster_admin_update ON public.guild_roster;
CREATE POLICY guild_roster_admin_update
  ON public.guild_roster
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE user_id = auth.uid()
    )
  );

INSERT INTO public.guild_roster (slot)
SELECT generate_series(1, 55)::smallint
ON CONFLICT (slot) DO NOTHING;

WITH approved_candidates AS (
  SELECT
    approved.id::text AS recruitment_id,
    trim(approved.nick_jogo) AS nickname,
    row_number() OVER (
      ORDER BY approved.approved_at NULLS FIRST, approved.created_at, approved.id
    ) AS row_num
  FROM public.recruitments AS approved
  WHERE approved.status = 'Aprovado'
    AND NULLIF(trim(approved.nick_jogo), '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.guild_roster AS linked
      WHERE linked.recruitment_id = approved.id::text
    )
),
available_slots AS (
  SELECT
    slot,
    row_number() OVER (ORDER BY slot) AS row_num
  FROM public.guild_roster
  WHERE recruitment_id IS NULL
    AND NULLIF(trim(nickname), '') IS NULL
    AND NULLIF(trim(game_id), '') IS NULL
    AND weekly_honor IS NULL
    AND guild_war_points IS NULL
),
assignments AS (
  SELECT available_slots.slot, approved_candidates.recruitment_id, approved_candidates.nickname
  FROM available_slots
  JOIN approved_candidates USING (row_num)
)
UPDATE public.guild_roster AS roster
SET
  nickname = assignments.nickname,
  recruitment_id = assignments.recruitment_id
FROM assignments
WHERE roster.slot = assignments.slot
  AND roster.recruitment_id IS NULL
  AND NULLIF(trim(roster.nickname), '') IS NULL
  AND NULLIF(trim(roster.game_id), '') IS NULL
  AND roster.weekly_honor IS NULL
  AND roster.guild_war_points IS NULL;

NOTIFY pgrst, 'reload schema';
