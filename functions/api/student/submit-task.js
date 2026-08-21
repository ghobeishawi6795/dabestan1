export async function onRequest(context) {
  const { env } = context;
  
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  
  try {
    const body = await context.request.json();
    const { taskId, studentId, answers } = body;
    
    if (!taskId || !studentId) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'شناسه تکلیف و دانش‌آموز الزامی است' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // بررسی دانش‌آموز
    const student = await env.DB.prepare(`
      SELECT * FROM users WHERE id = ? AND role = 'student'
    `).bind(studentId).first();
    
    if (!student) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'دانش‌آموز یافت نشد' 
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // بررسی تکلیف
    const task = await env.DB.prepare(`
      SELECT * FROM tasks WHERE id = ?
    `).bind(taskId).first();
    
    if (!task) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'تکلیف یافت نشد' 
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // بررسی مهلت
    if (task.deadline && new Date(task.deadline) < new Date()) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'مهلت ارسال به پایان رسیده است' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // تبدیل پاسخ‌ها به JSON
    const answerText = JSON.stringify(answers);
    
    // ثبت یا به‌روزرسانی پاسخ
    const existing = await env.DB.prepare(`
      SELECT id FROM submissions WHERE task_id = ? AND student_id = ?
    `).bind(taskId, studentId).first();
    
    if (existing) {
      await env.DB.prepare(`
        UPDATE submissions 
        SET answer_text = ?, status = 'submitted', submitted_at = datetime('now')
        WHERE id = ?
      `).bind(answerText, existing.id).run();
    } else {
      await env.DB.prepare(`
        INSERT INTO submissions (task_id, student_id, answer_text, status, submitted_at)
        VALUES (?, ?, ?, 'submitted', datetime('now'))
      `).bind(taskId, studentId, answerText).run();
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'پاسخ با موفقیت ثبت شد'
    }), { 
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'خطا در ثبت پاسخ: ' + error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
