/* =====================================================================
   supabase-data.js — ชั้นข้อมูลของแอป (แทนที่ window.storage เดิม)

   หน้าที่
   - เชื่อมต่อ Supabase (ฐานข้อมูล + Auth)
   - เข้ารหัสฟิลด์ละเอียดอ่อนฝั่งเครื่องผู้ใช้ก่อนส่งขึ้นฐานข้อมูล
     และถอดรหัสหลังดึงกลับมา (ฐานข้อมูลเห็นเป็นข้อความสุ่ม)
   - จัดการบัญชีผู้ใช้ผ่าน Supabase Auth (แฮชรหัสผ่าน + รีเซ็ตทางอีเมล)

   วิธีเข้ารหัส (envelope encryption)
   - DEK  = กุญแจสุ่ม AES-256 ใช้เข้ารหัสข้อมูลจริงทุกฟิลด์
   - KEK  = กุญแจที่สร้างจาก "รหัสผ่านองค์กร" ผ่าน PBKDF2
   - ฐานข้อมูลเก็บเฉพาะ DEK ที่ถูกห่อด้วย KEK — ไม่มีกุญแจจริง
   - เปลี่ยนรหัสผ่านองค์กร = ห่อ DEK เดิมใหม่ ไม่ต้องเข้ารหัสข้อมูลใหม่ทั้งหมด
   ===================================================================== */

import { createClient } from '@supabase/supabase-js';

/* ---- ตั้งค่าการเชื่อมต่อ (อ่านจาก .env — ดู SUPABASE-INTEGRATION.md) ---- */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/* =====================================================================
   ส่วนเข้ารหัส (Web Crypto — AES-256-GCM + PBKDF2)
   ===================================================================== */
const enc = new TextEncoder();
const dec = new TextDecoder();
const PBKDF2_ITER = 250000;            // รอบการสร้างกุญแจจากรหัสผ่าน
const VERIFIER_TEXT = 'lt-verify-v1';  // ข้อความตรวจสอบรหัสผ่านองค์กร

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/* กุญแจในหน่วยความจำ — หายเมื่อปิดแอปหรือ lock() */
let _dek = null;       // CryptoKey สำหรับเข้ารหัส/ถอดรหัสฟิลด์
let _dekRaw = null;    // ไบต์ดิบของ DEK (ใช้ตอนเปลี่ยนรหัสผ่านองค์กร)

export function isUnlocked() { return !!_dek; }
export function lock() { _dek = null; _dekRaw = null; }

/* สร้าง KEK จากรหัสผ่านองค์กร */
async function deriveKEK(passphrase, saltBytes) {
  const base = await crypto.subtle.importKey(
    'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITER, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/* เข้ารหัส AES-GCM → คืนสตริง "iv.ciphertext" (base64) */
async function aesEnc(key, bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
  return b64(iv) + '.' + b64(ct);
}
async function aesDec(key, packed) {
  const [ivB, ctB] = String(packed).split('.');
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(ivB) }, key, unb64(ctB));
  return new Uint8Array(pt);
}

/* เข้ารหัส/ถอดรหัสฟิลด์ข้อมูลด้วย DEK */
async function encField(value) {
  if (value === null || value === undefined || value === '') return null;
  if (!_dek) throw new Error('ยังไม่ได้ปลดล็อกกุญแจองค์กร');
  return aesEnc(_dek, enc.encode(String(value)));
}
async function decField(packed) {
  if (packed === null || packed === undefined) return '';
  if (!_dek) throw new Error('ยังไม่ได้ปลดล็อกกุญแจองค์กร');
  return dec.decode(await aesDec(_dek, packed));
}

/* =====================================================================
   กุญแจองค์กร — สร้าง / ปลดล็อก / เปลี่ยนรหัสผ่าน
   ===================================================================== */

