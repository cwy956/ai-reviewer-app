-- Run this once in Supabase SQL Editor (project → SQL Editor → New query → paste → Run).
-- Replaces the file-based JSON storage (lib/personas/*.json, lib/mail/*.json) with real tables.

-- 심사역 정보 + 온보딩 데이터
create table if not exists personas (
  id text primary key,
  name text not null,
  affiliation text not null,
  bio text not null default '',
  email text,
  portfolio jsonb not null default '[]',
  is_default boolean not null default false,
  seven_principles jsonb,
  domain_criteria jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

-- AI가 분류한 메일 (백로그 일괄 처리 + 신규 메일 감시 공통) — msg_num당 최신 분류 결과 1건만 유지
create table if not exists classified_mails (
  msg_num integer primary key,
  subject text not null,
  from_address text not null,
  mail_date timestamptz,
  has_attachment boolean not null default false,
  snippet text default '',
  category text not null,
  reason text default '',
  priority text not null default '낮음',
  domain_id text,
  processed_at timestamptz not null default now()
);

-- 이메일 알림 발송 이력 (누구에게 언제 무슨 메일이 갔는지, 발송 대시보드용)
create table if not exists mail_send_log (
  id bigserial primary key,
  msg_num integer not null,
  subject text not null,
  category text not null,
  domain_id text,
  recipient_email text not null,
  recipient_name text,
  sent_at timestamptz not null default now(),
  status text not null,
  error text
);

-- 신규 메일 감시 기준점 (단일 행)
create table if not exists mail_watch_state (
  id smallint primary key default 1,
  last_alerted_count integer not null,
  last_checked_at timestamptz not null default now(),
  last_alerted_at timestamptz,
  constraint mail_watch_state_singleton check (id = 1)
);

-- 진행 중인 백로그 Batch API 작업 (단일 행 — 완료되면 삭제됨)
create table if not exists mail_backlog_pending (
  id smallint primary key default 1,
  batch_id text not null,
  submitted_at timestamptz not null default now(),
  total_in_mailbox integer not null,
  mails jsonb not null,
  constraint mail_backlog_pending_singleton check (id = 1)
);

-- 마지막 백로그 일괄 처리 완료 시점 메타데이터 (실제 메일 데이터는 classified_mails에 있음)
create table if not exists mail_backlog_meta (
  id smallint primary key default 1,
  processed_at timestamptz not null default now(),
  total_in_mailbox integer not null,
  constraint mail_backlog_meta_singleton check (id = 1)
);

-- 관리팀 구성원 (정부지원사업·협업제안·기타 메일을 받는 사람들 — 온보딩 페이지에서 등록·삭제)
create table if not exists admin_team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

-- IR에 대한 AI 심사역 평가 결과. 출처가 둘 있음:
--   source='mail'     — 공용 메일함으로 들어온 IR (msg_num 있음, /ir-deals에서 평가하거나
--                        메일 자동 감시가 새 IR을 감지하면 기본 AI 심사역으로 자동 평가함).
--                        같은 메일을 다시 평가하면 새 행 추가(이력 보존) — 목록은 msg_num별
--                        최신 1건만 보여줌.
--   source='platform' — 공개 IR 평가 페이지(/)에 스타트업이 직접 업로드해서 즉시 평가된 것
--                        (msg_num 없음, company_name 있음). 제출마다 항상 새 행.
-- ⚠ 기존에 mail_evaluations로 만들어져 있던 프로젝트는 이 CREATE TABLE 대신 아래 마이그레이션을
--   실행해야 함 (Supabase SQL Editor에서 한 번만):
--
--   alter table mail_evaluations rename to ir_evaluations;
--   alter table ir_evaluations add column if not exists source text not null default 'mail';
--   alter table ir_evaluations add constraint ir_evaluations_source_check check (source in ('mail','platform'));
--   alter table ir_evaluations add column if not exists company_name text;
--   alter table ir_evaluations alter column msg_num drop not null;
--
create table if not exists ir_evaluations (
  id bigserial primary key,
  source text not null check (source in ('mail', 'platform')),
  msg_num integer,
  company_name text,
  attachment_index integer not null default 0,
  attachment_filename text not null,
  domain_id text not null,
  persona_id text not null,
  persona_name text not null,
  report jsonb not null,
  evaluated_at timestamptz not null default now()
);

create index if not exists ir_evaluations_msg_num_idx on ir_evaluations (msg_num);
create index if not exists ir_evaluations_source_idx on ir_evaluations (source);

create index if not exists classified_mails_category_idx on classified_mails (category);
create index if not exists mail_send_log_msg_num_idx on mail_send_log (msg_num);
