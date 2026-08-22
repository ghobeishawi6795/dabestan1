import { jsonResponse, requireAuth } from '../_lib/auth.js';

export async function onRequest(context) {
  const { env, request } = context;

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireAuth(context, ['teacher']);
  if (auth.error) return auth.error;
  const teacher = auth.user;

  try {
    const body = await request.json();
    
    // پشتیبانی از هر دو حالت: تک سوال یا آرایه‌ای از سوالات
    const questions = body.questions || [{
      title: body.title,
      subject: body.subject,
      grade: body.grade,
      html: body.questionHtml
    }];

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return jsonResponse({ success: false, message: 'لیست سوالات نامعتبر است' }, 400);
    }

    // آماده‌سازی دستور Insert
    const stmt = env.DB.prepare(`
      INSERT INTO question_bank (teacher_id, title, subject, grade, html_content)
      VALUES (?, ?, ?, ?, ?)
    `);

    // ساخت آرایه‌ای از دستورات برای اجرای دسته‌ای (Batch)
    const batch = questions.map(q => 
      stmt.bind(
        teacher.id, 
        q.title || 'بدون عنوان', 
        q.subject || null, 
        q.grade || null, 
        q.html || ''
      )
    );

    // اجرای دسته‌ای در دیتابیس (بسیار سریع‌تر از حلقه‌ی تکی)
    await env.DB.batch(batch);

    return jsonResponse({ 
      success: true, 
      message: `✅ ${questions.length} سوال با موفقیت و به صورت دسته‌ای به بانک اضافه شد` 
    });

  } catch (error) {
    console.error('Batch upload error:', error);
    return jsonResponse({ success: false, message: 'خطا در آپلود دسته‌ای: ' + error.message }, 500);
  }
                                }
