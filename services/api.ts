import {
    Student, Teacher, Staff, Class, AttendanceRecord, ProgressReport, Income, Expense, CenterSettings, Announcement, UserRole, Transaction, AppData
} from '../types';

const LOCAL_STORAGE_KEY = 'educenter_user_session';

const getHeaders = () => {
    const sessionStr = localStorage.getItem(LOCAL_STORAGE_KEY);
    let token = '';
    if (sessionStr) {
        try {
            const session = JSON.parse(sessionStr);
            if (session.token) {
                token = session.token;
            }
        } catch (e) {
            // Ignore parse error
        }
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

export async function loginApi(identifier: string, password?: string, centerId?: string) {
    const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password, centerId }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Đăng nhập thất bại');
    }
    return response.json();
}

export async function fetchCenters(): Promise<{ id: string; name: string; slug: string }[]> {
    try {
        // Public endpoint - no auth needed, returns basic center list
        const response = await fetch('/api/centers-public');
        if (!response.ok) return [];
        const data = await response.json();
        return data.centers || [];
    } catch {
        return [];
    }
}

const CACHE_ETAG_KEY = 'educenter_data_etag';
const CACHE_DATA_KEY = 'educenter_data_cache';

export async function loadInitialData(retries = 2): Promise<Omit<AppData, 'loading'>> {
    try {
        const headers: Record<string, string> = { ...getHeaders() };
        
        // Send ETag for conditional request
        const cachedETag = sessionStorage.getItem(CACHE_ETAG_KEY);
        if (cachedETag) {
            headers['If-None-Match'] = cachedETag;
        }

        const response = await fetch('/api/data', { headers });
        
        if (response.status === 304) {
            // Data not modified — use cached version
            const cachedStr = sessionStorage.getItem(CACHE_DATA_KEY);
            if (cachedStr) {
                try { return JSON.parse(cachedStr); } catch (e) { /* fall through to full fetch */ }
            }
            // Cache corrupted, do full fetch
            sessionStorage.removeItem(CACHE_ETAG_KEY);
            return loadInitialData(retries);
        }

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem(LOCAL_STORAGE_KEY);
                window.dispatchEvent(new Event('unauthorized'));
                throw new Error('Unauthorized');
            }
            if (response.status === 403) {
                try {
                    const errData = await response.json();
                    if (errData.forceLogout) {
                        localStorage.removeItem(LOCAL_STORAGE_KEY);
                        sessionStorage.clear();
                        alert(errData.error || 'Trung tâm đã bị xóa hoặc khóa. Bạn sẽ bị đăng xuất.');
                        window.location.href = '/login';
                        throw new Error(errData.error);
                    }
                } catch (e) {
                    if (e instanceof Error && e.message !== 'Unauthorized') throw e;
                }
            }
            const errorText = await response.text();
            throw new Error(errorText || 'Không thể kết nối đến máy chủ dữ liệu.');
        }

        const data = await response.json();
        
        // Cache the data and ETag for future requests
        const etag = response.headers.get('ETag');
        if (etag) {
            sessionStorage.setItem(CACHE_ETAG_KEY, etag);
            try { sessionStorage.setItem(CACHE_DATA_KEY, JSON.stringify(data)); } catch (e) { /* storage full */ }
        }
        
        return data;
    } catch (error) {
        if (retries > 0 && error instanceof Error && error.message !== 'Unauthorized') {
            console.warn(`Data load failed, retrying... (${retries} attempts left)`);
            await new Promise(res => setTimeout(res, retries > 1 ? 500 : 1000));
            return loadInitialData(retries - 1);
        }
        throw error;
    }
}

async function patchData(operation: { op: string, payload?: any }): Promise<Omit<AppData, 'loading'>> {
    const response = await fetch('/api/data', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(operation),
    });
    if (!response.ok) {
        if (response.status === 401) {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            window.dispatchEvent(new Event('unauthorized'));
            throw new Error('Unauthorized');
        }
        if (response.status === 403) {
            try {
                const errData = await response.json();
                if (errData.forceLogout) {
                    localStorage.removeItem(LOCAL_STORAGE_KEY);
                    sessionStorage.clear();
                    alert(errData.error || 'Trung tâm đã bị xóa hoặc khóa. Bạn sẽ bị đăng xuất.');
                    window.location.href = '/login';
                    throw new Error(errData.error);
                }
            } catch (e) {
                if (e instanceof Error && e.message !== 'Unauthorized') throw e;
            }
        }
        const errorText = await response.text();
        throw new Error(errorText || 'Yêu cầu API thất bại');
    }
    const data = await response.json();
    
    // Update cache with new data after mutation
    const etag = response.headers.get('ETag');
    if (etag) {
        sessionStorage.setItem(CACHE_ETAG_KEY, etag);
        try { sessionStorage.setItem(CACHE_DATA_KEY, JSON.stringify(data)); } catch (e) { /* storage full */ }
    }
    
    return data;
}

