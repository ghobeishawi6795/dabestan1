import { jsonResponse, requireAuth } from '../_lib/auth.js';

export async function onRequest(context) {
  const { env, request } = context;

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireAuth(context, ['admin']);
  if (auth.error) return auth.error;
  const admin = auth.user;

  try {
    const classesCount = await env.DB.prepare(`
      SELECT COUNT(*) as c FROM classes WHERE school_id = ?
    `).bind(admin.schoolId).first();

    const teachersCount = await env.DB.prepare(`
      SELECT COUNT(*) as c FROM users WHERE school_id = ? AND role = 'teacher'
    `).bind(admin.schoolId).first();

    const studentsCount = await env.DB.prepare(`
      SELECT COUNT(*) as c FROM users WHERE school_id = ? AND role = 'student'
    `).bind(admin.schoolId).first();

    const tasksThisMonth = await env.DB.prepare(`
      SELECT COUNT(*) as c FROM tasks
      WHERE school_id = ? AND is_active = 1 AND created_at >= datetime('now', 'start of month')
    `).bind(admin.schoolId).first();

    const recentTasks = await env.DB.prepare(`
      SELECT t.id, t.title, t.subject, t.created_at, u.name as teacher_name
      FROM tasks t
      LEFT JOIN users u ON t.teacher_id = u.id
      WHERE t.school_id = ? AND t.is_active = 1
      ORDER BY t.created_at DESC
      LIMIT 5
    `).bind(admin.schoolId).all();

    return jsonResponse({
      success: true,
      stats: {
        classes: classesCount?.c || 0,
        teachers: teachersCount?.c || 0,
        students: studentsCount?.c || 0,
        tasksThisMonth: tasksThisMonth?.c || 0
      },
      recentTasks: recentTasks.results || []
    });

  } catch (error) {
    return jsonResponse({ success: false, message: 'خطا در دریافت آمار: ' + error.message }, 500);
  }
}
