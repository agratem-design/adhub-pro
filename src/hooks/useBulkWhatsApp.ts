import { useState, useRef, useCallback } from 'react';
import { useSendWhatsApp } from './useSendWhatsApp';

export type RecipientStatus = 'pending' | 'sending' | 'sent' | 'failed';

export interface BulkRecipient {
  id: string;
  name: string;
  phone: string;
  status: RecipientStatus;
  error?: string;
  contractNumber?: number;
}

interface UseBulkWhatsAppReturn {
  recipients: BulkRecipient[];
  setRecipients: React.Dispatch<React.SetStateAction<BulkRecipient[]>>;
  isSending: boolean;
  isPaused: boolean;
  progress: { sent: number; failed: number; total: number };
  startSending: (messageTemplate: string) => Promise<void>;
  pauseSending: () => void;
  resumeSending: () => void;
  resetAll: () => void;
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function replaceVariables(template: string, recipient: BulkRecipient): string {
  return template
    .replace(/\{اسم_العميل\}/g, recipient.name)
    .replace(/\{رقم_العقد\}/g, String(recipient.contractNumber || ''))
    .replace(/\{رقم_الهاتف\}/g, recipient.phone);
}

export function useBulkWhatsApp(): UseBulkWhatsAppReturn {
  const { sendMessage } = useSendWhatsApp();
  const [recipients, setRecipients] = useState<BulkRecipient[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const pauseRef = useRef(false);
  const stopRef = useRef(false);
  const templateRef = useRef('');

  const progress = {
    sent: recipients.filter(r => r.status === 'sent').length,
    failed: recipients.filter(r => r.status === 'failed').length,
    total: recipients.length,
  };

  const startSending = useCallback(async (messageTemplate: string) => {
    templateRef.current = messageTemplate;
    stopRef.current = false;
    pauseRef.current = false;
    setIsSending(true);
    setIsPaused(false);

    for (let i = 0; i < recipients.length; i++) {
      if (stopRef.current) break;

      // Wait while paused
      while (pauseRef.current && !stopRef.current) {
        await delay(500);
      }
      if (stopRef.current) break;

      const recipient = recipients[i];
      if (recipient.status === 'sent') continue;
      if (!recipient.phone?.trim()) {
        setRecipients(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'failed', error: 'رقم هاتف مفقود' } : r
        ));
        continue;
      }

      // Mark as sending
      setRecipients(prev => prev.map((r, idx) =>
        idx === i ? { ...r, status: 'sending' } : r
      ));

      const personalizedMessage = replaceVariables(messageTemplate, recipient);

      try {
        const success = await sendMessage({
          phone: recipient.phone,
          message: personalizedMessage,
        });

        setRecipients(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: success ? 'sent' : 'failed', error: success ? undefined : 'فشل الإرسال' } : r
        ));
      } catch (err: any) {
        setRecipients(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'failed', error: err?.message || 'خطأ غير متوقع' } : r
        ));
      }

      // Delay between messages to avoid ban
      if (i < recipients.length - 1 && !stopRef.current) {
        await delay(2500);
      }
    }

    setIsSending(false);
  }, [recipients, sendMessage]);

  const pauseSending = useCallback(() => {
    pauseRef.current = true;
    setIsPaused(true);
  }, []);

  const resumeSending = useCallback(() => {
    pauseRef.current = false;
    setIsPaused(false);
  }, []);

  const resetAll = useCallback(() => {
    stopRef.current = true;
    pauseRef.current = false;
    setIsSending(false);
    setIsPaused(false);
    setRecipients(prev => prev.map(r => ({ ...r, status: 'pending' as const, error: undefined })));
  }, []);

  return {
    recipients,
    setRecipients,
    isSending,
    isPaused,
    progress,
    startSending,
    pauseSending,
    resumeSending,
    resetAll,
  };
}
