/**
 * ContractPDFPreview - يستخدم UnifiedPrintDialog الموحد
 */
import React from 'react';
import { FileText } from 'lucide-react';
import DOMPurify from 'dompurify';
import { UnifiedPrintDialog } from '@/components/print/UnifiedPrintDialog';

interface ContractPDFPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  html: string;
  pdfFilename?: string;
}

export function ContractPDFPreview({ open, onOpenChange, title, html, pdfFilename }: ContractPDFPreviewProps) {
  const sanitizedHtml = React.useMemo(() => {
    return DOMPurify.sanitize(html, {
      ADD_TAGS: ['style', 'link'],
      ADD_ATTR: ['target', 'rel', 'dir', 'lang'],
      WHOLE_DOCUMENT: true,
      RETURN_DOM: false,
    });
  }, [html]);

  return (
    <UnifiedPrintDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      icon={<FileText className="h-5 w-5 text-primary" />}
      html={sanitizedHtml}
      pdfFilename={pdfFilename || title}
    />
  );
}
