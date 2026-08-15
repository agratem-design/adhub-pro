/**
 * EditGuard - Only renders children if user has edit permission for the section
 * 
 * Usage:
 *   <EditGuard section="billboards">
 *     <Button onClick={handleEdit}>تعديل</Button>
 *   </EditGuard>
 */
import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface EditGuardProps {
  section: string;
  children: ReactNode;
  /** Optional fallback to show when user lacks permission */
  fallback?: ReactNode;
}

export function EditGuard({ section, children, fallback = null }: EditGuardProps) {
  const { canEdit } = useAuth();
  
  if (!canEdit(section)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}
