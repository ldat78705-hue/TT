
import React, { createContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { Student, Teacher, Staff, Class, AttendanceRecord, Invoice, ProgressReport, Income, Expense, CenterSettings, Payroll, Announcement, Transaction, UserRole, AppData, AuditLog, Room } from '../types';
import * as api from '../services/api';
import { MOCK_SETTINGS } from '../api/_lib/mockData';
import { applyOperation } from '../api/_lib/operations';


interface AppState {
  students: Student[];
  teachers: Teacher[];
  staff: Staff[];
  classes: Class[];
  attendance: AttendanceRecord[];
  invoices: Invoice[];
  progressReports: ProgressReport[];
  transactions: Transaction[];
  income: Income[];
  expenses: Expense[];
  settings: CenterSettings;
  payrolls: Payroll[];
  announcements: Announcement[];
  auditLogs: AuditLog[];
  rooms: Room[];
  loading: boolean;
}

const initialState: AppState = {
  students: [],
  teachers: [],
  staff: [],
  classes: [],
  attendance: [],
  invoices: [],
  progressReports: [],
  transactions: [],
  income: [],
  expenses: [],
  settings: MOCK_SETTINGS,
  payrolls: [],
  announcements: [],
  auditLogs: [],
  rooms: [],
  loading: true,
};

interface DataContextType {
    state: AppState;
    error: string | null;
    setError: React.Dispatch<React.SetStateAction<string | null>>;
    isInitialOffline: boolean;
    refreshData: () => Promise<void>;
    addStudent: (payload: { student: Student, classIds: string[] }) => Promise<void>;
    updateStudent: (payload: { originalId: string, updatedStudent: Student, classIds: string[] }) => Promise<void>;
    deleteStudent: (studentId: string) => Promise<void>;
    addTeacher: (data: Teacher) => Promise<void>;
    updateTeacher: (payload: { originalId: string, updatedTeacher: Teacher }) => Promise<void>;
    deleteTeacher: (teacherId: string) => Promise<void>;
    addStaff: (data: Staff) => Promise<void>;
    updateStaff: (payload: { originalId: string, updatedStaff: Staff }) => Promise<void>;
    deleteStaff: (staffId: string) => Promise<void>;
    addClass: (data: Class) => Promise<void>;
    updateClass: (payload: { originalId: string, updatedClass: Class }) => Promise<void>;
    deleteClass: (classId: string) => Promise<void>;
    updateAttendance: (records: AttendanceRecord[]) => Promise<void>;
    updateSingleAttendance: (payload: { classId: string; studentId: string; date: string; status: string; note?: string }) => Promise<void>;
    addProgressReport: (data: Omit<ProgressReport, 'id'>) => Promise<void>;
    addBulkProgressReports: (records: Omit<ProgressReport, 'id'>[]) => Promise<void>;
    updateProgressReport: (data: ProgressReport) => Promise<void>;
    deleteProgressReport: (reportId: string) => Promise<void>;
    generateInvoices: (payload: { month: number, year: number }) => Promise<void>;
    cancelInvoice: (invoiceId: string) => Promise<void>;
    updateInvoiceStatus: (payload: { invoiceId: string, status: 'PAID' | 'UNPAID' }) => Promise<void>;
    addAdjustment: (payload: { studentId: string; amount: number; date: string; description: string; type: 'CREDIT' | 'DEBIT'; paymentMethod?: 'transfer' | 'cash' }) => Promise<void>;
    updateTransaction: (transaction: Transaction) => Promise<void>;
    deleteTransaction: (transactionId: string) => Promise<void>;
    generatePayrolls: (payload: { month: number, year: number }) => Promise<void>;
    updatePayroll: (payload: { payrollId: string; bonus: number; deduction: number; status: 'PAID' | 'UNPAID' }) => Promise<void>;
    addIncome: (data: Omit<Income, 'id'>) => Promise<void>;
    updateIncome: (item: Income) => Promise<void>;
    deleteIncome: (itemId: string) => Promise<void>;
    addExpense: (data: Omit<Expense, 'id'>) => Promise<void>;
    updateExpense: (item: Expense) => Promise<void>;
    deleteExpense: (itemId: string) => Promise<void>;
    updateSettings: (settings: CenterSettings) => Promise<void>;
    backupData: () => Promise<Omit<AppState, 'loading'>>;
    restoreData: (data: Omit<AppState, 'loading'>) => Promise<void>;
    resetToMockData: () => Promise<void>;
    addAnnouncement: (data: Omit<Announcement, 'id'>) => Promise<void>;
    deleteAnnouncement: (id: string) => Promise<void>;
    deleteAttendanceForDate: (payload: { classId: string, date: string }) => Promise<void>;
    updateUserPassword: (payload: { userId: string; role: UserRole; newPassword: string; currentPassword?: string }) => Promise<void>;
    clearCollections: (collectionKeys: ('students' | 'teachers' | 'staff' | 'classes')[]) => Promise<void>;
    compactData: () => Promise<void>;
    deleteAttendanceByMonth: (payload: { month: number; year: number; }) => Promise<void>;
    clearAllTransactions: () => Promise<void>;
    addRoom: (payload: { name: string; capacity: number; description: string }) => Promise<void>;
    updateRoom: (payload: { id: string; name: string; capacity: number; description: string }) => Promise<void>;
    deleteRoom: (roomId: string) => Promise<void>;
}


export const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [isInitialOffline, setIsInitialOffline] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refreshData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    setError(null);
    setIsInitialOffline(false);
    try {
        const data = await api.loadInitialData();
        setState({ ...data, loading: false });
    } catch (err: any) {
        console.error("Failed to load local data:", err);
        if (err.message === 'Unauthorized') {
            setState(prev => ({ ...prev, loading: false }));
            return;
        }
        setIsInitialOffline(true);
        setError(err.message || 'Không thể tải dữ liệu cục bộ. Vui lòng cho phép trang web lưu trữ dữ liệu và thử lại.');
        setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Helper function to handle API operations that return the full updated state
  // This replaces the manual state updates which were causing type errors
  const handleStateUpdateOperation = <T,>(apiFunc: (payload: T) => Promise<Omit<AppData, 'loading'>>, opName?: string) => async (payload: T) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    
    const previousState = state;
    
    try {
        if (opName) {
            try {
                const stateClone = structuredClone(state);
                let optimisticPayload: any = payload;
                if (opName === 'deleteStudent') optimisticPayload = { studentId: payload };
                else if (opName === 'deleteTeacher') optimisticPayload = { teacherId: payload };
                else if (opName === 'deleteStaff') optimisticPayload = { staffId: payload };
                else if (opName === 'deleteClass') optimisticPayload = { classId: payload };
                else if (opName === 'deleteProgressReport') optimisticPayload = { reportId: payload };
                else if (opName === 'deleteIncome' || opName === 'deleteExpense') optimisticPayload = { itemId: payload };
                else if (opName === 'deleteAnnouncement') optimisticPayload = { id: payload };
                else if (opName === 'deleteTransaction') optimisticPayload = { transactionId: payload };
                else if (opName === 'addBulkProgressReports') optimisticPayload = { records: payload };
                else if (opName === 'cancelInvoice') optimisticPayload = { invoiceId: payload };
                
                const optimisticState = applyOperation(stateClone, { op: opName, payload: optimisticPayload });
                setState({ ...optimisticState, loading: false });
            } catch (e) {
                console.error("Optimistic update failed", e);
            }
        }

        const newState = await apiFunc(payload);
        setState({ ...newState, loading: false });
    } catch (err: any) {
         setState(previousState);
         throw err;
    } finally {
        setIsSubmitting(false);
    }
  };

  const value: DataContextType = {
    state,
    error,
    setError,
    isInitialOffline,
    refreshData,
    
    // All mutations now use the handleStateUpdateOperation helper
    // effectively syncing the local state with the backend's returned state
    addStudent: handleStateUpdateOperation(api.addStudent, 'addStudent'),
    updateStudent: handleStateUpdateOperation(api.updateStudent, 'updateStudent'),
    deleteStudent: handleStateUpdateOperation(api.deleteStudent, 'deleteStudent'),
    
    addTeacher: handleStateUpdateOperation(api.addTeacher, 'addTeacher'),
    updateTeacher: handleStateUpdateOperation(api.updateTeacher, 'updateTeacher'),
    deleteTeacher: handleStateUpdateOperation(api.deleteTeacher, 'deleteTeacher'),
    
    addStaff: handleStateUpdateOperation(api.addStaff, 'addStaff'),
    updateStaff: handleStateUpdateOperation(api.updateStaff, 'updateStaff'),
    deleteStaff: handleStateUpdateOperation(api.deleteStaff, 'deleteStaff'),
    
    addClass: handleStateUpdateOperation(api.addClass, 'addClass'),
    updateClass: handleStateUpdateOperation(api.updateClass, 'updateClass'),
    deleteClass: handleStateUpdateOperation(api.deleteClass, 'deleteClass'),
    
    updateAttendance: handleStateUpdateOperation(api.updateAttendance, 'updateAttendance'),
    updateSingleAttendance: handleStateUpdateOperation(api.updateSingleAttendance, 'updateSingleAttendance'),
    deleteAttendanceForDate: handleStateUpdateOperation(api.deleteAttendanceForDate, 'deleteAttendanceForDate'),
    deleteAttendanceByMonth: handleStateUpdateOperation(api.deleteAttendanceByMonth, 'deleteAttendanceByMonth'),
    
    addProgressReport: handleStateUpdateOperation(api.addProgressReport, 'addProgressReport'),
    addBulkProgressReports: handleStateUpdateOperation((records) => api.addBulkProgressReports({ records }), 'addBulkProgressReports'),
    updateProgressReport: handleStateUpdateOperation(api.updateProgressReport, 'updateProgressReport'),
    deleteProgressReport: handleStateUpdateOperation(api.deleteProgressReport, 'deleteProgressReport'),
    
    generateInvoices: handleStateUpdateOperation(api.generateInvoices, 'generateInvoices'),
    cancelInvoice: handleStateUpdateOperation(api.cancelInvoice, 'cancelInvoice'),
    updateInvoiceStatus: handleStateUpdateOperation(api.updateInvoiceStatus, 'updateInvoiceStatus'),
    
    addAdjustment: handleStateUpdateOperation(api.addAdjustment, 'addAdjustment'),
    updateTransaction: handleStateUpdateOperation(api.updateTransaction, 'updateTransaction'),
    deleteTransaction: handleStateUpdateOperation(api.deleteTransaction, 'deleteTransaction'),
    clearAllTransactions: async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const newState = await api.clearAllTransactions();
            setState({ ...newState, loading: false });
        } catch (err: any) {
            throw err;
        } finally {
            setIsSubmitting(false);
        }
    },

    generatePayrolls: handleStateUpdateOperation(api.generatePayrolls, 'generatePayrolls'),
    updatePayroll: handleStateUpdateOperation(api.updatePayroll, 'updatePayroll'),
    
    addIncome: handleStateUpdateOperation(api.addIncome, 'addIncome'),
    updateIncome: handleStateUpdateOperation(api.updateIncome, 'updateIncome'),
    deleteIncome: handleStateUpdateOperation(api.deleteIncome, 'deleteIncome'),
    
    addExpense: handleStateUpdateOperation(api.addExpense, 'addExpense'),
    updateExpense: handleStateUpdateOperation(api.updateExpense, 'updateExpense'),
    deleteExpense: handleStateUpdateOperation(api.deleteExpense, 'deleteExpense'),
    
    addAnnouncement: handleStateUpdateOperation(api.addAnnouncement, 'addAnnouncement'),
    deleteAnnouncement: handleStateUpdateOperation(api.deleteAnnouncement, 'deleteAnnouncement'),
    
    addRoom: handleStateUpdateOperation(api.addRoom, 'addRoom'),
    updateRoom: handleStateUpdateOperation(api.updateRoom, 'updateRoom'),
    deleteRoom: handleStateUpdateOperation(api.deleteRoom, 'deleteRoom'),
    
    updateSettings: handleStateUpdateOperation(api.updateSettings, 'updateSettings'),
    
    updateUserPassword: handleStateUpdateOperation(api.updateUserPassword, 'updateUserPassword'),
    clearCollections: handleStateUpdateOperation(api.clearCollections, 'clearCollections'),
    compactData: async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const newState = await api.compactData();
            setState({ ...newState, loading: false });
        } catch (err: any) {
            throw err;
        } finally {
            setIsSubmitting(false);
        }
    },
    
    backupData: api.backupData,
    restoreData: handleStateUpdateOperation<Omit<AppData, 'loading'>>(api.restoreData),
    
    resetToMockData: async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const newState = await api.resetToMockData();
            setState({ ...newState, loading: false });
        } catch (err: any) {
            throw err;
        } finally {
            setIsSubmitting(false);
        }
    },
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};
