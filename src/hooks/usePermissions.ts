/**
 * usePermissions - Hook for role-based permission checks
 * 
 * Usage:
 *   const { canView, canEditSection, isAdmin } = usePermissions('billboards');
 *   if (!canEditSection) hide edit buttons
 */
import { useAuth } from '@/contexts/AuthContext';

export function usePermissions(section?: string) {
  const { user, isAdmin, hasPermission, canEdit, isLoading } = useAuth();

  return {
    isLoading,
    isAdmin,
    user,
    roleName: user?.roleName || user?.role || 'user',
    
    /** Can the user view this section? */
    canView: section ? hasPermission(section) : true,
    
    /** Can the user edit in this section? */
    canEditSection: section ? canEdit(section) : isAdmin,
    
    /** Generic permission check */
    hasPermission,
    canEdit,
  };
}
