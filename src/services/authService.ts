/**
 * Auth Service - Role-Based Permission System
 * 
 * IMPORTANT: Permissions are role-based only. User-level permissions are deprecated.
 * All permissions are derived from the user's assigned role in the roles table.
 * To change a user's permissions, change their role via the role management system.
 */
import { supabase, isOfflineMode } from '@/integrations/supabase/client';
import { z } from 'zod';

// Input validation schemas - تدعم البريد الإلكتروني أو اسم المستخدم
// Password validation helper
export const passwordSchema = z.string()
  .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
  .max(100, 'كلمة المرور طويلة جداً')
  .regex(/[A-Z]/, 'كلمة المرور يجب أن تحتوي على حرف كبير')
  .regex(/[a-z]/, 'كلمة المرور يجب أن تحتوي على حرف صغير')
  .regex(/[0-9]/, 'كلمة المرور يجب أن تحتوي على رقم');

export const loginSchema = z.object({
  emailOrUsername: z.string().trim().min(1, 'يرجى إدخال البريد الإلكتروني أو اسم المستخدم').max(255, 'القيمة طويلة جداً'),
  password: z.string().min(1, 'كلمة المرور مطلوبة').max(100, 'كلمة المرور طويلة جداً'),
});

export const registerSchema = z.object({
  email: z.string().trim().email('صيغة البريد الإلكتروني غير صحيحة').max(255, 'البريد الإلكتروني طويل جداً'),
  password: passwordSchema,
  name: z.string().trim().min(1, 'الاسم مطلوب').max(100, 'الاسم طويل جداً'),
  username: z.string().trim().min(3, 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل').max(50, 'اسم المستخدم طويل جداً').optional(),
  phone: z.string().trim().max(20, 'رقم الهاتف طويل جداً').optional(),
  company: z.string().trim().max(100, 'اسم الشركة طويل جداً').optional(),
});

export interface User {
  id: string;
  email: string;
  name: string;
  username?: string;
  role: 'admin' | 'sub_admin' | 'accountant' | 'customer' | 'marketer' | 'user';
  roleName?: string; // The actual role name from user_roles
  phone?: string;
  company?: string;
  pricingCategory?: string | null;
  allowedCustomers?: string[] | null;
  linkedCustomerId?: string | null;
  approved?: boolean;
  status?: 'pending' | 'approved' | 'rejected';
  permissions?: string[]; // Permissions derived from role ONLY
}

export interface LoginCredentials {
  email: string; // يمكن أن يكون بريد إلكتروني أو اسم مستخدم
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  username?: string;
  phone?: string;
  company?: string;
}

/**
 * Fetch permissions from user's role
 * Permissions are derived ONLY from the role, not from user_permissions table
 */
const fetchRolePermissions = async (userId: string): Promise<{ permissions: string[], roleName: string }> => {
  try {
    // Get user's role name
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (!userRole?.role) return { permissions: [], roleName: 'user' };

    // Get permissions from the role definition
    const { data: roleData } = await supabase
      .from('roles')
      .select('permissions')
      .eq('name', userRole.role)
      .maybeSingle();

    return {
      permissions: (roleData?.permissions as string[]) || [],
      roleName: userRole.role
    };
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    return { permissions: [], roleName: 'user' };
  }
};

// تسجيل الدخول باستخدام Supabase Auth - يدعم البريد الإلكتروني أو اسم المستخدم
export const loginUser = async (credentials: LoginCredentials): Promise<{ user: User | null; error: string | null }> => {
  try {
    // Validate input
    const validation = loginSchema.safeParse({ 
      emailOrUsername: credentials.email, 
      password: credentials.password 
    });
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return { user: null, error: firstError.message };
    }

    const { emailOrUsername, password } = validation.data;
    const trimmedInput = emailOrUsername.trim();

    let authUserId: string | null = null;
    let authEmail: string | null = null;

    if (trimmedInput.includes('@')) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedInput.toLowerCase(),
        password,
      });

      if (error || !data.user) {
        const msg = error?.message || '';
        if (msg.includes('fetch') || msg.includes('Failed to fetch') || msg.includes('Network') || msg.includes('connection')) {
          return { user: null, error: 'تعذر الاتصال بقاعدة البيانات. يرجى التأكد من تشغيل السيرفر المحلي أو الاتصال بالإنترنت' };
        }
        return { user: null, error: 'البريد الإلكتروني/اسم المستخدم أو كلمة المرور غير صحيحة' };
      }

      authUserId = data.user.id;
      authEmail = data.user.email ?? null;
    } else {
      // 1. محاولة جلب البريد المرتبط باسم المستخدم عبر الـ RPC الآمن
      let resolvedEmail: string | null = null;
      try {
        const { data: rpcEmail } = await supabase.rpc('get_email_by_username', { p_username: trimmedInput });
        if (rpcEmail) {
          resolvedEmail = rpcEmail;
        }
      } catch (e) {}

      // 2. إذا لم يتوفر الـ RPC، محاولة الاستعلام المباشر من profiles
      if (!resolvedEmail) {
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('email')
            .ilike('username', trimmedInput)
            .maybeSingle();

          if (prof?.email) {
            resolvedEmail = prof.email;
          }
        } catch (e) {}
      }

      if (resolvedEmail) {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: resolvedEmail.toLowerCase(),
          password,
        });

        if (!signInErr && signInData.user) {
          authUserId = signInData.user.id;
          authEmail = signInData.user.email ?? resolvedEmail;
        } else {
          const msg = signInErr?.message || '';
          if (msg.includes('fetch') || msg.includes('Failed to fetch') || msg.includes('Network') || msg.includes('connection')) {
            return { user: null, error: 'تعذر الاتصال بقاعدة البيانات. يرجى التأكد من تشغيل السيرفر المحلي أو الاتصال بالإنترنت' };
          }
          return { user: null, error: 'البريد الإلكتروني/اسم المستخدم أو كلمة المرور غير صحيحة' };
        }
      } else {
        // محاولة بديلة عبر Edge Function
        const { data: tokenData, error: invokeError } = await supabase.functions.invoke('auth-username-login', {
          body: { emailOrUsername: trimmedInput, password },
        });

        if (!invokeError && tokenData?.access_token && tokenData?.refresh_token) {
          await supabase.auth.setSession({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
          });

          authUserId = tokenData.user?.id ?? null;
          authEmail = tokenData.user?.email ?? null;
        } else {
          return { user: null, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
        }
      }
    }

    if (!authUserId) {
      return { user: null, error: 'حدث خطأ أثناء تسجيل الدخول' };
    }

    // جلب بيانات المستخدم من profiles
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUserId)
      .maybeSingle();

    // التحقق من موافقة الأدمن - تجاهل إذا لم يكن هناك profile بعد
    if (profileData) {
      if (profileData.status === 'pending') {
        await supabase.auth.signOut();
        return { user: null, error: 'حسابك قيد المراجعة. يرجى انتظار موافقة المدير.' };
      }

      if (profileData.status === 'rejected') {
        await supabase.auth.signOut();
        return { user: null, error: 'تم رفض حسابك. يرجى التواصل مع الإدارة.' };
      }
      
      // إذا كان الـ profile موجود ولم يتم الموافقة عليه بعد
      if (profileData.approved === false && profileData.status !== 'approved') {
        await supabase.auth.signOut();
        return { user: null, error: 'حسابك قيد المراجعة. يرجى انتظار موافقة المدير.' };
      }
    }

    // جلب الصلاحيات من الدور فقط (role-based permissions only)
    const { permissions, roleName } = await fetchRolePermissions(authUserId);

    const user: User = {
      id: authUserId,
      email: authEmail || '',
      name: profileData?.name || '',
      username: profileData?.username || undefined,
      role: (['admin', 'sub_admin', 'accountant', 'customer', 'marketer'].includes(roleName) ? roleName : 'user') as User['role'],
      roleName: roleName,
      phone: profileData?.phone || undefined,
      company: profileData?.company || undefined,
      pricingCategory: profileData?.pricing_category || null,
      allowedCustomers: profileData?.allowed_customers || null,
      linkedCustomerId: profileData?.linked_customer_id || null,
      approved: profileData?.approved,
      status: profileData?.status as 'pending' | 'approved' | 'rejected',
      permissions: permissions,
    };

    if (isOfflineMode && typeof window !== 'undefined') {
      localStorage.setItem('adhub_offline_session', JSON.stringify(user));
    }

    return { user, error: null };
  } catch (error: any) {
    console.error('Login error:', error);
    return { user: null, error: error.message || 'حدث خطأ أثناء تسجيل الدخول' };
  }
};

