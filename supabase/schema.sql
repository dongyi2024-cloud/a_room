create extension if not exists "pgcrypto";
create extension if not exists vector;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  author text,
  description text,
  language text,
  cover_url text,
  source_file_name text not null,
  source_file_type text not null,
  source_storage_path text not null,
  import_status text not null default 'processing' check (import_status in ('processing', 'ready', 'failed')),
  import_error text,
  rag_status text not null default 'pending' check (rag_status in ('pending', 'processing', 'ready', 'partial', 'failed')),
  rag_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.books
  add column if not exists rag_status text not null default 'pending' check (rag_status in ('pending', 'processing', 'ready', 'partial', 'failed'));

alter table public.books
  add column if not exists rag_error text;

create table if not exists public.user_bookshelves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, book_id)
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  title text,
  order_index integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.paragraphs (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  order_index integer not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.smart_marks (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  paragraph_id uuid not null references public.paragraphs (id) on delete cascade,
  target_text text not null,
  mark_type text not null check (
    mark_type in (
      'difficult-term',
      'background',
      'person',
      'place',
      'historical-context',
      'literary-allusion',
      'abstract-concept',
      'author-keyword'
    )
  ),
  explanation text,
  start_offset integer not null check (start_offset >= 0),
  end_offset integer not null check (end_offset > start_offset),
  confidence double precision not null default 0 check (confidence >= 0 and confidence <= 1),
  source text not null default 'rule-lexicon',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, paragraph_id, start_offset, end_offset, target_text, source)
);

create table if not exists public.smart_mark_jobs (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  chapter_id uuid references public.chapters (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'failed')),
  total_paragraphs integer not null default 0 check (total_paragraphs >= 0),
  processed_paragraphs integer not null default 0 check (processed_paragraphs >= 0),
  inserted_marks integer not null default 0 check (inserted_marks >= 0),
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.smart_marks
  add column if not exists confidence double precision not null default 0 check (confidence >= 0 and confidence <= 1);

alter table public.smart_marks
  add column if not exists source text not null default 'rule-lexicon';

alter table public.smart_mark_jobs
  add column if not exists inserted_marks integer not null default 0 check (inserted_marks >= 0);

create index if not exists idx_smart_marks_book_chapter_paragraph
on public.smart_marks (book_id, chapter_id, paragraph_id, start_offset);

create index if not exists idx_smart_marks_paragraph_id
on public.smart_marks (paragraph_id, start_offset);

create index if not exists idx_smart_mark_jobs_book_id
on public.smart_mark_jobs (book_id, created_at desc);

create table if not exists public.book_chunks (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  chunk_index integer not null,
  start_paragraph_id uuid not null references public.paragraphs (id) on delete cascade,
  end_paragraph_id uuid not null references public.paragraphs (id) on delete cascade,
  start_paragraph_order integer not null,
  end_paragraph_order integer not null,
  paragraph_count integer not null,
  content text not null,
  embedding vector(1024),
  embedding_model text,
  embedding_status text not null default 'pending' check (embedding_status in ('pending', 'ready', 'failed')),
  embedding_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, chunk_index)
);

alter table public.book_chunks
  add column if not exists embedding vector(1024);

alter table public.book_chunks
  add column if not exists embedding_model text;

alter table public.book_chunks
  add column if not exists embedding_status text not null default 'pending' check (embedding_status in ('pending', 'ready', 'failed'));

alter table public.book_chunks
  add column if not exists embedding_error text;

create index if not exists idx_book_chunks_book_id on public.book_chunks (book_id, chunk_index);
create index if not exists idx_book_chunks_chapter_id on public.book_chunks (chapter_id, chunk_index);
create index if not exists idx_book_chunks_start_paragraph_id on public.book_chunks (start_paragraph_id);
create index if not exists idx_book_chunks_end_paragraph_id on public.book_chunks (end_paragraph_id);
create index if not exists idx_book_chunks_embedding_status on public.book_chunks (book_id, embedding_status);

