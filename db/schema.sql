-- =============================================
-- دیتابیس دبستان - نسخه اصلاح‌شده
-- =============================================

-- جدول کاربران (مدیر، معلم، دانش‌آموز)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,  -- بعداً با bcrypt هش می‌شود
    role TEXT NOT NULL CHECK(role IN ('admin', 'teacher', 'student')),
    school_id INTEGER,       -- برای مدیران و معلمان
    class_id INTEGER,        -- برای دانش‌آموزان
    full_name TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- جدول مدارس (فقط مدیران به آن دسترسی دارند)
CREATE TABLE IF NOT EXISTS schools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    admin_id INTEGER NOT NULL,  -- مدیر مدرسه
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);

-- جدول کلاس‌ها
CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    school_id INTEGER NOT NULL,
    teacher_id INTEGER NOT NULL,  -- معلم مسئول
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

-- جدول تکالیف (اصلاح‌شده با ستون‌های مورد نیاز API)
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    class_id INTEGER NOT NULL,
    teacher_id INTEGER NOT NULL,
    -- ستون‌های جدید (مطابق API)
    grade INTEGER DEFAULT 0,           -- نمره کل تکلیف
    answer_type TEXT CHECK(answer_type IN ('text', 'file', 'choice')) DEFAULT 'text',
    max_score INTEGER DEFAULT 100,     -- حداکثر نمره
    is_active BOOLEAN DEFAULT 1,       -- فعال/غیرفعال
    deadline DATETIME,                 -- مهلت ارسال
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

-- جدول پاسخ‌های دانش‌آموزان به تکالیف
CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    answer_text TEXT,                -- پاسخ متنی
    answer_file_url TEXT,            -- پاسخ فایل (آدرس)
    score INTEGER DEFAULT 0,         -- نمره داده شده توسط معلم
    feedback TEXT,                   -- بازخورد معلم
    status TEXT CHECK(status IN ('pending', 'reviewed', 'revised')) DEFAULT 'pending',
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

-- جدول بانک سؤال (جدید)
CREATE TABLE IF NOT EXISTS question_bank (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    answer_type TEXT CHECK(answer_type IN ('text', 'file', 'choice')) DEFAULT 'text',
    options TEXT,        -- برای سؤالات چندگزینه‌ای (JSON)
    correct_answer TEXT,
    difficulty INTEGER CHECK(difficulty BETWEEN 1 AND 5) DEFAULT 3,
    subject TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================
-- ایندکس‌ها برای بهبود سرعت
-- =============================================
CREATE INDEX idx_tasks_class_id ON tasks(class_id);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
CREATE INDEX idx_submissions_task_id ON submissions(task_id);
CREATE INDEX idx_submissions_student_id ON submissions(student_id);
CREATE INDEX idx_question_bank_teacher_id ON question_bank(teacher_id);

-- =============================================
-- داده‌های نمونه (اختیاری)
-- =============================================
-- یک مدیر پیش‌فرض با رمز `admin123` (بعداً با bcrypt هش می‌شود)
INSERT OR IGNORE INTO users (username, password, role, full_name) 
VALUES ('admin', '$2b$10$XxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx', 'admin', 'مدیر سیستم');
