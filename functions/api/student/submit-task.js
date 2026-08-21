export async function onRequest(context) {
  const { env } = context;
  
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  
  try {
    const body = await context.request.json();
    const { taskId, studentId, answers } = body;
    
    if (!taskId || !studentId) {
      return new Response(JSON.stringify({ success: false, message: 'شناسه تکلیف و دانش‌آموز الزامی است' }), { status: 400 });
    }
    
    // بررسی دانش‌آموز
    const student = await env.DB.prepare(`
      SELECT * FROM users WHERE id = ? AND role = 'student'
    `).bind(studentId).first();
    
    if (!student) {
      return new Response(JSON.stringify({ success: false, message: 'دانش‌آموز یافت نشد' }), { status: 404 });
    }
    
    // بررسی تکلیف
    const task = await env.DB.prepare(`
      SELECT * FROM tasks WHERE id = ?
    `).bind(taskId).first();
    
    if (!task) {
      return new Response(JSON.stringify({ success: false, message: 'تکلیف یافت نشد' }), { status: 404 });
    }
    
    // بررسی مهلت
    if (task.deadline && new Date(task.deadline) < new Date()) {
      return new Response(JSON.stringify({ success: false, message: 'مهلت ارسال به پایان رسیده است' }), { status: 400 });
    }
    
    // تبدیل پاسخ‌ها به JSON
    const answerText = JSON.stringify(answers);
    
    // بررسی ارسال قبلی
    const existing = await env.DB.prepare(`
      SELECT id FROM submissions WHERE task_id = ? AND student_id = ?
    `).bind(taskId, studentId).first();
    
    if (existing) {
      // به‌روزرسانی ارسال قبلی
      await env.DB.prepare(`
        UPDATE submissions 
        SET answer_text = ?, status = 'pending', submitted_at = datetime('now')
        WHERE id = ?
      `).bind(answerText, existing.id).run();
    } else {
      // ثبت ارسال جدید
      await env.DB.prepare(`
        INSERT INTO submissions (task_id, student_id, answer_text, status, submitted_at)
        VALUES (?, ?, ?, 'pending', datetime('now'))
      `).bind(taskId, studentId, answerText).run();
    }
    
    return new Response(JSON.stringify({ success: true, message: 'پاسخ با موفقیت ثبت شد' }));
    
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: error.message }), { status: 500 });
  }
        }