// --- API Wrappers for Mutations ---

export const addStudent = (payload: { student: Student, classIds: string[] }) => patchData({ op: 'addStudent', payload });
export const updateStudent = (payload: { originalId: string, updatedStudent: Student, classIds: string[] }) => patchData({ op: 'updateStudent', payload });
export const deleteStudent = (studentId: string) => patchData({ op: 'deleteStudent', payload: { studentId } });
export const archiveStudent = (studentId: string) => patchData({ op: 'archiveStudent', payload: { studentId } });
export const restoreStudent = (studentId: string) => patchData({ op: 'restoreStudent', payload: { studentId } });
export const addStudentNote = (payload: { studentId: string; note: { text: string; createdBy: string } }) => patchData({ op: 'addStudentNote', payload });
export const deleteStudentNote = (payload: { studentId: string; noteId: string }) => patchData({ op: 'deleteStudentNote', payload });
export const updateStudentTags = (payload: { studentId: string; tags: string[] }) => patchData({ op: 'updateStudentTags', payload });

export const addTeacher = (payload: Teacher) => patchData({ op: 'addTeacher', payload });
export const updateTeacher = (payload: { originalId: string, updatedTeacher: Teacher }) => patchData({ op: 'updateTeacher', payload });
export const deleteTeacher = (teacherId: string) => patchData({ op: 'deleteTeacher', payload: { teacherId } });

export const addStaff = (payload: Staff) => patchData({ op: 'addStaff', payload });
export const updateStaff = (payload: { originalId: string, updatedStaff: Staff }) => patchData({ op: 'updateStaff', payload });
export const deleteStaff = (staffId: string) => patchData({ op: 'deleteStaff', payload: { staffId } });

export const addClass = (payload: Class) => patchData({ op: 'addClass', payload });
export const updateClass = (payload: { originalId: string, updatedClass: Class }) => patchData({ op: 'updateClass', payload });
export const deleteClass = (classId: string) => patchData({ op: 'deleteClass', payload: { classId } });

export const updateAttendance = (payload: AttendanceRecord[]) => patchData({ op: 'updateAttendance', payload });
export const updateSingleAttendance = (payload: { classId: string; studentId: string; date: string; status: string; note?: string }) => patchData({ op: 'updateSingleAttendance', payload });
export const deleteAttendanceForDate = (payload: { classId: string, date: string }) => patchData({ op: 'deleteAttendanceForDate', payload });
export const deleteAttendanceByMonth = (payload: { month: number; year: number; }) => patchData({ op: 'deleteAttendanceByMonth', payload });

export const generateInvoices = (payload: { month: number, year: number }) => patchData({ op: 'generateInvoices', payload });
export const cancelInvoice = (invoiceId: string) => patchData({ op: 'cancelInvoice', payload: { invoiceId } });
export const updateInvoiceStatus = (payload: { invoiceId: string, status: 'PAID' | 'UNPAID' }) => patchData({ op: 'updateInvoiceStatus', payload });

export const addAdjustment = (payload: { studentId: string; amount: number; date: string; description: string; type: 'CREDIT' | 'DEBIT'; paymentMethod?: 'transfer' | 'cash' }) => patchData({ op: 'addAdjustment', payload });
export const addAdvancePayment = (payload: { studentId: string; amount: number; date: string; description: string; paymentMethod?: 'transfer' | 'cash'; months?: number; details?: string }) => patchData({ op: 'addAdvancePayment', payload });
export const updateTransaction = (payload: Transaction) => patchData({ op: 'updateTransaction', payload });
export const deleteTransaction = (transactionId: string) => patchData({ op: 'deleteTransaction', payload: { transactionId } });
export const clearAllTransactions = () => patchData({ op: 'clearAllTransactions' });

export const generatePayrolls = (payload: { month: number, year: number }) => patchData({ op: 'generatePayrolls', payload });
export const updatePayroll = (payload: { payrollId: string; bonus: number; deduction: number; status: 'PAID' | 'UNPAID' }) => patchData({ op: 'updatePayroll', payload });

export const updateSettings = (payload: CenterSettings) => patchData({ op: 'updateSettings', payload });
export const updateUserPassword = (payload: { userId: string; role: UserRole; newPassword: string; currentPassword?: string }) => patchData({ op: 'updateUserPassword', payload });

