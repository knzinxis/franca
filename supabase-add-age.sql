ALTER TABLE public.recruitments
  ADD COLUMN IF NOT EXISTS idade integer CHECK (idade BETWEEN 1 AND 120);

GRANT INSERT (idade)
  ON TABLE public.recruitments
  TO anon;
