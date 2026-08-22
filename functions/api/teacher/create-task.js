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
    const { title, subject, grade, classId, description, questionIds } = body;

    if (!title) {
      return jsonResponse({ success: false, message: 'عنوان تکلیف الزامی است' }, 400);
    }

    let finalDescription = description || '';

    // اگر معلم سوالاتی را از بانک انتخاب کرده باشد، محتوای HTML آن‌ها را بگیر و به توضیحات اضافه کن
    if (questionIds && Array.isArray(questionIds) && questionIds.length > 0) {
      const placeholders = questionIds.map(() => '?').join(',');
      const questions = await env.DB.prepare(`
        SELECT title, html_content FROM question_bank 
        WHERE id IN (${placeholders}) AND teacher_id = ?
      `).bind(...questionIds, teacher.id).all();

      if (questions.results && questions.results.length > 0) {
        // ترکیب سوالات انتخاب‌شده به صورت HTML
        const questionsHtml = questions.results.map((q, index) => `
          <div class="task-question-block" style="margin-bottom: 24px; padding: 16px; background: #f9f9f9; border-radius: 12px; border: 1px solid #e0e0e0;">
            <h4 style="margin-bottom: 12px; color: #6C5CE7;">سوال ${index + 1}: ${q.title}</h4>
            <div class="interactive-content">
              ${q.html_content}
            </div>
          </div>
        `).join('');
        
        finalDescription = finalDescription ? `${finalDescription}<hr>${questionsHtml}` : questionsHtml;
      }
    }

    await env.DB.prepare(`
      INSERT INTO tasks (teacher_id, class_id, grade, school_id, title, subject, description, response_type, max_score, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'html', 20, 1)
    `).bind(
      teacher.id,
      classId || null,
      grade || null,
      teacher.schoolId || 1,
      title,
      subject || null,
      finalDescription,
    ).run();

    return jsonResponse({ success: true, message: 'تکلیف با موفقیت ایجاد و ارسال شد' });

  } catch (error) {
    console.error('Create task error:', error);
    return jsonResponse({ success: false, message: 'خطا در ایجاد تکلیف: ' + error.message }, 500);
  }
  }
