-- Candidate business schema from verified encrypted PG snapshots. No public API is enabled.

CREATE TABLE "main__auth_subjects" (id TEXT PRIMARY KEY NOT NULL, created_at TEXT, email_confirmed_at TEXT, banned_until TEXT, deleted_at TEXT) STRICT;

CREATE TABLE "main__admin_operation_logs" (
  "id" TEXT NOT NULL DEFAULT ((lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random()%4)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))))),
  "admin_email" TEXT NOT NULL DEFAULT (''),
  "action" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "target_id" TEXT NOT NULL DEFAULT (''),
  "before_data" TEXT NOT NULL DEFAULT ('{}'),
  "after_data" TEXT NOT NULL DEFAULT ('{}'),
  "ip_address" TEXT NOT NULL DEFAULT (''),
  "result" TEXT NOT NULL DEFAULT ('success'),
  "remark" TEXT NOT NULL DEFAULT (''),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  CHECK ("before_data" IS NULL OR json_valid("before_data")),
  CHECK ("after_data" IS NULL OR json_valid("after_data")),
  CONSTRAINT "admin_operation_logs_pkey" PRIMARY KEY ("id")
) STRICT;

CREATE TABLE "main__admin_system_settings" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL DEFAULT ('{}'),
  "description" TEXT NOT NULL DEFAULT (''),
  "updated_by" TEXT NOT NULL DEFAULT (''),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  CHECK ("value" IS NULL OR json_valid("value")),
  CONSTRAINT "admin_system_settings_pkey" PRIMARY KEY ("key")
) STRICT;

CREATE TABLE "main__admin_users" (
  "id" TEXT NOT NULL DEFAULT ((lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random()%4)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))))),
  "user_id" TEXT,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT (''),
  "role" TEXT NOT NULL DEFAULT ('ops_manager'),
  "status" TEXT NOT NULL DEFAULT ('active'),
  "notes" TEXT NOT NULL DEFAULT (''),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  CONSTRAINT "admin_users_email_key" UNIQUE ("email"),
  CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "main__auth_subjects" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "main__ai_positioning_reports" (
  "id" TEXT NOT NULL DEFAULT ((lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random()%4)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))))),
  "user_id" TEXT NOT NULL,
  "profile_snapshot" TEXT NOT NULL DEFAULT ('{}'),
  "input_snapshot" TEXT NOT NULL DEFAULT ('{}'),
  "report" TEXT NOT NULL DEFAULT ('{}'),
  "source" TEXT NOT NULL DEFAULT ('ai-page'),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  CHECK ("profile_snapshot" IS NULL OR json_valid("profile_snapshot")),
  CHECK ("input_snapshot" IS NULL OR json_valid("input_snapshot")),
  CHECK ("report" IS NULL OR json_valid("report")),
  CONSTRAINT "ai_positioning_reports_report_check" CHECK ((((CASE json_type("report") WHEN 'integer' THEN 'number' WHEN 'real' THEN 'number' WHEN 'text' THEN 'string' WHEN 'true' THEN 'boolean' WHEN 'false' THEN 'boolean' ELSE json_type("report") END) = 'object') AND ((length(coalesce(("report" ->> 'summary'),'')) >= 20) AND (length(coalesce(("report" ->> 'summary'),'')) <= 1200)))),
  CONSTRAINT "ai_positioning_reports_source_check" CHECK (("source" = 'ai-page')),
  CONSTRAINT "ai_positioning_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_positioning_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "main__auth_subjects" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "main__ai_waitlist_leads" (
  "id" TEXT NOT NULL DEFAULT ((lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random()%4)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))))),
  "user_id" TEXT,
  "wechat_id" TEXT NOT NULL,
  "primary_need" TEXT NOT NULL,
  "details" TEXT NOT NULL DEFAULT (''),
  "submitted_at_text" TEXT NOT NULL DEFAULT (''),
  "source" TEXT NOT NULL DEFAULT ('ai-page'),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  CONSTRAINT "ai_waitlist_leads_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_waitlist_leads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "main__auth_subjects" ("id") ON DELETE SET NULL ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "main__applications" (
  "id" TEXT NOT NULL DEFAULT ((lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random()%4)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))))),
  "user_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "is_favorited" INTEGER NOT NULL DEFAULT (1),
  "my_status" TEXT NOT NULL DEFAULT ('已收藏'),
  "priority_level" TEXT NOT NULL DEFAULT ('中'),
  "materials_progress" INTEGER NOT NULL DEFAULT (0),
  "cv_ready" INTEGER NOT NULL DEFAULT (0),
  "transcript_ready" INTEGER NOT NULL DEFAULT (0),
  "ranking_proof_ready" INTEGER NOT NULL DEFAULT (0),
  "recommendation_ready" INTEGER NOT NULL DEFAULT (0),
  "personal_statement_ready" INTEGER NOT NULL DEFAULT (0),
  "contact_supervisor_done" INTEGER NOT NULL DEFAULT (0),
  "submitted_at" TEXT NOT NULL DEFAULT (''),
  "interview_time" TEXT NOT NULL DEFAULT (''),
  "result_status" TEXT NOT NULL DEFAULT ('未出结果'),
  "my_notes" TEXT NOT NULL DEFAULT (''),
  "custom_reminder_enabled" INTEGER NOT NULL DEFAULT (1),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  CHECK ("is_favorited" IN (0,1)),
  CHECK ("materials_progress" BETWEEN -2147483648 AND 2147483647),
  CHECK ("cv_ready" IN (0,1)),
  CHECK ("transcript_ready" IN (0,1)),
  CHECK ("ranking_proof_ready" IN (0,1)),
  CHECK ("recommendation_ready" IN (0,1)),
  CHECK ("personal_statement_ready" IN (0,1)),
  CHECK ("contact_supervisor_done" IN (0,1)),
  CHECK ("custom_reminder_enabled" IN (0,1)),
  CONSTRAINT "applications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "applications_user_project_unique" UNIQUE ("user_id","project_id"),
  CONSTRAINT "applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "main__auth_subjects" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "main__billing_fill_sessions" (
  "id" TEXT NOT NULL DEFAULT ((lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random()%4)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))))),
  "user_id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "field_count" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT ('prepared'),
  "tier" TEXT NOT NULL DEFAULT ('free'),
  "expires_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z',strftime('%Y-%m-%dT%H:%M:%f000Z','now'),'+00:05:00')),
  "expires_at__pg_raw" TEXT,
  "consumed_at" TEXT,
  "consumed_at__pg_raw" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  CHECK ("field_count" BETWEEN -32768 AND 32767),
  CONSTRAINT "billing_fill_sessions_field_count_check" CHECK ((("field_count" >= 1) AND ("field_count" <= 10))),
  CONSTRAINT "billing_fill_sessions_request_id_check" CHECK (((length("request_id") >= 16) AND (length("request_id") <= 120))),
  CONSTRAINT "billing_fill_sessions_status_check" CHECK (("status" IN ('prepared','consumed','denied','expired'))),
  CONSTRAINT "billing_fill_sessions_tier_check" CHECK (("tier" IN ('free','pro'))),
  CONSTRAINT "billing_fill_sessions_token_hash_check" CHECK ((length("token_hash")=64 AND "token_hash" NOT GLOB '*[^0-9a-f]*')),
  CONSTRAINT "billing_fill_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_fill_sessions_token_hash_key" UNIQUE ("token_hash"),
  CONSTRAINT "billing_fill_sessions_user_id_request_id_key" UNIQUE ("user_id","request_id"),
  CONSTRAINT "billing_fill_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "main__auth_subjects" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "main__billing_orders" (
  "id" TEXT NOT NULL DEFAULT ((lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random()%4)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))))),
  "user_id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "out_trade_no" TEXT NOT NULL,
  "provider_trade_no" TEXT NOT NULL DEFAULT (''),
  "amount_cents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT ('CNY'),
  "status" TEXT NOT NULL DEFAULT ('pending'),
  "code_url" TEXT NOT NULL DEFAULT (''),
  "checkout_url" TEXT NOT NULL DEFAULT (''),
  "raw_request" TEXT NOT NULL DEFAULT ('{}'),
  "raw_response" TEXT NOT NULL DEFAULT ('{}'),
  "paid_at" TEXT,
  "paid_at__pg_raw" TEXT,
  "expires_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z',strftime('%Y-%m-%dT%H:%M:%f000Z','now'),'+00:30:00')),
  "expires_at__pg_raw" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  "idempotency_key" TEXT NOT NULL DEFAULT (''),
  "last_checked_at" TEXT,
  "last_checked_at__pg_raw" TEXT,
  "failure_code" TEXT NOT NULL DEFAULT (''),
  CHECK ("amount_cents" BETWEEN -2147483648 AND 2147483647),
  CHECK ("raw_request" IS NULL OR json_valid("raw_request")),
  CHECK ("raw_response" IS NULL OR json_valid("raw_response")),
  CONSTRAINT "billing_orders_amount_cents_check" CHECK (("amount_cents" >= 0)),
  CONSTRAINT "billing_orders_provider_check" CHECK (("provider" IN ('wechat','alipay','manual'))),
  CONSTRAINT "billing_orders_status_check" CHECK (("status" IN ('pending','paid','failed','closed','refunded','expired'))),
  CONSTRAINT "billing_orders_out_trade_no_key" UNIQUE ("out_trade_no"),
  CONSTRAINT "billing_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_orders_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "main__billing_plans" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT "billing_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "main__auth_subjects" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "main__billing_plans" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT (''),
  "price_cents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT ('CNY'),
  "duration_days" INTEGER NOT NULL,
  "benefits" TEXT NOT NULL DEFAULT ('[]'),
  "sort_order" INTEGER NOT NULL DEFAULT (0),
  "is_recommended" INTEGER NOT NULL DEFAULT (0),
  "is_active" INTEGER NOT NULL DEFAULT (1),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  CHECK ("price_cents" BETWEEN -2147483648 AND 2147483647),
  CHECK ("duration_days" BETWEEN -2147483648 AND 2147483647),
  CHECK ("benefits" IS NULL OR json_valid("benefits")),
  CHECK ("sort_order" BETWEEN -2147483648 AND 2147483647),
  CHECK ("is_recommended" IN (0,1)),
  CHECK ("is_active" IN (0,1)),
  CONSTRAINT "billing_plans_duration_days_check" CHECK (("duration_days" > 0)),
  CONSTRAINT "billing_plans_price_cents_check" CHECK (("price_cents" >= 0)),
  CONSTRAINT "billing_plans_pkey" PRIMARY KEY ("id")
) STRICT;

