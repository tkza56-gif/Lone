/* =====================================================================
   App.supabase.jsx — คอมโพเนนต์ App เวอร์ชันเชื่อม Supabase

   ไฟล์นี้แทนที่ฟังก์ชัน App() เดิม (เวอร์ชันเก็บข้อมูลในเครื่อง)
   ส่วนคอมโพเนนต์ UI และตรรกะคำนวณทั้งหมด ใช้ของเดิมโดยไม่แก้

   วิธีใช้: ดูหัวข้อ "วิธีประกอบไฟล์" ท้ายไฟล์นี้ และ SUPABASE-INTEGRATION.md
   ===================================================================== */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Wallet, Lock, User, Eye, EyeOff, AlertTriangle, ShieldCheck, KeyRound,
  Building2, CheckCircle2 } from 'lucide-react';

/* ---- จาก supabase-data.js ---- */
import {
  signIn, signOut, getSession, onAuthChange, sendPasswordReset, updateMyPassword,
  getMyMembership, createOrg, listMembers, updateMemberRole, removeMember, inviteMember,
  orgKeyExists, createOrgKey, unlockWithPassphrase, changeOrgPassphrase,
  fetchAllData, upsertDebtor, deleteDebtor as sbDeleteDebtor,
  upsertLoan, deleteLoan as sbDeleteLoan, upsertPayment, deletePayment,
} from './supabase-data';

/* ---- จากไฟล์แอปเดิม (loan-interest-tracker) — export ออกมาใช้ซ้ำ ----
   ต้องเพิ่ม `export` หน้าฟังก์ชน/ตัวแปรเหล่านี้ในไฟล์เดิม (ดูคู่มือท้ายไฟล์) */
import {
  DashboardView, DebtorsView, DebtorDetailView, SettingsView, UsersView,
  BottomNav, Modal, InactivityModal, DebtorForm, LoanForm, PaymentForm,
  UserForm, ShareModal, PrimaryBtn, GhostBtn,
  curYM, ymLabel, fmtMoney, labelCls, inputCls, fontCss,
  AUTO_LOGOUT_MS, WARNING_MS,
} from './loan-interest-tracker';

/* =====================================================================
   หน้าจอเสริมสำหรับเวอร์ชัน Supabase
   ===================================================================== */

