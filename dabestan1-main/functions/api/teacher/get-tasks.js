export async function onRequest(context) {
  const { env } = context;

  if (context.request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const url = new URL(context.request.url);
    const teacherId = url.searchParams.get('teacherId');
    const subject = url.searchParams.get('subject');
    const grade = url.searchParams.get('grade');
    const limit = parseInt(url.searchParams.get('limit')) || 10;

    if (!teacherId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'شناسه معلم الزامی است'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ساخت کوئری پویا
    let query = `
      SELECT t.*, c.name as class_name, c.grade as class_grade
      FROM tasks t
      LEFT JOIN classes c ON t.class_id = c.id
      WHERE t.teacher_id = ? AND t.is_active = 1
    `;
    const params = [teacherId];

    if (subject && subject !== 'all') {
      query += ' AND t.subject = ?';
      params.push(subject);
    }

    if (grade && grade !== 'all') {
      query += ' AND t.grade = ?';
      params.push(grade);
    }

    query += ' ORDER BY t.created_at DESC LIMIT ?';
    params.push(limit);

    const tasks = await env.DB.prepare(query).bind(...params).all();

    return new Response(JSON.stringify({
      success: true,
      tasks: tasks.results || []
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'خطا در دریافت تکالیف: ' + error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
