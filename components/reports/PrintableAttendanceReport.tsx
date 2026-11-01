import React from 'react';

export interface AttendanceReportData {
    id: string;
    name: string;
    classNames: string;
    totalSessions: number;
    presentCount: number;
    absentCount: number;
    unexcusedAbsentCount: number;
}

export const PrintableAttendanceReport: React.FC<{
    data: AttendanceReportData[];
    title: string;
}> = ({ data, title }) => {
    return (
        <div className="bg-white p-6 text-black font-sans">
            <h2 className="text-2xl font-bold text-center mb-6">{title}</h2>
            <table className="min-w-full divide-y divide-gray-300 border border-gray-300">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Mã HV</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Họ tên</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Các lớp học</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Tổng số buổi</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 text-green-600">Đi học</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 text-teal-600">Nghỉ (Có phép)</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 text-red-600">Nghỉ (Không phép)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {data.map(item => (
                        <tr key={item.id}>
                            <td className="px-4 py-2 whitespace-nowrap text-sm">{item.id}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">{item.name}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm">{item.classNames}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-center font-semibold">{item.totalSessions}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm font-bold text-center text-green-600">{item.presentCount}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm font-bold text-center text-teal-600">{item.absentCount}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm font-bold text-center text-red-600">{item.unexcusedAbsentCount}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};