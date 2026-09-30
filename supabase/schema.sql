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

-- IR 메일에 대한 AI 심사역 평가 결과 (/ir-deals에서 첨부파일을 골라 평가를 돌리면 여기 쌓임).
-- 같은 메일을 다시 평가하면 새 행이 추가됨(이력 보존) — 목록 화면은 msg_num별 최신 1건만 보여줌.
create table if not exists mail_evaluations (
  id bigserial primary key,
  msg_num integer not null,
  attachment_index integer not null,
  attachment_filename text not null,
  domain_id text not null,
  persona_id text not null,
  persona_name text not null,
  report jsonb not null,
  evaluated_at timestamptz not null default now()
);

create index if not exists mail_evaluations_msg_num_idx on mail_evaluations (msg_num);

create index if not exists classified_mails_category_idx on classified_mails (category);
create index if not exists mail_send_log_msg_num_idx on mail_send_log (msg_num);
