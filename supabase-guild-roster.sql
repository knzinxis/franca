-- Execute once in the Supabase SQL Editor to enable the shared 55-member roster.

CREATE TABLE IF NOT EXISTS public.guild_roster (
  slot smallint PRIMARY KEY CHECK (slot BETWEEN 1 AND 55),
  nickname varchar(80) NOT NULL DEFAULT '',
  game_id varchar(24) NOT NULL DEFAULT '',
  weekly_honor integer CHECK (weekly_honor >= 0),
  guild_war_points integer CHECK (guild_war_points >= 0)
);

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
