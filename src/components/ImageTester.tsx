import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface ImageTestResult {
  path: string;
  status: 'loading' | 'success' | 'error';
  error?: string;
}

export const ImageTester: React.FC = () => {
  const [testImageName, setTestImageName] = useState('KH-SK0652.jpg');
  const [testResults, setTestResults] = useState<ImageTestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const testImagePaths = (imageName: string) => {
    const paths = [
      `/image/${imageName}`,
      `./image/${imageName}`,
      `/public/image/${imageName}`,
      `./public/image/${imageName}`,
      `/workspace/uploads/7/public/image/${imageName}`,
      `image/${imageName}`,
      `public/image/${imageName}`
    ];

    setIsLoading(true);
    setTestResults([]);

    paths.forEach(path => {
      const result: ImageTestResult = { path, status: 'loading' };
      setTestResults(prev => [...prev, result]);

      const img = new Image();
      
      img.onload = () => {
        setTestResults(prev => 
          prev.map(r => 
            r.path === path 
              ? { ...r, status: 'success' } 
              : r
          )
        );
      };

      img.onerror = (error) => {
        setTestResults(prev => 
          prev.map(r => 
            r.path === path 
              ? { ...r, status: 'error', error: 'فشل تحميل الصورة' } 
              : r
          )
        );
      };

      img.src = path;
    });

    setTimeout(() => setIsLoading(false), 3000);
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-600 animate-pulse" />;
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>اختبار مسارات الصور</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Label>اسم الصورة للاختبار</Label>
            <Input
              value={testImageName}
              onChange={(e) => setTestImageName(e.target.value)}
              placeholder="مثال: KH-SK0652.jpg"
            />
          </div>
          <div className="flex items-end">
            <Button 
              onClick={() => testImagePaths(testImageName)}
              disabled={isLoading || !testImageName}
            >
              اختبار المسارات
            </Button>
          </div>
        </div>

        {testResults.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold">نتائج الاختبار:</h3>
            {testResults.map((result, index) => (
              <div key={index} className="flex items-center gap-3 p-2 border rounded">
                <StatusIcon status={result.status} />
                <code className="flex-1 text-sm bg-gray-100 px-2 py-1 rounded">
                  {result.path}
                </code>
                {result.status === 'success' && (
 <span className="text-green-600 text-sm font-medium"> يعمل</span>
                )}
                {result.status === 'error' && (
 <span className="text-red-600 text-sm"> فشل</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Preview working image */}
        {testResults.some(r => r.status === 'success') && (
          <div className="mt-4">
            <h3 className="font-semibold mb-2">معاينة الصورة الناجحة:</h3>
            <img
              src={testResults.find(r => r.status === 'success')?.path}
              alt="اختبار الصورة"
              className="max-w-full h-48 object-contain border rounded"
              onError={(e) => console.error('Image preview failed:', e)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ImageTester;