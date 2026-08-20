export async function onRequest(context) {
  const { env } = context;

  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const body = await context.request.json();
    const { teacherId, submissionId, score, feedback, status } = body;

    if (!teacherId || !submissionId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'شناسه معلم و پاسخ الزامی است'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const finalStatus = status === 'revision' ? 'revision' : 'reviewed';

    if (finalStatus === 'revision' && (!feedback || !feedback.trim())) {
      return new Response(JSON.stringify({
        success: false,
        message: 'برای درخواست اصلاح باید بازخورد بنویسید'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // مالکیت این پاسخ رو از طریق تکلیفِ مرتبط با اون بررسی می‌کنیم
    const submission = await env.DB.prepare(`
      SELECT s.*, t.teacher_id, t.max_score
      FROM submissions s
      JOIN tasks t ON t.id = s.task_id
      WHERE s.id = ?
    `).bind(submissionId).first();

    if (!submission || String(submission.teacher_id) !== String(teacherId)) {
      return new Response(JSON.stringify({
        success: false,
        message: 'دسترسی غیرمجاز'
      }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    let finalScore = null;
    if (score !== undefined && score !== null && score !== '') {
      finalScore = parseInt(score);
      const maxScore = submission.max_score || 20;
      if (isNaN(finalScore) || finalScore < 0 || finalScore > maxScore) {
        return new Response(JSON.stringify({
          success: false,
          message: `نمره باید بین ۰ تا ${maxScore} باشد`
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
    }

    await env.DB.prepare(`
      UPDATE submissions
      SET score = ?, feedback = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(finalScore, feedback || null, finalStatus, submissionId).run();

    return new Response(JSON.stringify({
      success: true,
      message: finalStatus === 'revision' ? 'درخواست اصلاح ارسال شد' : 'بازخورد ثبت شد'
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'خطا در ثبت بازخورد: ' + error.message
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
