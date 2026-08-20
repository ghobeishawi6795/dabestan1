// =============================================
// Worker اصلی با احراز هویت JWT و bcrypt
// =============================================
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from './db.js';  // فرض می‌کنیم یک فایل db.js داریم

const JWT_SECRET = 'your-very-secret-key-change-this-in-production'; // در محیط واقعی از متغیر محیطی استفاده کنید

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // اتصال به دیتابیس (با استفاده از D1 یا SQLite)
    const db = getDb(env);

    // =========================================
    // 1. احراز هویت (Login) - عمومی
    // =========================================
    if (path === '/api/auth/login' && method === 'POST') {
      const { username, password } = await request.json();
      
      // پیدا کردن کاربر
      const user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
      if (!user) {
        return new Response(JSON.stringify({ error: 'کاربر یافت نشد' }), { status: 401 });
      }

      // بررسی رمز عبور با bcrypt
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return new Response(JSON.stringify({ error: 'رمز عبور اشتباه است' }), { status: 401 });
      }

      // تولید JWT توکن
      const token = jwt.sign(
        { id: user.id, role: user.role, school_id: user.school_id },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      // ارسال توکن به همراه اطلاعات کاربر (بدون رمز)
      delete user.password;
      return new Response(JSON.stringify({ token, user }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // =========================================
    // 2. میدلور تأیید توکن (برای تمام APIهای محافظت‌شده)
    // =========================================
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'توکن معتبر نیست' }), { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return new Response(JSON.stringify({ error: 'توکن منقضی یا نامعتبر' }), { status: 401 });
    }

    // =========================================
    // 3. APIهای محافظت‌شده
    // =========================================

    // ---- ایجاد تکلیف (معلم) ----
    if (path === '/api/teacher/create-task' && method === 'POST') {
      // فقط معلم مجاز است
      if (decoded.role !== 'teacher') {
        return new Response(JSON.stringify({ error: 'دسترسی غیرمجاز' }), { status: 403 });
      }

      const { title, description, class_id, grade, answer_type, max_score, is_active, deadline } = await request.json();
      
      // اعتبارسنجی ساده
      if (!title || !class_id) {
        return new Response(JSON.stringify({ error: 'عنوان و کلاس اجباری است' }), { status: 400 });
      }

      // درج تکلیف (با ستون‌های جدید)
      const result = await db.prepare(`
        INSERT INTO tasks (title, description, class_id, teacher_id, grade, answer_type, max_score, is_active, deadline)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(title, description, class_id, decoded.id, grade || 0, answer_type || 'text', max_score || 100, is_active !== undefined ? is_active : 1, deadline || null).run();

      return new Response(JSON.stringify({ success: true, taskId: result.lastInsertRowid }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ---- افزودن سؤال به بانک (معلم) ----
    if (path === '/api/teacher/upload-question' && method === 'POST') {
      if (decoded.role !== 'teacher') {
        return new Response(JSON.stringify({ error: 'دسترسی غیرمجاز' }), { status: 403 });
      }

      const { question_text, answer_type, options, correct_answer, difficulty, subject } = await request.json();
      
      if (!question_text) {
        return new Response(JSON.stringify({ error: 'متن سؤال اجباری است' }), { status: 400 });
      }

      await db.prepare(`
        INSERT INTO question_bank (teacher_id, question_text, answer_type, options, correct_answer, difficulty, subject)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(decoded.id, question_text, answer_type || 'text', options || null, correct_answer || null, difficulty || 3, subject || null).run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ---- دریافت سؤال‌های بانک (معلم) ----
    if (path === '/api/teacher/get-questions' && method === 'GET') {
      if (decoded.role !== 'teacher') {
        return new Response(JSON.stringify({ error: 'دسترسی غیرمجاز' }), { status: 403 });
      }

      const questions = await db.prepare('SELECT * FROM question_bank WHERE teacher_id = ?').bind(decoded.id).all();
      return new Response(JSON.stringify(questions.results), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ---- دریافت تکالیف یک کلاس (معلم) ----
    if (path === '/api/teacher/get-tasks' && method === 'GET') {
      if (decoded.role !== 'teacher') {
        return new Response(JSON.stringify({ error: 'دسترسی غیرمجاز' }), { status: 403 });
      }

      const { class_id } = url.searchParams;
      if (!class_id) {
        return new Response(JSON.stringify({ error: 'شناسه کلاس الزامی است' }), { status: 400 });
      }

      const tasks = await db.prepare('SELECT * FROM tasks WHERE class_id = ? AND teacher_id = ?').bind(class_id, decoded.id).all();
      return new Response(JSON.stringify(tasks.results), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ---- ثبت پاسخ دانش‌آموز (دانش‌آموز) ----
    if (path === '/api/student/submit-answer' && method === 'POST') {
      if (decoded.role !== 'student') {
        return new Response(JSON.stringify({ error: 'دسترسی غیرمجاز' }), { status: 403 });
      }

      const { task_id, answer_text, answer_file_url } = await request.json();
      if (!task_id) {
        return new Response(JSON.stringify({ error: 'شناسه تکلیف الزامی است' }), { status: 400 });
      }

      await db.prepare(`
        INSERT INTO submissions (task_id, student_id, answer_text, answer_file_url)
        VALUES (?, ?, ?, ?)
      `).bind(task_id, decoded.id, answer_text || null, answer_file_url || null).run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ---- دریافت پاسخ‌های یک تکلیف برای معلم (برای بررسی) ----
    if (path === '/api/teacher/get-submissions' && method === 'GET') {
      if (decoded.role !== 'teacher') {
        return new Response(JSON.stringify({ error: 'دسترسی غیرمجاز' }), { status: 403 });
      }

      const { task_id } = url.searchParams;
      if (!task_id) {
        return new Response(JSON.stringify({ error: 'شناسه تکلیف الزامی است' }), { status: 400 });
      }

      const submissions = await db.prepare(`
        SELECT s.*, u.full_name as student_name 
        FROM submissions s
        JOIN users u ON s.student_id = u.id
        WHERE s.task_id = ?
      `).bind(task_id).all();

      return new Response(JSON.stringify(submissions.results), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ---- ذخیره نمره و بازخورد توسط معلم (برای تکمیل صفحه review) ----
    if (path === '/api/teacher/review-submission' && method === 'POST') {
      if (decoded.role !== 'teacher') {
        return new Response(JSON.stringify({ error: 'دسترسی غیرمجاز' }), { status: 403 });
      }

      const { submission_id, score, feedback, status } = await request.json();
      if (!submission_id) {
        return new Response(JSON.stringify({ error: 'شناسه پاسخ الزامی است' }), { status: 400 });
      }

      await db.prepare(`
        UPDATE submissions 
        SET score = ?, feedback = ?, status = ?, reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(score || 0, feedback || null, status || 'reviewed', submission_id).run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ---- درخواست اصلاح توسط دانش‌آموز ----
    if (path === '/api/student/request-revision' && method === 'POST') {
      if (decoded.role !== 'student') {
        return new Response(JSON.stringify({ error: 'دسترسی غیرمجاز' }), { status: 403 });
      }

      const { submission_id } = await request.json();
      await db.prepare(`UPDATE submissions SET status = 'revised' WHERE id = ? AND student_id = ?`)
        .bind(submission_id, decoded.id).run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ---- (اختیاری) دریافت اطلاعات کاربر جاری ----
    if (path === '/api/me' && method === 'GET') {
      const user = await db.prepare('SELECT id, username, role, full_name, school_id, class_id FROM users WHERE id = ?').bind(decoded.id).first();
      return new Response(JSON.stringify(user), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // =========================================
    // 4. مسیرهای پیدا نشد
    // =========================================
    return new Response(JSON.stringify({ error: 'مسیر نامعتبر' }), { status: 404 });
  }
};
