/**
 * ProtectedRoute - Role-Based Permission Guard
 * 
 * IMPORTANT: Permissions are role-based only. User-level permissions are deprecated.
 * Access is granted based on hasPermission(permissionName) derived from user's role.
 * Do NOT use isAdmin for access control - use hasPermission instead.
 * Must be used within AuthProvider context.
 */
import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface ProtectedRouteProps {
  children: ReactNode;
  /** @deprecated Use requiredPermission instead */
  requireAdmin?: boolean;
  requiredPermission?: string;
}

/**
 * Maps route paths to their required permission names.
 * Permission names must match EXACTLY what's stored in the role's permissions array.
 */
const PATH_PERMISSION_MAP: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/admin': 'dashboard',
  '/admin/billboards': 'billboards',
  '/admin/billboard-photos': 'billboard_photos',
  '/admin/billboard-cleanup': 'billboard_cleanup',
  '/admin/billboard-maintenance': 'billboard_maintenance',
  '/admin/shared-billboards': 'shared_billboards',
  '/admin/friend-billboards': 'friend_billboards',
  '/admin/friend-accounts': 'friend_accounts',
  '/admin/delayed-billboards': 'delayed_billboards',
  '/admin/extended-billboards': 'extended_billboards',
  '/admin/contracts': 'contracts',
  '/admin/customers': 'customers',
  '/admin/customer-billing': 'customer_billing',
  '/admin/customer-merge': 'customer_merge',
  '/admin/overdue-payments': 'overdue_payments',
  '/admin/account-overdue-payments': 'overdue_payments',
  '/admin/reports': 'reports',
  '/admin/kpi-dashboard': 'kpi_dashboard',
  '/admin/profitability-reports': 'profitability_reports',
  '/admin/smart-distribution': 'smart_distribution',
  '/admin/tasks': 'tasks',
  '/admin/installation-tasks': 'installation_tasks',
  '/admin/removal-tasks': 'removal_tasks',
  '/admin/print-tasks': 'print_tasks',
  '/admin/cutout-tasks': 'cutout_tasks',
  '/admin/composite-tasks': 'composite_tasks',
  '/admin/expenses': 'expenses',
  '/admin/expense-management': 'expenses',
  '/admin/salaries': 'salaries',
  '/admin/employees': 'salaries',
  '/admin/custody-management': 'custody',
  '/admin/settings': 'settings',
  '/admin/system-settings': 'system_settings',
  '/admin/print-design': 'print_design',
  
  '/admin/billboard-print-settings': 'billboard_print_settings',
  '/admin/billboard-print-settings-old': 'billboard_print_settings',
  '/admin/quick-print-settings': 'quick_print_settings',
  '/admin/pdf-templates': 'pdf_templates',
  '/admin/contract-terms': 'contract_terms',
  '/admin/messaging-settings': 'messaging_settings',
  '/admin/currency-settings': 'currency_settings',
  '/admin/database-backup': 'database_backup',
  '/admin/database-setup': 'database_setup',
  '/admin/users': 'users',
  '/admin/roles': 'roles',
  '/admin/pricing': 'pricing',
  '/admin/export-pricing': 'export_pricing',
  '/admin/pricing-factors': 'pricing_factors',
  '/admin/offers': 'offers',
  '/admin/printers': 'printers',
  '/admin/printer-accounts': 'printer_accounts',
  '/admin/installation-teams': 'installation_teams',
  '/admin/installation-team-accounts': 'installation_team_accounts',
  '/admin/booking-requests': 'booking_requests',
  '/admin/shared-companies': 'shared_companies',
  '/admin/printed-invoices-page': 'printed_invoices_page',
  '/admin/payments-receipts-page': 'payments',
  '/admin/revenue': 'revenue',
  '/admin/municipality-stickers': 'municipality_stickers',
  '/admin/municipality-stats': 'municipality_stats',
  '/admin/municipality-rent-prices': 'municipality_rent_prices',
  '/admin/municipality-organizer': 'municipality_organizer',
  '/admin/image-gallery': 'image_gallery',
  '/admin/drive-uploader': 'settings',
  '/admin/activity-log': 'activity_log',
};

/**
 * Get required permission for a given path.
 * First tries exact match, then prefix match (longest first).
 */
const getRequiredPermission = (pathname: string): string | null => {
  // 1) Exact match
  if (PATH_PERMISSION_MAP[pathname]) {
    return PATH_PERMISSION_MAP[pathname];
  }

  // 2) Prefix match (longest path first, excluding /admin and /dashboard base paths)
  const prefixMatch = Object.entries(PATH_PERMISSION_MAP)
    .filter(([path]) => path !== '/admin' && path !== '/dashboard')
    .filter(([path]) => pathname.startsWith(path + '/') || pathname.startsWith(path))
    .sort((a, b) => b[0].length - a[0].length)[0];

  return prefixMatch ? prefixMatch[1] : null;
};

export const ProtectedRoute = ({ children, requiredPermission }: ProtectedRouteProps) => {
  const { user, loading, hasPermission } = useAuth();
  const location = useLocation();

  // Wait for auth to complete loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Not logged in - redirect to auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Determine the required permission
  const permission = requiredPermission || getRequiredPermission(location.pathname);

  // If no specific permission required, allow access (authenticated user)
  if (!permission) {
    return <>{children}</>;
  }

  // Check if user has the required permission (role-based)
  if (hasPermission(permission)) {
    return (
      <ErrorBoundary resetKeys={[location.pathname]}>
        {children}
      </ErrorBoundary>
    );
  }

  // User lacks permission - redirect to home
  return <Navigate to="/" replace />;
};