import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const plans = [
  {
    name: 'استكشاف',
    price: 'مجاني',
    desc: 'للأفراد والشركات الصغيرة للبدء.',
    features: ['تصفّح اللوحات المتاحة', 'حجز محدود', 'دعم أساسي'],
    cta: 'ابدأ الآن',
    featured: false,
  },
  {
    name: 'احترافي',
    price: 'حسب الباقة',
    desc: 'للشركات النامية التي تحتاج تكاملاً أعمق.',
    features: ['عقود غير محدودة', 'فواتير ذكية', 'تقارير متقدمة', 'دعم أولوية'],
    cta: 'تواصل معنا',
    featured: true,
  },
  {
    name: 'أعمال',
    price: 'مخصّص',
    desc: 'لكبار الوكالات والمؤسسات.',
    features: ['كل المزايا', 'لوحة تحكم مخصّصة', 'مدير حساب مخصّص', 'تدريب الفريق'],
    cta: 'تواصل معنا',
    featured: false,
  },
];

const PricingPlans: React.FC = () => {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <span className="text-xs font-semibold text-primary">الباقات</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-foreground leading-tight">
            باقات تناسب
            <br />
            <span className="text-primary">جميع الأحجام.</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {plans.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`relative p-7 rounded-2xl border transition-all duration-500 ${
                p.featured
                  ? 'bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border-primary/40 shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.5)] md:scale-105'
                  : 'bg-card/60 border-border hover:border-primary/30'
              }`}
            >
              {p.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold tracking-wide">
                  الأكثر طلباً
                </div>
              )}
              <div className="text-sm text-muted-foreground mb-2">{p.name}</div>
              <div className="text-4xl font-black text-foreground mb-1 tabular-nums">{p.price}</div>
              <p className="text-xs text-muted-foreground mb-6">{p.desc}</p>

              <Link to="/auth">
                <Button
                  className={`w-full rounded-full font-bold mb-6 ${
                    p.featured
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_8px_24px_hsl(var(--primary)/0.4)]'
                      : 'bg-card border border-primary/30 text-foreground hover:bg-primary/10'
                  }`}
                >
                  {p.cta}
                </Button>
              </Link>

              <div className="space-y-3 pt-5 border-t border-border/50">
                {p.features.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-foreground/80">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingPlans;
