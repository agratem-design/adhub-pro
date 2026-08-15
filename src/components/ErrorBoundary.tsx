import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  resetKeys?: any[];
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught an unhandled runtime error:', error, errorInfo);
  }

  componentDidUpdate(prevProps: Props): void {
    if (!this.state.hasError) return;
    
    // Auto-reset when specified keys change (e.g., URL pathname)
    if (this.props.resetKeys && prevProps.resetKeys) {
      const hasChanged = this.props.resetKeys.some(
        (key, idx) => key !== prevProps.resetKeys?.[idx]
      );
      if (hasChanged) {
        this.handleReset();
      }
    }
  }

  handleReset = (): void => {
    this.props.onReset?.();
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false,
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = '/dashboard';
  };

  handleCopyError = (): void => {
    const errorText = [
      `الخطأ: ${this.state.error?.message || 'غير محدد'}`,
      `المسار: ${window.location.href}`,
      `التاريخ: ${new Date().toISOString()}`,
      `Stack Trace:\n${this.state.error?.stack || ''}`,
      `Component Stack:\n${this.state.errorInfo?.componentStack || ''}`,
    ].join('\n\n');

    navigator.clipboard.writeText(errorText)
      .then(() => {
        this.setState({ copied: true });
        toast.success('تم نسخ تفاصيل الخطأ إلى الحافظة');
        setTimeout(() => this.setState({ copied: false }), 3000);
      })
      .catch(() => {
        toast.error('تعذر نسخ تفاصيل الخطأ');
      });
  };

  toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          dir="rtl"
          className="min-h-[50vh] w-full flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300"
        >
          <Card className="max-w-2xl w-full border-destructive/30 bg-card shadow-2xl overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-amber-500 via-destructive to-amber-600 w-full" />
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive mb-3 shadow-inner">
                <AlertTriangle className="w-7 h-7 stroke-[2.2]" />
              </div>
              <CardTitle className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                حدث خطأ غير متوقع أثناء عرض هذا القسم
              </CardTitle>
              <CardDescription className="text-muted-foreground text-sm mt-1">
                تم اعتراض الخطأ بنجاح لحماية بياناتك ومنع توقف النظام. يمكنك إعادة المحاولة أو العودة للرئيسية.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-2">
              {this.state.error?.message && (
                <div className="p-3.5 rounded-xl bg-destructive/5 border border-destructive/20 text-destructive text-sm font-medium leading-relaxed">
                  <span className="font-bold ml-1">رسالة الخطأ:</span>
                  <span className="font-mono text-xs md:text-sm">{this.state.error.message}</span>
                </div>
              )}

              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={this.toggleDetails}
                  className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <span>التفاصيل التقنية للخطأ (للمطورين)</span>
                  {this.state.showDetails ? (
                    <ChevronUp className="w-4 h-4 ml-1" />
                  ) : (
                    <ChevronDown className="w-4 h-4 ml-1" />
                  )}
                </Button>

                {this.state.showDetails && (
                  <div className="mt-2 p-3 rounded-lg bg-muted/60 border border-border text-left font-mono text-xs overflow-x-auto max-h-56 select-text text-muted-foreground space-y-2 dir-ltr">
                    <div>
                      <strong className="text-foreground">Stack:</strong>
                      <pre className="mt-1 whitespace-pre-wrap">{this.state.error?.stack}</pre>
                    </div>
                    {this.state.errorInfo?.componentStack && (
                      <div>
                        <strong className="text-foreground">Component Stack:</strong>
                        <pre className="mt-1 whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-wrap gap-2.5 justify-between items-center bg-muted/30 border-t border-border/50 p-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={this.handleCopyError}
                  className="gap-1.5 text-xs cursor-pointer"
                >
                  {this.state.copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{this.state.copied ? 'تم النسخ' : 'نسخ التقرير'}</span>
                </Button>
              </div>

              <div className="flex gap-2 mr-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={this.handleGoHome}
                  className="gap-1.5 cursor-pointer"
                >
                  <Home className="w-4 h-4" />
                  <span>الرئيسية</span>
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={this.handleReset}
                  className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>إعادة المحاولة</span>
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