CREATE TABLE "main__crawler_runs" (
  "id" TEXT NOT NULL DEFAULT ((lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random()%4)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))))),
  "source" TEXT NOT NULL DEFAULT ('cloudbase-sync'),
  "notices_received" INTEGER NOT NULL DEFAULT (0),
  "notices_upserted" INTEGER NOT NULL DEFAULT (0),
  "success" INTEGER NOT NULL DEFAULT (0),
  "summary" TEXT NOT NULL DEFAULT ('{}'),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  CHECK ("notices_received" BETWEEN -2147483648 AND 2147483647),
  CHECK ("notices_upserted" BETWEEN -2147483648 AND 2147483647),
  CHECK ("success" IN (0,1)),
  CHECK ("summary" IS NULL OR json_valid("summary")),
  CONSTRAINT "crawler_runs_pkey" PRIMARY KEY ("id")
) STRICT;

CREATE TABLE "main__desktop_download_attempts" (
  "id" INTEGER NOT NULL,
  "attempt_id" TEXT NOT NULL,
  "release_version" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  CONSTRAINT "desktop_download_attempts_platform_check" CHECK (("platform" = 'windows_x86_64')),
  CONSTRAINT "desktop_download_attempts_release_version_check" CHECK (((length("release_version") >= 1) AND (length("release_version") <= 32) AND ("release_version" NOT GLOB '*[^0-9.]*' AND length("release_version")-length(replace("release_version",'.',''))=2 AND instr("release_version",'.')>1 AND instr(substr("release_version",instr("release_version",'.')+1),'.')>1 AND substr("release_version",-1)<>'.'))),
  CONSTRAINT "desktop_download_attempts_source_check" CHECK (("source" = 'website_download_page')),
  CONSTRAINT "desktop_download_attempts_attempt_id_key" UNIQUE ("attempt_id"),
  CONSTRAINT "desktop_download_attempts_pkey" PRIMARY KEY ("id")
) STRICT;

CREATE TABLE "main__feedback_reports" (
  "id" TEXT NOT NULL DEFAULT ((lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random()%4)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))))),
  "user_id" TEXT,
  "type" TEXT NOT NULL DEFAULT ('feedback'),
  "module" TEXT NOT NULL DEFAULT ('system'),
  "target_id" TEXT NOT NULL DEFAULT (''),
  "content" TEXT NOT NULL DEFAULT (''),
  "status" TEXT NOT NULL DEFAULT ('pending'),
  "handler" TEXT NOT NULL DEFAULT (''),
  "handler_note" TEXT NOT NULL DEFAULT (''),
  "handled_at" TEXT,
  "handled_at__pg_raw" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  CONSTRAINT "feedback_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "feedback_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "main__auth_subjects" ("id") ON DELETE SET NULL ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "main__llm_call_logs" (
  "request_id" TEXT NOT NULL,
  "feature" TEXT NOT NULL,
  "student_id_hash" TEXT NOT NULL DEFAULT (''),
  "class_code" TEXT,
  "model" TEXT NOT NULL DEFAULT (''),
  "latency_ms" INTEGER NOT NULL DEFAULT (0),
  "retry_count" INTEGER NOT NULL DEFAULT (0),
  "prompt_tokens" INTEGER NOT NULL DEFAULT (0),
  "completion_tokens" INTEGER NOT NULL DEFAULT (0),
  "total_tokens" INTEGER NOT NULL DEFAULT (0),
  "cache_hit_tokens" INTEGER NOT NULL DEFAULT (0),
  "success" INTEGER NOT NULL DEFAULT (1),
  "error_type" TEXT NOT NULL DEFAULT (''),
  "fallback_used" INTEGER NOT NULL DEFAULT (0),
  "shadow_recorded" INTEGER NOT NULL DEFAULT (0),
  "shadow_payload" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  CHECK ("latency_ms" BETWEEN -2147483648 AND 2147483647),
  CHECK ("retry_count" BETWEEN -2147483648 AND 2147483647),
  CHECK ("prompt_tokens" BETWEEN -2147483648 AND 2147483647),
  CHECK ("completion_tokens" BETWEEN -2147483648 AND 2147483647),
  CHECK ("total_tokens" BETWEEN -2147483648 AND 2147483647),
  CHECK ("cache_hit_tokens" BETWEEN -2147483648 AND 2147483647),
  CHECK ("success" IN (0,1)),
  CHECK ("fallback_used" IN (0,1)),
  CHECK ("shadow_recorded" IN (0,1)),
  CHECK ("shadow_payload" IS NULL OR json_valid("shadow_payload")),
  CONSTRAINT "llm_call_logs_feature_check" CHECK (("feature" IN ('TUTOR','INTERVIEW'))),
  CONSTRAINT "llm_call_logs_pkey" PRIMARY KEY ("request_id")
) STRICT;

