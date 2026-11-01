import React, { useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useData } from '../../hooks/useDataContext';
import { Table, SortConfig } from '../../components/common/Table';
import { ProgressReport, Student, AttendanceStatus, Class } from '../../types';
import { ListItemCard } from '../../components/common/ListItemCard';

// Component to display attendance summary
const AttendanceSummary: React.FC<{ studentId: string, classes: Class[] }> = ({ studentId, classes }) => {
    const { state } = useData();
    const studentAttendance = state.attendance.filter(a => a.studentId === studentId);

    const summary = useMemo(() => {
        const data: { [key: string]: { present: number, absent: number, unexcusedAbsent: number, late: number, total: number } } = {};

        classes.forEach(cls => {
            const classAttendance = studentAttendance.filter(a => a.classId === cls.id);
            const present = classAttendance.filter(a => a.status === AttendanceStatus.PRESENT).length;
            const absent = classAttendance.filter(a => a.status === AttendanceStatus.ABSENT).length;
            const unexcusedAbsent = classAttendance.filter(a => a.status === AttendanceStatus.UNEXCUSED_ABSENT).length;
            const late = classAttendance.filter(a => a.status === AttendanceStatus.LATE).length;
            data[cls.name] = { present, absent, unexcusedAbsent, late, total: classAttendance.length };
        });
        return data;
    }, [studentAttendance, classes]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.keys(summary).map((className) => {
                const data = summary[className];
                return (
                    <div key={className} className="p-3 md:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <h3 className="font-semibold text-primary">{className}</h3>
                        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-sm mt-2 text-center">
                            <div>
                                <p className="font-bold text-lg text-green-600">{data.present}</p>
                                <p className="text-xs text-gray-500">Có mặt</p>
                            </div>
                             <div>
                                <p className="font-bold text-lg text-teal-600">{data.absent}</p>
                                <p className="text-xs text-gray-500">Có phép</p>
                            </div>
                            <div>
                                <p className="font-bold text-lg text-red-600">{data.unexcusedAbsent}</p>
                                <p className="text-xs text-gray-500">Không phép</p>
                            </div>
                            <div>
                                <p className="font-bold text-lg text-yellow-600">{data.late}</p>
                                <p className="text-xs text-gray-500">Trễ</p>
                            </div>
                            <div>
                                <p className="font-bold text-lg text-blue-600">{data.total > 0 ? `${(((data.present + data.late) / data.total) * 100).toFixed(0)}%` : 'N/A'}</p>
                                <p className="text-xs text-gray-500">Tỷ lệ</p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const AttendanceLog: React.FC<{ studentId: string }> = ({ studentId }) => {
    const { state } = useData();
    const studentAttendance = useMemo(() => 
        state.attendance
            .filter(a => a.studentId === studentId)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        [state.attendance, studentId]
    );

    const getStatusBadge = (status: AttendanceStatus) => {
        switch (status) {
            case AttendanceStatus.PRESENT:
                return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Có mặt</span>;
            case AttendanceStatus.ABSENT:
                return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-teal-100 text-teal-800">Có phép</span>;
            case AttendanceStatus.UNEXCUSED_ABSENT:
                return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Không phép</span>;
            case AttendanceStatus.LATE:
                return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Trễ</span>;
            default:
                return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Chưa điểm danh</span>;
        }
    };
    
    if(studentAttendance.length === 0) return <p className="text-center text-gray-500 dark:text-gray-400 p-4">Chưa có dữ liệu điểm danh.</p>

    return (
        <div className="max-h-96 overflow-y-auto">
            <div className="md:hidden space-y-2">
                {studentAttendance.map(record => (
                    <div key={record.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-md">
                        <div>
                            <p className="font-semibold text-sm">{state.classes.find(c => c.id === record.classId)?.name || 'N/A'}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">{record.date}</p>
                        </div>
                        {getStatusBadge(record.status)}
                    </div>
                ))}
            </div>
             <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 hidden md:table">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                    <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Ngày</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Lớp học</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Trạng thái</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {studentAttendance.map(record => (
                        <tr key={record.id}>
                            <td className="px-4 py-2 whitespace-nowrap text-sm">{record.date}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm">{state.classes.find(c => c.id === record.classId)?.name || 'N/A'}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm">{getStatusBadge(record.status)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};


export const ParentReportsScreen: React.FC = () => {
    const { user } = useAuth();
    const { state } = useData();
    const student = user as Student;

    const [sortConfig, setSortConfig] = useState<SortConfig<ProgressReport> | null>({ key: 'date', direction: 'descending' });

    const handleSort = (key: keyof ProgressReport) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedStudentReports = useMemo(() => {
        if (!student) return [];
        const studentReports = state.progressReports.filter(pr => pr.studentId === student.id);
        
        if (sortConfig) {
            studentReports.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                if (aValue == null && bValue == null) return 0;
                if (aValue == null) return sortConfig.direction === 'ascending' ? 1 : -1;
                if (bValue == null) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return studentReports;
    }, [student, state.progressReports, sortConfig]);

     const enrolledClasses = useMemo(() => {
        if (!student) return [];
        return state.classes.filter(c => c.studentIds.includes(student.id));
    }, [student, state.classes]);

    const reportColumns = [
        { header: 'Ngày', accessor: 'date' as keyof ProgressReport, sortable: true },
        { header: 'Lớp học', accessor: (item: ProgressReport) => state.classes.find(c => c.id === item.classId)?.name || 'N/A', sortable: true, sortKey: 'classId' as keyof ProgressReport },
        { header: 'Giáo viên', accessor: (item: ProgressReport) => state.teachers.find(t => t.id === item.createdBy)?.name || 'N/A', sortable: true, sortKey: 'createdBy' as keyof ProgressReport },
        { header: 'Điểm', accessor: (item: ProgressReport) => <span className="font-bold text-lg text-primary">{item.score !== null ? `${item.score} / 10` : 'N/A'}</span>, sortable: true, sortKey: 'score' as keyof ProgressReport },
        { header: 'Nhận xét', accessor: 'comments' as keyof ProgressReport },
    ];

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Báo cáo Học tập & Chuyên cần</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div className="card-base p-4 md:p-6">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Tổng kết Chuyên cần</h2>
                    <AttendanceSummary studentId={student.id} classes={enrolledClasses} />
                </div>
                 <div className="card-base p-4 md:p-6">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Sổ theo dõi Chuyên cần Chi tiết</h2>
                    <AttendanceLog studentId={student.id} />
                </div>
            </div>

            <div className="md:card-base md:p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white px-4 pt-4 md:p-0">Lịch sử Báo cáo Tiến độ</h2>
                <div className="hidden md:block">
                    <Table<ProgressReport>
                        columns={reportColumns}
                        data={sortedStudentReports}
                        sortConfig={sortConfig}
                        onSort={handleSort}
                    />
                </div>
                <div className="md:hidden space-y-4 px-4 pb-4 md:p-0">
                    {sortedStudentReports.map(report => (
                        <ListItemCard
                            key={report.id}
                            title={
                                <div className="flex justify-between w-full">
                                    <span>{state.classes.find(c => c.id === report.classId)?.name || 'N/A'}</span>
                                    <span className="text-primary font-bold">{report.score !== null ? `${report.score}/10` : 'N/A'}</span>
                                </div>
                            }
                            details={[
                                { label: "Ngày", value: report.date },
                                { label: "Giáo viên", value: state.teachers.find(t => t.id === report.createdBy)?.name || 'N/A' },
                                { label: "Nhận xét", value: <i className="block whitespace-normal">{report.comments}</i> }
                            ]}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};