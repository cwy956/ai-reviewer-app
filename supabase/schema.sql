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

create index if not exists classified_mails_category_idx on classified_mails (category);
create index if not exists mail_send_log_msg_num_idx on mail_send_log (msg_num);