drop function if exists public.match_book_chunks(uuid, text, uuid, uuid, integer);
create or replace function public.match_book_chunks(
  target_book_id uuid,
  query_embedding_text text,
  target_chapter_id uuid default null,
  target_paragraph_id uuid default null,
  match_count integer default 5
)
returns table (
  chunk_id uuid,
  book_id uuid,
  chapter_id uuid,
  chapter_title text,
  start_paragraph_id uuid,
  end_paragraph_id uuid,
  start_paragraph_order integer,
  end_paragraph_order integer,
  content text,
  similarity double precision
)
language sql
stable
as $$
  with query_vector as (
    select query_embedding_text::vector(1024) as embedding
  )
  select
    bc.id as chunk_id,
    bc.book_id,
    bc.chapter_id,
    ch.title as chapter_title,
    bc.start_paragraph_id,
    bc.end_paragraph_id,
    bc.start_paragraph_order,
    bc.end_paragraph_order,
    bc.content,
    1 - (bc.embedding <=> query_vector.embedding) as similarity
  from public.book_chunks bc
  join public.chapters ch on ch.id = bc.chapter_id
  cross join query_vector
  where bc.book_id = target_book_id
    and bc.embedding is not null
    and bc.embedding_status = 'ready'
    and bc.embedding_model = 'BAAI/bge-m3'
    and (target_chapter_id is null or bc.chapter_id = target_chapter_id)
    and (
      target_paragraph_id is null
      or exists (
        select 1
        from public.paragraphs p
        where p.id = target_paragraph_id
          and p.book_id = bc.book_id
          and p.chapter_id = bc.chapter_id
          and p.order_index between bc.start_paragraph_order and bc.end_paragraph_order
      )
    )
  order by bc.embedding <=> query_vector.embedding, bc.chunk_index asc
  limit greatest(coalesce(match_count, 5), 1);
$$;

create table if not exists public.reflection_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  paragraph_id uuid not null references public.paragraphs (id) on delete cascade,
  content text not null,
  paragraph_excerpt text not null,
  display_name_snapshot text,
  moderation_status text not null default 'visible' check (moderation_status in ('visible', 'pending_review', 'hidden')),
  report_count integer not null default 0 check (report_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reflection_card_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.reflection_cards (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, card_id)
);

create table if not exists public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('ai_answer', 'reflection_card', 'user_content', 'system_issue')),
  target_id text,
  feedback_type text not null check (
    feedback_type in (
      'ai_answer_wrong',
      'citation_inaccurate',
      'inappropriate_content',
      'offensive_or_uncomfortable',
      'bug',
      'other'
    )
  ),
  content text,
  status text not null default 'open' check (status in ('open', 'in_review', 'resolved', 'dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    target_type <> 'reflection_card'
    or nullif(trim(coalesce(target_id, '')), '') is not null
  )
);

create table if not exists public.personal_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  paragraph_id uuid not null references public.paragraphs (id) on delete cascade,
  source_type text not null check (source_type in ('ai_answer', 'smart_mark_explanation', 'selected_text', 'reflection', 'dialogue_summary')),
  source_text text,
  ai_content text,
  note_content text,
  paragraph_excerpt text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    coalesce(nullif(trim(source_text), ''), nullif(trim(ai_content), ''), nullif(trim(note_content), '')) is not null
  )
);

create table if not exists public.user_memory_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  memory_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.user_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  memory_type text not null check (
    memory_type in (
      'explanation_style',
      'interpretive_interest',
      'recurring_question',
      'answer_length',
      'reading_assistance'
    )
  ),
  memory_key text not null,
  content text not null,
  source text not null check (source in ('selection_ai', 'chapter_end_ai', 'reader_behavior', 'manual')),
  source_context jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'deleted', 'rejected')),
  is_enabled boolean not null default true,
  reinforcement_count integer not null default 1 check (reinforcement_count >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, memory_key)
);

create table if not exists public.reading_behavior_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  chapter_id uuid references public.chapters (id) on delete set null,
  paragraph_id uuid references public.paragraphs (id) on delete set null,
  event_type text not null check (
    event_type in (
      'reader_opened',
      'chapter_viewed',
      'progress_saved',
      'page_reopened_without_progress',
      'selection_ai_question',
      'reminder_dismissed'
    )
  ),
  chapter_order integer,
  paragraph_order integer,
  event_metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.reading_slump_rule_configs (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique,
  is_active boolean not null default false,
  enabled_rules jsonb not null default '{}'::jsonb,
  thresholds jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reading_slump_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  status text not null default 'steady' check (status in ('steady', 'at_risk', 'slump')),
  triggered_signals text[] not null default '{}',
  signal_count integer not null default 0 check (signal_count >= 0),
  rule_version integer not null,
  evaluated_at timestamptz not null default now(),
  reminder_suppressed_until timestamptz,
  last_dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book_id)
);