// تسجيل مستخدم جديد باستخدام Supabase Auth
export const registerUser = async (userData: RegisterData): Promise<{ user: User | null; error: string | null }> => {
  try {
    // Validate input
    const validation = registerSchema.safeParse(userData);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return { user: null, error: firstError.message };
    }

    const validatedData = validation.data;

    // التحقق من عدم وجود اسم المستخدم مسبقاً
    if (validatedData.username) {
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', validatedData.username)
        .maybeSingle();
      
      if (existingUser) {
        return { user: null, error: 'اسم المستخدم مستخدم بالفعل' };
      }
    }

    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email: validatedData.email,
      password: validatedData.password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name: validatedData.name,
          username: validatedData.username,
          phone: validatedData.phone,
          company: validatedData.company,
        }
      }
    });

    if (error) {
      if (error.message.includes('already registered')) {
        return { user: null, error: 'البريد الإلكتروني مستخدم بالفعل' };
      }
      return { user: null, error: error.message || 'حدث خطأ أثناء التسجيل' };
    }

    if (!data.user) {
      return { user: null, error: 'حدث خطأ أثناء إنشاء الحساب' };
    }

    // انتظار قصير لضمان تنفيذ triggers
    await new Promise(resolve => setTimeout(resolve, 500));

    // جلب بيانات المستخدم من profiles
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', data.user.id)
      .maybeSingle();

    // إنشاء دور افتراضي إذا لم يكن موجوداً
    if (!roleData) {
      await supabase
        .from('user_roles')
        .insert({ user_id: data.user.id, role: 'user' });
    }

    // تحديث اسم المستخدم إذا تم توفيره
    if (validatedData.username && profileData) {
      await supabase
        .from('profiles')
        .update({ username: validatedData.username })
        .eq('id', data.user.id);
    }

    // جلب الصلاحيات من الدور
    const { permissions, roleName } = await fetchRolePermissions(data.user.id);

    const user: User = {
      id: data.user.id,
      email: data.user.email || '',
      name: profileData?.name || userData.name,
      username: validatedData.username || profileData?.username,
      role: (['admin', 'sub_admin', 'accountant', 'customer', 'marketer'].includes(roleName) ? roleName : 'user') as User['role'],
      roleName: roleName,
      phone: profileData?.phone || userData.phone,
      company: profileData?.company || userData.company,
      permissions: permissions, // Role-based permissions ONLY
    };

    return { user, error: null };
  } catch (error: any) {
    console.error('Registration error:', error);
    return { user: null, error: error.message || 'حدث خطأ أثناء التسجيل' };
  }
};

