// =============================================
// Worker مستقل - نسخه اصلاح‌شده برای جلوگیری از خطای undefined
// مناسب برای Cloudflare Pages / Workers
// =============================================

const JWT_SECRET = 'dabestan-super-secret-key-change-this';

// =============================================
// توابع کمکی
// =============================================

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + JWT_SECRET);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function verifyPassword(password, hashed) {
    const newHash = await hashPassword(password);
    return newHash === hashed;
}

function generateToken(payload) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = btoa(JSON.stringify(header));
    const encodedPayload = btoa(JSON.stringify(payload));
    const signature = btoa(
        encodedHeader + '.' + encodedPayload + JWT_SECRET
    );
    return encodedHeader + '.' + encodedPayload + '.' + signature;
}

function verifyToken(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        const [header, payload, signature] = parts;
        const expectedSignature = btoa(header + '.' + payload + JWT_SECRET);
        if (signature !== expectedSignature) return null;
        
        const decoded = JSON.parse(atob(payload));
        if (decoded.exp && Date.now() > decoded.exp) return null;
        
        return decoded;
    } catch {
        return null;
    }
}

// =============================================
// Worker اصلی
// =============================================
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;
        const db = env.DB;

        // =========================================
        // 1. ورود (Login) - اصلاح‌شده
        // =========================================
        if (path === '/api/auth/login' && method === 'POST') {
            try {
                const body = await request.json();
                
                if (!body || typeof body !== 'object') {
                    return new Response(JSON.stringify({ error: 'داده‌های ورودی نامعتبر است' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                const { username, password } = body;

                if (!username || !password) {
                    return new Response(JSON.stringify({ error: 'نام کاربری و رمز عبور الزامی است' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                const user = await db.prepare('SELECT * FROM users WHERE username = ?')
                    .bind(username.toString())
                    .first();
                
                if (!user) {
                    return new Response(JSON.stringify({ error: 'کاربر یافت نشد' }), { 
                        status: 401,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                const isValid = await verifyPassword(password.toString(), user.password);
                if (!isValid) {
                    return new Response(JSON.stringify({ error: 'رمز عبور اشتباه است' }), { 
                        status: 401,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                const token = generateToken({
                    id: user.id,
                    role: user.role,
                    school_id: user.school_id,
                    exp: Date.now() + 7 * 24 * 60 * 60 * 1000
                });

                delete user.password;
                
                return new Response(JSON.stringify({ token, user }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                console.error('Login error:', error);
                return new Response(JSON.stringify({ error: 'خطا در سرور، لطفاً مجدداً تلاش کنید' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // =========================================
        // 2. میدلور تأیید توکن
        // =========================================
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'توکن معتبر نیست' }), { 
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        if (!decoded) {
            return new Response(JSON.stringify({ error: 'توکن منقضی یا نامعتبر' }), { 
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // =========================================
        // 3. APIهای محافظت‌شده (بقیه کدها)
        // =========================================
        // ... (بقیه کدها مانند قبل، بدون تغییر) ...
        // برای جلوگیری از طولانی شدن، بقیه کدها را همان‌طور که قبلاً داشتید قرار دهید.
        // اما مهم این است که بخش Login اصلاح شد.

        // اگر مسیر پیدا نشد
        return new Response(JSON.stringify({ error: 'مسیر نامعتبر' }), { 
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
