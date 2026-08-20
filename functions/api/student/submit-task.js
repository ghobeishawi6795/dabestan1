export async function onRequest(context) {
  const { env } = context;

  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const body = await context.request.json();
    const { studentId, taskId, answerText, answerFile, answerFileType } = body;

    if (!studentId || !taskId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'شناسه دانش‌آموز و تکلیف الزامی است'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if ((!answerText || !answerText.trim()) && !answerFile) {
      return new Response(JSON.stringify({
        success: false,
        message: 'پاسخی برای ارسال وارد نشده'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // فایل به‌صورت data URL (base64) ذخیره میشه؛ چون این پروژه هنوز به R2 وصل نیست
    // یه محدودیت حجم ساده می‌ذاریم که دیتابیس زیر فشار نره
    if (answerFile && answerFile.length > 1_500_000) {
      return new Response(JSON.stringify({
        success: false,
        message: 'حجم فایل خیلی زیاده. لطفاً فایل کوچک‌تری بفرست (حداکثر ~1 مگابایت)'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const student = await env.DB.prepare(`
      SELECT * FROM users WHERE id = ? AND role = 'student'
    `).bind(studentId).first();

    if (!student) {
      return new Response(JSON.stringify({
        success: false,
        message: 'دسترسی غیرمجاز - دانش‌آموز یافت نشد'
      }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    const task = await env.DB.prepare(`
      SELECT * FROM tasks WHERE id = ? AND school_id = ? AND is_active = 1
        AND (class_id = ? OR class_id IS NULL)
    `).bind(taskId, student.school_id, student.class_id).first();

    if (!task) {
      return new Response(JSON.stringify({
        success: false,
        message: 'تکلیف یافت نشد یا برای کلاس شما نیست'
      }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // ثبت یا به‌روزرسانی پاسخ (اگه قبلاً ارسال کرده، جایگزین میشه و وضعیت به "در انتظار بررسی" برمی‌گرده)
    await env.DB.prepare(`
      INSERT INTO submissions (task_id, student_id, answer_text, answer_file, answer_file_type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(task_id, student_id) DO UPDATE SET
        answer_text = excluded.answer_text,
        answer_file = excluded.answer_file,
        answer_file_type = excluded.answer_file_type,
        status = 'pending',
        score = NULL,
        feedback = NULL,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      taskId,
      studentId,
      answerText || null,
      answerFile || null,
      answerFileType || null
    ).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'پاسخ با موفقیت ارسال شد'
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'خطا در ارسال پاسخ: ' + error.message
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
