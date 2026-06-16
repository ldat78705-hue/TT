import React, { useMemo } from 'react';
import { Student, PersonStatus } from '../../types';
import { LineChart } from '../common/LineChart';

interface Props {
    students: Student[];
}

export const EnrollmentReportContent: React.FC<Props> = ({ students }) => {
    const monthlyData = useMemo(() => {
        const now = new Date();
        const months: { key: string; label: string; newCount: number; leftCount: number; newNames: string[]; leftNames: string[] }[] = [];

        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const monthStr = `${year}-${String(month).padStart(2, '0')}`;

            const newStudents = students.filter(s => s.createdAt && s.createdAt.startsWith(monthStr));
            const leftStudents = students.filter(s =>
                s.status === PersonStatus.INACTIVE &&
                s.statusChangedAt &&
                s.statusChangedAt.startsWith(monthStr)
            );

            months.push({
                key: monthStr,
                label: `T${month}/${year}`,
                newCount: newStudents.length,
                leftCount: leftStudents.length,
                newNames: newStudents.map(s => s.name),
                leftNames: leftStudents.map(s => s.name),
            });
        }

        return months;
    }, [students]);

    const totalActive = students.filter(s => s.status === PersonStatus.ACTIVE).length;
    const totalInactive = students.filter(s => s.status === PersonStatus.INACTIVE).length;
    const totalNew12m = monthlyData.reduce((sum, m) => sum + m.newCount, 0);
    const totalLeft12m = monthlyData.reduce((sum, m) => sum + m.leftCount, 0);
    const retentionRate = totalNew12m > 0 ? Math.round(((totalNew12m - totalLeft12m) / totalNew12m) * 100) : 100;

    const chartData = monthlyData.map(m => ({
        label: m.label,
        values: [m.newCount, m.leftCount],
    }));

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="card-base text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Đang học</p>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">{totalActive}</p>
                </div>
                <div className="card-base text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Tạm nghỉ</p>
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">{totalInactive}</p>
                </div>
                <div className="card-base text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">HS mới (12 tháng)</p>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalNew12m}</p>
                </div>
                <div className="card-base text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Tỉ lệ giữ chân</p>
                    <p className={`text-3xl font-bold ${retentionRate >= 70 ? 'text-green-600 dark:text-green-400' : retentionRate >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                        {retentionRate}%
                    </p>
                </div>
            </div>

            {/* Chart */}
            <div className="card-base">
                <LineChart
                    title="Xu hướng Tuyển sinh (12 tháng gần nhất)"
                    data={chartData}
                    series={[
                        { name: 'HS mới', color: '#3b82f6' },
                        { name: 'HS nghỉ', color: '#ef4444' },
                    ]}
                />
            </div>

            {/* Monthly Table */}
            <div className="card-base overflow-x-auto">
                <h3 className="text-lg font-semibold mb-4">Chi tiết theo tháng</h3>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b dark:border-gray-700">
                            <th className="text-left py-2 px-3 font-medium">Tháng</th>
                            <th className="text-center py-2 px-3 font-medium text-blue-600">HS mới</th>
                            <th className="text-center py-2 px-3 font-medium text-red-600">HS nghỉ</th>
                            <th className="text-center py-2 px-3 font-medium">Biến động</th>
                            <th className="text-left py-2 px-3 font-medium hidden md:table-cell">Chi tiết</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...monthlyData].reverse().map(m => {
                            const net = m.newCount - m.leftCount;
                            return (
                                <tr key={m.key} className="border-b dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                    <td className="py-2 px-3 font-medium">{m.label}</td>
                                    <td className="text-center py-2 px-3">
                                        {m.newCount > 0 ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                +{m.newCount}
                                            </span>
                                        ) : <span className="text-gray-400">0</span>}
                                    </td>
                                    <td className="text-center py-2 px-3">
                                        {m.leftCount > 0 ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                                -{m.leftCount}
                                            </span>
                                        ) : <span className="text-gray-400">0</span>}
                                    </td>
                                    <td className="text-center py-2 px-3">
                                        <span className={`font-semibold ${net > 0 ? 'text-green-600' : net < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                            {net > 0 ? `+${net}` : net}
                                        </span>
                                    </td>
                                    <td className="py-2 px-3 text-xs text-gray-500 hidden md:table-cell">
                                        {m.newNames.length > 0 && <span className="text-blue-600">Mới: {m.newNames.join(', ')}</span>}
                                        {m.newNames.length > 0 && m.leftNames.length > 0 && ' | '}
                                        {m.leftNames.length > 0 && <span className="text-red-600">Nghỉ: {m.leftNames.join(', ')}</span>}
                                        {m.newNames.length === 0 && m.leftNames.length === 0 && <span className="text-gray-400">—</span>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
