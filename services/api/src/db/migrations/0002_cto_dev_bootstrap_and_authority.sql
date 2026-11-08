CREATE TYPE cto_dev_position AS ENUM ('PRIMARY', 'SECONDARY');

ALTER TABLE authorization_assignments
  ADD COLUMN cto_dev_position cto_dev_position;

ALTER TABLE authorization_assignments
  ADD CONSTRAINT authorization_assignments_cto_position_consistent
  CHECK (
    (role = 'CTO_DEV' AND cto_dev_position IS NOT NULL) OR
    (role <> 'CTO_DEV' AND cto_dev_position IS NULL)
  ) NOT VALID;

CREATE UNIQUE INDEX authorization_assignments_one_cto_position
  ON authorization_assignments (cto_dev_position)
  WHERE role = 'CTO_DEV'
    AND is_active
    AND revoked_at IS NULL;

CREATE TABLE cto_dev_bootstrap_config (
  singleton_id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton_id),
  allowed_email TEXT NOT NULL,
  configured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  configured_by_db_role TEXT NOT NULL,
  consumed_at TIMESTAMPTZ,
  consumed_by_user_id UUID REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  CONSTRAINT cto_dev_bootstrap_email_normalized CHECK (
    allowed_email = lower(trim(allowed_email))
    AND allowed_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  CONSTRAINT cto_dev_bootstrap_consumption_consistent CHECK (
    (consumed_at IS NULL AND consumed_by_user_id IS NULL) OR
    (consumed_at IS NOT NULL AND consumed_by_user_id IS NOT NULL)
  )
);

ALTER TABLE cto_dev_bootstrap_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE cto_dev_bootstrap_config FORCE ROW LEVEL SECURITY;
CREATE POLICY cto_dev_bootstrap_config_owner
  ON cto_dev_bootstrap_config FOR ALL
  USING (
    current_user = (
      SELECT pg_get_userbyid(relation.relowner)
        FROM pg_class AS relation
       WHERE relation.oid = 'public.cto_dev_bootstrap_config'::regclass
    )
  )
  WITH CHECK (
    current_user = (
      SELECT pg_get_userbyid(relation.relowner)
        FROM pg_class AS relation
       WHERE relation.oid = 'public.cto_dev_bootstrap_config'::regclass
    )
  );

CREATE TABLE cto_dev_bootstrap_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL CHECK (length(trim(action)) > 0),
  assignment_id UUID NOT NULL REFERENCES authorization_assignments(id) ON DELETE RESTRICT,
  subject_user_id UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  authority_source TEXT NOT NULL CHECK (authority_source = 'CTO_DEV_BOOTSTRAP_EMAIL'),
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cto_dev_bootstrap_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE cto_dev_bootstrap_audit FORCE ROW LEVEL SECURITY;
CREATE POLICY cto_dev_bootstrap_audit_owner
  ON cto_dev_bootstrap_audit FOR ALL
  USING (
    current_user = (
      SELECT pg_get_userbyid(relation.relowner)
        FROM pg_class AS relation
       WHERE relation.oid = 'public.cto_dev_bootstrap_audit'::regclass
    )
  )
  WITH CHECK (
    current_user = (
      SELECT pg_get_userbyid(relation.relowner)
        FROM pg_class AS relation
       WHERE relation.oid = 'public.cto_dev_bootstrap_audit'::regclass
    )
  );

CREATE POLICY authorization_assignments_owner_manage
  ON authorization_assignments FOR ALL
  USING (
    current_user = (
      SELECT pg_get_userbyid(relation.relowner)
        FROM pg_class AS relation
       WHERE relation.oid = 'public.authorization_assignments'::regclass
    )
  )
  WITH CHECK (
    current_user = (
      SELECT pg_get_userbyid(relation.relowner)
        FROM pg_class AS relation
       WHERE relation.oid = 'public.authorization_assignments'::regclass
    )
  );

CREATE POLICY authorization_audit_owner_manage
  ON authorization_audit_log FOR ALL
  USING (
    current_user = (
      SELECT pg_get_userbyid(relation.relowner)
        FROM pg_class AS relation
       WHERE relation.oid = 'public.authorization_audit_log'::regclass
    )
  )
  WITH CHECK (
    current_user = (
      SELECT pg_get_userbyid(relation.relowner)
        FROM pg_class AS relation
       WHERE relation.oid = 'public.authorization_audit_log'::regclass
    )
  );