CREATE TABLE "main__notices" (
  "id" TEXT NOT NULL,
  "school_name" TEXT NOT NULL,
  "department_name" TEXT NOT NULL DEFAULT (''),
  "project_name" TEXT NOT NULL,
  "project_type" TEXT NOT NULL,
  "discipline" TEXT NOT NULL DEFAULT (''),
  "publish_date" TEXT NOT NULL DEFAULT (''),
  "deadline_date" TEXT NOT NULL DEFAULT (''),
  "event_start_date" TEXT NOT NULL DEFAULT (''),
  "event_end_date" TEXT NOT NULL DEFAULT (''),
  "apply_link" TEXT NOT NULL DEFAULT (''),
  "source_link" TEXT NOT NULL DEFAULT (''),
  "requirements" TEXT NOT NULL DEFAULT (''),
  "materials_required" TEXT NOT NULL DEFAULT ('[]'),
  "exam_interview_info" TEXT NOT NULL DEFAULT (''),
  "contact_info" TEXT NOT NULL DEFAULT (''),
  "remarks" TEXT NOT NULL DEFAULT (''),
  "tags" TEXT NOT NULL DEFAULT ('[]'),
  "status" TEXT NOT NULL DEFAULT ('报名中'),
  "year" INTEGER NOT NULL DEFAULT (2026),
  "deadline_level" TEXT NOT NULL DEFAULT ('future'),
  "source_site" TEXT NOT NULL DEFAULT (''),
  "is_private" INTEGER NOT NULL DEFAULT (0),
  "collected_at" TEXT NOT NULL DEFAULT (''),
  "updated_at" TEXT NOT NULL DEFAULT (''),
  "last_checked_at" TEXT NOT NULL DEFAULT (''),
  "is_verified" INTEGER NOT NULL DEFAULT (0),
  "change_log" TEXT NOT NULL DEFAULT ('[]'),
  "history_records" TEXT NOT NULL DEFAULT ('[]'),
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  "updated_at_ts" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at_ts__pg_raw" TEXT,
  "admin_status" TEXT NOT NULL DEFAULT ('published'),
  "admin_review_note" TEXT NOT NULL DEFAULT (''),
  "admin_reviewed_by" TEXT NOT NULL DEFAULT (''),
  "admin_reviewed_at" TEXT,
  "admin_reviewed_at__pg_raw" TEXT,
  "admin_deleted_at" TEXT,
  "admin_deleted_at__pg_raw" TEXT,
  CHECK ("materials_required" IS NULL OR json_valid("materials_required")),
  CHECK ("materials_required" IS NULL OR json_type("materials_required")='array'),
  CHECK ("tags" IS NULL OR json_valid("tags")),
  CHECK ("tags" IS NULL OR json_type("tags")='array'),
  CHECK ("year" BETWEEN -2147483648 AND 2147483647),
  CHECK ("is_private" IN (0,1)),
  CHECK ("is_verified" IN (0,1)),
  CHECK ("change_log" IS NULL OR json_valid("change_log")),
  CHECK ("history_records" IS NULL OR json_valid("history_records")),
  CONSTRAINT "notices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "main__auth_subjects" ("id") ON DELETE SET NULL ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "main__offer_comments" (
  "id" TEXT NOT NULL DEFAULT ((lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random()%4)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))))),
  "post_id" TEXT NOT NULL,
  "user_id" TEXT,
  "author_name" TEXT NOT NULL DEFAULT (''),
  "content" TEXT NOT NULL DEFAULT (''),
  "is_anonymous" INTEGER NOT NULL DEFAULT (1),
  "review_status" TEXT NOT NULL DEFAULT ('approved'),
  "hidden_at" TEXT,
  "hidden_at__pg_raw" TEXT,
  "deleted_at" TEXT,
  "deleted_at__pg_raw" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  CHECK ("is_anonymous" IN (0,1)),
  CONSTRAINT "offer_comments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "offer_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "main__offer_posts" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT "offer_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "main__auth_subjects" ("id") ON DELETE SET NULL ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "main__offer_post_follows" (
  "post_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  CONSTRAINT "offer_post_follows_pkey" PRIMARY KEY ("post_id","user_id"),
  CONSTRAINT "offer_post_follows_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "main__offer_posts" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT "offer_post_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "main__auth_subjects" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "main__offer_posts" (
  "id" TEXT NOT NULL DEFAULT ((lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random()%4)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))))),
  "user_id" TEXT,
  "author_name" TEXT NOT NULL DEFAULT (''),
  "school_name" TEXT NOT NULL DEFAULT (''),
  "major" TEXT NOT NULL DEFAULT (''),
  "project_type" TEXT NOT NULL DEFAULT (''),
  "result" TEXT NOT NULL DEFAULT (''),
  "undergraduate_background" TEXT NOT NULL DEFAULT (''),
  "content" TEXT NOT NULL DEFAULT (''),
  "is_anonymous" INTEGER NOT NULL DEFAULT (1),
  "review_status" TEXT NOT NULL DEFAULT ('pending'),
  "review_note" TEXT NOT NULL DEFAULT (''),
  "reviewed_by" TEXT NOT NULL DEFAULT (''),
  "reviewed_at" TEXT,
  "reviewed_at__pg_raw" TEXT,
  "hidden_at" TEXT,
  "hidden_at__pg_raw" TEXT,
  "deleted_at" TEXT,
  "deleted_at__pg_raw" TEXT,
  "reports_count" INTEGER NOT NULL DEFAULT (0),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  "content_type" TEXT NOT NULL DEFAULT ('offer'),
  "title" TEXT NOT NULL DEFAULT (''),
  "category" TEXT NOT NULL DEFAULT (''),
  "is_official" INTEGER NOT NULL DEFAULT (0),
  "source_label" TEXT NOT NULL DEFAULT (''),
  "comments_count" INTEGER NOT NULL DEFAULT (0),
  "follows_count" INTEGER NOT NULL DEFAULT (0),
  CHECK ("is_anonymous" IN (0,1)),
  CHECK ("reports_count" BETWEEN -2147483648 AND 2147483647),
  CHECK ("is_official" IN (0,1)),
  CHECK ("comments_count" BETWEEN -2147483648 AND 2147483647),
  CHECK ("follows_count" BETWEEN -2147483648 AND 2147483647),
  CONSTRAINT "offer_posts_content_type_check" CHECK (("content_type" IN ('offer','discussion'))),
  CONSTRAINT "offer_posts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "offer_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "main__auth_subjects" ("id") ON DELETE SET NULL ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "main__profiles" (
  "id" TEXT NOT NULL,
  "nickname" TEXT NOT NULL DEFAULT (''),
  "age" TEXT NOT NULL DEFAULT (''),
  "undergraduate_school" TEXT NOT NULL DEFAULT (''),
  "major" TEXT NOT NULL DEFAULT (''),
  "grade" TEXT NOT NULL DEFAULT ('大四'),
  "target_major" TEXT NOT NULL DEFAULT (''),
  "target_region" TEXT NOT NULL DEFAULT (''),
  "auth_provider" TEXT NOT NULL DEFAULT ('email'),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  CONSTRAINT "profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "main__auth_subjects" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "main__site_visit_events" (
  "id" INTEGER NOT NULL,
  "visitor_id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL DEFAULT (''),
  "event_type" TEXT NOT NULL DEFAULT ('pageview'),
  "path" TEXT NOT NULL DEFAULT (''),
  "title" TEXT NOT NULL DEFAULT (''),
  "referrer" TEXT NOT NULL DEFAULT (''),
  "locale" TEXT NOT NULL DEFAULT (''),
  "timezone" TEXT NOT NULL DEFAULT (''),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  CONSTRAINT "site_visit_events_event_type_check" CHECK (("event_type" IN ('pageview','heartbeat'))),
  CONSTRAINT "site_visit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "site_visit_events_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "main__site_visitors" ("visitor_id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "main__site_visitors" (
  "visitor_id" TEXT NOT NULL,
  "first_seen_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "first_seen_at__pg_raw" TEXT,
  "last_seen_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "last_seen_at__pg_raw" TEXT,
  "last_path" TEXT NOT NULL DEFAULT (''),
  "last_title" TEXT NOT NULL DEFAULT (''),
  "last_referrer" TEXT NOT NULL DEFAULT (''),
  "last_locale" TEXT NOT NULL DEFAULT (''),
  "last_timezone" TEXT NOT NULL DEFAULT (''),
  "last_user_agent" TEXT NOT NULL DEFAULT (''),
  "first_session_id" TEXT NOT NULL DEFAULT (''),
  "last_session_id" TEXT NOT NULL DEFAULT (''),
  "visit_count" INTEGER NOT NULL DEFAULT (1),
  "page_view_count" INTEGER NOT NULL DEFAULT (0),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  CHECK ("visit_count" BETWEEN -2147483648 AND 2147483647),
  CHECK ("page_view_count" BETWEEN -2147483648 AND 2147483647),
  CONSTRAINT "site_visitors_page_view_count_check" CHECK (("page_view_count" >= 0)),
  CONSTRAINT "site_visitors_visit_count_check" CHECK (("visit_count" >= 1)),
  CONSTRAINT "site_visitors_pkey" PRIMARY KEY ("visitor_id")
) STRICT;

CREATE TABLE "main__user_entitlements" (
  "user_id" TEXT NOT NULL,
  "plan_id" TEXT,
  "status" TEXT NOT NULL DEFAULT ('free'),
  "starts_at" TEXT,
  "starts_at__pg_raw" TEXT,
  "expires_at" TEXT,
  "expires_at__pg_raw" TEXT,
  "source_order_id" TEXT,
  "metadata" TEXT NOT NULL DEFAULT ('{}'),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  CHECK ("metadata" IS NULL OR json_valid("metadata")),
  CONSTRAINT "user_entitlements_status_check" CHECK (("status" IN ('free','active','expired','cancelled'))),
  CONSTRAINT "user_entitlements_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "user_entitlements_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "main__billing_plans" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT "user_entitlements_source_order_id_fkey" FOREIGN KEY ("source_order_id") REFERENCES "main__billing_orders" ("id") ON DELETE SET NULL ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT "user_entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "main__auth_subjects" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "main__user_moderation" (
  "user_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT ('active'),
  "note" TEXT NOT NULL DEFAULT (''),
  "updated_by" TEXT NOT NULL DEFAULT (''),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  CONSTRAINT "user_moderation_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "user_moderation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "main__auth_subjects" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "main__user_vaults" (
  "user_id" TEXT NOT NULL,
  "encrypted_payload" TEXT NOT NULL,
  "revision" TEXT NOT NULL,
  "schema_version" INTEGER NOT NULL DEFAULT (1),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  CHECK ("encrypted_payload" IS NULL OR json_valid("encrypted_payload")),
  CHECK ("schema_version" BETWEEN -32768 AND 32767),
  CONSTRAINT "user_vaults_payload_algorithm" CHECK ((("encrypted_payload" ->> 'algorithm') = 'AES-GCM-256')),
  CONSTRAINT "user_vaults_payload_is_object" CHECK (((CASE json_type("encrypted_payload") WHEN 'integer' THEN 'number' WHEN 'real' THEN 'number' WHEN 'text' THEN 'string' WHEN 'true' THEN 'boolean' WHEN 'false' THEN 'boolean' ELSE json_type("encrypted_payload") END) = 'object')),
  CONSTRAINT "user_vaults_payload_size" CHECK ((length(CAST("encrypted_payload" AS BLOB)) <= 2000000)),
  CONSTRAINT "user_vaults_schema_version_range" CHECK ((("schema_version" >= 1) AND ("schema_version" <= 32767))),
  CONSTRAINT "user_vaults_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "user_vaults_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "main__auth_subjects" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "main__wechat_daily_publications" (
  "digest_date" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT ('preparing'),
  "notice_count" INTEGER NOT NULL DEFAULT (0),
  "included_notice_count" INTEGER NOT NULL DEFAULT (0),
  "notice_ids" TEXT NOT NULL DEFAULT ('[]'),
  "article_title" TEXT NOT NULL DEFAULT (''),
  "article_digest" TEXT NOT NULL DEFAULT (''),
  "content_source_url" TEXT NOT NULL DEFAULT (''),
  "content_html" TEXT NOT NULL DEFAULT (''),
  "wechat_media_id" TEXT NOT NULL DEFAULT (''),
  "wechat_thumb_media_id" TEXT NOT NULL DEFAULT (''),
  "error_code" TEXT NOT NULL DEFAULT (''),
  "error_message" TEXT NOT NULL DEFAULT (''),
  "metadata" TEXT NOT NULL DEFAULT ('{}'),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  CHECK ("notice_count" BETWEEN -2147483648 AND 2147483647),
  CHECK ("included_notice_count" BETWEEN -2147483648 AND 2147483647),
  CHECK ("notice_ids" IS NULL OR json_valid("notice_ids")),
  CHECK ("notice_ids" IS NULL OR json_type("notice_ids")='array'),
  CHECK ("metadata" IS NULL OR json_valid("metadata")),
  CONSTRAINT "wechat_daily_publications_notice_count_check" CHECK ((("notice_count" >= 0) AND ("included_notice_count" >= 0) AND ("included_notice_count" <= "notice_count"))),
  CONSTRAINT "wechat_daily_publications_status_check" CHECK (("status" IN ('preparing','dry_run','drafted','skipped','failed'))),
  CONSTRAINT "wechat_daily_publications_pkey" PRIMARY KEY ("digest_date")
) STRICT;

CREATE TABLE "main__workbench_states" (
  "user_id" TEXT NOT NULL,
  "completed_todo_ids" TEXT NOT NULL DEFAULT ('[]'),
  "custom_todos" TEXT NOT NULL DEFAULT ('[]'),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  "mentor_contacts" TEXT NOT NULL DEFAULT ('[]'),
  CHECK ("completed_todo_ids" IS NULL OR json_valid("completed_todo_ids")),
  CHECK ("custom_todos" IS NULL OR json_valid("custom_todos")),
  CHECK ("mentor_contacts" IS NULL OR json_valid("mentor_contacts")),
  CONSTRAINT "workbench_states_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "workbench_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "main__auth_subjects" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE INDEX "main__admin_operation_logs_created_idx" ON "main__admin_operation_logs" ("created_at" DESC);

CREATE INDEX "main__admin_operation_logs_module_idx" ON "main__admin_operation_logs" ("module","created_at" DESC);

CREATE INDEX "main__admin_users_user_id_idx" ON "main__admin_users" ("user_id");

CREATE INDEX "main__ai_positioning_reports_user_created_idx" ON "main__ai_positioning_reports" ("user_id","created_at" DESC);

CREATE INDEX "main__ai_waitlist_leads_user_id_idx" ON "main__ai_waitlist_leads" ("user_id");

CREATE INDEX "main__applications_project_idx" ON "main__applications" ("project_id");

CREATE INDEX "main__applications_user_idx" ON "main__applications" ("user_id","updated_at" DESC);

CREATE INDEX "main__billing_fill_sessions_expiry_idx" ON "main__billing_fill_sessions" ("expires_at") WHERE ("status" = 'prepared');

CREATE INDEX "main__billing_fill_sessions_usage_idx" ON "main__billing_fill_sessions" ("user_id","tier","consumed_at" DESC) WHERE ("status" = 'consumed');

CREATE INDEX "main__billing_fill_sessions_user_created_idx" ON "main__billing_fill_sessions" ("user_id","created_at" DESC);

CREATE INDEX "main__billing_orders_out_trade_no_idx" ON "main__billing_orders" ("out_trade_no");

CREATE INDEX "main__billing_orders_plan_id_idx" ON "main__billing_orders" ("plan_id");

CREATE UNIQUE INDEX "main__billing_orders_provider_trade_no_idx" ON "main__billing_orders" ("provider","provider_trade_no") WHERE ("provider_trade_no" <> '');

CREATE INDEX "main__billing_orders_status_idx" ON "main__billing_orders" ("status","created_at" DESC);

CREATE INDEX "main__billing_orders_user_created_idx" ON "main__billing_orders" ("user_id","created_at" DESC);

CREATE UNIQUE INDEX "main__billing_orders_user_idempotency_key_idx" ON "main__billing_orders" ("user_id","idempotency_key") WHERE ("idempotency_key" <> '');

CREATE INDEX "main__desktop_download_attempts_created_at_idx" ON "main__desktop_download_attempts" ("created_at" DESC);

CREATE INDEX "main__desktop_download_attempts_release_created_at_idx" ON "main__desktop_download_attempts" ("release_version","created_at" DESC);

CREATE INDEX "main__feedback_reports_status_idx" ON "main__feedback_reports" ("status","created_at" DESC);

CREATE INDEX "main__feedback_reports_user_id_idx" ON "main__feedback_reports" ("user_id");

CREATE INDEX "main__llm_call_logs_created_at_idx" ON "main__llm_call_logs" ("created_at" DESC);

CREATE INDEX "main__notices_admin_status_idx" ON "main__notices" ("admin_status","admin_deleted_at");

CREATE INDEX "main__notices_created_by_idx" ON "main__notices" ("created_by");

CREATE INDEX "main__notices_public_deadline_v2_idx" ON "main__notices" ("year","deadline_date","id") WHERE (("is_private" = 0) AND ("admin_status" = 'published') AND ("admin_deleted_at" IS NULL));

CREATE INDEX "main__notices_public_feed_v2_idx" ON "main__notices" ("year","publish_date" DESC,"id") WHERE (("is_private" = 0) AND ("admin_status" = 'published') AND ("admin_deleted_at" IS NULL));

CREATE INDEX "main__notices_publish_date_idx" ON "main__notices" ("publish_date" DESC);

CREATE INDEX "main__notices_source_site_idx" ON "main__notices" ("source_site");

CREATE INDEX "main__notices_year_deadline_idx" ON "main__notices" ("year","deadline_date");

CREATE INDEX "main__offer_comments_public_idx" ON "main__offer_comments" ("post_id","review_status","created_at") WHERE (("hidden_at" IS NULL) AND ("deleted_at" IS NULL));

CREATE INDEX "main__offer_comments_user_idx" ON "main__offer_comments" ("user_id","created_at" DESC);

CREATE INDEX "main__offer_post_follows_user_idx" ON "main__offer_post_follows" ("user_id","created_at" DESC);

CREATE INDEX "main__offer_posts_public_feed_idx" ON "main__offer_posts" ("content_type","review_status","created_at" DESC) WHERE (("hidden_at" IS NULL) AND ("deleted_at" IS NULL));

CREATE INDEX "main__offer_posts_review_status_idx" ON "main__offer_posts" ("review_status","created_at" DESC);

CREATE INDEX "main__offer_posts_user_idx" ON "main__offer_posts" ("user_id","created_at" DESC);

CREATE INDEX "main__site_visit_events_created_idx" ON "main__site_visit_events" ("created_at" DESC);

CREATE INDEX "main__site_visit_events_visitor_created_idx" ON "main__site_visit_events" ("visitor_id","created_at" DESC);

CREATE INDEX "main__site_visitors_first_seen_idx" ON "main__site_visitors" ("first_seen_at" DESC);

CREATE INDEX "main__site_visitors_last_seen_idx" ON "main__site_visitors" ("last_seen_at" DESC);

CREATE INDEX "main__user_entitlements_plan_id_idx" ON "main__user_entitlements" ("plan_id");

CREATE INDEX "main__user_entitlements_source_order_id_idx" ON "main__user_entitlements" ("source_order_id");

CREATE INDEX "main__user_entitlements_status_idx" ON "main__user_entitlements" ("status","expires_at" DESC);

CREATE INDEX "main__wechat_daily_publications_status_created_idx" ON "main__wechat_daily_publications" ("status","created_at" DESC);

CREATE TABLE "autofill__auth_subjects" (id TEXT PRIMARY KEY NOT NULL, created_at TEXT, email_confirmed_at TEXT, banned_until TEXT, deleted_at TEXT) STRICT;

CREATE TABLE "autofill__account_entitlement_devices" (
  "id" TEXT NOT NULL DEFAULT ((lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random()%4)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))))),
  "entitlement_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "install_hash" TEXT NOT NULL,
  "activation_token_hash" TEXT NOT NULL,
  "extension_version" TEXT,
  "browser_family" TEXT,
  "activated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "activated_at__pg_raw" TEXT,
  "last_checked_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "last_checked_at__pg_raw" TEXT,
  "revoked_at" TEXT,
  "revoked_at__pg_raw" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  "metadata" TEXT NOT NULL DEFAULT ('{}'),
  CHECK ("metadata" IS NULL OR json_valid("metadata")),
  CONSTRAINT "account_entitlement_devices_browser_length" CHECK ((("browser_family" IS NULL) OR (length("browser_family") <= 32))),
  CONSTRAINT "account_entitlement_devices_extension_length" CHECK ((("extension_version" IS NULL) OR (length("extension_version") <= 32))),
  CONSTRAINT "account_entitlement_devices_install_hash" CHECK ((length("install_hash")=64 AND "install_hash" NOT GLOB '*[^0-9a-f]*')),
  CONSTRAINT "account_entitlement_devices_metadata_object" CHECK (((CASE json_type("metadata") WHEN 'integer' THEN 'number' WHEN 'real' THEN 'number' WHEN 'text' THEN 'string' WHEN 'true' THEN 'boolean' WHEN 'false' THEN 'boolean' ELSE json_type("metadata") END) = 'object')),
  CONSTRAINT "account_entitlement_devices_token_hash" CHECK ((length("activation_token_hash")=64 AND "activation_token_hash" NOT GLOB '*[^0-9a-f]*')),
  CONSTRAINT "account_entitlement_devices_activation_token_hash_key" UNIQUE ("activation_token_hash"),
  CONSTRAINT "account_entitlement_devices_install_unique" UNIQUE ("entitlement_id","install_hash"),
  CONSTRAINT "account_entitlement_devices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "account_entitlement_devices_owner_fkey" FOREIGN KEY ("entitlement_id","user_id") REFERENCES "autofill__account_entitlements" ("id","user_id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "autofill__account_entitlement_events" (
  "id" INTEGER NOT NULL,
  "entitlement_id" TEXT,
  "grant_id" TEXT,
  "device_id" TEXT,
  "user_id" TEXT,
  "order_id" TEXT,
  "event_type" TEXT NOT NULL,
  "event_data" TEXT NOT NULL DEFAULT ('{}'),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  CHECK ("event_data" IS NULL OR json_valid("event_data")),
  CONSTRAINT "account_entitlement_events_data_object" CHECK (((CASE json_type("event_data") WHEN 'integer' THEN 'number' WHEN 'real' THEN 'number' WHEN 'text' THEN 'string' WHEN 'true' THEN 'boolean' WHEN 'false' THEN 'boolean' ELSE json_type("event_data") END) = 'object')),
  CONSTRAINT "account_entitlement_events_type" CHECK (("event_type" IN ('account_granted','account_refunded','account_expired','account_revoked','device_attached','device_reactivated','device_deactivated','device_revoked'))),
  CONSTRAINT "account_entitlement_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "account_entitlement_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "autofill__account_entitlement_devices" ("id") ON DELETE SET NULL ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT "account_entitlement_events_entitlement_id_fkey" FOREIGN KEY ("entitlement_id") REFERENCES "autofill__account_entitlements" ("id") ON DELETE SET NULL ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT "account_entitlement_events_grant_id_fkey" FOREIGN KEY ("grant_id") REFERENCES "autofill__account_entitlement_grants" ("id") ON DELETE SET NULL ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT "account_entitlement_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "autofill__commercial_orders" ("id") ON DELETE SET NULL ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT "account_entitlement_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "autofill__auth_subjects" ("id") ON DELETE SET NULL ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "autofill__account_entitlement_grants" (
  "id" TEXT NOT NULL DEFAULT ((lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random()%4)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))))),
  "entitlement_id" TEXT,
  "user_id" TEXT,
  "order_id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "duration_days" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT ('active'),
  "previous_valid_until" TEXT NOT NULL,
  "previous_valid_until__pg_raw" TEXT,
  "granted_until" TEXT NOT NULL,
  "granted_until__pg_raw" TEXT,
  "granted_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "granted_at__pg_raw" TEXT,
  "refunded_at" TEXT,
  "refunded_at__pg_raw" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  "metadata" TEXT NOT NULL DEFAULT ('{}'),
  CHECK ("duration_days" BETWEEN -32768 AND 32767),
  CHECK ("metadata" IS NULL OR json_valid("metadata")),
  CONSTRAINT "account_entitlement_grants_duration" CHECK ((("duration_days" >= 1) AND ("duration_days" <= 3650))),
  CONSTRAINT "account_entitlement_grants_metadata_object" CHECK (((CASE json_type("metadata") WHEN 'integer' THEN 'number' WHEN 'real' THEN 'number' WHEN 'text' THEN 'string' WHEN 'true' THEN 'boolean' WHEN 'false' THEN 'boolean' ELSE json_type("metadata") END) = 'object')),
  CONSTRAINT "account_entitlement_grants_plan" CHECK (("plan_id" IN ('pro_30','pro_90','pro_365'))),
  CONSTRAINT "account_entitlement_grants_refund_state" CHECK (((("status" = 'active') AND ("refunded_at" IS NULL)) OR (("status" = 'refunded') AND ("refunded_at" IS NOT NULL)))),
  CONSTRAINT "account_entitlement_grants_status" CHECK (("status" IN ('active','refunded'))),
  CONSTRAINT "account_entitlement_grants_window" CHECK (("granted_until" > "previous_valid_until")),
  CONSTRAINT "account_entitlement_grants_order_id_key" UNIQUE ("order_id"),
  CONSTRAINT "account_entitlement_grants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "account_entitlement_grants_entitlement_id_fkey" FOREIGN KEY ("entitlement_id") REFERENCES "autofill__account_entitlements" ("id") ON DELETE SET NULL ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT "account_entitlement_grants_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "autofill__commercial_orders" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT "account_entitlement_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "autofill__auth_subjects" ("id") ON DELETE SET NULL ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "autofill__account_entitlements" (
  "id" TEXT NOT NULL DEFAULT ((lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random()%4)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))))),
  "user_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT ('expired'),
  "plan_id" TEXT NOT NULL,
  "valid_until" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "valid_until__pg_raw" TEXT,
  "max_devices" INTEGER NOT NULL DEFAULT (2),
  "version" INTEGER NOT NULL DEFAULT (0),
  "source_order_id" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  "metadata" TEXT NOT NULL DEFAULT ('{}'),
  CHECK ("max_devices" BETWEEN -32768 AND 32767),
  CHECK ("metadata" IS NULL OR json_valid("metadata")),
  CONSTRAINT "account_entitlements_device_limit" CHECK ((("max_devices" >= 1) AND ("max_devices" <= 5))),
  CONSTRAINT "account_entitlements_metadata_object" CHECK (((CASE json_type("metadata") WHEN 'integer' THEN 'number' WHEN 'real' THEN 'number' WHEN 'text' THEN 'string' WHEN 'true' THEN 'boolean' WHEN 'false' THEN 'boolean' ELSE json_type("metadata") END) = 'object')),
  CONSTRAINT "account_entitlements_plan" CHECK (("plan_id" IN ('pro_30','pro_90','pro_365'))),
  CONSTRAINT "account_entitlements_status" CHECK (("status" IN ('active','expired','refunded','revoked'))),
  CONSTRAINT "account_entitlements_version" CHECK (("version" >= 0)),
  CONSTRAINT "account_entitlements_id_user_unique" UNIQUE ("id","user_id"),
  CONSTRAINT "account_entitlements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "account_entitlements_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "account_entitlements_source_order_id_fkey" FOREIGN KEY ("source_order_id") REFERENCES "autofill__commercial_orders" ("id") ON DELETE SET NULL ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT "account_entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "autofill__auth_subjects" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "autofill__commercial_orders" (
  "id" TEXT NOT NULL DEFAULT ((lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random()%4)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))))),
  "order_no" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT ('CNY'),
  "status" TEXT NOT NULL DEFAULT ('pending'),
  "payment_provider" TEXT NOT NULL DEFAULT ('manual'),
  "payment_reference" TEXT,
  "contact_type" TEXT NOT NULL,
  "contact_value" TEXT NOT NULL,
  "note" TEXT,
  "license_id" TEXT,
  "consent_at" TEXT NOT NULL,
  "consent_at__pg_raw" TEXT,
  "expires_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z',strftime('%Y-%m-%dT%H:%M:%f000Z','now'),'+7 days')),
  "expires_at__pg_raw" TEXT,
  "paid_at" TEXT,
  "paid_at__pg_raw" TEXT,
  "fulfilled_at" TEXT,
  "fulfilled_at__pg_raw" TEXT,
  "refunded_at" TEXT,
  "refunded_at__pg_raw" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  "metadata" TEXT NOT NULL DEFAULT ('{}'),
  "access_token_hash" TEXT,
  "delivery_code_hash" TEXT,
  "delivery_code_hint" TEXT,
  "delivery_version" INTEGER,
  "user_id" TEXT,
  "delivery_mode" TEXT NOT NULL DEFAULT ('code'),
  CHECK ("amount_cents" BETWEEN -2147483648 AND 2147483647),
  CHECK ("metadata" IS NULL OR json_valid("metadata")),
  CHECK ("delivery_version" BETWEEN -32768 AND 32767),
  CONSTRAINT "commercial_orders_access_token_hash_format" CHECK ((("access_token_hash" IS NULL) OR (length("access_token_hash")=64 AND "access_token_hash" NOT GLOB '*[^0-9a-f]*'))),
  CONSTRAINT "commercial_orders_amount" CHECK ((("amount_cents" >= 100) AND ("amount_cents" <= 1000000))),
  CONSTRAINT "commercial_orders_contact_length" CHECK (((length("contact_value") >= 3) AND (length("contact_value") <= 254))),
  CONSTRAINT "commercial_orders_contact_type" CHECK (("contact_type" IN ('email','wechat','qq'))),
  CONSTRAINT "commercial_orders_currency" CHECK (("currency" IN ('CNY','USD'))),
  CONSTRAINT "commercial_orders_delivery_complete" CHECK (((("delivery_code_hash" IS NULL) AND ("delivery_code_hint" IS NULL) AND ("delivery_version" IS NULL)) OR (("delivery_code_hash" IS NOT NULL) AND ("delivery_code_hint" IS NOT NULL) AND ("delivery_version" = 1)))),
  CONSTRAINT "commercial_orders_delivery_hash_format" CHECK ((("delivery_code_hash" IS NULL) OR (length("delivery_code_hash")=64 AND "delivery_code_hash" NOT GLOB '*[^0-9a-f]*'))),
  CONSTRAINT "commercial_orders_delivery_hint_length" CHECK ((("delivery_code_hint" IS NULL) OR ((length("delivery_code_hint") >= 5) AND (length("delivery_code_hint") <= 24)))),
  CONSTRAINT "commercial_orders_delivery_mode" CHECK (("delivery_mode" IN ('code','account'))),
  CONSTRAINT "commercial_orders_delivery_version" CHECK ((("delivery_version" IS NULL) OR ("delivery_version" = 1))),
  CONSTRAINT "commercial_orders_metadata_object" CHECK (((CASE json_type("metadata") WHEN 'integer' THEN 'number' WHEN 'real' THEN 'number' WHEN 'text' THEN 'string' WHEN 'true' THEN 'boolean' WHEN 'false' THEN 'boolean' ELSE json_type("metadata") END) = 'object')),
  CONSTRAINT "commercial_orders_note_length" CHECK ((("note" IS NULL) OR (length("note") <= 500))),
  CONSTRAINT "commercial_orders_number_format" CHECK ((length("order_no")=18 AND substr("order_no",1,2)='BY' AND substr("order_no",3,8) NOT GLOB '*[^0-9]*' AND substr("order_no",11,8) NOT GLOB '*[^A-Z0-9]*')),
  CONSTRAINT "commercial_orders_plan" CHECK (("plan_id" IN ('pro_30','pro_90','pro_365'))),
  CONSTRAINT "commercial_orders_provider" CHECK (("payment_provider" IN ('manual','stripe','jianpay'))),
  CONSTRAINT "commercial_orders_status" CHECK (("status" IN ('pending','contacted','paid','fulfilled','canceled','expired','refunded'))),
  CONSTRAINT "commercial_orders_order_no_key" UNIQUE ("order_no"),
  CONSTRAINT "commercial_orders_payment_reference_key" UNIQUE ("payment_reference"),
  CONSTRAINT "commercial_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commercial_orders_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "autofill__license_codes" ("id") ON DELETE SET NULL ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT "commercial_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "autofill__auth_subjects" ("id") ON DELETE SET NULL ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "autofill__commercial_payment_events" (
  "id" INTEGER NOT NULL,
  "payment_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "provider_status" INTEGER,
  "payload_hash" TEXT NOT NULL,
  "event_data" TEXT NOT NULL DEFAULT ('{}'),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  CHECK ("provider_status" BETWEEN -32768 AND 32767),
  CHECK ("event_data" IS NULL OR json_valid("event_data")),
  CONSTRAINT "commercial_payment_events_data_object" CHECK (((CASE json_type("event_data") WHEN 'integer' THEN 'number' WHEN 'real' THEN 'number' WHEN 'text' THEN 'string' WHEN 'true' THEN 'boolean' WHEN 'false' THEN 'boolean' ELSE json_type("event_data") END) = 'object')),
  CONSTRAINT "commercial_payment_events_payload_hash" CHECK ((length("payload_hash")=64 AND "payload_hash" NOT GLOB '*[^0-9a-f]*')),
  CONSTRAINT "commercial_payment_events_provider_status" CHECK ((("provider_status" IS NULL) OR (("provider_status" >= 0) AND ("provider_status" <= 4)))),
  CONSTRAINT "commercial_payment_events_source" CHECK (("source" IN ('create','callback','query','refund','operator'))),
  CONSTRAINT "commercial_payment_events_type" CHECK (("event_type" IN ('payment_prepared','payment_created','payment_create_unknown','payment_create_failed','payment_state_changed','payment_succeeded','payment_needs_review','duplicate_payment','refund_prepared','refund_state_changed'))),
  CONSTRAINT "commercial_payment_events_dedupe" UNIQUE ("payment_id","event_type","payload_hash"),
  CONSTRAINT "commercial_payment_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commercial_payment_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "autofill__commercial_orders" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT "commercial_payment_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "autofill__commercial_payments" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "autofill__commercial_payments" (
  "id" TEXT NOT NULL DEFAULT ((lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random()%4)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))))),
  "order_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT ('jianpay'),
  "merchant_order_no" TEXT NOT NULL,
  "provider_order_id" TEXT,
  "pay_method" TEXT NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT ('CNY'),
  "status" TEXT NOT NULL DEFAULT ('creating'),
  "provider_status" INTEGER,
  "pay_url" TEXT,
  "failure_code" TEXT,
  "expires_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z',strftime('%Y-%m-%dT%H:%M:%f000Z','now'),'+00:30:00')),
  "expires_at__pg_raw" TEXT,
  "paid_at" TEXT,
  "paid_at__pg_raw" TEXT,
  "last_queried_at" TEXT,
  "last_queried_at__pg_raw" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  "metadata" TEXT NOT NULL DEFAULT ('{}'),
  CHECK ("amount_cents" BETWEEN -2147483648 AND 2147483647),
  CHECK ("provider_status" BETWEEN -32768 AND 32767),
  CHECK ("metadata" IS NULL OR json_valid("metadata")),
  CONSTRAINT "commercial_payments_amount" CHECK ((("amount_cents" >= 100) AND ("amount_cents" <= 1000000))),
  CONSTRAINT "commercial_payments_currency" CHECK (("currency" = 'CNY')),
  CONSTRAINT "commercial_payments_failure_length" CHECK ((("failure_code" IS NULL) OR (length("failure_code") <= 100))),
  CONSTRAINT "commercial_payments_merchant_order_format" CHECK ((length("merchant_order_no")=23 AND substr("merchant_order_no",1,3)='BYP' AND substr("merchant_order_no",4,8) NOT GLOB '*[^0-9]*' AND substr("merchant_order_no",12,12) NOT GLOB '*[^A-Z0-9]*')),
  CONSTRAINT "commercial_payments_metadata_object" CHECK (((CASE json_type("metadata") WHEN 'integer' THEN 'number' WHEN 'real' THEN 'number' WHEN 'text' THEN 'string' WHEN 'true' THEN 'boolean' WHEN 'false' THEN 'boolean' ELSE json_type("metadata") END) = 'object')),
  CONSTRAINT "commercial_payments_pay_method" CHECK (("pay_method" IN ('wx','alipay'))),
  CONSTRAINT "commercial_payments_pay_url" CHECK ((("pay_url" IS NULL) OR ((length("pay_url") <= 2048) AND (substr("pay_url",1,26)='https://jpay.hzjianban.com' AND (length("pay_url")=26 OR substr("pay_url",27,1) IN ('/','#','?')))))),
  CONSTRAINT "commercial_payments_provider" CHECK (("provider" = 'jianpay')),
  CONSTRAINT "commercial_payments_provider_order_length" CHECK ((("provider_order_id" IS NULL) OR ((length("provider_order_id") >= 6) AND (length("provider_order_id") <= 200)))),
  CONSTRAINT "commercial_payments_provider_status" CHECK ((("provider_status" IS NULL) OR (("provider_status" >= 0) AND ("provider_status" <= 4)))),
  CONSTRAINT "commercial_payments_status" CHECK (("status" IN ('creating','create_unknown','pending','succeeded','failed','closed','needs_review','duplicate_succeeded','refunding','refunded'))),
  CONSTRAINT "commercial_payments_window" CHECK (("expires_at" > "created_at")),
  CONSTRAINT "commercial_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commercial_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "autofill__commercial_orders" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "autofill__commercial_refunds" (
  "id" TEXT NOT NULL DEFAULT ((lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random()%4)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))))),
  "order_id" TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT ('jianpay'),
  "refund_no" TEXT NOT NULL,
  "provider_refund_id" TEXT,
  "amount_cents" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT ('creating'),
  "provider_status" INTEGER,
  "affects_order" INTEGER NOT NULL DEFAULT (1),
  "affects_entitlement" INTEGER NOT NULL DEFAULT (1),
  "reason" TEXT NOT NULL,
  "error_message" TEXT,
  "requested_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "requested_at__pg_raw" TEXT,
  "refunded_at" TEXT,
  "refunded_at__pg_raw" TEXT,
  "last_queried_at" TEXT,
  "last_queried_at__pg_raw" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  "metadata" TEXT NOT NULL DEFAULT ('{}'),
  CHECK ("amount_cents" BETWEEN -2147483648 AND 2147483647),
  CHECK ("provider_status" BETWEEN -32768 AND 32767),
  CHECK ("affects_order" IN (0,1)),
  CHECK ("affects_entitlement" IN (0,1)),
  CHECK ("metadata" IS NULL OR json_valid("metadata")),
  CONSTRAINT "commercial_refunds_amount" CHECK ((("amount_cents" >= 100) AND ("amount_cents" <= 1000000))),
  CONSTRAINT "commercial_refunds_error_length" CHECK ((("error_message" IS NULL) OR (length("error_message") <= 500))),
  CONSTRAINT "commercial_refunds_metadata_object" CHECK (((CASE json_type("metadata") WHEN 'integer' THEN 'number' WHEN 'real' THEN 'number' WHEN 'text' THEN 'string' WHEN 'true' THEN 'boolean' WHEN 'false' THEN 'boolean' ELSE json_type("metadata") END) = 'object')),
  CONSTRAINT "commercial_refunds_number_format" CHECK ((length("refund_no")=23 AND substr("refund_no",1,3)='BYR' AND substr("refund_no",4,8) NOT GLOB '*[^0-9]*' AND substr("refund_no",12,12) NOT GLOB '*[^A-Z0-9]*')),
  CONSTRAINT "commercial_refunds_provider" CHECK (("provider" = 'jianpay')),
  CONSTRAINT "commercial_refunds_provider_id_length" CHECK ((("provider_refund_id" IS NULL) OR ((length("provider_refund_id") >= 6) AND (length("provider_refund_id") <= 200)))),
  CONSTRAINT "commercial_refunds_provider_status" CHECK ((("provider_status" IS NULL) OR (("provider_status" >= 0) AND ("provider_status" <= 3)))),
  CONSTRAINT "commercial_refunds_reason_length" CHECK (((length("reason") >= 3) AND (length("reason") <= 500))),
  CONSTRAINT "commercial_refunds_status" CHECK (("status" IN ('creating','create_unknown','processing','succeeded','failed'))),
  CONSTRAINT "commercial_refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commercial_refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "autofill__commercial_orders" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT "commercial_refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "autofill__commercial_payments" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "autofill__license_activations" (
  "id" TEXT NOT NULL DEFAULT ((lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random()%4)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))))),
  "license_id" TEXT NOT NULL,
  "install_hash" TEXT NOT NULL,
  "activation_token_hash" TEXT NOT NULL,
  "extension_version" TEXT,
  "browser_family" TEXT,
  "activated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "activated_at__pg_raw" TEXT,
  "last_checked_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "last_checked_at__pg_raw" TEXT,
  "revoked_at" TEXT,
  "revoked_at__pg_raw" TEXT,
  CONSTRAINT "license_activations_browser_length" CHECK ((("browser_family" IS NULL) OR (length("browser_family") <= 32))),
  CONSTRAINT "license_activations_extension_version_length" CHECK ((("extension_version" IS NULL) OR (length("extension_version") <= 32))),
  CONSTRAINT "license_activations_install_hash_format" CHECK ((length("install_hash")=64 AND "install_hash" NOT GLOB '*[^0-9a-f]*')),
  CONSTRAINT "license_activations_token_hash_format" CHECK ((length("activation_token_hash")=64 AND "activation_token_hash" NOT GLOB '*[^0-9a-f]*')),
  CONSTRAINT "license_activations_activation_token_hash_key" UNIQUE ("activation_token_hash"),
  CONSTRAINT "license_activations_license_install_unique" UNIQUE ("license_id","install_hash"),
  CONSTRAINT "license_activations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "license_activations_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "autofill__license_codes" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "autofill__license_codes" (
  "id" TEXT NOT NULL DEFAULT ((lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random()%4)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))))),
  "code_hash" TEXT NOT NULL,
  "code_hint" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "duration_days" INTEGER NOT NULL,
  "max_devices" INTEGER NOT NULL DEFAULT (1),
  "status" TEXT NOT NULL DEFAULT ('active'),
  "batch_id" TEXT NOT NULL DEFAULT ((lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random()%4)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))))),
  "label" TEXT,
  "not_before" TEXT,
  "not_before__pg_raw" TEXT,
  "expires_at" TEXT,
  "expires_at__pg_raw" TEXT,
  "entitlement_expires_at" TEXT,
  "entitlement_expires_at__pg_raw" TEXT,
  "first_redeemed_at" TEXT,
  "first_redeemed_at__pg_raw" TEXT,
  "redemption_count" INTEGER NOT NULL DEFAULT (0),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  "metadata" TEXT NOT NULL DEFAULT ('{}'),
  CHECK ("duration_days" BETWEEN -32768 AND 32767),
  CHECK ("max_devices" BETWEEN -32768 AND 32767),
  CHECK ("redemption_count" BETWEEN -2147483648 AND 2147483647),
  CHECK ("metadata" IS NULL OR json_valid("metadata")),
  CONSTRAINT "license_codes_device_limit" CHECK ((("max_devices" >= 1) AND ("max_devices" <= 5))),
  CONSTRAINT "license_codes_duration" CHECK ((("duration_days" >= 1) AND ("duration_days" <= 3650))),
  CONSTRAINT "license_codes_hash_format" CHECK ((length("code_hash")=64 AND "code_hash" NOT GLOB '*[^0-9a-f]*')),
  CONSTRAINT "license_codes_hint_length" CHECK (((length("code_hint") >= 5) AND (length("code_hint") <= 24))),
  CONSTRAINT "license_codes_label_length" CHECK ((("label" IS NULL) OR (length("label") <= 120))),
  CONSTRAINT "license_codes_metadata_object" CHECK (((CASE json_type("metadata") WHEN 'integer' THEN 'number' WHEN 'real' THEN 'number' WHEN 'text' THEN 'string' WHEN 'true' THEN 'boolean' WHEN 'false' THEN 'boolean' ELSE json_type("metadata") END) = 'object')),
  CONSTRAINT "license_codes_plan" CHECK (("plan_id" IN ('pro_30','pro_90','pro_365','internal_test'))),
  CONSTRAINT "license_codes_redemption_nonnegative" CHECK (("redemption_count" >= 0)),
  CONSTRAINT "license_codes_status" CHECK (("status" IN ('active','disabled','revoked'))),
  CONSTRAINT "license_codes_window" CHECK ((("expires_at" IS NULL) OR ("not_before" IS NULL) OR ("expires_at" > "not_before"))),
  CONSTRAINT "license_codes_code_hash_key" UNIQUE ("code_hash"),
  CONSTRAINT "license_codes_pkey" PRIMARY KEY ("id")
) STRICT;

