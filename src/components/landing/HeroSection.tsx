import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowDown, Sparkles, BarChart3 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface HeroSectionProps {
  availableCount: number;
}

const HeroSection: React.FC<HeroSectionProps> = ({ availableCount }) => {
  const { user } = useAuth();

  return (
    <section className="relative min-h-[100vh] flex items-center justify-center overflow-hidden">
      {/* Deep dark base */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-accent/10" />

      {/* Radial gold glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[1100px] pointer-events-none">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.35)_0%,hsl(var(--primary)/0.12)_25%,transparent_60%)] blur-2xl" />
      </div>

      {/* Concentric arcs */}
      <svg
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[35%] w-[1400px] h-[900px] pointer-events-none opacity-60"
        viewBox="0 0 1400 900"
        fill="none"
      >
        <defs>
          <linearGradient id="arcGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        {[180, 280, 380, 480, 580].map((r, i) => (
          <circle
            key={r}
            cx="700"
            cy="700"
            r={r}
            stroke="url(#arcGrad)"
            strokeWidth="1.2"
            opacity={0.9 - i * 0.15}
          />
        ))}
      </svg>

      {/* Floating particles */}
      {[
        { top: '18%', left: '12%', size: 'w-1.5 h-1.5', delay: '0s' },
        { top: '32%', right: '14%', size: 'w-2 h-2', delay: '1.5s' },
        { top: '60%', left: '8%', size: 'w-1 h-1', delay: '2s' },
        { top: '70%', right: '10%', size: 'w-1.5 h-1.5', delay: '0.8s' },
        { top: '45%', left: '18%', size: 'w-1 h-1', delay: '3s' },
      ].map((p, i) => (
        <div
          key={i}
          className={`absolute ${p.size} bg-primary/60 rounded-full animate-pulse shadow-[0_0_12px_hsl(var(--primary))]`}
          style={{ top: p.top, left: p.left as any, right: p.right as any, animationDelay: p.delay }}
        />
      ))}

      {/* Content */}
      <div className="container mx-auto px-6 relative z-10 text-center pt-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-5 py-2 bg-primary/10 border border-primary/25 rounded-full mb-8 backdrop-blur-sm"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary tracking-wide">
            {availableCount > 0 ? `${availableCount} لوحة متاحة الآن` : 'منصة إعلانات احترافية'}
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="text-5xl md:text-7xl lg:text-8xl font-black text-foreground mb-6 leading-[1.05] tracking-tight"
        >
          منصّة <span className="bg-gradient-to-b from-primary via-primary to-primary/70 bg-clip-text text-transparent drop-shadow-[0_0_30px_hsl(var(--primary)/0.5)]">إعلانات</span>
          <br />
          <span className="text-muted-foreground/80">تحفظ كل شيء لك</span>
        </motion.h1>

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="h-[2px] w-32 bg-gradient-to-r from-transparent via-primary to-transparent mx-auto mb-8"
        />

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          إدارة شاملة للوحات الإعلانية والعقود والفواتير في مكان واحد.
          <br className="hidden md:block" />
          دائماً قابلة للبحث، ومتزامنة، ومحدّثة بحيث لا يضيع شيء.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.65 }}
          className="flex flex-wrap items-center justify-center gap-4 mb-20"
        >
          {user ? (
            <Link to="/admin">
              <Button size="lg" className="rounded-full px-10 py-6 h-auto text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_8px_32px_hsl(var(--primary)/0.4)] hover:shadow-[0_12px_40px_hsl(var(--primary)/0.6)] transition-all duration-300 hover:scale-105">
                <BarChart3 className="h-5 w-5 ml-2" />
                لوحة التحكم
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/auth">
                <Button size="lg" className="rounded-full px-10 py-6 h-auto text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_8px_32px_hsl(var(--primary)/0.4)] hover:shadow-[0_12px_40px_hsl(var(--primary)/0.6)] transition-all duration-300 hover:scale-105">
                  ابدأ الآن
                </Button>
              </Link>
              <a href="#available-billboards">
                <Button size="lg" variant="outline" className="rounded-full px-10 py-6 h-auto text-base font-semibold border-2 border-primary/30 hover:border-primary/60 hover:bg-primary/5 backdrop-blur-sm transition-all duration-300">
                  استكشف اللوحات
                </Button>
              </a>
            </>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="inline-flex flex-col items-center gap-2 text-muted-foreground/50 animate-bounce-slow"
        >
          <span className="text-xs tracking-[0.2em] uppercase">اكتشف المزيد</span>
          <ArrowDown className="h-4 w-4" />
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
