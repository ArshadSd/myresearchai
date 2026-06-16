REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM anon;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

DROP POLICY IF EXISTS "Block client inserts on subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Block client updates on subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Block client deletes on subscriptions" ON public.subscriptions;

CREATE POLICY "Block client inserts on subscriptions"
  ON public.subscriptions FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "Block client updates on subscriptions"
  ON public.subscriptions FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE POLICY "Block client deletes on subscriptions"
  ON public.subscriptions FOR DELETE TO authenticated, anon
  USING (false);