import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const FinalCTA: React.FC = () => {
  const { user } = useAuth();

  return (
    <section className="py-20 relative">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border border-primary/30 px-6 py-20 text-center"
        >
          {/* Radial glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle,hsl(var(--primary)/0.4),transparent_70%)] blur-3xl pointer-events-none" />

          {/* Concentric arcs */}
          <svg
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-50 pointer-events-none"
            viewBox="0 0 800 400"
            fill="none"
          >
            {[120, 180, 240, 300].map((r) => (
              <circle key={r} cx="400" cy="350" r={r} stroke="hsl(var(--primary))" strokeOpacity="0.3" strokeWidth="1" />
            ))}
          </svg>

          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-black text-foreground mb-3 leading-tight">
              جاهز لإنجاز
              <br />
              <span className="text-primary">حملتك الإعلانية؟</span>
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              اعمل بذكاء أكبر. كل شيء في مكان واحد.
            </p>
            <Link to={user ? '/admin' : '/auth'}>
              <Button
                size="lg"
                className="rounded-full px-10 py-6 h-auto text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_8px_32px_hsl(var(--primary)/0.5)] hover:shadow-[0_12px_40px_hsl(var(--primary)/0.7)] transition-all hover:scale-105"
              >
                {user ? 'لوحة التحكم' : 'ابدأ مجاناً'}
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FinalCTA;
