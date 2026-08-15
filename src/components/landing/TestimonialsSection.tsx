import React from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const testimonials = [
  {
    name: 'أحمد المنصوري',
    role: 'مدير تسويق',
    text: 'النظام غيّر طريقة عملنا بالكامل. كل شيء منظم وسلس، وأصبح متابعة العقود واللوحات أمراً سهلاً.',
  },
  {
    name: 'سارة العلي',
    role: 'مديرة حسابات',
    text: 'أفضل منصة جربتها لإدارة الفواتير والمدفوعات. التقارير دقيقة والواجهة احترافية.',
  },
  {
    name: 'خالد إبراهيم',
    role: 'صاحب وكالة إعلانية',
    text: 'تغطية مذهلة للوحات وخدمة عملاء استثنائية. أوصي به بشدة لأي وكالة إعلانية.',
  },
];

const TestimonialsSection: React.FC = () => {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <span className="text-xs font-semibold text-primary">آراء العملاء</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-foreground leading-tight">
            عملاء انتقلوا إلينا
            <br />
            <span className="text-primary">ولم يندموا.</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group p-6 rounded-2xl bg-card/60 backdrop-blur-sm border border-border hover:border-primary/30 transition-all duration-500"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-foreground text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </div>
              <div className="flex gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="h-3.5 w-3.5 fill-primary text-primary" />
                ))}
                <span className="text-xs font-bold text-primary mr-2">5.0</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{t.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
