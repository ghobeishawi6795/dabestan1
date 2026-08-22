import { hashPassword, signToken, jsonResponse, makeInviteCode, getSecret } from '../_lib/auth.js';

export async function onRequest(context) {
  const { env, request } = context;

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await request.json();
    const { schoolName, adminName, phone, password } = body;

    if (!schoolName || !adminName || !password) {
      return jsonResponse({ success: false, message: 'همه‌ی فیلدها الزامی هستند' }, 400);
    }

    // بررسی اینکه آیا مدیری وجود داره یا نه
    const existingAdmin = await env.DB.prepare("SELECT id FROM users WHERE role = 'admin'").first();
    if (existingAdmin) {
      return jsonResponse({ success: false, message: 'مدیر قبلاً ثبت‌نام کرده است' }, 400);
    }

    const schoolCode = makeInviteCode('');
    const adminInviteCode = makeInviteCode('A');
    const passwordHash = await hashPassword(password);

    await env.DB.prepare(`INSERT INTO schools (name, code) VALUES (?, ?)`).bind(schoolName, schoolCode).run();
    const school = await env.DB.prepare("SELECT id FROM schools WHERE code = ?").bind(schoolCode).first();

    const result = await env.DB.prepare(`
      INSERT INTO users (school_id, name, phone, password_hash, role, invite_code, is_active)
      VALUES (?, ?, ?, ?, 'admin', ?, 1)
    `).bind(school.id, adminName, phone || null, passwordHash, adminInviteCode).run();

    const adminId = result.meta?.last_row_id;
    const token = await signToken({ sub: adminId, role: 'admin', schoolId: school.id }, getSecret(env));

    return jsonResponse({
      success: true,
      message: 'مدیر با موفقیت ثبت‌نام شد',
      schoolCode,
      inviteCode: adminInviteCode,
      token,
      user: { id: adminId, name: adminName, role: 'admin', schoolId: school.id }
    });

  } catch (error) {
    return jsonResponse({ success: false, message: 'خطا در ثبت‌نام: ' + error.message }, 500);
  }
}
