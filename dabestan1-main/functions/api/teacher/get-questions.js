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
      SELECT * FROM question_bank 
      WHERE teacher_id = ? AND is_active = 1
    `;
    const params = [teacherId];
    
    if (subject && subject !== 'all') {
      query += ' AND subject = ?';
      params.push(subject);
    }
    
    if (grade && grade !== 'all') {
      query += ' AND grade = ?';
      params.push(grade);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const questions = await env.DB.prepare(query).bind(...params).all();
    
    return new Response(JSON.stringify({ 
      success: true, 
      questions: questions.results || []
    }), { 
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'خطا در دریافت سوالات: ' + error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  }
