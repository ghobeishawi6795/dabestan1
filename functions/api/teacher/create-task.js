export async function onRequest(context) {
  const { env, request } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { title, subject, grade, className, description, deadline, answerType, maxScore } = body;

    if (!title) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'عنوان تکلیف الزامی است' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // برای تست: ID ثابت
    const teacherId = 1;
    const schoolId = 1;

    const result = await env.DB.prepare(`
      INSERT INTO tasks (teacher_id, class_id, grade, school_id, title, subject, description, response_type, max_score, is_active, deadline)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).bind(
      teacherId,
      null,
      grade || null,
      schoolId,
      title,
      subject || null,
      description || '',
      answerType || 'text',
      maxScore || 20,
      deadline || null
    ).run();

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'تکلیف با موفقیت ایجاد شد',
      taskId: result.meta?.last_row_id || 1
    }), { 
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Create task error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'خطا در ایجاد تکلیف: ' + error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
        }