CREATE TABLE "autofill__license_events" (
  "id" INTEGER NOT NULL,
  "license_id" TEXT,
  "order_id" TEXT,
  "install_hash" TEXT,
  "event_type" TEXT NOT NULL,
  "event_data" TEXT NOT NULL DEFAULT ('{}'),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "created_at__pg_raw" TEXT,
  CHECK ("event_data" IS NULL OR json_valid("event_data")),
  CONSTRAINT "license_events_data_object" CHECK (((CASE json_type("event_data") WHEN 'integer' THEN 'number' WHEN 'real' THEN 'number' WHEN 'text' THEN 'string' WHEN 'true' THEN 'boolean' WHEN 'false' THEN 'boolean' ELSE json_type("event_data") END) = 'object')),
  CONSTRAINT "license_events_install_hash_format" CHECK ((("install_hash" IS NULL) OR (length("install_hash")=64 AND "install_hash" NOT GLOB '*[^0-9a-f]*'))),
  CONSTRAINT "license_events_type" CHECK (("event_type" IN ('issued','activated','reactivated','renewed','renewal_reversed','deactivated','revoked','order_created','order_paid','order_fulfilled','order_refunded'))),
  CONSTRAINT "license_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "license_events_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "autofill__license_codes" ("id") ON DELETE SET NULL ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT "license_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "autofill__commercial_orders" ("id") ON DELETE SET NULL ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE "autofill__license_rate_limits" (
  "key_hash" TEXT NOT NULL,
  "window_started_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "window_started_at__pg_raw" TEXT,
  "attempt_count" INTEGER NOT NULL DEFAULT (0),
  "blocked_until" TEXT,
  "blocked_until__pg_raw" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  CHECK ("attempt_count" BETWEEN -32768 AND 32767),
  CONSTRAINT "license_rate_limits_attempts" CHECK ((("attempt_count" >= 0) AND ("attempt_count" <= 32767))),
  CONSTRAINT "license_rate_limits_key_format" CHECK ((length("key_hash")=64 AND "key_hash" NOT GLOB '*[^0-9a-f]*')),
  CONSTRAINT "license_rate_limits_pkey" PRIMARY KEY ("key_hash")
) STRICT;

