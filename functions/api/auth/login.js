export async function onRequest(context) {
  const { env } = context;
  
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  
  try {
    const body = await context.request.json();
    const { inviteCode, password } = body;
    
    // جستجو با username یا invite_code
    const user = await env.DB.prepare(`
      SELECT * FROM users WHERE username = ? OR invite_code = ?
    `).bind(inviteCode, inviteCode).first();
    
    if (!user) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'کد ورود نامعتبر است' 
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // بررسی رمز عبور (هم plain text و هم hash شده)
    const passwordHash = btoa(password);
    const isPasswordCorrect = (user.password === password) || (user.password_hash === passwordHash) || (user.password === passwordHash);
    
    if (!isPasswordCorrect) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'رمز عبور اشتباه است' 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
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
