import React from 'react';
import { Link } from 'react-router-dom';
import { useBranding } from '@/hooks/useBranding';
import { BRAND_NAME } from '@/lib/branding';

const LandingFooter: React.FC = () => {
  const { logoUrl } = useBranding();

  return (
    <footer className="py-14 border-t border-border bg-card/30">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2">
            <div className="flex items-center gap-3 mb-3">
              <img src={logoUrl} alt={BRAND_NAME || 'Logo'} className="h-9 w-auto" />
              <span className="font-bold text-foreground">{BRAND_NAME || 'العلامة'}</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              منصّة إعلانات متكاملة لإدارة اللوحات والعقود والفواتير في مكان واحد.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-foreground mb-3 text-sm">روابط</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#available-billboards" className="hover:text-primary transition-colors">اللوحات</a></li>
              <li><Link to="/auth" className="hover:text-primary transition-colors">تسجيل الدخول</Link></li>
              <li><a href="#" className="hover:text-primary transition-colors">من نحن</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-foreground mb-3 text-sm">المصادر</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-primary transition-colors">سياسة الخصوصية</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">الدعم</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">شروط الاستخدام</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-border/60 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {BRAND_NAME || 'العلامة'}. جميع الحقوق محفوظة.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
