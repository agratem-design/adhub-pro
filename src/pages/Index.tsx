import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, LogIn, Database, Wifi, WifiOff, Settings2, Server } from 'lucide-react';
import { loginUser, LoginCredentials } from '@/services/authService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { BRAND_NAME } from '@/lib/branding';
import { useBranding } from '@/hooks/useBranding';
import { isOfflineMode, getOfflineSettings } from '@/integrations/supabase/client';
import { DatabaseModeModal } from '@/components/database/DatabaseModeModal';
import { cn } from '@/lib/utils';

const Index = () => {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const { logoUrl: BRAND_LOGO } = useBranding();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginData, setLoginData] = useState<LoginCredentials>({ email: '', password: '' });
  const [dbModalOpen, setDbModalOpen] = useState(false);

  const offlineSettings = getOfflineSettings();

  if (user) {
    return <Navigate to="/admin" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { user, error } = await loginUser(loginData);

    if (error) {
      setError(error);
    } else if (user) {
      login(user);
      toast({ title: 'تم تسجيل الدخول بنجاح', description: `مرحباً ${user.name}` });
      navigate('/admin');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md space-y-4">
        {/* Brand Header */}
        <div className="text-center">
          <img src={BRAND_LOGO} alt={BRAND_NAME} className="mx-auto mb-3 h-14 md:h-16 w-auto drop-shadow-md" />
          <h1 className="text-lg font-bold text-foreground">{BRAND_NAME}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">منظومة إدارة وحسابات اللوحات الإعلانية</p>
        </div>

        {/* Database Connection Status Pill */}
        <div
          onClick={() => setDbModalOpen(true)}
          className="p-3 rounded-xl border border-border/80 bg-card/90 shadow-sm flex items-center justify-between gap-2 cursor-pointer hover:border-primary/60 transition-all hover:bg-card"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn(
              'p-2 rounded-lg shrink-0',
              isOfflineMode ? 'bg-blue-500/10 text-blue-500' : 'bg-emerald-500/10 text-emerald-500'
            )}>
              {isOfflineMode ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground">
                  {isOfflineMode ? 'قاعدة بيانات محلية (Offline)' : 'قاعدة بيانات سحابية (Online)'}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[9px] px-1.5 py-0 font-semibold',
                    isOfflineMode
                      ? 'border-blue-500/30 text-blue-500 bg-blue-500/5'
                      : 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5'
                  )}
                >
                  {isOfflineMode ? 'محلي' : 'سحابي'}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground truncate font-sans mt-0.5">
                {isOfflineMode ? (offlineSettings.localUrl || 'http://127.0.0.1:54321') : '🔒 اتصال سحابي مشفر ومحمي'}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setDbModalOpen(true);
            }}
            className="h-8 text-xs px-3 shrink-0 gap-1.5 font-bold border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
          >
            <Database className="w-3.5 h-3.5" />
            <span>إدارة النسخ / التبديل</span>
          </Button>
        </div>

        {/* Login Card */}
        <Card className="border-border/80 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <LogIn className="h-4.5 w-4.5 text-primary" />
              تسجيل الدخول
            </CardTitle>
            <CardDescription className="text-xs">أدخل بياناتك للوصول إلى لوحة التحكم</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="loginEmail" className="text-xs font-semibold">
                  البريد الإلكتروني أو اسم المستخدم
                </Label>
                <Input
                  id="loginEmail"
                  type="text"
                  value={loginData.email}
                  onChange={(e) => setLoginData((p) => ({ ...p, email: e.target.value }))}
                  required
                  placeholder="البريد الإلكتروني أو اسم المستخدم"
                  className="h-9 text-sm"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="loginPassword" className="text-xs font-semibold">
                  كلمة المرور
                </Label>
                <div className="relative">
                  <Input
                    id="loginPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={loginData.password}
                    onChange={(e) => setLoginData((p) => ({ ...p, password: e.target.value }))}
                    required
                    placeholder="كلمة المرور"
                    className="h-9 text-sm pl-9"
                    dir="ltr"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute left-0 top-0 h-full px-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {error && (
                <Alert variant="destructive" className="py-2 text-xs">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full h-9 font-bold text-sm bg-primary hover:bg-primary/90" disabled={isLoading}>
                {isLoading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Database Mode Switcher & Backup Restore Modal */}
      <DatabaseModeModal open={dbModalOpen} onOpenChange={setDbModalOpen} />
    </div>
  );
};

export default Index;