// تسجيل الخروج
export const logoutUser = async (): Promise<void> => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('adhub_offline_session');
  }
  try {
    await supabase.auth.signOut();
  } catch (e) {}
};

// الحصول على المستخدم الحالي
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    if (isOfflineMode) {
      const savedOffline = typeof window !== 'undefined' && localStorage.getItem('adhub_offline_session');
      if (savedOffline) {
        return JSON.parse(savedOffline);
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      if (isOfflineMode) {
        const savedOffline = typeof window !== 'undefined' && localStorage.getItem('adhub_offline_session');
        if (savedOffline) return JSON.parse(savedOffline);
      }
      return null;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    // جلب الصلاحيات من الدور فقط (role-based permissions only)
    const { permissions, roleName } = await fetchRolePermissions(user.id);

    return {
      id: user.id,
      email: user.email || '',
      name: profileData?.name || '',
      username: profileData?.username || undefined,
      role: (['admin', 'sub_admin', 'accountant', 'customer', 'marketer'].includes(roleName) ? roleName : 'user') as User['role'],
      roleName: roleName,
      phone: profileData?.phone || undefined,
      company: profileData?.company || undefined,
      pricingCategory: profileData?.pricing_category || null,
      allowedCustomers: profileData?.allowed_customers || null,
      linkedCustomerId: profileData?.linked_customer_id || null,
      approved: profileData?.approved,
      status: profileData?.status as 'pending' | 'approved' | 'rejected',
      permissions: permissions,
    };
  } catch {
    return null;
  }
};

// التحقق من صلاحية المدير
export const isAdmin = (user: User | null): boolean => {
  return user?.role === 'admin';
};
