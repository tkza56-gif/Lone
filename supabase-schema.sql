-- =====================================================================
--  ระบบจัดการดอกเบี้ยเงินกู้ — สคีมาฐานข้อมูล Supabase (PostgreSQL)
--  วิธีใช้: คัดลอกทั้งไฟล์ไปวางใน Supabase Dashboard > SQL Editor แล้วกด Run
--
--  ชั้นความปลอดภัยในไฟล์นี้
--   1) Row Level Security (RLS) — ผู้ใช้เห็นเฉพาะข้อมูลขององค์กรตัวเอง
--   2) ฟิลด์ละเอียดอ่อน (ชื่อ/เบอร์/ยอดเงิน/หมายเหตุ) เก็บเป็นค่าที่
--      เข้ารหัสฝั่งเครื่องผู้ใช้แล้ว (ฐานข้อมูลเห็นเป็นข้อความสุ่ม)
--   3) กุญแจเข้ารหัสไม่เคยถูกเก็บเป็นค่าจริง — เก็บเฉพาะรูปแบบที่ถูกห่อ
--      ด้วยรหัสผ่านองค์กร
-- =====================================================================

-- ---- ส่วนขยายที่ต้องใช้ ----
create extension if not exists pgcrypto;     -- ใช้ gen_random_uuid()

-- =====================================================================
--  1) ตาราง
-- =====================================================================

-- องค์กร / ร้าน (แต่ละกิจการปล่อยกู้คือ 1 องค์กร)
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- สมาชิกในองค์กร — เชื่อมผู้ใช้ของ Supabase Auth เข้ากับองค์กร พร้อมบทบาท
create table if not exists public.org_members (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null default 'staff' check (role in ('admin','staff')),
  display_name  text not null default '',
  created_at    timestamptz not null default now(),
  unique (org_id, user_id)
);

-- กุญแจเข้ารหัสข้อมูลขององค์กร (สำหรับเข้ารหัสฝั่งเครื่องผู้ใช้)
-- เก็บเฉพาะ DEK ที่ถูกห่อด้วยรหัสผ่านองค์กร — ไม่มีกุญแจจริงในฐานข้อมูล
create table if not exists public.org_keys (
  org_id       uuid primary key references public.organizations(id) on delete cascade,
  wrapped_dek  text not null,   -- กุญแจข้อมูล (DEK) ที่ถูกเข้ารหัสด้วย KEK
  kdf_salt     text not null,   -- เกลือ PBKDF2 สำหรับสร้าง KEK จากรหัสผ่านองค์กร
  verifier     text not null,   -- ค่าตรวจสอบว่ารหัสผ่านองค์กรถูกต้อง
  updated_at   timestamptz not null default now()
);

-- ลูกหนี้ — ฟิลด์ลงท้าย _enc คือข้อมูลที่ถูกเข้ารหัสฝั่งเครื่องแล้ว
create table if not exists public.debtors (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name_enc    text not null,            -- ชื่อลูกหนี้ (เข้ารหัส)
  phone_enc   text,                     -- เบอร์โทร (เข้ารหัส)
  note_enc    text,                     -- หมายเหตุ (เข้ารหัส)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ก้อนเงินกู้ — รองรับ 3 ชนิด: interest / amortized / installment
create table if not exists public.loans (
  id              uuid primary key default gen_random_uuid(),
  debtor_id       uuid not null references public.debtors(id) on delete cascade,
  org_id          uuid not null references public.organizations(id) on delete cascade,
  loan_type       text not null check (loan_type in ('interest','amortized','installment')),
  principal_enc   text not null,        -- เงินต้น (เข้ารหัส)
  rate            numeric not null default 0,   -- อัตราดอกเบี้ย % (ไม่ละเอียดอ่อน เก็บปกติ)
  installment_enc text,                 -- ยอดผ่อน/เดือน แบบไม่มีดอกเบี้ย (เข้ารหัส)
  payment_enc     text,                 -- ยอดผ่อน/เดือน แบบลดต้นลดดอก (เข้ารหัส)
  start_month     text not null,        -- เดือนเริ่ม 'YYYY-MM'
  note_enc        text,                 -- หมายเหตุ (เข้ารหัส)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- การชำระเงินรายเดือน — 1 แถว = 1 งวด
create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  loan_id     uuid not null references public.loans(id) on delete cascade,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  ym          text not null,            -- รอบบิล 'YYYY-MM'
  amount_enc  text not null,            -- จำนวนเงินที่ชำระ (เข้ารหัส)
  paid_date   date not null,            -- วันที่ชำระ
  created_at  timestamptz not null default now(),
  unique (loan_id, ym)                  -- 1 ก้อน มีได้ 1 การชำระต่อเดือน
);

-- ดัชนีช่วยความเร็วในการค้นหา
create index if not exists idx_org_members_user on public.org_members(user_id);
create index if not exists idx_debtors_org      on public.debtors(org_id);
create index if not exists idx_loans_debtor     on public.loans(debtor_id);
create index if not exists idx_loans_org        on public.loans(org_id);
create index if not exists idx_payments_loan    on public.payments(loan_id);
create index if not exists idx_payments_org     on public.payments(org_id);

-- =====================================================================
--  2) ฟังก์ชันช่วย
--     security definer = ฟังก์ชันทำงานด้วยสิทธิ์เจ้าของ จึงข้าม RLS
--     ภายในตัวเองได้ (ป้องกันการเรียกซ้ำวน) และตั้ง search_path กันการโจมตี
-- =====================================================================

