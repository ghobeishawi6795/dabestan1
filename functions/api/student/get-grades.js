import { jsonResponse, requireAuth } from '../_lib/auth.js';

export async function onRequest(context) {
  const { env, request } = context;

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireAuth(context, ['student']);
  if (auth.error) return auth.error;
  const student = auth.user;

  try {
    // دریافت تمام پاسخ‌های ثبت‌شده توسط این دانش‌آموز به همراه جزئیات تکلیف و نمره
    const grades = await env.DB.prepare(`
      SELECT 
        s.id, s.task_id, s.score, s.feedback, s.status, s.submitted_at, s.reviewed_at,
        t.title as task_title, t.subject, t.max_score,
        u.name as teacher_name
      FROM submissions s
      JOIN tasks t ON s.task_id = t.id
      JOIN users u ON t.teacher_id = u.id
      WHERE s.student_id = ?
      ORDER BY s.submitted_at DESC
    `).bind(student.id).all();

    // محاسبه آمار کلی
    const gradedSubmissions = grades.results.filter(g => g.status === 'reviewed' && g.score !== null);
    const totalScore = gradedSubmissions.reduce((sum, g) => sum + (g.score || 0), 0);
    const maxPossible = gradedSubmissions.reduce((sum, g) => sum + (g.max_score || 20), 0);
    const average = maxPossible > 0 ? ((totalScore / maxPossible) * 20).toFixed(1) : 0;

    return jsonResponse({ 
      success: true, 
      grades: grades.results || [],
      stats: {
        totalGraded: gradedSubmissions.length,
        average: average
      }
    });

  } catch (error) {
    return jsonResponse({ success: false, message: 'خطا در دریافت نمرات: ' + error.message }, 500);
  }
}
