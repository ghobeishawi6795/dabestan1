import { verifyPassword, signToken, jsonResponse, getSecret } from '../_lib/auth.js';

export async function onRequest(context) {
  const { env, request } = context;

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await request.json();
    const { inviteCode, password } = body;

    if (!inviteCode || !password) {
      return jsonResponse({ success: false, message: 'کد ورود و رمز عبور الزامی است' }, 400);
    }

    const user = await env.DB.prepare(`SELECT * FROM users WHERE invite_code = ?`).bind(inviteCode).first();

    if (!user) {
      return jsonResponse({ success: false, message: 'کد ورود نامعتبر است' }, 404);
    }

    const isCorrect = await verifyPassword(password, user.password_hash);
    if (!isCorrect) {
      return jsonResponse({ success: false, message: 'رمز عبور اشتباه است' }, 401);
    }

    await env.DB.prepare(`UPDATE users SET is_active = 1 WHERE id = ?`).bind(user.id).run();

    const token = await signToken(
      { sub: user.id, role: user.role, schoolId: user.school_id },
      getSecret(env)
    );

    return jsonResponse({
      success: true,
      message: 'ورود موفق',
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        schoolId: user.school_id,
        classId: user.class_id
      }
    });

  } catch (error) {
    return jsonResponse({ success: false, message: 'خطا در ورود: ' + error.message }, 500);
  }
}