-- คืนรายการ org_id ทั้งหมดที่ผู้ใช้ปัจจุบันเป็นสมาชิก
create or replace function public.user_org_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select org_id from public.org_members where user_id = auth.uid()
$$;

-- ตรวจว่าผู้ใช้ปัจจุบันเป็นผู้ดูแลระบบขององค์กรที่ระบุหรือไม่
create or replace function public.is_org_admin(p_org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.org_members
    where user_id = auth.uid() and org_id = p_org and role = 'admin'
  )
$$;

-- อัปเดตคอลัมน์ updated_at อัตโนมัติทุกครั้งที่แก้แถว
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- บังคับให้ org_id ของ loan ตรงกับ org_id ของ debtor เสมอ (กันข้อมูลข้ามองค์กร)
create or replace function public.sync_loan_org()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from public.debtors where id = new.debtor_id;
  if v_org is null then
    raise exception 'ไม่พบลูกหนี้ของก้อนเงินกู้นี้';
  end if;
  new.org_id := v_org;
  return new;
end $$;

-- บังคับให้ org_id ของ payment ตรงกับ org_id ของ loan เสมอ
create or replace function public.sync_payment_org()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from public.loans where id = new.loan_id;
  if v_org is null then
    raise exception 'ไม่พบก้อนเงินกู้ของการชำระนี้';
  end if;
  new.org_id := v_org;
  return new;
end $$;

-- สร้างองค์กรใหม่ + ตั้งผู้เรียกเป็นผู้ดูแลระบบ (ใช้ตอนสมัครใช้งานครั้งแรก)
create or replace function public.create_org(p_name text, p_display_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน';
  end if;
  insert into public.organizations(name) values (p_name) returning id into v_org;
  insert into public.org_members(org_id, user_id, role, display_name)
    values (v_org, auth.uid(), 'admin', coalesce(p_display_name, ''));
  return v_org;
end $$;

-- =====================================================================
--  3) ทริกเกอร์
-- =====================================================================
drop trigger if exists trg_debtors_touch on public.debtors;
create trigger trg_debtors_touch before update on public.debtors
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_loans_touch on public.loans;
create trigger trg_loans_touch before update on public.loans
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_loans_org on public.loans;
create trigger trg_loans_org before insert or update on public.loans
  for each row execute function public.sync_loan_org();

drop trigger if exists trg_payments_org on public.payments;
create trigger trg_payments_org before insert or update on public.payments
  for each row execute function public.sync_payment_org();

-- =====================================================================
--  4) Row Level Security — เปิดใช้ทุกตาราง
-- =====================================================================
alter table public.organizations enable row level security;
alter table public.org_members   enable row level security;
alter table public.org_keys      enable row level security;
alter table public.debtors       enable row level security;
alter table public.loans         enable row level security;
alter table public.payments      enable row level security;

-- ---- organizations: สมาชิกอ่านได้, ผู้ดูแลแก้ไขได้ ----
-- (การสร้างองค์กรทำผ่านฟังก์ชัน create_org เท่านั้น จึงไม่มีนโยบาย insert)
drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations
  for select using (id in (select public.user_org_ids()));

drop policy if exists org_update on public.organizations;
create policy org_update on public.organizations
  for update using (public.is_org_admin(id));

-- ---- org_members: สมาชิกอ่านรายชื่อกันได้, เฉพาะผู้ดูแลจัดการได้ ----
drop policy if exists members_select on public.org_members;
create policy members_select on public.org_members
  for select using (org_id in (select public.user_org_ids()));

drop policy if exists members_insert on public.org_members;
create policy members_insert on public.org_members
  for insert with check (public.is_org_admin(org_id));

drop policy if exists members_update on public.org_members;
create policy members_update on public.org_members
  for update using (public.is_org_admin(org_id));

drop policy if exists members_delete on public.org_members;
create policy members_delete on public.org_members
  for delete using (public.is_org_admin(org_id));

-- ---- org_keys: สมาชิกอ่านได้ (เพื่อปลดล็อก), เฉพาะผู้ดูแลตั้ง/เปลี่ยนได้ ----
drop policy if exists keys_select on public.org_keys;
create policy keys_select on public.org_keys
  for select using (org_id in (select public.user_org_ids()));

drop policy if exists keys_insert on public.org_keys;
create policy keys_insert on public.org_keys
  for insert with check (public.is_org_admin(org_id));

drop policy if exists keys_update on public.org_keys;
create policy keys_update on public.org_keys
  for update using (public.is_org_admin(org_id));

-- ---- debtors / loans / payments: สมาชิกทุกคนในองค์กรเข้าถึงได้เต็มที่ ----
drop policy if exists debtors_all on public.debtors;
create policy debtors_all on public.debtors
  for all
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

drop policy if exists loans_all on public.loans;
create policy loans_all on public.loans
  for all
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

drop policy if exists payments_all on public.payments;
create policy payments_all on public.payments
  for all
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

-- =====================================================================
--  เสร็จสิ้น
--  ขั้นต่อไป: ดูไฟล์ SUPABASE-INTEGRATION.md เพื่อเชื่อมแอปเข้ากับฐานข้อมูลนี้
-- =====================================================================
