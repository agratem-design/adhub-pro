/**
 * usePrint Hook - Universal Print Trigger
 * هوك تشغيل الطباعة الموحد
 */

import { useCallback, useRef } from 'react';
import { PrintConfig } from './types';
import { generateDynamicStyles } from './generateDynamicStyles';

interface UsePrintOptions {
  /** Delay before printing (ms) */
  delay?: number;
  /** Callback before print */
  onBeforePrint?: () => void;
  /** Callback after print */
  onAfterPrint?: () => void;
  /** Document title for print */
  documentTitle?: string;
}

interface UsePrintReturn {
  /** Trigger print for a specific element */
  printElement: (element: HTMLElement | null, config?: PrintConfig) => void;
  /** Trigger print for current window */
  print: () => void;
  /** Open content in new window and print */
  printInNewWindow: (htmlContent: string, config: PrintConfig) => void;
  /** Ref to attach to printable element */
  printRef: React.RefObject<HTMLDivElement>;
}

/**
 * usePrint - Hook for triggering print functionality
 */
export const usePrint = (options: UsePrintOptions = {}): UsePrintReturn => {
  const { delay = 300, onBeforePrint, onAfterPrint, documentTitle } = options;
  const printRef = useRef<HTMLDivElement>(null);

  /**
   * Print current window
   */
  const print = useCallback(() => {
    onBeforePrint?.();
    
    setTimeout(() => {
      window.print();
      onAfterPrint?.();
    }, delay);
  }, [delay, onBeforePrint, onAfterPrint]);

  /**
   * Print a specific element
   */
  const printElement = useCallback(
    (element: HTMLElement | null, config?: PrintConfig) => {
      if (!element) {
        console.warn('usePrint: No element provided for printing');
        return;
      }

      onBeforePrint?.();

      // Clone the element
      const clone = element.cloneNode(true) as HTMLElement;
      
      // Create print container
      const printContainer = document.createElement('div');
      printContainer.id = 'print-container';
      printContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 99999;
        background: white;
        overflow: auto;
      `;
      printContainer.appendChild(clone);

      // Inject styles if config provided
      if (config) {
        const styleEl = document.createElement('style');
        styleEl.textContent = generateDynamicStyles(config);
        printContainer.appendChild(styleEl);
      }

      // Hide original content
      const originalBody = document.body.innerHTML;
      document.body.innerHTML = '';
      document.body.appendChild(printContainer);

      // Set document title
      const originalTitle = document.title;
      if (documentTitle) {
        document.title = documentTitle;
      }

      setTimeout(() => {
        window.print();

        // Restore original content
        document.body.innerHTML = originalBody;
        document.title = originalTitle;

        onAfterPrint?.();
      }, delay);
    },
    [delay, documentTitle, onBeforePrint, onAfterPrint]
  );

  /**
   * Open in new window and print
   */
  const printInNewWindow = useCallback(
    (htmlContent: string, config: PrintConfig) => {
      onBeforePrint?.();

      const printWindow = window.open('', '_blank', 'width=800,height=600');
      
      if (!printWindow) {
        console.error('usePrint: Could not open print window. Check popup blocker.');
        return;
      }

      const fullHtml = `
        <!DOCTYPE html>
        <html dir="${config.page.direction}">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${documentTitle || 'طباعة'}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
          <style>
            ${generateDynamicStyles(config)}
          </style>
        </head>
        <body>
          ${htmlContent}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              }, ${delay});
            };
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(fullHtml);
      printWindow.document.close();

      onAfterPrint?.();
    },
    [delay, documentTitle, onBeforePrint, onAfterPrint]
  );

  return {
    printElement,
    print,
    printInNewWindow,
    printRef,
  };
};

/**
 * Generate complete HTML document for printing
 */
export const generatePrintHTML = (
  bodyContent: string,
  config: PrintConfig,
  title?: string
): string => {
  return `
    <!DOCTYPE html>
    <html dir="${config.page.direction}" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title || 'طباعة'}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
      <style>
        ${generateDynamicStyles(config)}
      </style>
    </head>
    <body>
      ${bodyContent}
    </body>
    </html>
  `;
};

/**
 * Open print window with pre-built HTML
 */
export const openUniversalPrintWindow = (
  htmlContent: string,
  config: PrintConfig,
  title?: string
): Window | null => {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  
  if (!printWindow) {
    console.error('Could not open print window. Please allow popups.');
    return null;
  }

  const fullHtml = generatePrintHTML(htmlContent, config, title);
  
  printWindow.document.write(fullHtml);
  printWindow.document.close();

  // Auto-print after load
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return printWindow;
};

export default usePrint;
