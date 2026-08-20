// =============================================
// Worker مستقل - بدون نیاز به npm یا کتابخانه خارجی
// مناسب برای Cloudflare Pages / Workers
// =============================================

// کلید مخفی برای JWT (حتماً در محیط تولید تغییر دهید)
const JWT_SECRET = 'dabestan-super-secret-key-change-this';

// =============================================
// توابع کمکی
// =============================================

// تابع هش کردن رمز عبور با SHA-256 (جایگزین bcrypt)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + JWT_SECRET);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

// تابع مقایسه رمز عبور
async function verifyPassword(password, hashed) {
    const newHash = await hashPassword(password);
    return newHash === hashed;
}

// تابع ساخت JWT ساده (بدون کتابخانه)
function generateToken(payload) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = btoa(JSON.stringify(header));
    const encodedPayload = btoa(JSON.stringify(payload));
    const signature = btoa(
        encodedHeader + '.' + encodedPayload + JWT_SECRET
    );
    return encodedHeader + '.' + encodedPayload + '.' + signature;
}

// تابع بررسی JWT ساده
function verifyToken(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        const [header, payload, signature] = parts;
        const expectedSignature = btoa(header + '.' + payload + JWT_SECRET);
        if (signature !== expectedSignature) return null;
        
        const decoded = JSON.parse(atob(payload));
        // بررسی انقضا
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
        const db = env.DB; // اتصال به D1

        // =========================================
        // 1. ورود (Login) - عمومی
        // =========================================
        if (path === '/api/auth/login' && method === 'POST') {
            try {
                const { username, password } = await request.json();
                
                // پیدا کردن کاربر
                const user = await db.prepare('SELECT * FROM users WHERE username = ?')
                    .bind(username)
                    .first();
                
                if (!user) {
                    return new Response(JSON.stringify({ error: 'کاربر یافت نشد' }), { 
                        status: 401,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // بررسی رمز عبور
                const isValid = await verifyPassword(password, user.password);
                if (!isValid) {
                    return new Response(JSON.stringify({ error: 'رمز عبور اشتباه است' }), { 
                        status: 401,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // تولید توکن
                const token = generateToken({
                    id: user.id,
                    role: user.role,
                    school_id: user.school_id,
                    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 روز
                });

                // حذف رمز از پاسخ
                delete user.password;
                
                return new Response(JSON.stringify({ token, user }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: 'خطا در ورود' }), {
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
        // 3. APIهای محافظت‌شده
        // =========================================

        // ---- ایجاد تکلیف (معلم) ----
        if (path === '/api/teacher/create-task' && method === 'POST') {
            if (decoded.role !== 'teacher') {
                return new Response(JSON.stringify({ error: 'دسترسی غیرمجاز' }), { 
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            try {
                const { title, description, class_id, grade, answer_type, max_score, is_active, deadline } = await request.json();
                
                if (!title || !class_id) {
                    return new Response(JSON.stringify({ error: 'عنوان و کلاس اجباری است' }), { 
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                const result = await db.prepare(`
                    INSERT INTO tasks (title, description, class_id, teacher_id, grade, answer_type, max_score, is_active, deadline)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                    title, 
                    description || '', 
                    parseInt(class_id), 
                    decoded.id, 
                    parseInt(grade) || 0, 
                    answer_type || 'text', 
                    parseInt(max_score) || 100, 
                    is_active !== undefined ? is_active : 1, 
                    deadline || null
                ).run();

                return new Response(JSON.stringify({ 
                    success: true, 
                    taskId: result.lastInsertRowid 
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: 'خطا در ایجاد تکلیف' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // ---- افزودن سؤال به بانک (معلم) ----
        if (path === '/api/teacher/upload-question' && method === 'POST') {
            if (decoded.role !== 'teacher') {
                return new Response(JSON.stringify({ error: 'دسترسی غیرمجاز' }), { 
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            try {
                const { question_text, answer_type, options, correct_answer, difficulty, subject } = await request.json();
                
                if (!question_text) {
                    return new Response(JSON.stringify({ error: 'متن سؤال اجباری است' }), { 
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                await db.prepare(`
                    INSERT INTO question_bank (teacher_id, question_text, answer_type, options, correct_answer, difficulty, subject)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).bind(
                    decoded.id, 
                    question_text, 
                    answer_type || 'text', 
                    options || null, 
                    correct_answer || null, 
                    parseInt(difficulty) || 3, 
                    subject || null
                ).run();

                return new Response(JSON.stringify({ success: true }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: 'خطا در ذخیره سؤال' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // ---- دریافت سؤال‌های بانک (معلم) ----
        if (path === '/api/teacher/get-questions' && method === 'GET') {
            if (decoded.role !== 'teacher') {
                return new Response(JSON.stringify({ error: 'دسترسی غیرمجاز' }), { 
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            try {
                const questions = await db.prepare('SELECT * FROM question_bank WHERE teacher_id = ?')
                    .bind(decoded.id)
                    .all();
                
                return new Response(JSON.stringify(questions.results || []), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: 'خطا در دریافت سؤال‌ها' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // ---- دریافت تکالیف (معلم) ----
        if (path === '/api/teacher/get-tasks' && method === 'GET') {
            if (decoded.role !== 'teacher') {
                return new Response(JSON.stringify({ error: 'دسترسی غیرمجاز' }), { 
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const class_id = url.searchParams.get('class_id');
            if (!class_id) {
                return new Response(JSON.stringify({ error: 'شناسه کلاس الزامی است' }), { 
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            try {
                const tasks = await db.prepare('SELECT * FROM tasks WHERE class_id = ? AND teacher_id = ?')
                    .bind(parseInt(class_id), decoded.id)
                    .all();
                
                return new Response(JSON.stringify(tasks.results || []), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: 'خطا در دریافت تکالیف' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // ---- ثبت پاسخ دانش‌آموز ----
        if (path === '/api/student/submit-answer' && method === 'POST') {
            if (decoded.role !== 'student') {
                return new Response(JSON.stringify({ error: 'دسترسی غیرمجاز' }), { 
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            try {
                const { task_id, answer_text, answer_file_url } = await request.json();
                if (!task_id) {
                    return new Response(JSON.stringify({ error: 'شناسه تکلیف الزامی است' }), { 
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                await db.prepare(`
                    INSERT INTO submissions (task_id, student_id, answer_text, answer_file_url)
                    VALUES (?, ?, ?, ?)
                `).bind(parseInt(task_id), decoded.id, answer_text || null, answer_file_url || null).run();

                return new Response(JSON.stringify({ success: true }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: 'خطا در ثبت پاسخ' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // ---- دریافت پاسخ‌های یک تکلیف (معلم) ----
        if (path === '/api/teacher/get-submissions' && method === 'GET') {
            if (decoded.role !== 'teacher') {
                return new Response(JSON.stringify({ error: 'دسترسی غیرمجاز' }), { 
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const task_id = url.searchParams.get('task_id');
            if (!task_id) {
                return new Response(JSON.stringify({ error: 'شناسه تکلیف الزامی است' }), { 
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            try {
                const submissions = await db.prepare(`
                    SELECT s.*, u.full_name as student_name 
                    FROM submissions s
                    JOIN users u ON s.student_id = u.id
                    WHERE s.task_id = ?
                `).bind(parseInt(task_id)).all();

                return new Response(JSON.stringify(submissions.results || []), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: 'خطا در دریافت پاسخ‌ها' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // ---- ذخیره نمره و بازخورد (معلم) ----
        if (path === '/api/teacher/review-submission' && method === 'POST') {
            if (decoded.role !== 'teacher') {
                return new Response(JSON.stringify({ error: 'دسترسی غیرمجاز' }), { 
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            try {
                const { submission_id, score, feedback, status } = await request.json();
                if (!submission_id) {
                    return new Response(JSON.stringify({ error: 'شناسه پاسخ الزامی است' }), { 
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                await db.prepare(`
                    UPDATE submissions 
                    SET score = ?, feedback = ?, status = ?, reviewed_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).bind(
                    parseInt(score) || 0, 
                    feedback || null, 
                    status || 'reviewed', 
                    parseInt(submission_id)
                ).run();

                return new Response(JSON.stringify({ success: true }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: 'خطا در ذخیره بازخورد' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // ---- دریافت اطلاعات کاربر جاری ----
        if (path === '/api/me' && method === 'GET') {
            try {
                const user = await db.prepare(
                    'SELECT id, username, role, full_name, school_id, class_id FROM users WHERE id = ?'
                ).bind(decoded.id).first();

                return new Response(JSON.stringify(user), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: 'خطا در دریافت اطلاعات' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // =========================================
        // 4. مسیر پیدا نشد
        // =========================================
        return new Response(JSON.stringify({ error: 'مسیر نامعتبر' }), { 
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
