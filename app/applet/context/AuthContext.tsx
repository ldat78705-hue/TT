import React, { createContext, useState, ReactNode, useEffect } from 'react';
import { UserRole, Teacher, Staff, Student } from '../types';
import { useData } from '../hooks/useDataContext';
import { loginApi } from '../services/api';

const ADMIN_ID = 'ADMIN_USER';
const VIEWER_ID = 'VIEWER_USER';
const LOCAL_STORAGE_KEY = 'educenter_user_session';

interface AdminUser {
    id: string;
    name: string;
    role: UserRole.ADMIN;
}

interface ViewerUser {
    id: string;
    name: string;
    role: UserRole.VIEWER;
}

type AuthenticatedUser = Teacher | Staff | Student | AdminUser | ViewerUser;

interface AuthState {
  isAuthenticated: boolean;
  role: UserRole | null;
  user: AuthenticatedUser | null;
}

interface StoredSession {
    userId: string;
    role: UserRole;
    token: string;
}

interface AuthContextType extends AuthState {
  login: (identifier: string, password?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    role: null,
    user: null
  });
  const [isAuthLoading, setAuthLoading] = useState(true);
  const [storedSession, setStoredSession] = useState<StoredSession | null>(null);

  const { state } = useData();
  const { students, teachers, staff, loading: isDataLoading } = state;
  
  // Step 1: Check for a stored session on initial load
  useEffect(() => {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
            setStoredSession(JSON.parse(stored));
        } else {
            setAuthLoading(false); // No session, stop auth loading if data is also ready
        }
    } catch (error) {
        console.error("Failed to parse user session from localStorage", error);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        setAuthLoading(false);
    }
  }, []);

  // Step 2: Once data is loaded, try to authenticate with the stored session
  useEffect(() => {
    if (!isDataLoading && storedSession) {
        // The 'Student' type does not have a 'role' property, so we must rely
        // on the role returned by findUserInState.
        const { user, role } = findUserInState(storedSession.userId);
        if (user && role === storedSession.role) {
            setAuth({ isAuthenticated: true, user, role });
        } else {
            // User not found or role mismatch, clear invalid session
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
        setAuthLoading(false); // Auth process is complete
    } else if (!isDataLoading && !storedSession) {
        setAuthLoading(false); // Data is ready, and there was no session to check
    }
  }, [isDataLoading, storedSession, students, teachers, staff]);


  const findUserInState = (identifier: string): { user: AuthenticatedUser | null; role: UserRole | null } => {
    const upperIdentifier = identifier.toUpperCase();

    if (upperIdentifier === 'ADMIN' || upperIdentifier === ADMIN_ID) {
        const adminName = (state.settings as any)?.adminDisplayName || 'Admin';
        const adminUser: AdminUser = { id: ADMIN_ID, name: adminName, role: UserRole.ADMIN };
        return { user: adminUser, role: UserRole.ADMIN };
    }
    
    if (upperIdentifier === 'VIEWER' || upperIdentifier === VIEWER_ID) {
        const viewerUser: ViewerUser = { id: VIEWER_ID, name: 'Viewer', role: UserRole.VIEWER };
        return { user: viewerUser, role: UserRole.VIEWER };
    }
    
    const teacher = teachers.find(u => u.id.toUpperCase() === upperIdentifier);
    if (teacher) return { user: teacher, role: teacher.role };
    
    const staffMember = staff.find(u => u.id.toUpperCase() === upperIdentifier);
    if (staffMember) return { user: staffMember, role: staffMember.role };

    const student = students.find(s => s.id.toUpperCase() === upperIdentifier);
    if (student) return { user: student, role: UserRole.PARENT };

    return { user: null, role: null };
  }


  const login = async (identifier: string, password?: string): Promise<boolean> => {
    if (!password) return false;

    try {
      const response = await loginApi(identifier, password);
      if (response && response.token && response.user && response.role) {
        setAuth({ isAuthenticated: true, user: response.user, role: response.role });
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ 
            userId: response.user.id, 
            role: response.role,
            token: response.token 
        }));
        setStoredSession({ userId: response.user.id, role: response.role, token: response.token });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Login Error:", error);
      return false;
    }
  };

  const logout = async () => {
    setAuth({ isAuthenticated: false, role: null, user: null });
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setStoredSession(null);
  };
  
  const value = { ...auth, login, logout, isAuthLoading };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