create table if not exists public.academic_recommendation_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  chapter_id uuid references public.chapters (id) on delete set null,
  paragraph_id uuid references public.paragraphs (id) on delete set null,
  chapter_order integer,
  paragraph_order integer,
  cache_key text not null,
  trigger_reasons text[] not null default '{}',
  themes text[] not null default '{}',
  recommendations jsonb not null default '[]'::jsonb,
  source_count integer not null default 0 check (source_count >= 0),
  retrieved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book_id, cache_key)
);

insert into public.reading_slump_rule_configs (version, is_active, enabled_rules, thresholds)
values (
  1,
  true,
  '{
    "inactivity": true,
    "chapter_stagnation": true,
    "repeated_open_without_progress": true,
    "frequent_comprehension_questions": true,
    "low_chapter_completion": true
  }'::jsonb,
  '{
    "inactivityDays": 4,
    "chapterStagnationDays": 3,
    "repeatedOpenCount": 3,
    "repeatedOpenWindowDays": 2,
    "comprehensionQuestionCount": 3,
    "comprehensionQuestionWindowDays": 2,
    "lowCompletionRatio": 0.35,
    "lowCompletionWindowDays": 2,
    "reminderCooldownDays": 5
  }'::jsonb
)
on conflict (version) do update
set is_active = excluded.is_active,
    enabled_rules = excluded.enabled_rules,
    thresholds = excluded.thresholds,
    updated_at = now();

create index if not exists idx_reading_behavior_events_user_book_time
on public.reading_behavior_events (user_id, book_id, occurred_at desc);

create index if not exists idx_reading_behavior_events_type_time
on public.reading_behavior_events (user_id, book_id, event_type, occurred_at desc);

create index if not exists idx_reading_behavior_events_position
on public.reading_behavior_events (book_id, chapter_order, paragraph_order);

create index if not exists idx_reading_slump_rule_configs_active
on public.reading_slump_rule_configs (is_active, version desc);

create index if not exists idx_reading_slump_states_user_book
on public.reading_slump_states (user_id, book_id);

create index if not exists idx_reading_slump_states_status
on public.reading_slump_states (status, evaluated_at desc);

create index if not exists idx_user_memory_settings_user_id
on public.user_memory_settings (user_id);

create index if not exists idx_personal_notes_user_created
on public.personal_notes (user_id, created_at desc);

create index if not exists idx_personal_notes_context
on public.personal_notes (user_id, book_id, chapter_id, paragraph_id, created_at desc);

create index if not exists idx_reflection_cards_moderation
on public.reflection_cards (moderation_status, report_count desc, created_at desc);

create index if not exists idx_feedback_reports_user_created
on public.feedback_reports (user_id, created_at desc);

create index if not exists idx_feedback_reports_target
on public.feedback_reports (target_type, target_id, created_at desc);

create index if not exists idx_feedback_reports_status
on public.feedback_reports (status, created_at desc);

create index if not exists idx_user_memories_user_active
on public.user_memories (user_id, status, is_enabled, updated_at desc);

create index if not exists idx_user_memories_user_type
on public.user_memories (user_id, memory_type, updated_at desc);

create index if not exists idx_academic_recommendation_cache_user_book
on public.academic_recommendation_cache (user_id, book_id, updated_at desc);

create index if not exists idx_academic_recommendation_cache_context
on public.academic_recommendation_cache (book_id, chapter_order, paragraph_order);

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.user_bookshelves enable row level security;
alter table public.chapters enable row level security;
alter table public.paragraphs enable row level security;
alter table public.smart_marks enable row level security;
alter table public.smart_mark_jobs enable row level security;
alter table public.book_chunks enable row level security;
alter table public.reflection_cards enable row level security;
alter table public.reflection_card_likes enable row level security;
alter table public.feedback_reports enable row level security;
alter table public.personal_notes enable row level security;
alter table public.user_memory_settings enable row level security;
alter table public.user_memories enable row level security;
alter table public.reading_behavior_events enable row level security;
alter table public.reading_slump_rule_configs enable row level security;
alter table public.reading_slump_states enable row level security;
alter table public.academic_recommendation_cache enable row level security;

