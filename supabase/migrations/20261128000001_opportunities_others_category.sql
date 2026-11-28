-- Allow 'Others' in opportunity category CHECK constraints across opportunities tables
DO $$
DECLARE
  v_table TEXT;
  v_constraint RECORD;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['opportunities', 'user_opportunities'] LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      FOR v_constraint IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = ('public.' || v_table)::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%category%'
      LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', v_table, v_constraint.conname);
      END LOOP;

      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (category IN (''Tender'', ''Consultancy'', ''Grant'', ''Internship'', ''Joint Venture'', ''Equipment Supply'', ''Others''))',
        v_table,
        v_table || '_category_check'
      );
    END IF;
  END LOOP;
END $$;
