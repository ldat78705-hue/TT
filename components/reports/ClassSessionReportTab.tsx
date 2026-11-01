import React, { useMemo, useState, useEffect } from 'react';
import { useData } from '../../hooks/useDataContext';
import { AttendanceStatus, ClassStatus } from '../../types';
import { Table, SortConfig, Column } from '../common/Table';
import { Pagination } from '../common/Pagination';
import { ListItemCard } from '../common/ListItemCard';
import { Button } from '../common/Button';
import { ExportButton } from '../common/ExportButton';
import { ICONS } from '../../constants';
import { printHtml, escapeHtml } from '../../utils/html';
import { buildPrintableReport } from '../../utils/reportPrintTemplates';
import { formatVietnamDate } from '../../utils/date';

const ITEMS_PER_PAGE = 15;

interface ClassSessionReportTabProps {
    startDate: string;
    endDate: string;
    classFilter: string;
}

interface ClassSessionSummary {
    id: string; // same as classId, required by Table component
    classId: string;
    className: string;
    teacherNames: string;
    totalSessions: number;
    totalStudents: number;
    totalPresent: number;
    totalAbsent: number;
    totalUnexcused: number;
    avgAttendancePerSession: number;
    attendanceRate: number;
}

interface SessionDetail {
    date: string;
    presentCount: number;
    absentCount: number;
    unexcusedCount: number;
    totalStudents: number;
    teacherNames: string;
    absentStudentNames: string[];
}

