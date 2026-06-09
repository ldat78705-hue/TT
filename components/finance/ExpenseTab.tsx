import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from '../../hooks/useDataContext';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Table, SortConfig, Column } from '../common/Table';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { ICONS } from '../../constants';
import { Expense, ExpenseCategory, UserRole } from '../../types';
import { CurrencyInput } from '../common/CurrencyInput';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { Pagination } from '../common/Pagination';
import { ListItemCard } from '../common/ListItemCard';

const ITEMS_PER_PAGE = 10;

const expenseCategoryMap: Record<ExpenseCategory, string> = {
    [ExpenseCategory.SALARY]: 'Lương',
    [ExpenseCategory.RENT]: 'Thuê mặt bằng',
    [ExpenseCategory.UTILITIES]: 'Điện, nước, internet',
    [ExpenseCategory.MARKETING]: 'Tiếp thị',
    [ExpenseCategory.SUPPLIES]: 'Văn phòng phẩm',
    [ExpenseCategory.OTHER]: 'Chi khác',
};

import { getVietnamTime, formatVietnamDate } from '../../utils/date';

const ExpenseForm: React.FC<{
    item?: Expense;
    onSubmit: (data: Omit<Expense, 'id'>) => void;
    onCancel: () => void;
}> = ({ item, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState({
        description: item?.description || '',
        amount: item?.amount || 0,
        category: item?.category || ExpenseCategory.OTHER,
        date: item?.date ? (item.date.includes('T') ? item.date.substring(0, 16) : `${item.date}T00:00`) : getVietnamTime().substring(0, 16),
    });
    const descRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        descRef.current?.focus();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalDate = formData.date.length === 16 ? `${formData.date}:00` : formData.date;
        onSubmit({ ...formData, date: finalDate });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium">Mô tả</label>
                <input ref={descRef} type="text" name="description" value={formData.description} onChange={handleChange} className="form-input mt-1" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium">Số tiền (VND)</label>
                    <CurrencyInput value={formData.amount} onChange={(val) => setFormData(p => ({...p, amount: val}))} className="form-input mt-1" required />
                </div>
                 <div>
                    <label className="block text-sm font-medium">Ngày</label>
                    <input type="datetime-local" step="1" name="date" value={formData.date} onChange={handleChange} className="form-input mt-1" required />
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium">Hạng mục</label>
                <select name="category" value={formData.category} onChange={handleChange} className="form-select mt-1">
                    {Object.entries(expenseCategoryMap).map(([key, value]) => (
                        <option key={key} value={key}>{value}</option>
                    ))}
                </select>
            </div>
             <div className="flex justify-end space-x-4 pt-4 border-t dark:border-gray-700">
                <Button type="button" variant="secondary" onClick={onCancel}>Hủy</Button>
                <Button type="submit">{item ? 'Lưu' : 'Thêm'}</Button>
            </div>
        </form>
    )
};

