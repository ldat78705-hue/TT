import React, { useMemo, useState, useEffect } from 'react';
import { useData } from '../../hooks/useDataContext';
import { PersonStatus, AttendanceStatus } from '../../types';
import { Table, SortConfig, Column } from '../common/Table';
import { Pagination } from '../common/Pagination';
import { ListItemCard } from '../common/ListItemCard';
import { Button } from '../common/Button';
import { ExportButton } from '../common/ExportButton';
import { ICONS } from '../../constants';
import { printHtml, escapeHtml } from '../../utils/html';
import { buildPrintableReport } from '../../utils/reportPrintTemplates';

const ITEMS_PER_PAGE = 15;

interface AbsentStudentsReportTabProps {
    classFilter: string;
    startDate: string;
    endDate: string;
}

export interface AbsentReportData {
    id: string;
    name: string;
    className: string;
    date: string;
    reason: string;
    status: AttendanceStatus;
}

export const AbsentStudentsReportTab: React.FC<AbsentStudentsReportTabProps> = ({ classFilter, startDate, endDate }) => {
    const { state } = useData();
    const { students, classes, attendance } = state;
    
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<SortConfig<AbsentReportData> | null>({ key: 'date', direction: 'descending' });

    const reportData = useMemo(() => {
        let relevantStudents = students.filter(s => s.status === PersonStatus.ACTIVE);
        if (classFilter !== 'all') {
            const classStudentIds = new Set(classes.find(c => c.id === classFilter)?.studentIds || []);
            relevantStudents = relevantStudents.filter(s => classStudentIds.has(s.id));
        }

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            relevantStudents = relevantStudents.filter(s => s.name.toLowerCase().includes(lowerQuery) || s.id.toLowerCase().includes(lowerQuery));
        }

        // Find attendance records for the selected date range that are ABSENT or UNEXCUSED_ABSENT
        const absentRecords = attendance.filter(a => {
            const isAfterStart = !startDate || a.date >= startDate;
            const isBeforeEnd = !endDate || a.date <= endDate;
            return isAfterStart && isBeforeEnd &&
                (classFilter === 'all' || a.classId === classFilter) &&
                (a.status === AttendanceStatus.ABSENT || a.status === AttendanceStatus.UNEXCUSED_ABSENT);
        });

        const data: AbsentReportData[] = [];
        
        absentRecords.forEach(record => {
            const student = relevantStudents.find(s => s.id === record.studentId);
            if (student) {
                const cls = classes.find(c => c.id === record.classId);
                data.push({
                    id: student.id,
                    name: student.name,
                    className: cls?.name || 'Không rõ',
                    date: record.date,
                    reason: record.note || 'Không có lý do',
                    status: record.status
                });
            }
        });

        return data;

    }, [students, classes, attendance, startDate, endDate, classFilter, searchQuery]);
    
    const sortedData = useMemo(() => {
        let sortableItems = [...reportData];
        if (sortConfig !== null) {
            const getLastName = (fullName: string) => {
                if (!fullName) return '';
                const parts = fullName.trim().split(/\s+/);
                return parts[parts.length - 1];
            };

            sortableItems.sort((a, b) => {
                if (sortConfig.key === 'name') {
                    const lastNameA = getLastName(a.name);
                    const lastNameB = getLastName(b.name);
                    
                    const lastNameComparison = lastNameA.localeCompare(lastNameB, 'vi');
                    
                    if (lastNameComparison !== 0) {
                        return sortConfig.direction === 'ascending' ? lastNameComparison : -lastNameComparison;
                    }

                    const fullNameComparison = a.name.localeCompare(b.name, 'vi');
                    return sortConfig.direction === 'ascending' ? fullNameComparison : -fullNameComparison;
                }

                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [reportData, sortConfig]);

    const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
    const paginatedData = sortedData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        } else if (currentPage === 0 && totalPages > 0) {
            setCurrentPage(1);
        }
    }, [currentPage, totalPages]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, classFilter, startDate, endDate]);
    
    const handleSort = (key: keyof AbsentReportData) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };
    
    const exportData = useMemo(() => sortedData.map(item => ({
        id: item.id,
        name: item.name,
        className: item.className,
        date: item.date,
        statusText: item.status === AttendanceStatus.UNEXCUSED_ABSENT ? 'Không phép' : 'Có phép',
        reason: item.reason || ''
    })), [sortedData]);

    const exportColumns = {
        id: 'Mã HV',
        name: 'Họ tên',
        className: 'Lớp học',
        date: 'Ngày nghỉ',
        statusText: 'Trạng thái',
        reason: 'Lý do'
    };

    const columns: Column<AbsentReportData>[] = [
        { header: 'Mã HV', accessor: 'id', sortable: true },
        { header: 'Họ tên', accessor: 'name', sortable: true },
        { header: 'Lớp học', accessor: 'className', sortable: true },
        { header: 'Ngày nghỉ', accessor: 'date', sortable: true },
        { 
            header: 'Trạng thái', 
            accessor: (item: AbsentReportData) => (
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${item.status === AttendanceStatus.UNEXCUSED_ABSENT ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' : 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200'}`}>
                    {item.status === AttendanceStatus.UNEXCUSED_ABSENT ? 'Không phép' : 'Có phép'}
                </span>
            ),
            sortable: false 
        },
        { header: 'Lý do', accessor: 'reason', sortable: false },
    ];

    return (
        <div className="card-base">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <h2 className="text-xl font-semibold">Học sinh nghỉ học theo ngày</h2>
                <div className="flex flex-wrap gap-2 items-center">
                    <Button onClick={() => {
                        const html = buildPrintableReport({
                            title: 'Danh Sách Học Sinh Nghỉ Học',
                            subtitle: classFilter !== 'all' ? `Lớp: ${classes.find(c => c.id === classFilter)?.name || ''}` : undefined,
                            centerName: state.settings.name,
                            dateRange: { from: startDate, to: endDate },
                            columns: [
                                { header: 'STT', align: 'center', width: '40px' },
                                { header: 'Mã HV', width: '80px' },
                                { header: 'Họ tên' },
                                { header: 'Lớp học' },
                                { header: 'Ngày nghỉ', align: 'center', width: '100px' },
                                { header: 'Trạng thái', align: 'center', width: '90px' },
                                { header: 'Lý do' },
                            ],
                            rows: sortedData.map((item, idx) => [
                                String(idx + 1),
                                escapeHtml(item.id),
                                escapeHtml(item.name),
                                escapeHtml(item.className),
                                escapeHtml(item.date),
                                item.status === AttendanceStatus.UNEXCUSED_ABSENT
                                    ? '<span style="color:#dc2626;font-weight:600">Không phép</span>'
                                    : '<span style="color:#0d9488;font-weight:600">Có phép</span>',
                                escapeHtml(item.reason),
                            ]),
                            summary: [
                                { label: 'Tổng lượt nghỉ', value: String(sortedData.length) },
                            ],
                        });
                        printHtml(html);
                    }} variant="secondary">
                        {ICONS.print} In báo cáo
                    </Button>
                    <ExportButton data={exportData} columns={exportColumns} filenameBase={`HocSinhNghiHoc_${startDate}_${endDate}`} />
                </div>
            </div>
            <input 
                type="text"
                placeholder="Tìm học viên..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="form-input mb-4"
            />
            <div className="hidden md:block">
                <Table
                    columns={columns}
                    data={paginatedData}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                />
            </div>
            <div className="md:hidden space-y-4">
                 {paginatedData.map((item, index) => (
                    <ListItemCard
                        key={`${item.id}-${item.className}-${item.date}-${index}`}
                        title={item.name}
                        details={[
                            { label: 'Mã HV', value: item.id },
                            { label: 'Lớp học', value: item.className },
                            { label: 'Ngày nghỉ', value: item.date },
                            { 
                                label: 'Trạng thái', 
                                value: <span className={`px-2 py-1 text-xs font-semibold rounded-full ${item.status === AttendanceStatus.UNEXCUSED_ABSENT ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' : 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200'}`}>
                                    {item.status === AttendanceStatus.UNEXCUSED_ABSENT ? 'Không phép' : 'Có phép'}
                                </span> 
                            },
                            { label: 'Lý do', value: item.reason }
                        ]}
                    />
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
            {paginatedData.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                    Không có học sinh nào nghỉ học trong khoảng thời gian này.
                </div>
            )}
        </div>
    );
};

