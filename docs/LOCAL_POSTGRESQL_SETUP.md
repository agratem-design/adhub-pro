# 🐘 دليل إعداد PostgreSQL المحلي

## نظرة عامة

هذا الدليل يشرح كيفية إعداد قاعدة بيانات PostgreSQL محلية تعمل **أوفلاين 100%** وبنفس كفاءة Supabase، مع جميع:
- ✅ الجداول (80+ جدول)
- ✅ Functions (40+ دالة)
- ✅ Triggers (25+ trigger)
- ✅ RLS Policies
- ✅ Indexes

---

## 📋 المتطلبات

| المكون | الإصدار الأدنى | رابط التحميل |
|--------|---------------|--------------|
| PostgreSQL | 14+ | [postgresql.org/download](https://www.postgresql.org/download/) |
| pgAdmin (اختياري) | 4+ | [pgadmin.org/download](https://www.pgadmin.org/download/) |

---

## 🚀 خطوات التثبيت

### 1. تثبيت PostgreSQL

#### Windows:
```bash
# تحميل المثبت من الموقع الرسمي
# أو باستخدام Chocolatey:
choco install postgresql
```

#### macOS:
```bash
# باستخدام Homebrew:
brew install postgresql@15
brew services start postgresql@15
```

#### Linux (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

---

### 2. إنشاء قاعدة البيانات

```bash
# الدخول إلى PostgreSQL
sudo -u postgres psql

# إنشاء قاعدة بيانات جديدة
CREATE DATABASE billboard_system;

# إنشاء مستخدم جديد (اختياري)
CREATE USER billboard_admin WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE billboard_system TO billboard_admin;

# الخروج
\q
```

---

### 3. إنشاء schema المصادقة (محاكاة Supabase Auth)

```sql
-- الاتصال بقاعدة البيانات
\c billboard_system

-- إنشاء schema المصادقة
CREATE SCHEMA IF NOT EXISTS auth;

-- جدول المستخدمين (يحاكي auth.users في Supabase)
CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    encrypted_password TEXT,
    email_confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb
);

-- دالة للحصول على معرف المستخدم الحالي
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
BEGIN
    -- في البيئة المحلية، يمكن تعيين معرف المستخدم من متغير الجلسة
    RETURN COALESCE(
        current_setting('app.current_user_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    );
END;
$$ LANGUAGE plpgsql STABLE;
```

---

### 4. استعادة قاعدة البيانات

```bash
# استعادة من ملف SQL الكامل
psql -U postgres -d billboard_system -f public/database_full_restore.sql

# أو باستخدام pgAdmin:
# 1. افتح pgAdmin
# 2. اتصل بالسيرفر المحلي
# 3. انقر بزر الفأرة الأيمن على billboard_system
# 4. اختر "Query Tool"
# 5. افتح الملف public/database_full_restore.sql
# 6. اضغط F5 لتنفيذ
```

---

### 5. إعداد المستخدم الأول (Admin)

```sql
-- إدراج مستخدم في auth.users
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'admin@example.com',
    crypt('admin123', gen_salt('bf')),
    now()
);

-- إنشاء ملف شخصي
INSERT INTO public.profiles (id, name, email, approved, status)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'المدير',
    'admin@example.com',
    true,
    'approved'
);

-- تعيين صلاحية الأدمن
INSERT INTO public.user_roles (user_id, role)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'admin'
);
```

---

## ⚙️ إعداد التطبيق للعمل محلياً

### 1. تعديل ملف البيئة

أنشئ ملف `.env.local`:

```env
# PostgreSQL المحلي
VITE_DATABASE_URL=postgresql://billboard_admin:your_secure_password@localhost:5432/billboard_system
VITE_LOCAL_MODE=true

# أو استخدم Supabase local
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key
```

### 2. إنشاء خدمة اتصال محلية

أنشئ ملف `src/services/localDatabaseService.ts`:

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: import.meta.env.VITE_DATABASE_URL,
});

