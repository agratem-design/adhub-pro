import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Layers, Receipt, MapPin, Search, Workflow } from 'lucide-react';

const BentoFeatures: React.FC = () => {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-14"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-semibold text-primary">مزايانا</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-foreground leading-tight mb-3">
            فكّر أقل في الأدوات.
            <br />
            <span className="text-primary">ركّز على عملك.</span>
          </h2>
          <p className="text-muted-foreground max-w-xl">
            مجموعة متكاملة لتنظيم فريقك وعقودك ولوحاتك بكفاءة وسلاسة.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Workflow - small */}
          <BentoCard className="md:col-span-1" delay={0}>
            <div className="relative h-44 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/15 flex items-center justify-center mb-5 overflow-hidden">
              <Workflow className="h-16 w-16 text-primary/80" strokeWidth={1.5} />
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-primary/90 text-primary-foreground text-[10px] font-bold">
                + مهمة جديدة
              </div>
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">سير عمل الفريق</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              عيّن المهام وحدّد الأولويات في الوقت الفعلي لتعاون أكثر سلاسة.
            </p>
          </BentoCard>

          {/* Cloud Backup - large */}
          <BentoCard className="md:col-span-2" delay={0.1}>
            <div className="grid md:grid-cols-2 gap-6 items-center">
              <div>
                <h3 className="text-2xl font-black text-foreground mb-2">نسخ سحابي آمن</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  بياناتك محفوظة بأمان في السحابة، محدّثة دائماً وقابلة للاسترداد في أي وقت.
                </p>
              </div>
              <div className="relative h-44 rounded-xl bg-gradient-to-br from-primary/30 via-primary/15 to-transparent border border-primary/20 flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,hsl(var(--primary)/0.4),transparent_60%)]" />
                <Layers className="h-20 w-20 text-primary relative z-10" strokeWidth={1.2} />
              </div>
            </div>
          </BentoCard>

          {/* Search - large */}
          <BentoCard className="md:col-span-2" delay={0.2}>
            <div className="grid md:grid-cols-2 gap-6 items-center">
              <div className="relative h-32 rounded-xl bg-gradient-to-br from-muted/40 to-transparent border border-border/50 flex items-center px-4 overflow-hidden">
                <Search className="h-4 w-4 text-muted-foreground ml-2" />
                <input
                  disabled
                  placeholder="ابحث عن أي شيء..."
                  className="bg-transparent flex-1 text-sm text-muted-foreground outline-none"
                />
                <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-primary/20 blur-3xl" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-foreground mb-2">بحث موحّد</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  جد العقود واللوحات والفواتير عبر بحث واحد سريع في كامل النظام.
                </p>
              </div>
            </div>
          </BentoCard>

          {/* Integrations - small */}
          <BentoCard className="md:col-span-1" delay={0.3}>
            <div className="relative h-44 rounded-xl bg-gradient-to-br from-primary/15 to-transparent border border-primary/15 flex items-center justify-center mb-5 overflow-hidden">
              <div className="grid grid-cols-3 gap-3">
                {[Receipt, FileText, MapPin, Layers, Workflow, Search].map((Ic, i) => (
                  <div key={i} className="w-10 h-10 rounded-lg bg-card/80 border border-border flex items-center justify-center">
                    <Ic className="h-4 w-4 text-primary" />
                  </div>
                ))}
              </div>
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">تكاملات شاملة</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              ربط مع WhatsApp والخرائط والطابعات وأدواتك المفضّلة بسلاسة.
            </p>
          </BentoCard>
        </div>
      </div>
    </section>
  );
};

const BentoCard: React.FC<{ children: React.ReactNode; className?: string; delay?: number }> = ({ children, className, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay }}
    className={`group relative p-6 rounded-2xl bg-card/60 backdrop-blur-sm border border-border hover:border-primary/30 transition-all duration-500 hover:shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.3)] ${className || ''}`}
  >
    {children}
  </motion.div>
);

export default BentoFeatures;
