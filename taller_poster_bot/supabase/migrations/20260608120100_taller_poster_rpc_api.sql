-- TALLER poster bot — RPC API (copied from Voltix poster_rpc_api migration)

CREATE TABLE IF NOT EXISTS poster_internal_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

ALTER TABLE poster_internal_config ENABLE ROW LEVEL SECURITY;

INSERT INTO poster_internal_config (key, value)
VALUES ('api_secret', gen_random_uuid()::text)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.poster_create_scheduled(p_secret text, p_publish_at timestamp with time zone, p_text text)
 RETURNS poster_posts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_secret TEXT;
  v_row poster_posts;
BEGIN
  SELECT value INTO v_secret FROM poster_internal_config WHERE key = 'api_secret';
  IF p_secret IS DISTINCT FROM v_secret THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO poster_posts (publish_at, text, status)
  VALUES (p_publish_at, p_text, 'scheduled')
  RETURNING * INTO v_row;
  INSERT INTO poster_audit_logs (post_id, action, details)
  VALUES (v_row.id, 'post_scheduled', jsonb_build_object('publish_at', p_publish_at));
  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.poster_record_published(p_secret text, p_text text, p_actor bigint DEFAULT NULL::bigint, p_message_id bigint DEFAULT NULL::bigint)
 RETURNS poster_posts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_secret TEXT;
  v_row poster_posts;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT value INTO v_secret FROM poster_internal_config WHERE key = 'api_secret';
  IF p_secret IS DISTINCT FROM v_secret THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO poster_posts (publish_at, text, status, published_at, telegram_message_id)
  VALUES (v_now, p_text, 'published', v_now, p_message_id)
  RETURNING * INTO v_row;
  INSERT INTO poster_audit_logs (post_id, action, actor_telegram_id, details)
  VALUES (v_row.id, 'post_published_instant', p_actor, jsonb_build_object('telegram_message_id', p_message_id));
  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.poster_get_scheduled_due(p_secret text, p_limit integer DEFAULT 50)
 RETURNS SETOF poster_posts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_secret TEXT;
BEGIN
  SELECT value INTO v_secret FROM poster_internal_config WHERE key = 'api_secret';
  IF p_secret IS DISTINCT FROM v_secret THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT * FROM poster_posts WHERE status = 'scheduled' AND publish_at <= NOW() ORDER BY publish_at ASC LIMIT p_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.poster_get_upcoming(p_secret text, p_limit integer DEFAULT 10)
 RETURNS SETOF poster_posts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_secret TEXT;
BEGIN
  SELECT value INTO v_secret FROM poster_internal_config WHERE key = 'api_secret';
  IF p_secret IS DISTINCT FROM v_secret THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT * FROM poster_posts WHERE status = 'scheduled' ORDER BY publish_at ASC LIMIT p_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.poster_get_by_id(p_secret text, p_id uuid)
 RETURNS poster_posts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_secret TEXT; v_row poster_posts;
BEGIN
  SELECT value INTO v_secret FROM poster_internal_config WHERE key = 'api_secret';
  IF p_secret IS DISTINCT FROM v_secret THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_row FROM poster_posts WHERE id = p_id;
  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.poster_get_by_status(p_secret text, p_status text, p_limit integer DEFAULT 50)
 RETURNS SETOF poster_posts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_secret TEXT;
BEGIN
  SELECT value INTO v_secret FROM poster_internal_config WHERE key = 'api_secret';
  IF p_secret IS DISTINCT FROM v_secret THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT * FROM poster_posts WHERE status = p_status ORDER BY created_at DESC LIMIT p_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.poster_mark_published(p_secret text, p_id uuid, p_message_id bigint DEFAULT NULL::bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_secret TEXT;
BEGIN
  SELECT value INTO v_secret FROM poster_internal_config WHERE key = 'api_secret';
  IF p_secret IS DISTINCT FROM v_secret THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE poster_posts SET status = 'published', published_at = NOW(), last_error = NULL, telegram_message_id = p_message_id WHERE id = p_id;
  INSERT INTO poster_audit_logs (post_id, action, details) VALUES (p_id, 'post_published_scheduled', jsonb_build_object('telegram_message_id', p_message_id));
END;
$function$;

CREATE OR REPLACE FUNCTION public.poster_mark_canceled(p_secret text, p_id uuid, p_actor bigint DEFAULT NULL::bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_secret TEXT;
BEGIN
  SELECT value INTO v_secret FROM poster_internal_config WHERE key = 'api_secret';
  IF p_secret IS DISTINCT FROM v_secret THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE poster_posts SET status = 'canceled' WHERE id = p_id;
  INSERT INTO poster_audit_logs (post_id, action, actor_telegram_id) VALUES (p_id, 'post_canceled', p_actor);
END;
$function$;

CREATE OR REPLACE FUNCTION public.poster_update_error(p_secret text, p_id uuid, p_error text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_secret TEXT;
BEGIN
  SELECT value INTO v_secret FROM poster_internal_config WHERE key = 'api_secret';
  IF p_secret IS DISTINCT FROM v_secret THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE poster_posts SET last_error = p_error WHERE id = p_id;
  INSERT INTO poster_audit_logs (post_id, action, details) VALUES (p_id, 'post_publish_error', jsonb_build_object('error', p_error));
END;
$function$;

GRANT EXECUTE ON FUNCTION poster_create_scheduled(text, timestamptz, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION poster_record_published(text, text, bigint, bigint) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION poster_get_scheduled_due(text, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION poster_get_upcoming(text, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION poster_get_by_id(text, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION poster_get_by_status(text, text, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION poster_mark_published(text, uuid, bigint) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION poster_mark_canceled(text, uuid, bigint) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION poster_update_error(text, uuid, text) TO anon, authenticated, service_role;