CREATE FUNCTION bootstrap_initial_cto_dev()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, neon_auth
AS $$
DECLARE
  authenticated_user_id UUID;
  configured_email TEXT;
  user_record JSONB;
  account_email TEXT;
  email_verified BOOLEAN;
  assignment_id UUID;
BEGIN
  authenticated_user_id :=
    NULLIF(current_setting('app.authenticated_user_id', TRUE), '')::uuid;
  IF authenticated_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT allowed_email
    INTO configured_email
    FROM public.cto_dev_bootstrap_config
   WHERE singleton_id = TRUE
   AND consumed_at IS NULL;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  SELECT to_jsonb(auth_user)
    INTO user_record
    FROM neon_auth."user" AS auth_user
   WHERE auth_user.id = authenticated_user_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  account_email := lower(trim(coalesce(user_record ->> 'email', '')));
  email_verified := lower(coalesce(
    user_record ->> 'emailVerified',
    user_record ->> 'email_verified',
    'false'
  )) = 'true';
  IF account_email <> configured_email OR NOT email_verified THEN
    RETURN FALSE;
  END IF;

  PERFORM pg_advisory_xact_lock(7520031101::bigint);

  SELECT allowed_email
    INTO configured_email
    FROM public.cto_dev_bootstrap_config
   WHERE singleton_id = TRUE
     AND consumed_at IS NULL
   FOR UPDATE;
  IF NOT FOUND OR account_email <> configured_email THEN
    RETURN FALSE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.authorization_assignments WHERE role = 'CTO_DEV'
  ) THEN
    RETURN FALSE;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.authorization_assignments
     WHERE user_id = authenticated_user_id
       AND is_active
       AND revoked_at IS NULL
  ) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.authorization_assignments (
    user_id,
    role,
    scope_kind,
    cto_dev_position,
    granted_by_user_id,
    grant_reason
  )
  VALUES (
    authenticated_user_id,
    'CTO_DEV',
    'GLOBAL',
    'PRIMARY',
    NULL,
    'Initial CTO/DEV principal bootstrap from configured verified email'
  )
  RETURNING id INTO assignment_id;

  UPDATE public.cto_dev_bootstrap_config
     SET consumed_at = now(),
         consumed_by_user_id = authenticated_user_id
   WHERE singleton_id = TRUE
     AND consumed_at IS NULL;

  INSERT INTO public.cto_dev_bootstrap_audit (
    action,
    assignment_id,
    subject_user_id,
    authority_source,
    request_id
  )
  VALUES (
    'INITIAL_CTO_DEV_BOOTSTRAP',
    assignment_id,
    authenticated_user_id,
    'CTO_DEV_BOOTSTRAP_EMAIL',
    NULLIF(current_setting('app.request_id', TRUE), '')
  );

  RETURN assignment_id IS NOT NULL;
END;
$$;

CREATE FUNCTION assign_secondary_cto_dev(
  target_user_id UUID,
  reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor_user_id UUID;
  assignment_id UUID;
  active_cto_count INTEGER;
  target_user_record JSONB;
  target_email_verified BOOLEAN;
BEGIN
  actor_user_id :=
    NULLIF(current_setting('app.authenticated_user_id', TRUE), '')::uuid;
  IF actor_user_id IS NULL OR target_user_id IS NULL OR actor_user_id = target_user_id THEN
    RAISE EXCEPTION 'A distinct authenticated primary CTO/DEV is required'
      USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(reason, ''))) = 0
     OR length(trim(coalesce(reason, ''))) > 500 THEN
    RAISE EXCEPTION 'A reason between 1 and 500 characters is required'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(7520031101::bigint);

  IF NOT EXISTS (
    SELECT 1
      FROM public.authorization_assignments
     WHERE user_id = actor_user_id
       AND role = 'CTO_DEV'
       AND cto_dev_position = 'PRIMARY'
       AND scope_kind = 'GLOBAL'
       AND is_active
       AND revoked_at IS NULL
       AND valid_from <= now()
       AND (valid_until IS NULL OR valid_until > now())
  ) THEN
    RAISE EXCEPTION 'Only the primary CTO/DEV may assign a secondary'
      USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(auth_user)
    INTO target_user_record
    FROM neon_auth."user" AS auth_user
   WHERE auth_user.id = target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The target must have an existing Neon Auth account'
      USING ERRCODE = '42501';
  END IF;
  target_email_verified := lower(coalesce(
    target_user_record ->> 'emailVerified',
    target_user_record ->> 'email_verified',
    'false'
  )) = 'true';
  IF NOT target_email_verified THEN
    RAISE EXCEPTION 'The target account email must be verified'
      USING ERRCODE = '42501';
  END IF;

  SELECT count(*)::integer
    INTO active_cto_count
    FROM public.authorization_assignments
   WHERE role = 'CTO_DEV'
     AND is_active
     AND revoked_at IS NULL;
  IF active_cto_count >= 2 THEN
    RAISE EXCEPTION 'A secondary CTO/DEV is already assigned'
      USING ERRCODE = '23505';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.authorization_assignments
     WHERE user_id = target_user_id
       AND is_active
       AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'The target already has an active authorization assignment'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.authorization_assignments (
    user_id,
    role,
    scope_kind,
    cto_dev_position,
    granted_by_user_id,
    grant_reason
  )
  VALUES (
    target_user_id,
    'CTO_DEV',
    'GLOBAL',
    'SECONDARY',
    actor_user_id,
    trim(reason)
  )
  RETURNING id INTO assignment_id;

  INSERT INTO public.authorization_audit_log (
    actor_user_id,
    assignment_id,
    action,
    entity_type,
    entity_id,
    scope_kind,
    details
  )
  VALUES (
    actor_user_id,
    assignment_id,
    'CTO_DEV_SECONDARY_ASSIGNED',
    'authorization_assignment',
    assignment_id::text,
    'GLOBAL',
    jsonb_build_object('position', 'SECONDARY', 'reason', trim(reason))
  );

  RETURN assignment_id;