export const localDb = {
  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  },
  
  async from(table: string) {
    return {
      select: async (columns = '*') => {
        const result = await this.query(`SELECT ${columns} FROM ${table}`);
        return { data: result, error: null };
      },
      insert: async (data: any) => {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
        const result = await this.query(sql, values);
        return { data: result[0], error: null };
      },
      update: async (data: any) => {
        // Implementation...
      },
      delete: async () => {
        // Implementation...
      }
    };
  }
};
```

---

## 🔧 تشغيل Supabase محلياً (بديل)

إذا كنت تفضل استخدام واجهة Supabase المحلية:

```bash
# تثبيت Supabase CLI
npm install -g supabase

# تهيئة المشروع
supabase init

# تشغيل الخدمات المحلية
supabase start

# ستحصل على:
# - API URL: http://localhost:54321
# - DB URL: postgresql://postgres:postgres@localhost:54322/postgres
# - Studio URL: http://localhost:54323
```

---

## 📊 مقارنة: Supabase vs PostgreSQL المحلي

| الميزة | Supabase (Cloud) | PostgreSQL المحلي |
|--------|-----------------|-------------------|
| التكلفة | مجاني/مدفوع | مجاني 100% |
| الاتصال | يحتاج إنترنت | أوفلاين |
| الأداء | يعتمد على الخطة | سريع جداً |
| Auth | مدمج | تحتاج إعداد |
| Storage | مدمج | تحتاج إعداد |
| Realtime | مدمج | يحتاج pg_notify |
| RLS | تلقائي | يدوي |
| Functions | ✅ | ✅ |
| Triggers | ✅ | ✅ |

---

## 🔐 أمان قاعدة البيانات

### تفعيل RLS

```sql
-- تفعيل RLS على جميع الجداول
DO $$ 
DECLARE
  tbl text;
BEGIN
  FOR tbl IN 
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;
```

### سياسات الوصول

السياسات موجودة بالفعل في ملف `database_full_restore.sql` وتسمح للمستخدمين المصادق عليهم بالوصول الكامل.

---

## 🔄 النسخ الاحتياطي

### نسخ احتياطي يدوي:

```bash
# نسخ كامل للقاعدة
pg_dump -U postgres -d billboard_system -f backup_$(date +%Y%m%d).sql

# نسخ البيانات فقط
pg_dump -U postgres -d billboard_system --data-only -f data_backup.sql

# نسخ الهيكل فقط
pg_dump -U postgres -d billboard_system --schema-only -f schema_backup.sql
```

### نسخ احتياطي تلقائي (cron):

```bash
# إضافة مهمة cron للنسخ اليومي
0 2 * * * pg_dump -U postgres billboard_system > /backups/daily_$(date +\%Y\%m\%d).sql
```

---

## ❓ حل المشاكل الشائعة

### 1. خطأ: "relation does not exist"

```sql
-- تأكد من وجود الجدول
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- أعد تشغيل ملف الاستعادة
\i public/database_full_restore.sql
```

### 2. خطأ: "auth.uid() does not exist"

```sql
-- أنشئ الدالة
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
BEGIN
    RETURN COALESCE(
        current_setting('app.current_user_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    );
END;
$$ LANGUAGE plpgsql STABLE;
```

### 3. خطأ: "permission denied"

```sql
-- منح الصلاحيات
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO billboard_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO billboard_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO billboard_admin;
```

---

## 📝 الخلاصة

بعد اتباع هذا الدليل، ستحصل على:

1. ✅ قاعدة بيانات PostgreSQL محلية كاملة
2. ✅ جميع الـ Functions والـ Triggers من Supabase
3. ✅ سياسات RLS للأمان
4. ✅ نظام يعمل أوفلاين 100%
5. ✅ مجاني بدون أي تكاليف

---

## 🔗 روابط مفيدة

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [pgAdmin Documentation](https://www.pgadmin.org/docs/)
- [Supabase Self-Hosting](https://supabase.com/docs/guides/self-hosting)
