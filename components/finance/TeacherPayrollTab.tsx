
import React, { useMemo, useState } from 'react';
import { useData } from '../../hooks/useDataContext';
import { useAuth } from '../../hooks/useAuth';
import { Table } from '../common/Table';
import { Payroll, Teacher, UserRole } from '../../types';
import { ListItemCard } from '../common/ListItemCard';
import { Button } from '../common/Button';
import { PayslipModal } from './PayslipModal';

export const TeacherPayrollTab: React.FC = () => {
    const { state } = useData();
    const { user, role } = useAuth();
    const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);
    
    // Internal state for year selection, defaulting to current year
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

    const teacherPayrolls = useMemo(() => {
        if (!user || role !== UserRole.TEACHER) return [];
        
        return state.payrolls
            .filter(p => {
                const [pYear] = p.month.split('-').map(Number);
                return p.teacherId === (user as Teacher).id && pYear === selectedYear;
            })
            .sort((a, b) => b.month.localeCompare(a.month));
    }, [state.payrolls, user, role, selectedYear]);

    const columns = [
        { header: 'Tháng', accessor: 'month' as keyof Payroll },
        { header: 'Số buổi dạy', accessor: 'sessionsTaught' as keyof Payroll },
        { header: 'Tổng lương', accessor: (item: Payroll) => `${item.totalSalary.toLocaleString('vi-VN')} VND` },
        { 
            header: 'Trạng thái', 
            accessor: (item: Payroll) => (
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${item.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {item.status === 'PAID' ? 'Đã nhận' : 'Chưa nhận'}
                </span>
            )
        },
    ];

    return (
        <div className="card-base">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-xl font-bold">Lịch sử Lương của tôi</h2>
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Chọn năm:</label>
                    <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(Number(e.target.value))} 
                        className="form-select py-1 w-32"
                    >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            <div className="hidden md:block">
                <Table<Payroll>
                    columns={columns}
                    data={teacherPayrolls}
                    sortConfig={null}
                    onSort={() => {}}
                    actions={(item) => (
                        <Button size="sm" variant="secondary" onClick={() => setSelectedPayroll(item)}>Chi tiết</Button>
                    )}
                />
            </div>
             <div className="md:hidden space-y-4">
                {teacherPayrolls.length > 0 ? (
                    teacherPayrolls.map(item => (
                        <ListItemCard
                            key={item.id}
                            title={<span className="font-semibold text-lg">Tháng {item.month}</span>}
                            details={[
                                { label: "Thực lĩnh", value: <span className="font-bold text-xl text-primary">{item.totalSalary.toLocaleString('vi-VN')} ₫</span> },
                                { label: "Số buổi", value: item.sessionsTaught > 0 ? item.sessionsTaught : 'Lương cứng' },
                            ]}
                            status={{
                                text: item.status === 'PAID' ? 'Đã nhận' : 'Chưa nhận',
                                colorClasses: item.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }}
                            actions={<Button className="w-full" variant="secondary" onClick={() => setSelectedPayroll(item)}>Xem Chi tiết</Button>}
                        />
                    ))
                ) : (
                    <div className="text-center text-gray-500 py-8">
                        Không có dữ liệu lương cho năm {selectedYear}.
                    </div>
                )}
            </div>
            
            <PayslipModal 
                isOpen={!!selectedPayroll} 
                onClose={() => setSelectedPayroll(null)} 
                payroll={selectedPayroll} 
                readOnly={true}
            />
        </div>
    );
};
