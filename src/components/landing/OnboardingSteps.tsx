import React from 'react';
import { motion } from 'framer-motion';

const steps = [
  { num: 1, title: 'سجّل دخولك', desc: 'أنشئ حسابك وأعدّ ملف شركتك في دقائق.' },
  { num: 2, title: 'اختر اللوحات', desc: 'استعرض اللوحات المتاحة على الخريطة وحدّد ما يناسبك.' },
  { num: 3, title: 'احجز فوراً', desc: 'تابع العقد والفاتورة والمهام من لوحة موحّدة.' },
];

const OnboardingSteps: React.FC = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <span className="text-xs font-semibold text-primary">كيف يعمل</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-foreground leading-tight">
            جاهز خلال دقائق،
            <br />
            <span className="text-primary">انطلق بسرعة.</span>
          </h2>
        </motion.div>

        {/* Curve path */}
        <div className="relative">
          <svg
            className="absolute inset-x-0 top-12 hidden md:block w-full h-32 pointer-events-none"
            viewBox="0 0 1000 120"
            fill="none"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="pathGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
                <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            <path
              d="M 50 80 Q 250 -20, 500 60 T 950 40"
              stroke="url(#pathGrad)"
              strokeWidth="2.5"
              strokeDasharray="6 6"
              fill="none"
            />
          </svg>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 relative z-10">
            {steps.map((s, i) => (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-primary/30 to-primary/5 border border-primary/30 mb-5 relative shadow-[0_0_40px_hsl(var(--primary)/0.3)]">
                  <span className="text-4xl font-black text-primary tabular-nums">{s.num}</span>
                  <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl -z-10" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">{s.title}</h3>
                <p className="text-muted-foreground leading-relaxed max-w-xs mx-auto text-sm">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default OnboardingSteps;
