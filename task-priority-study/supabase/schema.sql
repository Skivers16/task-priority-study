-- TASK PRIORITY STUDY — Supabase schema
-- Jalankan seluruh file ini di Supabase Dashboard > SQL Editor.
-- Tabel sengaja insert-only dari browser publik. Responden tidak dapat membaca,
-- mengubah, atau menghapus hasil responden lain lewat API publik.

create extension if not exists pgcrypto;

create table if not exists public.study_sessions (
  id uuid primary key,
  participant_code text not null check (char_length(participant_code) between 3 and 40),
  consent boolean not null check (consent = true),
  sequence_plan text not null check (
    sequence_plan in (
      'list-A__gantt-B',
      'list-B__gantt-A',
      'gantt-A__list-B',
      'gantt-B__list-A'
    )
  ),
  started_at timestamptz not null,
  app_version text not null default '1.0.0',
  created_at timestamptz not null default now()
);

create table if not exists public.trial_results (
  id uuid primary key,
  session_id uuid not null references public.study_sessions(id) on delete cascade,
  condition_view text not null check (condition_view in ('list', 'gantt')),
  trial_order smallint not null check (trial_order between 1 and 2),
  task_set text not null check (task_set in ('A', 'B')),
  started_at timestamptz not null,
  submitted_at timestamptz not null,
  duration_ms integer not null check (duration_ms >= 0),
  correct_count smallint not null check (correct_count between 0 and 10),
  total_tasks smallint not null default 10 check (total_tasks = 10),
  accuracy_percent numeric(5,2) not null check (accuracy_percent between 0 and 100),
  answers jsonb not null,
  expected_order jsonb not null,
  created_at timestamptz not null default now(),
  unique (session_id, trial_order),
  unique (session_id, condition_view)
);

create table if not exists public.session_completions (
  session_id uuid primary key references public.study_sessions(id) on delete cascade,
  completed_at timestamptz not null,
  total_trial_duration_ms integer not null check (total_trial_duration_ms >= 0),
  elapsed_session_duration_ms integer not null check (elapsed_session_duration_ms >= 0),
  overall_correct_count smallint not null check (overall_correct_count between 0 and 20),
  overall_task_count smallint not null default 20 check (overall_task_count = 20),
  overall_accuracy_percent numeric(5,2) not null check (overall_accuracy_percent between 0 and 100),
  sequence_plan text not null check (
    sequence_plan in (
      'list-A__gantt-B',
      'list-B__gantt-A',
      'gantt-A__list-B',
      'gantt-B__list-A'
    )
  ),
  created_at timestamptz not null default now()
);

alter table public.study_sessions enable row level security;
alter table public.trial_results enable row level security;
alter table public.session_completions enable row level security;

-- Hapus akses bawaan yang tidak diperlukan, lalu izinkan hanya INSERT bagi anon.
revoke all on table public.study_sessions from public, anon, authenticated;
revoke all on table public.trial_results from public, anon, authenticated;
revoke all on table public.session_completions from public, anon, authenticated;

grant insert on table public.study_sessions to anon;
grant insert on table public.trial_results to anon;
grant insert on table public.session_completions to anon;

drop policy if exists "allow consented session insert" on public.study_sessions;
create policy "allow consented session insert"
on public.study_sessions
for insert to anon
with check (consent = true);

drop policy if exists "allow trial result insert" on public.trial_results;
create policy "allow trial result insert"
on public.trial_results
for insert to anon
with check (
  duration_ms >= 0
  and total_tasks = 10
  and correct_count between 0 and 10
);

drop policy if exists "allow completion insert" on public.session_completions;
create policy "allow completion insert"
on public.session_completions
for insert to anon
with check (
  overall_task_count = 20
  and overall_correct_count between 0 and 20
);

-- Query untuk ekspor hasil lengkap dari SQL Editor.
-- Jalankan query ini setelah data mulai terkumpul; gunakan tombol Download CSV
-- pada hasil query untuk mengunduh dataset.
select
  s.id as session_id,
  s.participant_code,
  s.sequence_plan,
  s.started_at as session_started_at,
  tr.trial_order,
  tr.condition_view,
  tr.task_set,
  tr.started_at as trial_started_at,
  tr.submitted_at,
  tr.duration_ms,
  tr.correct_count,
  tr.total_tasks,
  tr.accuracy_percent,
  tr.answers,
  tr.expected_order,
  sc.completed_at,
  sc.total_trial_duration_ms,
  sc.elapsed_session_duration_ms,
  sc.overall_correct_count,
  sc.overall_task_count,
  sc.overall_accuracy_percent
from public.study_sessions s
left join public.trial_results tr on tr.session_id = s.id
left join public.session_completions sc on sc.session_id = s.id
order by s.started_at, tr.trial_order;
