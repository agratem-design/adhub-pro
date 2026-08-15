import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowRight, Search } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />

      <div className="text-center px-6 max-w-2xl">
        <div className="mb-8 flex justify-center">
          <img
            src="/logofaresgold.svg"
            alt="شعار الشركة"
            className="h-24 w-auto animate-in fade-in zoom-in duration-500"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>

        <div className="space-y-6 animate-in slide-in-from-bottom duration-700">
          <div className="relative">
            <h1 className="text-[120px] font-black text-slate-200 leading-none select-none">
              404
            </h1>
            <div className="absolute inset-0 flex items-center justify-center">
              <Search className="h-16 w-16 text-slate-400 animate-pulse" />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-3xl font-bold text-slate-800">
              عذراً، الصفحة غير موجودة
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              الصفحة التي تبحث عنها قد تم نقلها أو حذفها أو لم تعد موجودة
            </p>
            <p className="text-sm text-slate-500 font-mono bg-slate-100 inline-block px-4 py-2 rounded-lg">
              {location.pathname}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
            <Button
              size="lg"
              onClick={() => navigate('/')}
              className="gap-2 min-w-[200px] bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Home className="h-5 w-5" />
              العودة للرئيسية
              <ArrowRight className="h-5 w-5" />
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate(-1)}
              className="gap-2 min-w-[200px] border-2 hover:bg-slate-50 transition-all duration-300"
            >
              الرجوع للصفحة السابقة
            </Button>
          </div>

          <div className="pt-8 text-sm text-slate-500">
            <p>إذا كنت تعتقد أن هذا خطأ، يرجى التواصل مع الدعم الفني</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
