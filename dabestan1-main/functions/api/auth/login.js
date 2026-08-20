import { verifyPassword } from '../../_lib/crypto.js';

export async function onRequest(context) {
  const { env } = context;

  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const body = await context.request.json();
    const { inviteCode, password } = body;

    if (!inviteCode || !password) {
      return new Response(JSON.stringify({
        success: false,
        message: 'کد ورود و رمز عبور الزامی است'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const user = await env.DB.prepare(`
      SELECT * FROM users WHERE invite_code = ?
    `).bind(inviteCode).first();

    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        message: 'کد ورود نامعتبر است'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const passwordOk = await verifyPassword(password, user.password_hash);

    if (!passwordOk) {
      return new Response(JSON.stringify({
        success: false,
        message: 'رمز عبور اشتباه است'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // فعال‌سازی کاربر
    await env.DB.prepare(`
      UPDATE users SET is_active = 1 WHERE id = ?
    `).bind(user.id).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'ورود موفق',
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        schoolId: user.school_id
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'خطا در ورود',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