CREATE TABLE "autofill__product_links" (
  "key" TEXT NOT NULL,
  "destination_url" TEXT,
  "enabled" INTEGER NOT NULL DEFAULT (0),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  "metadata" TEXT NOT NULL DEFAULT ('{}'),
  CHECK ("enabled" IN (0,1)),
  CHECK ("metadata" IS NULL OR json_valid("metadata")),
  CONSTRAINT "product_links_https" CHECK ((("destination_url" IS NULL) OR ((substr("destination_url",1,8)='https://' AND length("destination_url")>8 AND instr("destination_url",char(9))=0 AND instr("destination_url",char(10))=0 AND instr("destination_url",char(11))=0 AND instr("destination_url",char(12))=0 AND instr("destination_url",char(13))=0 AND instr("destination_url",char(32))=0 AND instr("destination_url",char(133))=0 AND instr("destination_url",char(160))=0 AND instr("destination_url",char(5760))=0 AND instr("destination_url",char(8192))=0 AND instr("destination_url",char(8193))=0 AND instr("destination_url",char(8194))=0 AND instr("destination_url",char(8195))=0 AND instr("destination_url",char(8196))=0 AND instr("destination_url",char(8197))=0 AND instr("destination_url",char(8198))=0 AND instr("destination_url",char(8199))=0 AND instr("destination_url",char(8200))=0 AND instr("destination_url",char(8201))=0 AND instr("destination_url",char(8202))=0 AND instr("destination_url",char(8232))=0 AND instr("destination_url",char(8233))=0 AND instr("destination_url",char(8239))=0 AND instr("destination_url",char(8287))=0 AND instr("destination_url",char(12288))=0) AND ((length("destination_url") >= 12) AND (length("destination_url") <= 500))))),
  CONSTRAINT "product_links_known_key" CHECK (("key" IN ('purchase','homepage','privacy','support'))),
  CONSTRAINT "product_links_metadata_object" CHECK (((CASE json_type("metadata") WHEN 'integer' THEN 'number' WHEN 'real' THEN 'number' WHEN 'text' THEN 'string' WHEN 'true' THEN 'boolean' WHEN 'false' THEN 'boolean' ELSE json_type("metadata") END) = 'object')),
  CONSTRAINT "product_links_pkey" PRIMARY KEY ("key")
) STRICT;

