/**
 * AuthContext - Role-Based Permission System
 * 
 * IMPORTANT: Permissions are role-based only. User-level permissions are deprecated.
 * All permissions are derived from the user's assigned role in the roles table.
 * To change a user's permissions, change their role via the role management system.
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, getCurrentUser, logoutUser } from '@/services/authService';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';
import { preloadFallbackPaths } from '@/utils/preloadFallbackPaths';

interface AuthContextType {
  user: User | null;
  profile: User | null;
  isLoading: boolean;
  loading: boolean;
  login: (user: User) => void;
  logout: () => void;
  signOut: () => void;
  isAdmin: boolean;
  hasPermission: (permission: string) => boolean;
  canEdit: (section: string) => boolean;
  refreshUserPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user permissions from their role
  const fetchRolePermissions = async (userId: string): Promise<string[]> => {
    try {
      // Get user's role name
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (!userRole?.role) return [];

      // Get permissions from the role definition
      const { data: roleData } = await supabase
        .from('roles')
        .select('permissions')
        .eq('name', userRole.role)
        .maybeSingle();

      return (roleData?.permissions as string[]) || [];
    } catch (error) {
      console.error('Error fetching role permissions:', error);
      return [];
    }
  };

  // Refresh user permissions from role (useful after role change)
  const refreshUserPermissions = async () => {
    if (!user?.id) return;

    const permissions = await fetchRolePermissions(user.id);
    setUser(prev => prev ? { ...prev, permissions } : null);
  };

  useEffect(() => {
    // Set up auth state listener FIRST (without async to prevent deadlock)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        
        // Defer Supabase calls with setTimeout to prevent deadlock
        if (session?.user) {
          setTimeout(async () => {
            const currentUser = await getCurrentUser();
            if (currentUser) {
              // Permissions are role-based only - fetched in getCurrentUser
              setUser(currentUser);
              // Preload fallback paths only after successful auth
              preloadFallbackPaths();
            }
            setIsLoading(false);
          }, 0);
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      
      if (session?.user) {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          preloadFallbackPaths();
        }
        setIsLoading(false);
      } else {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          preloadFallbackPaths();
          setIsLoading(false);
          return;
        }
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = (userData: User) => {
    setUser(userData);
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
  };

  const isAdmin = user?.role === 'admin';

  /**
   * Check if user has a specific permission
   * Permissions are derived ONLY from the user's role.
   * User-level permissions are deprecated and ignored.
   */
  const hasPermission = (permission: string): boolean => {
    if (isAdmin) return true;
    return user?.permissions?.includes(permission) || false;
  };

  /**
   * Check if user can edit a specific section
   * User needs both view permission AND edit permission (section_edit)
   * Admins always have edit access
   */
  const canEdit = (section: string): boolean => {
    if (isAdmin) return true;
    // User can edit if they have both view permission AND edit permission
    const hasViewPermission = user?.permissions?.includes(section) || false;
    const hasEditPermission = user?.permissions?.includes(`${section}_edit`) || false;
    return hasViewPermission && hasEditPermission;
  };

  const value: AuthContextType = {
    user,
    profile: user,
    isLoading,
    loading: isLoading,
    login,
    logout,
    signOut: logout,
    isAdmin,
    hasPermission,
    canEdit,
    refreshUserPermissions
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
