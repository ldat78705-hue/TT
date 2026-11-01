
import React, { useMemo, useState, useEffect } from 'react';
import { useData } from '../../hooks/useDataContext';
import { Table, SortConfig, Column } from '../common/Table';
import { Payroll } from '../../types';
import { ListItemCard } from '../common/ListItemCard';
import { Pagination } from '../common/Pagination';
import { Button } from '../common/Button';
import { PayslipModal } from './PayslipModal';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { useToast } from '../../hooks/useToast';
import { ICONS } from '../../constants';

const ITEMS_PER_PAGE = 10;

interface PayrollTabProps {
    period: 'this_month' | 'last_month' | 'this_year';
}

const GeneratePayrollModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (month: number, year: number) => Promise<void>;
}> = ({ isOpen, onClose, onGenerate }) => {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const [year, setYear] = useState(lastMonth.getFullYear());
    const [month, setMonth] = useState(lastMonth.getMonth() + 1);
    const [isLoading, setIsLoading] = useState(false);

    const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    const handleGenerate = async () => {
        setIsLoading(true);
        await onGenerate(month, year);
        setIsLoading(false);
        onClose();
    };

    return (
        <ConfirmationModal
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={handleGenerate}
            title="Tính Lương Giáo viên"
            message={
                <div className="space-y-4">
                    <p>Chọn kỳ để tính lương. Hệ thống sẽ:</p>
                    <ul className="list-disc list-inside text-sm space-y-1 pl-2 text-gray-600 dark:text-gray-300">
                        <li>Quét toàn bộ dữ liệu điểm danh trong tháng đã chọn.</li>
                        <li>Tính toán lương dựa trên số buổi dạy (hoặc lương cứng) và mức lương hiện tại của giáo viên.</li>
                        <li><strong>Bảo toàn</strong> các khoản Thưởng/Phạt và Trạng thái thanh toán nếu bạn đã nhập trước đó.</li>
                        <li>Tự động tạo bảng lương cho giáo viên mới hoặc cập nhật số liệu cho bảng lương cũ.</li>
                    </ul>
                    <div className="flex items-center gap-4 pt-2">
                        <div className="flex-1">
                            <label className="block text-xs font-medium mb-1">Tháng</label>
                            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="form-select w-full">
                                {months.map(m => <option key={m} value={m}>Tháng {m}</option>)}
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-medium mb-1">Năm</label>
                            <select value={year} onChange={e => setYear(Number(e.target.value))} className="form-select w-full">
                                {years.map(y => <option key={y} value={y}>Năm {y}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            }
            confirmButtonText={isLoading ? 'Đang tính toán...' : 'Xác nhận Tính toán'}
            confirmButtonVariant="primary"
        />
    );
};

export const PayrollTab: React.FC<PayrollTabProps> = ({ period }) => {
    const { state, generatePayrolls } = useData();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<SortConfig<Payroll> | null>({ key: 'month', direction: 'descending' });
    const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);
    const [isGenerateModalOpen, setGenerateModalOpen] = useState(false);

    // Enhanced filters
    const [selectedMonth, setSelectedMonth] = useState(0); // 0 = All months
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    // Sync local filters with the generic period prop initially
    useEffect(() => {
        const now = new Date();
        if (period === 'this_month') {
            setSelectedMonth(now.getMonth() + 1);
            setSelectedYear(now.getFullYear());
        } else if (period === 'last_month') {
            const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            setSelectedMonth(last.getMonth() + 1);
            setSelectedYear(last.getFullYear());
        } else {
            setSelectedMonth(0); // All months
            setSelectedYear(now.getFullYear());
        }
    }, [period]);

    const handleSort = (key: keyof Payroll) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const filteredPayrolls = useMemo(() => {
        let payrolls = state.payrolls;

        // Filter by Year
        payrolls = payrolls.filter(p => p.month.startsWith(String(selectedYear)));

        // Filter by Month (if selected)
        if (selectedMonth !== 0) {
            const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
            payrolls = payrolls.filter(p => p.month === monthStr);
        }
        
        // Filter by Search Query
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            payrolls = payrolls.filter(p => p.teacherName.toLowerCase().includes(lowerQuery));
        }

        return payrolls;
    }, [state.payrolls, selectedYear, selectedMonth, searchQuery]);

    const sortedPayrolls = useMemo(() => {
        let sortableItems = [...filteredPayrolls];
        if (sortConfig) {
            sortableItems.sort((a, b) => {
                // Cast to any to bypass TypeScript strict null checks for sorting generic objects
                const aValue = (a as any)[sortConfig.key];
                const bValue = (b as any)[sortConfig.key];
                
                if (aValue === bValue) return 0;
                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;

                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [filteredPayrolls, sortConfig]);

    const totalPages = Math.ceil(sortedPayrolls.length / ITEMS_PER_PAGE);
    const paginatedPayrolls = sortedPayrolls.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        } else if (currentPage === 0 && totalPages > 0) {
            setCurrentPage(1);
        }
    }, [currentPage, totalPages]);

    useEffect(() => { setCurrentPage(1); }, [searchQuery, sortConfig, selectedMonth, selectedYear]);

    const handleGenerate = async (month: number, year: number) => {
        try {
            await generatePayrolls({ month, year });
            toast.success(`Đã tính lương xong cho tháng ${month}/${year}.`);
            // Auto switch filter to view the generated data
            setSelectedMonth(month);
            setSelectedYear(year);
        } catch (error) {
            toast.error('Lỗi khi tính lương. Vui lòng thử lại.');
        }
    };

    const columns: Column<Payroll>[] = [
        { header: 'Tháng', accessor: 'month', sortable: true },
        { header: 'Tên Giáo viên', accessor: 'teacherName', sortable: true },
        { header: 'Số buổi dạy', accessor: 'sessionsTaught', sortable: true },
        { header: 'Lương Cơ bản', accessor: (item) => `${item.baseSalary.toLocaleString('vi-VN')} ₫`, sortable: true, sortKey: 'baseSalary' },
        { header: 'Tổng Thực Lĩnh', accessor: (item) => <span className="font-bold text-primary">{item.totalSalary.toLocaleString('vi-VN')} ₫</span>, sortable: true, sortKey: 'totalSalary' },
        { 
            header: 'Trạng thái', 
            accessor: (item) => (
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${item.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {item.status === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                </span>
            ),
            sortable: true, 
            sortKey: 'status'
        },
    ];

    return (
        <div className="card-base">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <h2 className="text-xl font-bold">Bảng lương Giáo viên</h2>
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <div className="flex items-center gap-2">
                        <select 
                            value={selectedMonth} 
                            onChange={(e) => setSelectedMonth(Number(e.target.value))} 
                            className="form-select py-1.5 w-auto text-sm"
                        >
                            <option value={0}>Tất cả các tháng</option>
                            {months.map(m => <option key={m} value={m}>Tháng {m}</option>)}
                        </select>
                        <select 
                            value={selectedYear} 
                            onChange={(e) => setSelectedYear(Number(e.target.value))} 
                            className="form-select py-1.5 w-auto text-sm"
                        >
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <Button onClick={() => setGenerateModalOpen(true)} className="whitespace-nowrap">
                        {ICONS.plus} Tính lương
                    </Button>
                </div>
            </div>
            
            <input 
                type="text"
                placeholder="Tìm theo tên giáo viên..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="form-input mb-4"
            />

            <div className="hidden md:block">
                <Table<Payroll> 
                    columns={columns} 
                    data={paginatedPayrolls} 
                    sortConfig={sortConfig} 
                    onSort={handleSort} 
                    actions={(item) => (
                        <Button size="sm" variant="secondary" onClick={() => setSelectedPayroll(item)}>Chi tiết / Sửa</Button>
                    )}
                />
            </div>
            <div className="md:hidden space-y-4">
                {paginatedPayrolls.length > 0 ? (
                    paginatedPayrolls.map(item => (
                        <ListItemCard
                            key={item.id}
                            title={
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-900 dark:text-white">{item.teacherName}</span>
                                    <span className="text-xs text-gray-500">Tháng {item.month}</span>
                                </div>
                            }
                            details={[
                                { label: "Thực lĩnh", value: <span className="font-bold text-xl text-primary">{item.totalSalary.toLocaleString('vi-VN')} ₫</span> },
                                { label: "Số buổi", value: item.sessionsTaught > 0 ? item.sessionsTaught : 'Lương cứng' },
                            ]}
                            status={{
                                text: item.status === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán',
                                colorClasses: item.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }}
                            actions={<Button className="w-full mt-2" size="sm" variant="secondary" onClick={() => setSelectedPayroll(item)}>Chi tiết / Sửa</Button>}
                        />
                    ))
                ) : (
                    <div className="text-center text-gray-500 py-8">
                        Không tìm thấy dữ liệu lương phù hợp.
                        <br/>
                        Hãy thử bấm <strong>"Tính lương"</strong> để tạo dữ liệu mới.
                    </div>
                )}
            </div>

            {paginatedPayrolls.length > 0 && <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={sortedPayrolls.length} itemsPerPage={ITEMS_PER_PAGE} />}
            
            <PayslipModal 
                isOpen={!!selectedPayroll} 
                onClose={() => setSelectedPayroll(null)} 
                payroll={selectedPayroll} 
            />
            <GeneratePayrollModal
                isOpen={isGenerateModalOpen}
                onClose={() => setGenerateModalOpen(false)}
                onGenerate={handleGenerate}
            />
        </div>
    );
};
