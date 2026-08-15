import React from 'react';
import { motion } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  { q: 'كم يستغرق إعداد الحساب؟', a: 'أقل من 5 دقائق. سجّل دخولك واملأ بيانات شركتك ثم ابدأ مباشرة.' },
  { q: 'هل المنصة مجانية فعلاً؟', a: 'نعم، الباقة المجانية تتضمّن المزايا الأساسية. يمكنك الترقية في أي وقت لاحتياجات أكبر.' },
  { q: 'هل بياناتي آمنة؟', a: 'نعم، نستخدم تشفير على مستوى المؤسسات وسياسات صارمة لحماية وصولك وبياناتك.' },
  { q: 'هل يمكنني الربط مع أدواتي الحالية؟', a: 'نعم، ندعم WhatsApp و Telegram والخرائط والطابعات وأدوات الفوترة.' },
  { q: 'هل يمكنني تغيير باقتي لاحقاً؟', a: 'بالتأكيد. يمكنك الترقية أو الإلغاء في أي وقت بدون قيود.' },
];

const FAQSection: React.FC = () => {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-6 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <span className="text-xs font-semibold text-primary">أسئلة شائعة</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-foreground leading-tight">
            كل ما تحتاج معرفته
            <br />
            <span className="text-primary">قبل أن تبدأ.</span>
          </h2>
        </motion.div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((f, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="rounded-xl bg-card/60 backdrop-blur-sm border border-border hover:border-primary/30 transition-colors px-5 data-[state=open]:border-primary/40"
            >
              <AccordionTrigger className="text-right font-semibold text-foreground hover:no-underline py-4 text-sm">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default FAQSection;