END;
$$;

CREATE FUNCTION revoke_secondary_cto_dev(
  target_user_id UUID,
  reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor_user_id UUID;
  assignment_id UUID;
BEGIN
  actor_user_id :=
    NULLIF(current_setting('app.authenticated_user_id', TRUE), '')::uuid;
  IF actor_user_id IS NULL OR target_user_id IS NULL OR actor_user_id = target_user_id THEN
    RAISE EXCEPTION 'A distinct authenticated primary CTO/DEV is required'
      USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(reason, ''))) = 0
     OR length(trim(coalesce(reason, ''))) > 500 THEN
    RAISE EXCEPTION 'A reason between 1 and 500 characters is required'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(7520031101::bigint);

  IF NOT EXISTS (
    SELECT 1
      FROM public.authorization_assignments
     WHERE user_id = actor_user_id
       AND role = 'CTO_DEV'
       AND cto_dev_position = 'PRIMARY'
       AND scope_kind = 'GLOBAL'
       AND is_active
       AND revoked_at IS NULL
       AND valid_from <= now()
       AND (valid_until IS NULL OR valid_until > now())
  ) THEN
    RAISE EXCEPTION 'Only the primary CTO/DEV may revoke a secondary'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.authorization_assignments
     SET is_active = FALSE,
         revoked_by_user_id = actor_user_id,
         revoked_at = now(),
         revoke_reason = trim(reason)
   WHERE user_id = target_user_id
     AND role = 'CTO_DEV'
     AND cto_dev_position = 'SECONDARY'
     AND is_active
     AND revoked_at IS NULL
  RETURNING id INTO assignment_id;

  IF assignment_id IS NULL THEN
    RAISE EXCEPTION 'No active secondary CTO/DEV assignment exists for target'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.authorization_audit_log (
    actor_user_id,
    assignment_id,
    action,
    entity_type,
    entity_id,
    scope_kind,
    details
  )
  VALUES (
    actor_user_id,
    assignment_id,
    'CTO_DEV_SECONDARY_REVOKED',
    'authorization_assignment',
    assignment_id::text,
    'GLOBAL',
    jsonb_build_object('position', 'SECONDARY', 'reason', trim(reason))
  );

  RETURN TRUE;
END;
$$;

GRANT USAGE ON TYPE cto_dev_position TO shippiyyukon_runtime;
REVOKE ALL ON FUNCTION bootstrap_initial_cto_dev() FROM PUBLIC;
REVOKE ALL ON FUNCTION assign_secondary_cto_dev(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION revoke_secondary_cto_dev(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bootstrap_initial_cto_dev() TO shippiyyukon_runtime;
GRANT EXECUTE ON FUNCTION assign_secondary_cto_dev(UUID, TEXT)
  TO shippiyyukon_runtime;
GRANT EXECUTE ON FUNCTION revoke_secondary_cto_dev(UUID, TEXT)
  TO shippiyyukon_runtime;