/* สร้างกุญแจองค์กรครั้งแรก (เรียกหลังสร้างองค์กร) */
export async function createOrgKey(orgId, passphrase) {
  const dekRaw = crypto.getRandomValues(new Uint8Array(32));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const kek = await deriveKEK(passphrase, salt);
  const wrapped = await aesEnc(kek, dekRaw);
  const verifier = await aesEnc(kek, enc.encode(VERIFIER_TEXT));
  const { error } = await sb.from('org_keys').insert({
    org_id: orgId, wrapped_dek: wrapped, kdf_salt: b64(salt), verifier,
  });
  if (error) throw error;
  _dekRaw = dekRaw;
  _dek = await crypto.subtle.importKey('raw', dekRaw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/* มีกุญแจองค์กรแล้วหรือยัง */
export async function orgKeyExists(orgId) {
  const { data, error } = await sb.from('org_keys')
    .select('org_id').eq('org_id', orgId).maybeSingle();
  if (error) throw error;
  return !!data;
}

/* ปลดล็อกด้วยรหัสผ่านองค์กร — เก็บ DEK ไว้ในหน่วยความจำ */
export async function unlockWithPassphrase(orgId, passphrase) {
  const { data, error } = await sb.from('org_keys')
    .select('*').eq('org_id', orgId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('องค์กรนี้ยังไม่ได้ตั้งกุญแจเข้ารหัส');
  const salt = unb64(data.kdf_salt);
  const kek = await deriveKEK(passphrase, salt);
  // ตรวจรหัสผ่านด้วย verifier ก่อน
  try {
    const v = await aesDec(kek, data.verifier);
    if (dec.decode(v) !== VERIFIER_TEXT) throw new Error('mismatch');
  } catch (e) {
    throw new Error('รหัสผ่านองค์กรไม่ถูกต้อง');
  }
  const dekRaw = await aesDec(kek, data.wrapped_dek);
  _dekRaw = dekRaw;
  _dek = await crypto.subtle.importKey('raw', dekRaw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/* เปลี่ยนรหัสผ่านองค์กร — ห่อ DEK เดิมด้วยรหัสใหม่ (ข้อมูลเดิมไม่ต้องแตะ) */
export async function changeOrgPassphrase(orgId, oldPass, newPass) {
  if (!_dekRaw) await unlockWithPassphrase(orgId, oldPass);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const kek = await deriveKEK(newPass, salt);
  const wrapped = await aesEnc(kek, _dekRaw);
  const verifier = await aesEnc(kek, enc.encode(VERIFIER_TEXT));
  const { error } = await sb.from('org_keys').update({
    wrapped_dek: wrapped, kdf_salt: b64(salt), verifier,
    updated_at: new Date().toISOString(),
  }).eq('org_id', orgId);
  if (error) throw error;
}

/* =====================================================================
   บัญชีผู้ใช้ — ผ่าน Supabase Auth
   (Supabase จัดการแฮชรหัสผ่านแบบ bcrypt, โทเค็น JWT, จำกัดอัตราการล็อกอิน
    และการรีเซ็ตรหัสผ่านทางอีเมลให้เองทั้งหมด)
   ===================================================================== */
export async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
export async function signUp(email, password) {
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}
export async function signOut() {
  lock();
  await sb.auth.signOut();
}
export async function getSession() {
  const { data } = await sb.auth.getSession();
  return data.session;
}
export function onAuthChange(cb) {
  return sb.auth.onAuthStateChange((_event, session) => cb(session));
}
/* ส่งอีเมลลิงก์รีเซ็ตรหัสผ่าน — แทนระบบ "กุญแจกู้คืน USB" เดิม */
export async function sendPasswordReset(email) {
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password',
  });
  if (error) throw error;
}
/* ตั้งรหัสผ่านใหม่ (เรียกหลังผู้ใช้คลิกลิงก์รีเซ็ต หรือเปลี่ยนรหัสเอง) */
export async function updateMyPassword(newPassword) {
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/* =====================================================================
   องค์กร + การเป็นสมาชิก
   ===================================================================== */
export async function getMyMembership() {
  const { data, error } = await sb.from('org_members')
    .select('id, org_id, role, display_name, organizations(name)')
    .maybeSingle();
  if (error) throw error;
  return data;   // { id, org_id, role, display_name, organizations:{name} } หรือ null
}
export async function createOrg(orgName, displayName) {
  const { data, error } = await sb.rpc('create_org', {
    p_name: orgName, p_display_name: displayName,
  });
  if (error) throw error;
  return data;   // org_id
}
export async function listMembers() {
  const { data, error } = await sb.from('org_members')
    .select('id, user_id, role, display_name, created_at')
    .order('created_at');
  if (error) throw error;
  return data;
}
export async function updateMemberRole(memberId, role) {
  const { error } = await sb.from('org_members')
    .update({ role: role === 'admin' ? 'admin' : 'staff' }).eq('id', memberId);
  if (error) throw error;
}
export async function removeMember(memberId) {
  const { error } = await sb.from('org_members').delete().eq('id', memberId);
  if (error) throw error;
}
/* เชิญสมาชิกใหม่ — ผ่าน Edge Function (ต้องใช้สิทธิ์ฝั่งเซิร์ฟเวอร์) */
export async function inviteMember(email, displayName, role) {
  const { data, error } = await sb.functions.invoke('invite-member', {
    body: { email, displayName, role },
  });
  if (error) throw error;
  return data;
}

/* =====================================================================
   ข้อมูลลูกหนี้ / เงินกู้ / การชำระ — เข้ารหัสอัตโนมัติทุกฟิลด์ละเอียดอ่อน
   ===================================================================== */

/* ดึงข้อมูลทั้งหมดขององค์กร แล้วประกอบเป็นโครงสร้างเดียวกับที่แอปเคยใช้:
   { debtors: [ { id,name,phone,note,loans:[ { ...,payments:{} } ] } ] } */
export async function fetchAllData() {
  const [dRes, lRes, pRes] = await Promise.all([
    sb.from('debtors').select('*').order('created_at'),
    sb.from('loans').select('*').order('created_at'),
    sb.from('payments').select('*'),
  ]);
  if (dRes.error) throw dRes.error;
  if (lRes.error) throw lRes.error;
  if (pRes.error) throw pRes.error;

  // การชำระ จัดกลุ่มตามก้อนเงินกู้
  const payByLoan = {};
  for (const p of pRes.data) {
    if (!payByLoan[p.loan_id]) payByLoan[p.loan_id] = {};
    payByLoan[p.loan_id][p.ym] = {
      amount: Number(await decField(p.amount_enc)) || 0,
      date: p.paid_date,
    };
  }
  // เงินกู้ จัดกลุ่มตามลูกหนี้
  const loansByDebtor = {};
  for (const l of lRes.data) {
    if (!loansByDebtor[l.debtor_id]) loansByDebtor[l.debtor_id] = [];
    loansByDebtor[l.debtor_id].push({
      id: l.id,
      type: l.loan_type,
      principal: Number(await decField(l.principal_enc)) || 0,
      rate: Number(l.rate) || 0,
      installment: l.installment_enc ? (Number(await decField(l.installment_enc)) || 0) : 0,
      payment: l.payment_enc ? (Number(await decField(l.payment_enc)) || 0) : 0,
      startMonth: l.start_month,
      note: l.note_enc ? await decField(l.note_enc) : '',
      payments: payByLoan[l.id] || {},
    });
  }
  // ลูกหนี้
  const debtors = [];
  for (const d of dRes.data) {
    debtors.push({
      id: d.id,
      name: await decField(d.name_enc),
      phone: d.phone_enc ? await decField(d.phone_enc) : '',
      note: d.note_enc ? await decField(d.note_enc) : '',
      createdAt: d.created_at,
      loans: loansByDebtor[d.id] || [],
    });
  }
  return { debtors };
}

/* เพิ่ม/แก้ไขลูกหนี้ — คืน id */
export async function upsertDebtor(orgId, debtor) {
  const row = {
    org_id: orgId,
    name_enc: await encField(debtor.name),
    phone_enc: await encField(debtor.phone),
    note_enc: await encField(debtor.note),
  };
  if (debtor.id) {
    const { data, error } = await sb.from('debtors')
      .update(row).eq('id', debtor.id).select('id').single();
    if (error) throw error;
    return data.id;
  }
  const { data, error } = await sb.from('debtors')
    .insert(row).select('id').single();
  if (error) throw error;
  return data.id;
}
export async function deleteDebtor(id) {
  const { error } = await sb.from('debtors').delete().eq('id', id);
  if (error) throw error;
}

/* เพิ่ม/แก้ไขก้อนเงินกู้ — คืน id */
export async function upsertLoan(orgId, debtorId, loan) {
  const row = {
    org_id: orgId,
    debtor_id: debtorId,
    loan_type: loan.type,
    principal_enc: await encField(loan.principal),
    rate: Number(loan.rate) || 0,
    installment_enc: loan.installment ? await encField(loan.installment) : null,
    payment_enc: loan.payment ? await encField(loan.payment) : null,
    start_month: loan.startMonth,
    note_enc: await encField(loan.note),
  };
  if (loan.id) {
    const { data, error } = await sb.from('loans')
      .update(row).eq('id', loan.id).select('id').single();
    if (error) throw error;
    return data.id;
  }
  const { data, error } = await sb.from('loans')
    .insert(row).select('id').single();
  if (error) throw error;
  return data.id;
}
export async function deleteLoan(id) {
  const { error } = await sb.from('loans').delete().eq('id', id);
  if (error) throw error;
}

/* บันทึก/แก้ไขการชำระของงวด (ym) — เขียนทับงวดเดิมถ้ามี */
export async function upsertPayment(orgId, loanId, ym, amount, paidDate) {
  const row = {
    org_id: orgId,
    loan_id: loanId,
    ym,
    amount_enc: await encField(amount),
    paid_date: paidDate,
  };
  const { error } = await sb.from('payments')
    .upsert(row, { onConflict: 'loan_id,ym' });
  if (error) throw error;
}
export async function deletePayment(loanId, ym) {
  const { error } = await sb.from('payments')
    .delete().eq('loan_id', loanId).eq('ym', ym);
  if (error) throw error;
}