export const ClassSessionReportTab: React.FC<ClassSessionReportTabProps> = ({ startDate, endDate, classFilter }) => {
    const { state } = useData();
    const { classes, attendance, students, teachers } = state;

    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<SortConfig<ClassSessionSummary> | null>({ key: 'totalSessions', direction: 'descending' });
    const [expandedClassId, setExpandedClassId] = useState<string | null>(null);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
        setExpandedClassId(null);
    }, [startDate, endDate, classFilter]);

    // Build teacher name lookup
    const teacherMap = useMemo(() => new Map(teachers.map(t => [t.id, t.name])), [teachers]);
    const studentMap = useMemo(() => new Map(students.map(s => [s.id, s.name])), [students]);

    // Compute summary data per class
    const reportData = useMemo(() => {
        const relevantClasses = classFilter === 'all'
            ? classes.filter(c => c.classStatus !== ClassStatus.ARCHIVED)
            : classes.filter(c => c.id === classFilter);

        const periodAttendance = attendance.filter(a =>
            a.date >= startDate && a.date <= endDate
        );

        return relevantClasses.map(cls => {
            const classAttendance = periodAttendance.filter(a => a.classId === cls.id);

            // Group by date to find unique sessions
            const sessionsByDate = new Map<string, typeof classAttendance>();
            classAttendance.forEach(a => {
                if (!sessionsByDate.has(a.date)) {
                    sessionsByDate.set(a.date, []);
                }
                sessionsByDate.get(a.date)!.push(a);
            });

            const totalSessions = sessionsByDate.size;

            let totalPresent = 0;
            let totalAbsent = 0;
            let totalUnexcused = 0;
            let totalMarked = 0;

            classAttendance.forEach(a => {
                if (a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.LATE) {
                    totalPresent++;
                    totalMarked++;
                } else if (a.status === AttendanceStatus.ABSENT || a.status === AttendanceStatus.EXCUSED_ABSENT) {
                    totalAbsent++;
                    totalMarked++;
                } else if (a.status === AttendanceStatus.UNEXCUSED_ABSENT) {
                    totalUnexcused++;
                    totalMarked++;
                }
            });

            const avgAttendancePerSession = totalSessions > 0
                ? Math.round(totalPresent / totalSessions * 10) / 10
                : 0;

            const attendanceRate = totalMarked > 0
                ? Math.round((totalPresent / totalMarked) * 100)
                : 0;

            const teacherNames = (cls.teacherIds || [])
                .map(id => teacherMap.get(id) || 'Không rõ')
                .join(', ');

            return {
                id: cls.id,
                classId: cls.id,
                className: cls.name,
                teacherNames,
                totalSessions,
                totalStudents: cls.studentIds.length,
                totalPresent,
                totalAbsent,
                totalUnexcused,
                avgAttendancePerSession,
                attendanceRate,
            } as ClassSessionSummary;
        }).filter(c => c.totalSessions > 0); // Only show classes that had sessions

    }, [classes, attendance, students, teachers, startDate, endDate, classFilter, teacherMap]);

    // Sort
    const sortedData = useMemo(() => {
        const items = [...reportData];
        if (sortConfig) {
            items.sort((a, b) => {
                const aVal = a[sortConfig.key];
                const bVal = b[sortConfig.key];
                if (typeof aVal === 'string' && typeof bVal === 'string') {
                    const cmp = aVal.localeCompare(bVal, 'vi');
                    return sortConfig.direction === 'ascending' ? cmp : -cmp;
                }
                if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return items;
    }, [reportData, sortConfig]);

    // Pagination
    const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
    const paginatedData = sortedData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        } else if (currentPage === 0 && totalPages > 0) {
            setCurrentPage(1);
        }
    }, [currentPage, totalPages]);

    // Detail data for expanded class
    const sessionDetails = useMemo((): SessionDetail[] => {
        if (!expandedClassId) return [];

        const classAttendance = attendance.filter(a =>
            a.classId === expandedClassId &&
            a.date >= startDate && a.date <= endDate
        );

        const sessionsByDate = new Map<string, typeof classAttendance>();
        classAttendance.forEach(a => {
            if (!sessionsByDate.has(a.date)) {
                sessionsByDate.set(a.date, []);
            }
            sessionsByDate.get(a.date)!.push(a);
        });

        const details: SessionDetail[] = [];
        sessionsByDate.forEach((records, date) => {
            let presentCount = 0;
            let absentCount = 0;
            let unexcusedCount = 0;
            const absentStudentNames: string[] = [];
            const sessionTeacherIds = new Set<string>();

            records.forEach(r => {
                if (r.status === AttendanceStatus.PRESENT || r.status === AttendanceStatus.LATE) {
                    presentCount++;
                } else if (r.status === AttendanceStatus.ABSENT || r.status === AttendanceStatus.EXCUSED_ABSENT) {
                    absentCount++;
                    absentStudentNames.push(studentMap.get(r.studentId) || r.studentId);
                } else if (r.status === AttendanceStatus.UNEXCUSED_ABSENT) {
                    unexcusedCount++;
                    absentStudentNames.push(studentMap.get(r.studentId) || r.studentId);
                }
                (r.teacherIds || []).forEach(tid => sessionTeacherIds.add(tid));
            });

            const teacherNames = Array.from(sessionTeacherIds)
                .map(id => teacherMap.get(id) || 'Không rõ')
                .join(', ');

            details.push({
                date,
                presentCount,
                absentCount,
                unexcusedCount,
                totalStudents: records.length,
                teacherNames: teacherNames || '—',
                absentStudentNames,
            });
        });

        return details.sort((a, b) => b.date.localeCompare(a.date)); // Newest first
    }, [expandedClassId, attendance, startDate, endDate, studentMap, teacherMap]);

    const handleSort = (key: keyof ClassSessionSummary) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const handleToggleExpand = (classId: string) => {
        setExpandedClassId(prev => prev === classId ? null : classId);
    };

    // Export columns
    const exportColumns = {
        className: 'Tên lớp',
        teacherNames: 'Giáo viên',
        totalSessions: 'Số buổi dạy',
        totalStudents: 'Sĩ số',
        totalPresent: 'Lượt có mặt',
        totalAbsent: 'Lượt vắng (CP)',
        totalUnexcused: 'Lượt vắng (KP)',
        avgAttendancePerSession: 'TB có mặt/buổi',
        attendanceRate: 'Tỷ lệ CC (%)',
    } as Record<keyof ClassSessionSummary, string>;

    // Summary stats
    const summaryStats = useMemo(() => {
        const totalSessions = reportData.reduce((s, c) => s + c.totalSessions, 0);
        const totalPresent = reportData.reduce((s, c) => s + c.totalPresent, 0);
        const totalAbsent = reportData.reduce((s, c) => s + c.totalAbsent, 0);
        const totalUnexcused = reportData.reduce((s, c) => s + c.totalUnexcused, 0);
        const totalMarked = totalPresent + totalAbsent + totalUnexcused;
        const overallRate = totalMarked > 0 ? Math.round((totalPresent / totalMarked) * 100) : 0;
        return { totalSessions, totalPresent, totalAbsent, totalUnexcused, overallRate, classCount: reportData.length };
    }, [reportData]);

    const columns: Column<ClassSessionSummary>[] = [
        { header: 'Tên lớp', accessor: (item) => (
            <button
                onClick={() => handleToggleExpand(item.classId)}
                className={`text-left font-medium hover:underline ${expandedClassId === item.classId ? 'text-blue-600 dark:text-blue-400' : 'text-primary'}`}
            >
                {expandedClassId === item.classId ? '▼ ' : '▶ '}{item.className}
            </button>
        ), sortable: true, sortKey: 'className' },
        { header: 'Giáo viên', accessor: 'teacherNames', sortable: false },
        { header: 'Số buổi', accessor: 'totalSessions', sortable: true },
        { header: 'Sĩ số', accessor: 'totalStudents', sortable: true },
        { header: 'Có mặt', accessor: (item) => <span className="font-semibold text-green-600">{item.totalPresent}</span>, sortable: true, sortKey: 'totalPresent' },
        { header: 'Vắng (CP)', accessor: (item) => <span className="font-semibold text-teal-600">{item.totalAbsent}</span>, sortable: true, sortKey: 'totalAbsent' },
        { header: 'Vắng (KP)', accessor: (item) => <span className="font-semibold text-red-600">{item.totalUnexcused}</span>, sortable: true, sortKey: 'totalUnexcused' },
        { header: 'TB/buổi', accessor: 'avgAttendancePerSession', sortable: true },
        { header: 'CC (%)', accessor: (item) => (
            <span className={`font-semibold ${item.attendanceRate >= 80 ? 'text-green-600' : item.attendanceRate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                {item.attendanceRate}%
            </span>
        ), sortable: true, sortKey: 'attendanceRate' },
    ];

    return (
        <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-center">
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Số lớp có buổi học</p>
                    <p className="text-xl font-bold text-blue-700 dark:text-blue-300 mt-1">{summaryStats.classCount}</p>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg text-center">
                    <p className="text-xs font-medium text-purple-600 dark:text-purple-400">Tổng số buổi dạy</p>
                    <p className="text-xl font-bold text-purple-700 dark:text-purple-300 mt-1">{summaryStats.totalSessions}</p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg text-center">
                    <p className="text-xs font-medium text-green-600 dark:text-green-400">Tổng lượt có mặt</p>
                    <p className="text-xl font-bold text-green-700 dark:text-green-300 mt-1">{summaryStats.totalPresent}</p>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-lg text-center">
                    <p className="text-xs font-medium text-red-600 dark:text-red-400">Tổng lượt vắng</p>
                    <p className="text-xl font-bold text-red-700 dark:text-red-300 mt-1">{summaryStats.totalAbsent + summaryStats.totalUnexcused}</p>
                </div>
                <div className="p-3 bg-teal-50 dark:bg-teal-900/30 rounded-lg text-center">
                    <p className="text-xs font-medium text-teal-600 dark:text-teal-400">Tỷ lệ CC chung</p>
                    <p className="text-xl font-bold text-teal-700 dark:text-teal-300 mt-1">{summaryStats.overallRate}%</p>
                </div>
            </div>

            {/* Main Table */}
            <div className="card-base">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                    <h2 className="text-xl font-semibold">Thống kê Buổi học theo Lớp</h2>
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={() => {
                            const html = buildPrintableReport({
                                title: 'Thống Kê Buổi Học Theo Lớp',
                                subtitle: classFilter !== 'all' ? `Lớp: ${classes.find(c => c.id === classFilter)?.name || ''}` : undefined,
                                centerName: state.settings.name,
                                dateRange: { from: startDate, to: endDate },
                                columns: [
                                    { header: 'STT', align: 'center', width: '35px' },
                                    { header: 'Tên lớp' },
                                    { header: 'Giáo viên' },
                                    { header: 'Số buổi', align: 'center', width: '65px' },
                                    { header: 'Sĩ số', align: 'center', width: '50px' },
                                    { header: 'Có mặt', align: 'center', width: '65px' },
                                    { header: 'Vắng CP', align: 'center', width: '65px' },
                                    { header: 'Vắng KP', align: 'center', width: '65px' },
                                    { header: 'TB/buổi', align: 'center', width: '60px' },
                                    { header: 'CC (%)', align: 'center', width: '55px' },
                                ],
                                rows: sortedData.map((item, idx) => [
                                    String(idx + 1),
                                    escapeHtml(item.className),
                                    escapeHtml(item.teacherNames),
                                    String(item.totalSessions),
                                    String(item.totalStudents),
                                    `<span style="color:#16a34a;font-weight:600">${item.totalPresent}</span>`,
                                    `<span style="color:#0d9488;font-weight:600">${item.totalAbsent}</span>`,
                                    `<span style="color:#dc2626;font-weight:600">${item.totalUnexcused}</span>`,
                                    String(item.avgAttendancePerSession),
                                    `<span style="font-weight:600;color:${item.attendanceRate >= 80 ? '#16a34a' : item.attendanceRate >= 60 ? '#ca8a04' : '#dc2626'}">${item.attendanceRate}%</span>`,
                                ]),
                                summary: [
                                    { label: 'Tổng số lớp', value: String(sortedData.length) },
                                    { label: 'Tổng số buổi', value: String(summaryStats.totalSessions) },
                                    { label: 'Tỷ lệ CC chung', value: `${summaryStats.overallRate}%` },
                                ],
                                orientation: 'landscape',
                            });
                            printHtml(html);
                        }} variant="secondary">
                            {ICONS.print} In báo cáo
                        </Button>
                        <ExportButton data={sortedData} columns={exportColumns} filenameBase={`ThongKeBuoiHoc_${startDate}_${endDate}`} />
                    </div>
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block">
                    <Table
                        columns={columns}
                        data={paginatedData}
                        sortConfig={sortConfig}
                        onSort={handleSort}
                    />
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-4">
                    {paginatedData.map(item => (
                        <div key={item.classId} onClick={() => handleToggleExpand(item.classId)} className="cursor-pointer">
                            <ListItemCard
                                title={item.className}
                                details={[
                                    { label: 'Giáo viên', value: item.teacherNames },
                                    { label: 'Số buổi dạy', value: <span className="font-bold text-purple-600">{item.totalSessions}</span> },
                                    { label: 'Sĩ số', value: String(item.totalStudents) },
                                    { label: 'Có mặt', value: <span className="font-bold text-green-600">{item.totalPresent}</span> },
                                    { label: 'Vắng', value: <span className="font-bold text-red-600">{item.totalAbsent + item.totalUnexcused}</span> },
                                    { label: 'Tỷ lệ CC', value: <span className={`font-bold ${item.attendanceRate >= 80 ? 'text-green-600' : item.attendanceRate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>{item.attendanceRate}%</span> },
                                ]}
                            />
                        </div>
                    ))}
                </div>

                {paginatedData.length > 0 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        totalItems={sortedData.length}
                        itemsPerPage={ITEMS_PER_PAGE}
                    />
                )}

                {sortedData.length === 0 && (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <p className="text-lg">Không có dữ liệu buổi học trong khoảng thời gian đã chọn.</p>
                    </div>
                )}
            </div>

            {/* Expanded Session Detail */}
            {expandedClassId && sessionDetails.length > 0 && (
                <div className="card-base">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">
                            📋 Chi tiết buổi học — {classes.find(c => c.id === expandedClassId)?.name}
                        </h3>
                        <Button onClick={() => setExpandedClassId(null)} variant="secondary">
                            {ICONS.close} Đóng
                        </Button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Ngày</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Sĩ số</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-green-600 uppercase">Có mặt</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-teal-600 uppercase">Vắng CP</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-red-600 uppercase">Vắng KP</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Giáo viên</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">HS vắng</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {sessionDetails.map(session => (
                                    <tr key={session.date} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                        <td className="px-4 py-2 text-sm font-medium">{formatVietnamDate(session.date)}</td>
                                        <td className="px-4 py-2 text-sm text-center font-semibold">{session.totalStudents}</td>
                                        <td className="px-4 py-2 text-sm text-center font-bold text-green-600">{session.presentCount}</td>
                                        <td className="px-4 py-2 text-sm text-center font-bold text-teal-600">{session.absentCount}</td>
                                        <td className="px-4 py-2 text-sm text-center font-bold text-red-600">{session.unexcusedCount}</td>
                                        <td className="px-4 py-2 text-sm">{session.teacherNames}</td>
                                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                                            {session.absentStudentNames.length > 0
                                                ? session.absentStudentNames.join(', ')
                                                : <span className="text-green-500">Đầy đủ ✓</span>
                                            }
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
