import React, { useMemo, useState } from 'react';
import { Teacher, Class, AttendanceRecord, AttendanceStatus, PersonStatus } from '../../types';

interface Props {
    teachers: Teacher[];
    classes: Class[];
    attendance: AttendanceRecord[];
    startDate: string;
    endDate: string;
}

export const TeacherPerformanceTab: React.FC<Props> = ({ teachers, classes, attendance, startDate, endDate }) => {
    const [selectedTeacherId, setSelectedTeacherId] = useState<string>('all');

    const activeTeachers = teachers.filter(t => t.status === PersonStatus.ACTIVE);

    const performanceData = useMemo(() => {
        const filteredAttendance = attendance.filter(a =>
            a.date >= startDate && a.date <= endDate
        );

        return activeTeachers.map(teacher => {
            // Classes this teacher is assigned to
            const teacherClasses = classes.filter(c => (c.teacherIds || []).includes(teacher.id));
            const classIds = new Set(teacherClasses.map(c => c.id));

            // Sessions taught (attendance records where this teacher is listed as teaching)
            const taughtRecords = filteredAttendance.filter(a =>
                classIds.has(a.classId) && a.teacherIds?.includes(teacher.id)
            );

            // Unique dates taught
            const taughtDates = new Set(taughtRecords.map(a => `${a.classId}-${a.date}`));
            const sessionsTaught = taughtDates.size;

            // Attendance stats for their classes
            const classAttendance = filteredAttendance.filter(a => classIds.has(a.classId));
            const totalMarked = classAttendance.filter(a => a.status !== AttendanceStatus.UNMARKED).length;
            const presentCount = classAttendance.filter(a =>
                a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.LATE
            ).length;
            const attendanceRate = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 0;

            // Total students across all their classes
            const totalStudents = new Set(teacherClasses.flatMap(c => c.studentIds)).size;

            return {
                teacher,
                classCount: teacherClasses.length,
                classNames: teacherClasses.map(c => c.name),
                sessionsTaught,
                totalStudents,
                attendanceRate,
                totalMarked,
                presentCount,
            };
        }).sort((a, b) => b.sessionsTaught - a.sessionsTaught);
    }, [activeTeachers, classes, attendance, startDate, endDate]);

    const filteredData = selectedTeacherId === 'all'
        ? performanceData
        : performanceData.filter(d => d.teacher.id === selectedTeacherId);

    const totalSessions = performanceData.reduce((sum, d) => sum + d.sessionsTaught, 0);
    const avgAttendance = performanceData.length > 0
        ? Math.round(performanceData.reduce((sum, d) => sum + d.attendanceRate, 0) / performanceData.length)
        : 0;

    return (
        <div className="space-y-6">
            {/* Filter */}
            <div className="flex items-center gap-3">
                <label className="text-sm font-medium whitespace-nowrap">Lọc giáo viên:</label>
                <select
                    value={selectedTeacherId}
                    onChange={e => setSelectedTeacherId(e.target.value)}
                    className="form-select text-sm py-1.5"
                >
                    <option value="all">Tất cả ({activeTeachers.length} GV)</option>
                    {activeTeachers.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
            </div>

            {/* KPI Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="card-base text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Tổng GV đang dạy</p>
                    <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{activeTeachers.length}</p>
                </div>
                <div className="card-base text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Tổng buổi dạy (kỳ)</p>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalSessions}</p>
                </div>
                <div className="card-base text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">TB chuyên cần lớp</p>
                    <p className={`text-3xl font-bold ${avgAttendance >= 80 ? 'text-green-600 dark:text-green-400' : avgAttendance >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                        {avgAttendance}%
                    </p>
                </div>
                <div className="card-base text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">TB buổi/GV</p>
                    <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                        {activeTeachers.length > 0 ? Math.round(totalSessions / activeTeachers.length) : 0}
                    </p>
                </div>
            </div>

            {/* Table */}
            <div className="card-base overflow-x-auto">
                <h3 className="text-lg font-semibold mb-4">Chi tiết hiệu suất</h3>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                            <th className="text-left py-3 px-3 font-medium">Giáo viên</th>
                            <th className="text-left py-3 px-3 font-medium hidden md:table-cell">Môn</th>
                            <th className="text-center py-3 px-3 font-medium">Số lớp</th>
                            <th className="text-center py-3 px-3 font-medium">Số HS</th>
                            <th className="text-center py-3 px-3 font-medium">Buổi dạy</th>
                            <th className="text-center py-3 px-3 font-medium">Chuyên cần</th>
                            <th className="text-left py-3 px-3 font-medium hidden lg:table-cell">Lớp</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.map(({ teacher, classCount, classNames, sessionsTaught, totalStudents, attendanceRate }) => (
                            <tr key={teacher.id} className="border-b dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                <td className="py-3 px-3">
                                    <div>
                                        <p className="font-semibold">{teacher.name}</p>
                                        <p className="text-xs text-gray-500">{teacher.id}</p>
                                    </div>
                                </td>
                                <td className="py-3 px-3 hidden md:table-cell text-gray-600 dark:text-gray-300">{teacher.subject}</td>
                                <td className="text-center py-3 px-3">{classCount}</td>
                                <td className="text-center py-3 px-3">{totalStudents}</td>
                                <td className="text-center py-3 px-3">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                        {sessionsTaught}
                                    </span>
                                </td>
                                <td className="text-center py-3 px-3">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                        attendanceRate >= 80 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                        : attendanceRate >= 60 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                    }`}>
                                        {attendanceRate}%
                                    </span>
                                </td>
                                <td className="py-3 px-3 text-xs text-gray-500 hidden lg:table-cell">
                                    {classNames.join(', ')}
                                </td>
                            </tr>
                        ))}
                        {filteredData.length === 0 && (
                            <tr>
                                <td colSpan={7} className="text-center py-8 text-gray-500">
                                    Không có dữ liệu giáo viên.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