export const ExpenseTab: React.FC = () => {
    const { state, addExpense, updateExpense, deleteExpense } = useData();
    const { role } = useAuth();
    const { toast } = useToast();
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Expense | undefined>(undefined);
    const [itemToDelete, setItemToDelete] = useState<Expense | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<SortConfig<Expense> | null>({ key: 'date', direction: 'descending' });

    const canManage = role === UserRole.ADMIN || role === UserRole.ACCOUNTANT;

    const handleSort = (key: keyof Expense) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const filteredItems = useMemo(() => {
        if (!searchQuery) return state.expenses;
        const lowerQuery = searchQuery.toLowerCase();
        return state.expenses.filter(item => item.description.toLowerCase().includes(lowerQuery));
    }, [state.expenses, searchQuery]);

    const sortedItems = useMemo(() => {
        let sortableItems = [...filteredItems];
        if (sortConfig) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [filteredItems, sortConfig]);

    const totalPages = Math.ceil(sortedItems.length / ITEMS_PER_PAGE);
    const paginatedItems = sortedItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        } else if (currentPage === 0 && totalPages > 0) {
            setCurrentPage(1);
        }
    }, [currentPage, totalPages]);

    useEffect(() => { setCurrentPage(1); }, [searchQuery, sortConfig]);

    const handleOpenModal = (item?: Expense) => {
        setEditingItem(item);
        setModalOpen(true);
    };
    
    const handleSubmit = async (data: Omit<Expense, 'id'>) => {
        try {
            if (editingItem) {
                await updateExpense({ ...data, id: editingItem.id });
                toast.success('Đã cập nhật khoản chi.');
            } else {
                await addExpense(data);
                toast.success('Đã thêm khoản chi mới.');
            }
            setModalOpen(false);
            setEditingItem(undefined);
        } catch (error) {
            toast.error('Đã xảy ra lỗi.');
        }
    };

    const handleDelete = async () => {
        if (itemToDelete) {
            try {
                await deleteExpense(itemToDelete.id);
                toast.success('Đã xóa khoản chi.');
            } catch (error) {
                toast.error('Lỗi khi xóa.');
            } finally {
                setItemToDelete(null);
            }
        }
    };
    
    const columns: Column<Expense>[] = [
        { header: 'Ngày', accessor: (item) => formatVietnamDate(item.date), sortable: true, sortKey: 'date' },
        { header: 'Mô tả', accessor: 'description', sortable: true },
        { header: 'Hạng mục', accessor: (item) => expenseCategoryMap[item.category], sortable: true, sortKey: 'category' },
        { header: 'Số tiền', accessor: (item) => `${item.amount.toLocaleString('vi-VN')} ₫`, sortable: true, sortKey: 'amount' },
    ];

    return (
        <div className="card-base">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <h2 className="text-xl font-semibold">Quản lý Chi phí</h2>
                {canManage && (
                    <Button onClick={() => handleOpenModal()}>{ICONS.plus} Thêm Khoản chi</Button>
                )}
            </div>
            <input type="text" placeholder="Tìm kiếm..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="form-input mb-4"/>

            <div className="hidden md:block">
                <Table<Expense> columns={columns} data={paginatedItems} sortConfig={sortConfig} onSort={handleSort} actions={canManage ? (item) => (
                    item.id.startsWith('EXP-PAY-') ? <span className="text-gray-400 text-xs italic">Tự động</span> :
                    <><button onClick={() => handleOpenModal(item)}>{ICONS.edit}</button><button onClick={() => setItemToDelete(item)} className="text-red-500">{ICONS.delete}</button></>
                ) : undefined}/>
            </div>
             <div className="md:hidden space-y-4">
                {paginatedItems.map(item => <ListItemCard key={item.id} title={item.description} details={[{label: "Ngày", value: formatVietnamDate(item.date)}, {label: "Số tiền", value: `${item.amount.toLocaleString('vi-VN')} ₫`}]} actions={canManage && !item.id.startsWith('EXP-PAY-') ? (<><Button size="sm" variant="secondary" onClick={() => handleOpenModal(item)}>Sửa</Button><Button size="sm" variant="danger" onClick={() => setItemToDelete(item)}>Xóa</Button></>) : undefined} />)}
            </div>

            {paginatedItems.length > 0 && <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={sortedItems.length} itemsPerPage={ITEMS_PER_PAGE} />}
            
            <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editingItem ? 'Sửa Khoản chi' : 'Thêm Khoản chi'}>
                <ExpenseForm item={editingItem} onSubmit={handleSubmit} onCancel={() => setModalOpen(false)} />
            </Modal>
            <ConfirmationModal isOpen={!!itemToDelete} onClose={() => setItemToDelete(null)} onConfirm={handleDelete} title="Xác nhận Xóa" message="Bạn có chắc muốn xóa khoản chi này?" />
        </div>
    );
};