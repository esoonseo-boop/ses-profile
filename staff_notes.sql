-- 직원 상담 관리 (영업 CRM과 완전히 분리된 전용 테이블)
-- Supabase 대시보드 > SQL Editor 에 전체를 붙여넣고 Run (한 번만 실행)
-- 전제: proposal_multi_user_branch.sql 이 이미 적용되어 있어야 합니다 (private.my_role() 사용).

-- 1) 직원 (이니셜만 저장)
create table if not exists public.staff_members (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  initials    text not null check (initials ~ '^[A-Za-z0-9ㄱ-ㅎ]{1,6}$'),   -- 한글 완성형(실명) 입력 차단
  rank_title  text check (char_length(rank_title) <= 20),
  duties      text check (char_length(duties) <= 60),
  joined_on   date,
  memo        text check (char_length(memo) <= 200),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (owner_id, initials)
);

-- 2) 상담 이력
create table if not exists public.staff_counsels (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  staff_id     uuid not null references public.staff_members(id) on delete cascade,
  counsel_date date not null,
  kind         text not null check (kind in ('업무','경력','고충','성과','기타')),
  summary      text not null check (char_length(summary) between 1 and 500),
  follow_up    text check (char_length(follow_up) <= 200),
  follow_due   date,
  follow_done  boolean not null default false,
  next_date    date,
  created_at   timestamptz not null default now()
);
create index if not exists staff_members_owner_idx  on public.staff_members(owner_id);
create index if not exists staff_counsels_owner_idx on public.staff_counsels(owner_id);
create index if not exists staff_counsels_staff_idx on public.staff_counsels(staff_id, counsel_date desc);

-- 3) 접근 통제: 로그인한 지점장(총괄/지점 관리자) 본인 데이터만. 비로그인(anon)은 아예 불가.
alter table public.staff_members  enable row level security;
alter table public.staff_counsels enable row level security;
revoke all on public.staff_members  from anon;
revoke all on public.staff_counsels from anon;
grant select, insert, update, delete on public.staff_members, public.staff_counsels to authenticated;

drop policy if exists "own staff"   on public.staff_members;
drop policy if exists "own counsel" on public.staff_counsels;

create policy "own staff" on public.staff_members for all to authenticated
  using      (owner_id = (select auth.uid()) and (select private.my_role()) in ('owner','branch_admin'))
  with check (owner_id = (select auth.uid()) and (select private.my_role()) in ('owner','branch_admin'));

create policy "own counsel" on public.staff_counsels for all to authenticated
  using      (owner_id = (select auth.uid()) and (select private.my_role()) in ('owner','branch_admin'))
  with check (owner_id = (select auth.uid()) and (select private.my_role()) in ('owner','branch_admin')
              and exists (select 1 from public.staff_members m
                          where m.id = staff_id and m.owner_id = (select auth.uid())));
