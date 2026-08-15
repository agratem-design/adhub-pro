/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📁 ملف إعدادات قواعد البيانات الموحد (Cloud & Local Supabase Configuration)
 * ═══════════════════════════════════════════════════════════════════════════
 * يحتوي هذا الملف على كافة بيانات الاتصال وكلمات المرور للسيرفر السحابي والمحلي
 * في حال تغيير مشروع Supabase أو كلمة المرور، يتم تعديلها هنا مباشرة.
 */

export const DATABASE_CONFIG = {
  // 🌐 1. بيانات السيرفر السحابي (Supabase Cloud)
  cloud: {
    projectId: 'atqjaiebixuzomrfwilu',
    url: 'https://atqjaiebixuzomrfwilu.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0cWphaWViaXh1em9tcmZ3aWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTkxOTcsImV4cCI6MjA3Mjc3NTE5N30.OGAQFsAl1Eo1tmPZ93VZoSL5tO2FYZa_szeRvUmoj-4',
    // إعدادات الاتصال المباشر بقاعدة البيانات (Direct Postgres / Pooler)
    db: {
      host: 'aws-1-eu-north-1.pooler.supabase.com',
      port: '5432', // منفذ Session Pooler السريع والموثوق للنسخ
      user: 'postgres.atqjaiebixuzomrfwilu',
      password: 'Zer4oBi57gZ',
      dbname: 'postgres',
    },
  },

  // 💻 2. بيانات السيرفر المحلي للأوفلاين (Supabase Local Docker)
  local: {
    projectId: 'adhub_local_supabase',
    url: 'http://127.0.0.1:54321',
    anonKey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
    // إعدادات الاتصال بقاعدة بيانات بوستجريس المحلية في دوكر
    db: {
      host: '127.0.0.1',
      port: '54322', // منفذ PostgreSQL المحلي المباشر
      user: 'postgres',
      password: 'postgres', // كلمة المرور الافتراضية للسب بيس المحلي
      dbname: 'postgres',
    },
    studioUrl: 'http://127.0.0.1:54323',
  },
};
