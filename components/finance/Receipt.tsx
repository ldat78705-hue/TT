import { forwardRef, useMemo } from 'react';
import { useData } from '../../hooks/useDataContext';
import { Transaction } from '../../types';

interface ReceiptProps {
    transaction: Transaction;
    /** 'print' = fixed A4 width for export; 'preview' = responsive for modal display */
    mode?: 'print' | 'preview';
}

const formatCurrency = (amount: number) => `${Math.round(Math.abs(amount)).toLocaleString('vi-VN')} ₫`;

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(({ transaction, mode = 'print' }, ref) => {
    const { state } = useData();
    const { students, settings, classes } = state;

    const student = useMemo(() => students.find(s => s.id === transaction.studentId), [students, transaction]);
    const enrolledClasses = useMemo(() => {
        if (!student) return [];
        return classes.filter(c => c.studentIds.includes(student.id));
    }, [classes, student]);

    if (!student) return <div ref={ref}>Không tìm thấy học viên.</div>;

    const receiptDate = new Date(transaction.date);
    const isPreview = mode === 'preview';

    const containerStyle: React.CSSProperties = isPreview
        ? { width: '100%', maxWidth: '100%', margin: '0 auto', boxSizing: 'border-box' as const }
        : { width: '210mm', margin: '0 auto', boxSizing: 'border-box' as const };

    return (
        <div ref={ref} className="bg-white text-gray-900 font-sans" style={{ ...containerStyle, padding: isPreview ? '20px' : '24px' }}>
            {/* Header */}
            <div className="text-center mb-4 border-b-2 border-gray-300 pb-4">
                <h1 className="text-2xl font-bold uppercase tracking-wide" style={{ color: settings.themeColor }}>{settings.name}</h1>
                <div className="text-xs mt-1 text-gray-500">
                    {settings.address && <span className="block">{settings.address}</span>}
                    {settings.phone && <span>Hotline: <span className="font-medium text-gray-700">{settings.phone}</span></span>}
                </div>
            </div>

            {/* Title */}
            <div className="text-center mb-6">
                <h2 className="text-3xl font-extrabold uppercase tracking-tight">PHIẾU THU</h2>
                <div className="flex items-center justify-center gap-4 text-xs mt-2 text-gray-500">
                    <span>Số phiếu: <span className="font-mono font-bold text-gray-700">#{transaction.id.slice(-8)}</span></span>
                    <span>•</span>
                    <span>Ngày: {receiptDate.toLocaleDateString('vi-VN')}</span>
                    <span>•</span>
                    <span>Giờ: {receiptDate.toLocaleTimeString('vi-VN')}</span>
                </div>
            </div>

            {/* Student Info */}
            <div className="mb-4 border border-gray-300 rounded-lg p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2 text-gray-500">Thông tin người nộp</h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <div><span className="text-xs text-gray-500">Họ tên học viên</span><p className="font-bold text-lg">{student.name}</p></div>
                    <div><span className="text-xs text-gray-500">Mã học viên</span><p className="font-mono font-semibold">{student.id}</p></div>
                    <div><span className="text-xs text-gray-500">Phụ huynh</span><p className="font-medium">{student.parentName}</p></div>
                    <div><span className="text-xs text-gray-500">Lớp đang học</span><p className="font-medium">{enrolledClasses.map(c => c.name).join(', ') || 'N/A'}</p></div>
                </div>
            </div>

            {/* Payment Details */}
            <table className="w-full text-sm border-collapse border border-gray-300 mb-4">
                <thead>
                    <tr className="bg-gray-50">
                        <th className="py-3 px-4 text-left font-bold uppercase text-xs tracking-wider border-b-2 border-gray-300">Nội dung</th>
                        <th className="py-3 px-4 text-center font-bold uppercase text-xs tracking-wider w-32 border-b-2 border-gray-300">Hình thức</th>
                        <th className="py-3 px-4 text-right font-bold uppercase text-xs tracking-wider w-40 border-b-2 border-gray-300">Số tiền</th>
                    </tr>
                </thead>
                <tbody>
                    <tr className="border-b border-gray-200">
                        <td className="py-3 px-4 font-medium">{transaction.description}</td>
                        <td className="py-3 px-4 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                transaction.paymentMethod === 'transfer' 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                                {transaction.paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'}
                            </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-lg">{formatCurrency(transaction.amount)}</td>
                    </tr>
                </tbody>
            </table>

            {/* Total */}
            <div className="flex justify-end mb-6">
                <div className="text-right border-2 border-gray-300 rounded-lg px-6 py-3 bg-gray-50">
                    <span className="block text-xs uppercase tracking-widest text-gray-500">Tổng số tiền đã thu</span>
                    <span className="block text-2xl font-bold tracking-tight">{formatCurrency(transaction.amount)}</span>
                </div>
            </div>

            {/* Balance after payment */}
            <div className="bg-gray-50 p-3 rounded-lg text-sm mb-6 border border-gray-200">
                <p>Số dư tài khoản sau giao dịch: <span className={`font-bold ${student.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{student.balance.toLocaleString('vi-VN')} ₫</span></p>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 mt-8 text-center text-sm">
                <div>
                    <p className="font-bold uppercase text-xs tracking-wider">Người nộp tiền</p>
                    <p className="text-xs text-gray-400 mt-1">(Ký, ghi rõ họ tên)</p>
                    <div className="h-20"></div>
                </div>
                <div>
                    <p className="font-bold uppercase text-xs tracking-wider">Người thu tiền</p>
                    <p className="text-xs text-gray-400 mt-1">(Ký, ghi rõ họ tên)</p>
                    <div className="h-20"></div>
                    {settings.taxSignatureUrl && (
                        <img src={settings.taxSignatureUrl} alt="Chữ ký" className="h-12 mx-auto opacity-60" />
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] text-gray-400 mt-6 border-t border-gray-200 pt-3">
                <p>Phiếu thu được xuất từ hệ thống {settings.name}. Đây là bằng chứng thanh toán hợp lệ.</p>
            </div>
        </div>
    );
});
