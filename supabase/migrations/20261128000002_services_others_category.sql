-- Allow 'Others' in service expertise_area CHECK constraints across services tables
DO $$
DECLARE
  v_table TEXT;
  v_constraint RECORD;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['services', 'user_services'] LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      FOR v_constraint IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = ('public.' || v_table)::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%expertise_area%'
      LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', v_table, v_constraint.conname);
      END LOOP;

      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (expertise_area IN (''Geological & Exploration'', ''Drilling & Core Recovery'', ''Assay & Laboratory Testing'', ''Legal, Licensing & Cadastre'', ''Environmental (ESIA) & ESG'', ''Mine Engineering & EPCM'', ''Others''))',
        v_table,
        v_table || '_expertise_area_check'
      );
    END IF;
  END LOOP;
END $$;