drop policy if exists "profiles owner read write" on public.profiles;
create policy "profiles owner read write"
on public.profiles
for all
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "books authenticated read" on public.books;
drop policy if exists "books owner read" on public.books;
create policy "books owner read"
on public.books
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "books owner write" on public.books;
create policy "books owner write"
on public.books
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "bookshelf owner read write" on public.user_bookshelves;
create policy "bookshelf owner read write"
on public.user_bookshelves
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "chapters authenticated read" on public.chapters;
drop policy if exists "chapters owner read" on public.chapters;
create policy "chapters owner read"
on public.chapters
for select
to authenticated
using (
  exists (
    select 1
    from public.books
    where public.books.id = public.chapters.book_id
      and public.books.user_id = auth.uid()
  )
);

drop policy if exists "paragraphs authenticated read" on public.paragraphs;
drop policy if exists "paragraphs owner read" on public.paragraphs;
create policy "paragraphs owner read"
on public.paragraphs
for select
to authenticated
using (
  exists (
    select 1
    from public.books
    where public.books.id = public.paragraphs.book_id
      and public.books.user_id = auth.uid()
  )
);

drop policy if exists "smart marks owner read" on public.smart_marks;
create policy "smart marks owner read"
on public.smart_marks
for select
to authenticated
using (
  exists (
    select 1
    from public.books
    where public.books.id = public.smart_marks.book_id
      and public.books.user_id = auth.uid()
  )
);

drop policy if exists "smart mark jobs owner read" on public.smart_mark_jobs;
create policy "smart mark jobs owner read"
on public.smart_mark_jobs
for select
to authenticated
using (
  exists (
    select 1
    from public.books
    where public.books.id = public.smart_mark_jobs.book_id
      and public.books.user_id = auth.uid()
  )
);

drop policy if exists "book chunks owner read" on public.book_chunks;
create policy "book chunks owner read"
on public.book_chunks
for select
to authenticated
using (
  exists (
    select 1
    from public.books
    where public.books.id = public.book_chunks.book_id
      and public.books.user_id = auth.uid()
  )
);

drop policy if exists "reflection cards authenticated read" on public.reflection_cards;
create policy "reflection cards authenticated read"
on public.reflection_cards
for select
to authenticated
using (moderation_status <> 'hidden');

drop policy if exists "reflection cards owner write" on public.reflection_cards;
create policy "reflection cards owner write"
on public.reflection_cards
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "reflection card likes authenticated read" on public.reflection_card_likes;
create policy "reflection card likes authenticated read"
on public.reflection_card_likes
for select
to authenticated
using (true);

drop policy if exists "reflection card likes owner write" on public.reflection_card_likes;
create policy "reflection card likes owner write"
on public.reflection_card_likes
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "feedback reports owner read" on public.feedback_reports;
create policy "feedback reports owner read"
on public.feedback_reports
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "feedback reports owner insert" on public.feedback_reports;
create policy "feedback reports owner insert"
on public.feedback_reports
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "personal notes owner read" on public.personal_notes;
create policy "personal notes owner read"
on public.personal_notes
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "personal notes owner write" on public.personal_notes;
create policy "personal notes owner write"
on public.personal_notes
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user memory settings owner read write" on public.user_memory_settings;
create policy "user memory settings owner read write"
on public.user_memory_settings
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user memories owner read write" on public.user_memories;
create policy "user memories owner read write"
on public.user_memories
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "reading behavior events owner read write" on public.reading_behavior_events;
create policy "reading behavior events owner read write"
on public.reading_behavior_events
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "reading slump rule configs authenticated read" on public.reading_slump_rule_configs;
create policy "reading slump rule configs authenticated read"
on public.reading_slump_rule_configs
for select
to authenticated
using (true);

drop policy if exists "reading slump states owner read write" on public.reading_slump_states;
create policy "reading slump states owner read write"
on public.reading_slump_states
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "academic recommendation cache owner read write" on public.academic_recommendation_cache;
create policy "academic recommendation cache owner read write"
on public.academic_recommendation_cache
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('book-files', 'book-files', false)
on conflict (id) do nothing;
