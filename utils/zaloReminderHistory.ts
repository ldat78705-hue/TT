/**
 * Zalo Reminder History — LocalStorage-based tracking
 * 
 * Lưu lịch sử mỗi lần gửi nhắc nhở Zalo (qua deep link).
 * Dữ liệu lưu client-side, không ảnh hưởng server.
 */

const STORAGE_KEY = 'zalo_reminder_history';
const MAX_ENTRIES = 500;

export interface ZaloReminderEntry {
    id: string;
    studentId: string;
    studentName: string;
    parentName?: string;
    phone: string;
    method: 'text' | 'image';
    /** Invoice ID if sent from InvoicesTab */
    invoiceId?: string;
    /** e.g. 'invoices' | 'debt' | 'students' */
    source: string;
    amount: number;
    sentAt: string; // ISO datetime
}

// Simple cache to avoid repeated JSON.parse per render cycle
let _cachedHistory: ZaloReminderEntry[] | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL = 2000; // 2 seconds

function getHistory(): ZaloReminderEntry[] {
    const now = Date.now();
    if (_cachedHistory && (now - _cacheTimestamp) < CACHE_TTL) {
        return _cachedHistory;
    }
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) { _cachedHistory = []; _cacheTimestamp = now; return []; }
        _cachedHistory = JSON.parse(raw) as ZaloReminderEntry[];
        _cacheTimestamp = now;
        return _cachedHistory;
    } catch {
        _cachedHistory = [];
        _cacheTimestamp = now;
        return [];
    }
}

function saveHistory(entries: ZaloReminderEntry[]): void {
    try {
        // Keep only latest MAX_ENTRIES
        const trimmed = entries.slice(-MAX_ENTRIES);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        // Invalidate cache
        _cachedHistory = trimmed;
        _cacheTimestamp = Date.now();
    } catch {
        // localStorage full — ignore
    }
}

export function addReminderEntry(entry: Omit<ZaloReminderEntry, 'id' | 'sentAt'>): ZaloReminderEntry {
    const fullEntry: ZaloReminderEntry = {
        ...entry,
        id: `zr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        sentAt: new Date().toISOString(),
    };
    const history = getHistory();
    history.push(fullEntry);
    saveHistory(history);
    return fullEntry;
}

export function getReminderHistory(): ZaloReminderEntry[] {
    return getHistory().sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

/**
 * Get the latest reminder for a student.
 * Returns null if never reminded.
 */
export function getLastReminder(studentId: string): ZaloReminderEntry | null {
    const history = getHistory();
    // Iterate from end (most recent) to find first match
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].studentId === studentId) {
            return history[i];
        }
    }
    return null;
}

/**
 * Check if a student was reminded today.
 */
export function wasRemindedToday(studentId: string): boolean {
    const last = getLastReminder(studentId);
    if (!last) return false;
    const today = new Date().toISOString().slice(0, 10);
    return last.sentAt.slice(0, 10) === today;
}

/**
 * Format a date string into human-readable "time ago" label.
 * e.g. "Hôm nay 08:30", "Hôm qua", "3 ngày trước"
 */
export function formatReminderDate(isoDate: string): string {
    const sentDate = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - sentDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return `Hôm nay ${sentDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
        return 'Hôm qua';
    } else if (diffDays <= 7) {
        return `${diffDays} ngày trước`;
    } else {
        return sentDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    }
}

/**
 * Get a human-readable "time ago" label for the last reminder.
 * Uses localStorage only (single device).
 */
export function getLastReminderLabel(studentId: string): string | null {
    const last = getLastReminder(studentId);
    if (!last) return null;
    return formatReminderDate(last.sentAt);
}

/**
 * Get reminder label combining DB invoices + localStorage.
 * DB data syncs across all devices (invoices[].lastReminderDate).
 * localStorage is fallback for current device only.
 * 
 * @param studentId - Student ID to check
 * @param invoices - All invoices from state (synced via DB)
 * @returns Human-readable label or null
 */
export function getStudentReminderLabel(studentId: string, invoices: { studentId: string; status: string; lastReminderDate?: string }[]): string | null {
    // 1. Check DB: find latest lastReminderDate from student's UNPAID invoices
    let latestDbDate: string | null = null;
    for (const inv of invoices) {
        if (inv.studentId === studentId && inv.status === 'UNPAID' && inv.lastReminderDate) {
            if (!latestDbDate || inv.lastReminderDate > latestDbDate) {
                latestDbDate = inv.lastReminderDate;
            }
        }
    }
    
    // 2. Check localStorage (exclude group entries — those are separate)
    const history = getHistory();
    let localDate: string | null = null;
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].studentId === studentId && history[i].source !== 'class_group') {
            localDate = history[i].sentAt;
            break;
        }
    }
    
    // 3. Use whichever is more recent
    let bestDate: string | null = null;
    if (latestDbDate && localDate) {
        bestDate = latestDbDate > localDate ? latestDbDate : localDate;
    } else {
        bestDate = latestDbDate || localDate;
    }
    
    if (!bestDate) return null;
    return formatReminderDate(bestDate);
}

/**
 * Get group reminder label from DB invoices (lastGroupReminderDate).
 * Nhắc nhóm hiển thị riêng, chỉ dùng ở trang Lớp học.
 */
export function getGroupReminderLabel(studentId: string, invoices: { studentId: string; status: string; lastGroupReminderDate?: string }[]): string | null {
    let latestDate: string | null = null;
    for (const inv of invoices) {
        if (inv.studentId === studentId && inv.status === 'UNPAID' && inv.lastGroupReminderDate) {
            if (!latestDate || inv.lastGroupReminderDate > latestDate) {
                latestDate = inv.lastGroupReminderDate;
            }
        }
    }
    if (!latestDate) return null;
    return formatReminderDate(latestDate);
}

/**
 * Clear all reminder history.
 */
export function clearReminderHistory(): void {
    localStorage.removeItem(STORAGE_KEY);
    _cachedHistory = null;
    _cacheTimestamp = 0;
}
