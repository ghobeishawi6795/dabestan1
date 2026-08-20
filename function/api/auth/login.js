import { verifyPassword } from '../../_lib/crypto.js';

export async function onRequest(context) {
  const { env, request } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'Method not allowed' 
    }), { 
      status: 405, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  try {
    const body = await request.json();
    const inviteCode = body.inviteCode;
    const password = body.password;

    if (!inviteCode || !password) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'کد ورود و رمز عبور الزامی هستند' 
      }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const user = await env.DB.prepare(`
      SELECT id, school_id, name, phone, role, invite_code, is_active, password_hash 
      FROM users 
      WHERE invite_code = ?
    `).bind(inviteCode).first();

    if (!user) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'کد ورود یا رمز عبور اشتباه است' 
      }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    if (user.is_active !== 1) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'حساب کاربری فعال نیست' 
      }), { 
        status: 403, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'کد ورود یا رمز عبور اشتباه است' 
      }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const { password_hash, ...safeUser } = user;

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'ورود موفق',
      user: safeUser 
    }), { 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'خطای سرور: ' + error.message 
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
        }
