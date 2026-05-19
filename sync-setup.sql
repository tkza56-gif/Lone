-- ตารางเก็บข้อมูลแบบ key-value (เข้ารหัสฝั่งเครื่องก่อนส่งมา)
create table if not exists public.app_store (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
-- เปิด RLS — อนุญาตให้ทุกคนที่มี anon key อ่าน/เขียนได้
-- (ข้อมูลถูกเข้ารหัส AES-256 แล้ว ไม่มีใครอ่านเนื้อหาจริงได้)
alter table public.app_store enable row level security;
drop policy if exists app_store_all on public.app_store;
create policy app_store_all on public.app_store
  for all using (true) with check (true);