export const addProgressReport = (payload: Omit<ProgressReport, 'id'>) => patchData({ op: 'addProgressReport', payload });
export const addBulkProgressReports = (payload: { records: Omit<ProgressReport, 'id'>[] }) => patchData({ op: 'addBulkProgressReports', payload });
export const updateProgressReport = (payload: ProgressReport) => patchData({ op: 'updateProgressReport', payload });
export const deleteProgressReport = (reportId: string) => patchData({ op: 'deleteProgressReport', payload: { reportId } });

export const addIncome = (payload: Omit<Income, 'id'>) => patchData({ op: 'addIncome', payload });
export const updateIncome = (payload: Income) => patchData({ op: 'updateIncome', payload });
export const deleteIncome = (itemId: string) => patchData({ op: 'deleteIncome', payload: { itemId } });

export const addExpense = (payload: Omit<Expense, 'id'>) => patchData({ op: 'addExpense', payload });
export const updateExpense = (payload: Expense) => patchData({ op: 'updateExpense', payload });
export const deleteExpense = (itemId: string) => patchData({ op: 'deleteExpense', payload: { itemId } });

export const addAnnouncement = (payload: Omit<Announcement, 'id'>) => patchData({ op: 'addAnnouncement', payload });
export const deleteAnnouncement = (id: string) => patchData({ op: 'deleteAnnouncement', payload: { id } });
export const markAnnouncementRead = (payload: { announcementId: string; userId: string }) => patchData({ op: 'markAnnouncementRead', payload });
export const markAnnouncementsReadBatch = (payload: { announcementIds: string[]; userId: string }) => patchData({ op: 'markAnnouncementsReadBatch', payload });

export const addRoom = (payload: { name: string; capacity: number; description: string }) => patchData({ op: 'addRoom', payload });
export const updateRoom = (payload: { id: string; name: string; capacity: number; description: string }) => patchData({ op: 'updateRoom', payload });
export const deleteRoom = (roomId: string) => patchData({ op: 'deleteRoom', payload: { roomId } });

export const clearCollections = (collectionKeys: ('students' | 'teachers' | 'staff' | 'classes')[]) => patchData({ op: 'clearCollections', payload: collectionKeys });
export const compactData = () => patchData({ op: 'compactData', payload: {} });
export const recalculateAllInvoices = () => patchData({ op: 'recalculateAllInvoices', payload: {} });

export async function backupData(): Promise<Omit<AppData, 'loading'>> {
    return loadInitialData();
}

export async function restoreData(data: Omit<AppData, 'loading'>): Promise<Omit<AppData, 'loading'>> {
    return patchData({ op: 'restoreData', payload: data });
}

export const resetToMockData = async (): Promise<Omit<AppData, 'loading'>> => {
    const response = await fetch('/api/reset', { 
        method: 'POST',
        headers: getHeaders()
    });
    if (!response.ok) {
        if (response.status === 401) {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            window.dispatchEvent(new Event('unauthorized'));
            throw new Error('Unauthorized');
        }
        throw new Error("Không thể khôi phục dữ liệu mặc định.");
    }
    return response.json();
};

export async function exportFullData() {
    const response = await fetch('/api/export', {
        headers: getHeaders()
    });
    if (!response.ok) {
        throw new Error('Lỗi xuất dữ liệu');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BaoCao_ToanThoiGian_${new Date().toISOString().slice(0,10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// ===== Zalo OA API =====

export async function zaloTestConnection(appId: string, secretKey: string, refreshToken: string) {
    const response = await fetch('/api/zalo', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action: 'test_connection', appId, secretKey, refreshToken }),
    });
    return response.json();
}

export async function zaloSendAbsence(students: { name: string; parentName: string; parentPhone: string; zaloUserId?: string }[], className: string, date: string, centerName: string) {
    const response = await fetch('/api/zalo', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action: 'send_absence', students, className, date, centerName }),
    });
    return response.json();
}

export async function zaloSendTuition(studentName: string, parentName: string, parentPhone: string, zaloUserId: string, amount: number, centerName: string) {
    const response = await fetch('/api/zalo', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action: 'send_tuition', studentName, parentName, parentPhone, zaloUserId, amount, centerName }),
    });
    return response.json();
}

export async function zaloGetFollowers() {
    const response = await fetch('/api/zalo', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action: 'get_followers' }),
    });
    return response.json();
}

export async function zaloGetFollowersList() {
    const response = await fetch('/api/zalo', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action: 'get_followers_list' }),
    });
    return response.json();
}

export async function zaloSendOverdueReminders(students: { name: string; parentName: string; zaloUserId?: string; amount: number }[]) {
    const response = await fetch('/api/zalo', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action: 'send_overdue_reminders', students }),
    });
    return response.json();
}
