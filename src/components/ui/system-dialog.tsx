import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface SystemDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export const SystemDialog: React.FC<SystemDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'موافق',
  cancelText = 'إلغاء'
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return createPortal(
    <div className="custom-confirm-overlay" onClick={onCancel}>
      <div className="custom-confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="system-dialog-header">
          <h3 className="system-dialog-title">{title}</h3>
        </div>
        <div className="system-dialog-content">
          <p style={{ whiteSpace: 'pre-line', lineHeight: '1.6' }}>{message}</p>
          <div className="system-dialog-buttons">
            <button
              className="system-btn-secondary"
              onClick={onCancel}
              autoFocus
            >
              {cancelText}
            </button>
            <button
              className="system-btn-primary"
              onClick={onConfirm}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Hook لاستخدام النافذة المنبثقة المخصصة
export const useSystemDialog = () => {
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {}
  });

  const showDialog = (
    title: string,
    message: string,
    confirmText?: string,
    cancelText?: string
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({
        isOpen: true,
        title,
        message,
        confirmText,
        cancelText,
        onConfirm: () => {
          setDialog(prev => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setDialog(prev => ({ ...prev, isOpen: false }));
          resolve(false);
        }
      });
    });
  };

  const DialogComponent = () => (
    <SystemDialog {...dialog} />
  );

  return { showDialog, DialogComponent };
};