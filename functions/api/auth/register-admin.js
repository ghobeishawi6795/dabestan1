// functions/api/auth/register-admin.js
import { hashPassword, generateCode } from '../../_lib/crypto.js';

export async function onRequest(context) {
  const { env, request } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, message: 'متد درخواست نامعتبر است' }), { 
      status: 405, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  try {
    const body = await request.json();
    const { schoolName, adminName, phone, password } = body;

    if (!schoolName || !adminName || !phone || !password) {
      return new Response(JSON.stringify({ success: false, message: 'تمامی فیلدها الزامی هستند' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // بررسی اینکه آیا قبلاً مدیری ثبت‌نام کرده است یا خیر
    const existingAdmin = await env.DB.prepare("SELECT id FROM users WHERE role = 'admin'").first();
    if (existingAdmin) {
      return new Response(JSON.stringify({ success: false, message: 'مدیر قبلاً در این سامانه ثبت‌نام کرده است' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // تولید کد یکتا برای مدرسه (با پیشوند SCH برای خوانایی بهتر)
    let schoolCode;
    let isUnique = false;
    while (!isUnique) {
      schoolCode = generateCode('SCH-');
      const existingSchool = await env.DB.prepare("SELECT id FROM schools WHERE code = ?").bind(schoolCode).first();
      if (!existingSchool) {
        isUnique = true; // کد یکتا است و می‌توان از آن استفاده کرد
      }
    }

    const passwordHash = await hashPassword(password);

    // ۱. ثبت اطلاعات مدرسه
    await env.DB.prepare(`
      INSERT INTO schools (name, code) VALUES (?, ?)
    `).bind(schoolName, schoolCode).run();

    // ۲. دریافت ID مدرسه‌ی刚刚 ثبت‌شده
    const school = await env.DB.prepare("SELECT id FROM schools WHERE code = ?").bind(schoolCode).first();

    // ۳. ثبت کاربر مدیر (کد دعوت مدیر همان کد مدرسه است)
    await env.DB.prepare(`
      INSERT INTO users (school_id, name, phone, password_hash, role, invite_code, is_active)
      VALUES (?, ?, ?, ?, 'admin', ?, 1)
    `).bind(school.id, adminName, phone, passwordHash, schoolCode).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'مدرسه و مدیر با موفقیت ثبت‌نام شدند',
      schoolCode: schoolCode
    }), { 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Register admin error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'خطا در ثبت‌نام. لطفاً دوباره تلاش کنید.',
      error: error.message
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
      }