CREATE TABLE "autofill__user_vaults" (
  "user_id" TEXT NOT NULL,
  "encrypted_payload" TEXT NOT NULL,
  "revision" TEXT NOT NULL,
  "schema_version" INTEGER NOT NULL DEFAULT (1),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  "updated_at__pg_raw" TEXT,
  CHECK ("encrypted_payload" IS NULL OR json_valid("encrypted_payload")),
  CHECK ("schema_version" BETWEEN -32768 AND 32767),
  CONSTRAINT "user_vaults_payload_algorithm" CHECK ((("encrypted_payload" ->> 'algorithm') = 'AES-GCM-256')),
  CONSTRAINT "user_vaults_payload_is_object" CHECK (((CASE json_type("encrypted_payload") WHEN 'integer' THEN 'number' WHEN 'real' THEN 'number' WHEN 'text' THEN 'string' WHEN 'true' THEN 'boolean' WHEN 'false' THEN 'boolean' ELSE json_type("encrypted_payload") END) = 'object')),
  CONSTRAINT "user_vaults_payload_size" CHECK ((length(CAST("encrypted_payload" AS BLOB)) <= 2000000)),
  CONSTRAINT "user_vaults_schema_version_range" CHECK ((("schema_version" >= 1) AND ("schema_version" <= 32767))),
  CONSTRAINT "user_vaults_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "user_vaults_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "autofill__auth_subjects" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE INDEX "autofill__account_entitlement_devices_entitlement_idx" ON "autofill__account_entitlement_devices" ("entitlement_id");

CREATE INDEX "autofill__account_entitlement_devices_owner_idx" ON "autofill__account_entitlement_devices" ("entitlement_id","user_id");

CREATE INDEX "autofill__account_entitlement_devices_user_active_idx" ON "autofill__account_entitlement_devices" ("user_id","last_checked_at" DESC) WHERE ("revoked_at" IS NULL);

CREATE INDEX "autofill__account_entitlement_events_device_idx" ON "autofill__account_entitlement_events" ("device_id") WHERE ("device_id" IS NOT NULL);

CREATE INDEX "autofill__account_entitlement_events_entitlement_idx" ON "autofill__account_entitlement_events" ("entitlement_id") WHERE ("entitlement_id" IS NOT NULL);

CREATE INDEX "autofill__account_entitlement_events_grant_idx" ON "autofill__account_entitlement_events" ("grant_id") WHERE ("grant_id" IS NOT NULL);

CREATE INDEX "autofill__account_entitlement_events_order_idx" ON "autofill__account_entitlement_events" ("order_id") WHERE ("order_id" IS NOT NULL);

CREATE INDEX "autofill__account_entitlement_events_user_created_idx" ON "autofill__account_entitlement_events" ("user_id","created_at" DESC) WHERE ("user_id" IS NOT NULL);

CREATE INDEX "autofill__account_entitlement_grants_entitlement_created_idx" ON "autofill__account_entitlement_grants" ("entitlement_id","created_at" DESC) WHERE ("entitlement_id" IS NOT NULL);

CREATE INDEX "autofill__account_entitlement_grants_user_created_idx" ON "autofill__account_entitlement_grants" ("user_id","created_at" DESC) WHERE ("user_id" IS NOT NULL);

CREATE INDEX "autofill__account_entitlements_source_order_idx" ON "autofill__account_entitlements" ("source_order_id") WHERE ("source_order_id" IS NOT NULL);

CREATE INDEX "autofill__account_entitlements_status_expiry_idx" ON "autofill__account_entitlements" ("status","valid_until");

CREATE UNIQUE INDEX "autofill__commercial_orders_access_token_hash_idx" ON "autofill__commercial_orders" ("access_token_hash") WHERE ("access_token_hash" IS NOT NULL);

CREATE UNIQUE INDEX "autofill__commercial_orders_delivery_code_hash_idx" ON "autofill__commercial_orders" ("delivery_code_hash") WHERE ("delivery_code_hash" IS NOT NULL);

CREATE INDEX "autofill__commercial_orders_license_id_idx" ON "autofill__commercial_orders" ("license_id") WHERE ("license_id" IS NOT NULL);

CREATE INDEX "autofill__commercial_orders_status_created_idx" ON "autofill__commercial_orders" ("status","created_at" DESC);

CREATE INDEX "autofill__commercial_orders_user_created_idx" ON "autofill__commercial_orders" ("user_id","created_at" DESC) WHERE ("user_id" IS NOT NULL);

CREATE INDEX "autofill__commercial_payment_events_order_created_idx" ON "autofill__commercial_payment_events" ("order_id","created_at" DESC);

CREATE INDEX "autofill__commercial_payment_events_payment_created_idx" ON "autofill__commercial_payment_events" ("payment_id","created_at" DESC);

CREATE INDEX "autofill__commercial_payments_active_order_idx" ON "autofill__commercial_payments" ("order_id","expires_at" DESC) WHERE ("status" IN ('creating','create_unknown','pending'));

CREATE UNIQUE INDEX "autofill__commercial_payments_merchant_order_idx" ON "autofill__commercial_payments" ("provider","merchant_order_no");

CREATE INDEX "autofill__commercial_payments_order_created_idx" ON "autofill__commercial_payments" ("order_id","created_at" DESC);

CREATE UNIQUE INDEX "autofill__commercial_payments_provider_order_idx" ON "autofill__commercial_payments" ("provider","provider_order_id") WHERE ("provider_order_id" IS NOT NULL);

CREATE INDEX "autofill__commercial_refunds_order_created_idx" ON "autofill__commercial_refunds" ("order_id","created_at" DESC);

CREATE INDEX "autofill__commercial_refunds_payment_created_idx" ON "autofill__commercial_refunds" ("payment_id","created_at" DESC);

CREATE UNIQUE INDEX "autofill__commercial_refunds_provider_refund_idx" ON "autofill__commercial_refunds" ("provider","provider_refund_id") WHERE ("provider_refund_id" IS NOT NULL);

CREATE UNIQUE INDEX "autofill__commercial_refunds_refund_no_idx" ON "autofill__commercial_refunds" ("provider","refund_no");

CREATE INDEX "autofill__license_activations_active_install_idx" ON "autofill__license_activations" ("install_hash") WHERE ("revoked_at" IS NULL);

CREATE INDEX "autofill__license_activations_last_checked_idx" ON "autofill__license_activations" ("last_checked_at");

CREATE INDEX "autofill__license_activations_license_id_idx" ON "autofill__license_activations" ("license_id");

CREATE INDEX "autofill__license_events_created_idx" ON "autofill__license_events" ("created_at" DESC);

CREATE INDEX "autofill__license_events_license_id_idx" ON "autofill__license_events" ("license_id") WHERE ("license_id" IS NOT NULL);

CREATE INDEX "autofill__license_events_order_id_idx" ON "autofill__license_events" ("order_id") WHERE ("order_id" IS NOT NULL);

CREATE INDEX "autofill__license_rate_limits_updated_idx" ON "autofill__license_rate_limits" ("updated_at");