/* ---- หน้าเข้าสู่ระบบด้วยอีเมล (แทน LoginScreen เดิมที่ใช้ username) ---- */
function EmailLogin({ onSignedIn }) {
  const [mode, setMode] = useState('login');     // login | forgot
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const doLogin = async () => {
    setErr(''); setBusy(true);
    try {
      await signIn(email.trim(), pw);
      onSignedIn();
    } catch (e) {
      // Supabase คืนข้อความเป็นภาษาอังกฤษ — แปลงให้เป็นไทย
      const m = String(e.message || '');
      setErr(/invalid login/i.test(m) ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
        : /rate limit/i.test(m) ? 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่'
          : m || 'เข้าสู่ระบบไม่สำเร็จ');
    }
    setBusy(false);
  };

  const doForgot = async () => {
    setErr(''); setMsg(''); setBusy(true);
    try {
      await sendPasswordReset(email.trim());
      setMsg('ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว กรุณาตรวจกล่องจดหมาย');
    } catch (e) {
      setErr(String(e.message || 'ส่งอีเมลไม่สำเร็จ'));
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-br from-emerald-800 to-emerald-950">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 mb-4">
            <Wallet size={30} className="text-emerald-200" />
          </div>
          <h1 className="text-2xl font-bold text-white">ระบบจัดการดอกเบี้ยเงินกู้</h1>
          <p className="text-emerald-200/80 text-sm mt-1">
            {mode === 'login' ? 'เข้าสู่ระบบด้วยอีเมล' : 'รีเซ็ตรหัสผ่าน'}
          </p>
        </div>
        <div className="bg-white rounded-3xl shadow-2xl p-6">
          <div className="mb-4">
            <label className={labelCls}>อีเมล</label>
            <div className="relative">
              <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className={inputCls + ' pl-10'} value={email} type="email" autoCapitalize="none"
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (mode === 'login' ? doLogin() : doForgot())} />
            </div>
          </div>
          {mode === 'login' && (
            <div className="mb-2">
              <label className={labelCls}>รหัสผ่าน</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className={inputCls + ' pl-10 pr-10'} type={show ? 'text' : 'password'} value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && doLogin()} />
                <button onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}
          {err && (
            <div className="flex items-center gap-2 text-red-600 text-sm mt-3 bg-red-50 rounded-lg px-3 py-2">
              <AlertTriangle size={15} className="shrink-0" /> {err}
            </div>
          )}
          {msg && (
            <div className="flex items-center gap-2 text-emerald-700 text-sm mt-3 bg-emerald-50 rounded-lg px-3 py-2">
              <CheckCircle2 size={15} className="shrink-0" /> {msg}
            </div>
          )}
          <PrimaryBtn onClick={mode === 'login' ? doLogin : doForgot} disabled={busy}
            className="w-full mt-5 py-3">
            {busy ? 'กำลังดำเนินการ...' : mode === 'login' ? 'เข้าสู่ระบบ' : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}
          </PrimaryBtn>
          <button onClick={() => { setMode(mode === 'login' ? 'forgot' : 'login'); setErr(''); setMsg(''); }}
            className="w-full text-center mt-3 text-sm text-emerald-700 font-medium hover:underline">
            {mode === 'login' ? 'ลืมรหัสผ่าน?' : '← กลับไปหน้าเข้าสู่ระบบ'}
          </button>
          <div className="flex items-center gap-1.5 justify-center mt-3 text-xs text-slate-400 text-center">
            <ShieldCheck size={14} className="shrink-0" /> ข้อมูลเข้ารหัส · ออกจากระบบอัตโนมัติใน 5 นาที
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- หน้าตั้งค่าเริ่มต้น: สร้างองค์กร หรือ ตั้ง/ใส่รหัสผ่านองค์กร ---- */
function OrgSetup({ kind, onCreateOrg, onSetKey, onUnlock, onSignOut, err, busy }) {
  // kind: 'create-org' | 'set-key' | 'unlock'
  const [orgName, setOrgName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [show, setShow] = useState(false);
  const [localErr, setLocalErr] = useState('');

  const titles = {
    'create-org': 'สร้างองค์กรของคุณ',
    'set-key': 'ตั้งรหัสผ่านองค์กร',
    'unlock': 'ปลดล็อกข้อมูล',
  };
  const subtitles = {
    'create-org': 'ตั้งชื่อร้าน/กิจการ เพื่อเริ่มใช้งาน',
    'set-key': 'รหัสนี้ใช้เข้ารหัสข้อมูลทั้งหมด — เก็บไว้ให้ดี หากลืมจะกู้ข้อมูลไม่ได้',
    'unlock': 'ใส่รหัสผ่านองค์กรเพื่อถอดรหัสข้อมูล',
  };

  const submit = () => {
    setLocalErr('');
    if (kind === 'create-org') {
      if (!orgName.trim()) { setLocalErr('กรุณากรอกชื่อองค์กร'); return; }
      onCreateOrg(orgName.trim(), displayName.trim());
    } else if (kind === 'set-key') {
      if (pass.length < 8) { setLocalErr('รหัสผ่านองค์กรต้องยาวอย่างน้อย 8 ตัวอักษร'); return; }
      if (pass !== pass2) { setLocalErr('รหัสผ่านทั้งสองช่องไม่ตรงกัน'); return; }
      onSetKey(pass);
    } else {
      if (!pass) { setLocalErr('กรุณากรอกรหัสผ่านองค์กร'); return; }
      onUnlock(pass);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-br from-emerald-800 to-emerald-950">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 mb-4">
            {kind === 'create-org' ? <Building2 size={28} className="text-emerald-200" />
              : <KeyRound size={28} className="text-emerald-200" />}
          </div>
          <h1 className="text-xl font-bold text-white">{titles[kind]}</h1>
          <p className="text-emerald-200/80 text-sm mt-1 px-2">{subtitles[kind]}</p>
        </div>
        <div className="bg-white rounded-3xl shadow-2xl p-6">
          {kind === 'create-org' && (
            <>
              <div className="mb-3">
                <label className={labelCls}>ชื่อองค์กร / ร้าน *</label>
                <input className={inputCls} value={orgName}
                  onChange={(e) => setOrgName(e.target.value)} placeholder="เช่น ร้านเงินกู้สมหวัง" />
              </div>
              <div className="mb-2">
                <label className={labelCls}>ชื่อของคุณ (ผู้ดูแลระบบ)</label>
                <input className={inputCls} value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)} placeholder="เช่น สมหวัง" />
              </div>
            </>
          )}
          {kind !== 'create-org' && (
            <>
              <div className="mb-3">
                <label className={labelCls}>รหัสผ่านองค์กร</label>
                <div className="relative">
                  <input className={inputCls + ' pr-10'} type={show ? 'text' : 'password'} value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && kind === 'unlock' && submit()}
                    placeholder={kind === 'set-key' ? 'อย่างน้อย 8 ตัวอักษร' : ''} />
                  <button onClick={() => setShow(!show)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              {kind === 'set-key' && (
                <div className="mb-2">
                  <label className={labelCls}>ยืนยันรหัสผ่านองค์กร</label>
                  <input className={inputCls} type={show ? 'text' : 'password'} value={pass2}
                    onChange={(e) => setPass2(e.target.value)} />
                </div>
              )}
            </>
          )}
          {(localErr || err) && (
            <div className="flex items-center gap-2 text-red-600 text-sm mt-3 bg-red-50 rounded-lg px-3 py-2">
              <AlertTriangle size={15} className="shrink-0" /> {localErr || err}
            </div>
          )}
          <PrimaryBtn onClick={submit} disabled={busy} className="w-full mt-5 py-3">
            {busy ? 'กำลังดำเนินการ...'
              : kind === 'create-org' ? 'สร้างองค์กร'
                : kind === 'set-key' ? 'ตั้งรหัสผ่านและเริ่มใช้งาน' : 'ปลดล็อก'}
          </PrimaryBtn>
          <button onClick={onSignOut}
            className="w-full text-center mt-3 text-sm text-slate-500 font-medium hover:underline">
            ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   App — ตัวควบคุมหลัก เวอร์ชัน Supabase
   phase: loading | login | create-org | set-key | unlock | app
   ===================================================================== */
export default function App() {
  const [phase, setPhase] = useState('loading');
  const [data, setData] = useState({ debtors: [] });
  const [membership, setMembership] = useState(null);   // { org_id, role, display_name, ... }
  const [view, setView] = useState('dashboard');
  const [selectedId, setSelectedId] = useState(null);
  const [warn, setWarn] = useState(false);
  const [secLeft, setSecLeft] = useState(60);
  const [setupErr, setSetupErr] = useState('');
  const [busy, setBusy] = useState(false);

  // modal states
  const [debtorForm, setDebtorForm] = useState(null);
  const [loanForm, setLoanForm] = useState(null);
  const [paymentForm, setPaymentForm] = useState(null);
  const [shareDebtor, setShareDebtor] = useState(null);
  const [confirmBox, setConfirmBox] = useState(null);
  const [members, setMembers] = useState([]);
  const [userFormState, setUserFormState] = useState(null);

  const lastActivity = useRef(Date.now());

  /* ---- โหลดข้อมูลใหม่จาก Supabase ---- */
  const reload = useCallback(async () => {
    const d = await fetchAllData();
    setData(d);
  }, []);

  /* ---- ตัดสินใจว่าจะไปหน้าไหนหลังล็อกอิน ---- */
  const routeAfterAuth = useCallback(async () => {
    const m = await getMyMembership();
    if (!m) { setPhase('create-org'); return; }
    setMembership(m);
    const hasKey = await orgKeyExists(m.org_id);
    if (!hasKey) { setPhase('set-key'); return; }
    setPhase('unlock');
  }, []);

  /* ---- ตอนเปิดแอป: ตรวจ session เดิม ---- */
  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (session) await routeAfterAuth();
      else setPhase('login');
    })();
    // ฟังการเปลี่ยนสถานะ auth (เช่น โทเค็นหมดอายุ)
    const { data: sub } = onAuthChange((session) => {
      if (!session) { setPhase('login'); setData({ debtors: [] }); }
    });
    return () => sub?.subscription?.unsubscribe();
  }, [routeAfterAuth]);

  /* ---- ออกจากระบบอัตโนมัติเมื่อไม่มีการใช้งาน ---- */
  useEffect(() => {
    if (phase !== 'app') return;
    const bump = () => { lastActivity.current = Date.now(); };
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const timer = setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= AUTO_LOGOUT_MS) { handleSignOut(); }
      else if (idle >= AUTO_LOGOUT_MS - WARNING_MS) {
        setWarn(true);
        setSecLeft(Math.ceil((AUTO_LOGOUT_MS - idle) / 1000));
      } else { setWarn(false); }
    }, 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(timer);
    };
  }, [phase]);

  /* ---- handlers: auth + org setup ---- */
  const handleSignedIn = async () => { await routeAfterAuth(); };

  const handleSignOut = async () => {
    await signOut();
    setWarn(false);
    setData({ debtors: [] });
    setMembership(null);
    setPhase('login');
  };

  const handleCreateOrg = async (orgName, displayName) => {
    setSetupErr(''); setBusy(true);
    try {
      await createOrg(orgName, displayName);
      await routeAfterAuth();
    } catch (e) { setSetupErr(String(e.message || 'สร้างองค์กรไม่สำเร็จ')); }
    setBusy(false);
  };

  const handleSetKey = async (passphrase) => {
    setSetupErr(''); setBusy(true);
    try {
      await createOrgKey(membership.org_id, passphrase);
      await reload();
      lastActivity.current = Date.now();
      setPhase('app');
    } catch (e) { setSetupErr(String(e.message || 'ตั้งรหัสผ่านองค์กรไม่สำเร็จ')); }
    setBusy(false);
  };

  const handleUnlock = async (passphrase) => {
    setSetupErr(''); setBusy(true);
    try {
      await unlockWithPassphrase(membership.org_id, passphrase);
      await reload();
      lastActivity.current = Date.now();
      setPhase('app');
    } catch (e) { setSetupErr(String(e.message || 'ปลดล็อกไม่สำเร็จ')); }
    setBusy(false);
  };

  /* ---- handlers: ข้อมูลลูกหนี้/เงินกู้/การชำระ (เขียนผ่าน Supabase) ----
     ทุกตัวบันทึกขึ้นฐานข้อมูล แล้ว reload() เพื่อให้ state ตรงกับฐานข้อมูล */
  const wrap = (fn) => async (...args) => {
    try { await fn(...args); await reload(); }
    catch (e) { setConfirmBox({ text: 'เกิดข้อผิดพลาด: ' + String(e.message || e), onYes: () => setConfirmBox(null) }); }
  };

  const saveDebtorForm = wrap(async (vals) => {
    await upsertDebtor(membership.org_id, { id: debtorForm.debtor?.id, ...vals });
    setDebtorForm(null);
  });

  const saveLoanForm = wrap(async (vals) => {
    const { debtorId, loan } = loanForm;
    await upsertLoan(membership.org_id, debtorId, { id: loan?.id, ...vals });
    setLoanForm(null);
  });

  const savePayment = wrap(async (vals) => {
    const { loanId, month } = paymentForm;
    await upsertPayment(membership.org_id, loanId, month, vals.amount, vals.date);
    setPaymentForm(null);
  });

  const undoPayment = (debtorId, loanId, month) => {
    setConfirmBox({
      text: `ยกเลิกการบันทึกชำระรอบ ${ymLabel(month)} ?`,
      onYes: wrap(async () => { await deletePayment(loanId, month); setConfirmBox(null); }),
    });
  };

  const removeDebtor = (debtor) => {
    setConfirmBox({
      text: `ลบลูกหนี้ "${debtor.name}" และข้อมูลทั้งหมด?`,
      onYes: wrap(async () => {
        await sbDeleteDebtor(debtor.id);
        setSelectedId(null); setView('debtors'); setConfirmBox(null);
      }),
    });
  };

  const removeLoan = (debtor, loan) => {
    setConfirmBox({
      text: `ลบก้อนเงินกู้ ${fmtMoney(loan.principal)} บาท?`,
      onYes: wrap(async () => { await sbDeleteLoan(loan.id); setConfirmBox(null); }),
    });
  };

  /* ---- handlers: จัดการผู้ใช้ผ่าน Supabase ---- */
  const loadMembers = useCallback(async () => {
    try { setMembers(await listMembers()); } catch (e) { /* เงียบ */ }
  }, []);
  useEffect(() => { if (view === 'users') loadMembers(); }, [view, loadMembers]);

  const saveUserForm = wrap(async (out, formCtx) => {
    // formCtx.mode: 'add' = เชิญ , 'edit' = แก้บทบาท , 'password' = เปลี่ยนรหัสตัวเอง
    if (formCtx.mode === 'add') {
      await inviteMember(out.email, out.name, out.role);
    } else if (formCtx.mode === 'password') {
      await updateMyPassword(out.password);
    } else {
      await updateMemberRole(formCtx.user.memberId, out.role);
    }
    await loadMembers();
  });

  const deleteMember = (m) => {
    setConfirmBox({
      text: `ลบผู้ใช้ "${m.display_name || m.user_id}" ?`,
      onYes: wrap(async () => { await removeMember(m.id); await loadMembers(); setConfirmBox(null); }),
    });
  };

  /* ===================== หน้าจอตามสถานะ ===================== */
  if (phase === 'loading') {
    return (
      <div className="lt-root">
        <style>{fontCss}</style>
        <div className="min-h-screen flex items-center justify-center bg-emerald-950 text-emerald-200">
          กำลังโหลด...
        </div>
      </div>
    );
  }
  if (phase === 'login') {
    return (
      <div className="lt-root"><style>{fontCss}</style>
        <EmailLogin onSignedIn={handleSignedIn} />
      </div>
    );
  }
  if (phase === 'create-org' || phase === 'set-key' || phase === 'unlock') {
    return (
      <div className="lt-root"><style>{fontCss}</style>
        <OrgSetup kind={phase} err={setupErr} busy={busy}
          onCreateOrg={handleCreateOrg} onSetKey={handleSetKey} onUnlock={handleUnlock}
          onSignOut={handleSignOut} />
      </div>
    );
  }

  /* ---- หน้าแอปหลัก ---- */
  const selectedDebtor = data.debtors.find((d) => d.id === selectedId) || null;
  const headerTitle = view === 'dashboard' ? 'หน้าหลัก'
    : view === 'debtors' ? 'รายชื่อลูกหนี้'
      : view === 'settings' ? 'ตั้งค่า'
        : view === 'users' ? 'จัดการผู้ใช้งาน' : '';
  // แปลงข้อมูลสมาชิก Supabase ให้เข้ากับ UsersView/SettingsView เดิม
  const currentUser = {
    name: membership?.display_name || 'ผู้ใช้',
    username: membership?.org_id ? '' : '',
    role: membership?.role || 'staff',
  };
  const usersForView = members.map((m) => ({
    id: m.id, name: m.display_name || '(ไม่มีชื่อ)', username: m.user_id.slice(0, 8),
    role: m.role, memberId: m.id,
  }));

  return (
    <div className="lt-root">
      <style>{fontCss}</style>
      <div className="min-h-screen bg-stone-100 max-w-md mx-auto relative">
        {view !== 'debtor' && view !== 'users' && (
          <div className="bg-gradient-to-br from-emerald-800 to-emerald-950 px-4 pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-emerald-200/70 text-xs">
                  {membership?.organizations?.name || 'ระบบจัดการดอกเบี้ยเงินกู้'}
                </div>
                <h1 className="text-white text-xl font-bold">{headerTitle}</h1>
              </div>
              <div className="h-9 w-9 rounded-full bg-white/10 ring-1 ring-white/20 flex items-center justify-center text-white text-sm font-semibold">
                {currentUser.name.charAt(0)}
              </div>
            </div>
          </div>
        )}

        <div>
          {view === 'dashboard' && (
            <DashboardView data={data} onOpenDebtor={(id) => { setSelectedId(id); setView('debtor'); }} />
          )}
          {view === 'debtors' && (
            <DebtorsView data={data}
              onOpenDebtor={(id) => { setSelectedId(id); setView('debtor'); }}
              onAdd={() => setDebtorForm({ mode: 'add' })} />
          )}
          {view === 'debtor' && selectedDebtor && (
            <DebtorDetailView debtor={selectedDebtor}
              onBack={() => { setView('debtors'); setSelectedId(null); }}
              onEdit={() => setDebtorForm({ mode: 'edit', debtor: selectedDebtor })}
              onDelete={removeDebtor}
              onAddLoan={(d) => setLoanForm({ debtorId: d.id, loan: null })}
              onEditLoan={(d, l) => setLoanForm({ debtorId: d.id, loan: l })}
              onDeleteLoan={removeLoan}
              onRecord={(loanId, month) => setPaymentForm({ debtorId: selectedDebtor.id, loanId, month })}
              onUndo={(loanId, month) => undoPayment(selectedDebtor.id, loanId, month)}
              onShare={(d) => setShareDebtor(d)} />
          )}
          {view === 'settings' && (
            <SettingsView data={{ ...data, users: usersForView }} currentUser={currentUser}
              onLogout={handleSignOut}
              onClearData={() => setConfirmBox({
                text: 'การล้างข้อมูลทั้งหมดทำได้จาก Supabase Dashboard เท่านั้น',
                onYes: () => setConfirmBox(null),
              })}
              onExport={async () => {
                const backup = { debtors: data.debtors, exportedAt: new Date().toISOString() };
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `loan-backup-${curYM()}.json`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              encOK
              onManageUsers={() => setView('users')}
              onRecoveryKey={() => setConfirmBox({
                text: 'เวอร์ชัน Supabase รีเซ็ตรหัสผ่านผ่านอีเมลแทนกุญแจกู้คืน',
                onYes: () => setConfirmBox(null),
              })}
              notifyPerm="default" swReady={false}
              onEnableNotify={() => {}}
              onChangePassword={() => setUserFormState({ mode: 'password', user: currentUser })} />
          )}
          {view === 'users' && (
            <UsersView users={usersForView} currentUser={currentUser}
              onBack={() => setView('settings')}
              onAdd={() => setUserFormState({ mode: 'add' })}
              onEdit={(u) => setUserFormState({ mode: 'edit', user: u })}
              onDelete={(u) => deleteMember(members.find((m) => m.id === u.id))} />
          )}
        </div>

        {view !== 'debtor' && <BottomNav view={view} setView={setView} />}

        {/* โมดัล */}
        <Modal open={!!debtorForm} onClose={() => setDebtorForm(null)}
          title={debtorForm?.mode === 'add' ? 'เพิ่มลูกหนี้' : 'แก้ไขลูกหนี้'}>
          {debtorForm && <DebtorForm initial={debtorForm.debtor} onSave={saveDebtorForm} />}
        </Modal>

        <Modal open={!!loanForm} onClose={() => setLoanForm(null)}
          title={loanForm?.loan ? 'แก้ไขก้อนเงินกู้' : 'เพิ่มก้อนเงินกู้'}>
          {loanForm && <LoanForm initial={loanForm.loan} onSave={saveLoanForm} />}
        </Modal>

        <Modal open={!!paymentForm} onClose={() => setPaymentForm(null)} title="บันทึกการชำระ">
          {paymentForm && (() => {
            const d = data.debtors.find((x) => x.id === paymentForm.debtorId);
            const l = d?.loans.find((x) => x.id === paymentForm.loanId);
            return l ? <PaymentForm loan={l} month={paymentForm.month} onSave={savePayment} /> : null;
          })()}
        </Modal>

        {shareDebtor && <ShareModal debtor={shareDebtor} onClose={() => setShareDebtor(null)} />}

        <UserFormModal />

        {confirmBox && (
          <Modal open onClose={() => setConfirmBox(null)} title="ยืนยัน">
            <div className="space-y-4">
              <p className="text-slate-600">{confirmBox.text}</p>
              <div className="flex gap-2">
                <GhostBtn onClick={() => setConfirmBox(null)} className="flex-1">ยกเลิก</GhostBtn>
                <PrimaryBtn onClick={confirmBox.onYes} className="flex-1">ยืนยัน</PrimaryBtn>
              </div>
            </div>
          </Modal>
        )}

        {warn && (
          <InactivityModal secLeft={secLeft}
            onStay={() => { lastActivity.current = Date.now(); setWarn(false); }}
            onLeave={handleSignOut} />
        )}
      </div>
    </div>
  );

  /* โมดัลฟอร์มผู้ใช้ — แยกเป็นฟังก์ชันในเพื่อเข้าถึง state ได้ */
  function UserFormModal() {
    if (!userFormState) return null;
    return (
      <Modal open onClose={() => setUserFormState(null)}
        title={userFormState.mode === 'add' ? 'เชิญผู้ใช้ใหม่'
          : userFormState.mode === 'password' ? 'เปลี่ยนรหัสผ่าน' : 'แก้ไขผู้ใช้'}>
        <UserForm mode={userFormState.mode} initial={userFormState.user}
          existingUsernames={[]}
          onSave={(out) => saveUserForm(out, userFormState)} />
      </Modal>
    );
  }
}

/* =====================================================================
   วิธีประกอบไฟล์ (ทำใน src/ ของโปรเจกต์ Vite)

   1) ไฟล์เดิม loan-interest-tracker.jsx
      - ลบ `export default` หน้า function App() เดิมออก (เปลี่ยนเป็น
        function App_Local() ไว้เฉย ๆ หรือลบทิ้ง)
      - เพิ่มคำว่า `export` หน้าฟังก์ชัน/ตัวแปรเหล่านี้ เพื่อให้ไฟล์นี้ import ได้:
          DashboardView, DebtorsView, DebtorDetailView, SettingsView,
          UsersView, BottomNav, Modal, InactivityModal, DebtorForm,
          LoanForm, PaymentForm, UserForm, ShareModal, PrimaryBtn, GhostBtn,
          curYM, ymLabel, fmtMoney, labelCls, inputCls, fontCss,
          AUTO_LOGOUT_MS, WARNING_MS
        (ตรรกะคำนวณ loanStats/buildLedger ฯลฯ อยู่ในไฟล์เดิม ใช้ได้เลย
         ไม่ต้อง export เพราะคอมโพเนนต์ที่ export ไปแล้วเรียกใช้เองภายใน)

   2) main.jsx ของโปรเจกต์ ให้ import App จากไฟล์นี้แทนไฟล์เดิม:
          import App from './App.supabase.jsx';

   3) ต้องมี supabase-data.js และ .env อยู่ใน src/ (ดู SUPABASE-INTEGRATION.md)
   ===================================================================== */
