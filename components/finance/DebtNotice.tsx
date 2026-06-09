
import React, { useMemo } from 'react';
import { Student, Transaction, CenterSettings } from '../../types';

interface DebtNoticeProps {
    student: Student;
    transactions: Transaction[];
    settings: CenterSettings;
}

const formatCurrency = (amount: number) => `${Math.round(amount).toLocaleString('vi-VN')} ₫`;

const normalizeAccountName = (name: string) => {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase();
};

export const DebtNotice: React.FC<DebtNoticeProps> = ({ student, transactions, settings }) => {
    const totalDue = student.balance < 0 ? Math.abs(student.balance) : 0;

    const recentTransactions = useMemo(() => {
        return [...transactions]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 8); // show last 8 transactions
    }, [transactions]);


    const qrCodeUrl = useMemo(() => {
        const { bankAccountNumber, bankBin, bankAccountHolder } = settings;
        if (!bankAccountNumber || !bankBin || totalDue <= 0) {
            return null;
        }
        const description = `HOC PHI ${student.id}`;
        
        const params: Record<string, string> = {
            amount: Math.round(totalDue).toString(),
            addInfo: description,
        };
        
        if (bankAccountHolder) {
            params.accountName = normalizeAccountName(bankAccountHolder);
        }
        
        return `https://img.vietqr.io/image/${bankBin}-${bankAccountNumber}-compact2.png?${new URLSearchParams(params).toString()}`;
    }, [settings, student.name, totalDue]);

    return (
        <div className="bg-white p-2 text-gray-900 border border-gray-300 flex flex-col text-[10px]" style={{ fontFamily: "Arial, sans-serif", maxWidth: '300px', margin: '0 auto' }}>
            <header className="text-center pb-2 border-b border-dashed border-gray-400">
                <h1 className="text-sm font-bold uppercase whitespace-nowrap" style={{ color: settings.themeColor }}>{settings.name}</h1>
                <p>{settings.address}</p>
                <p>ĐT: {settings.phone}</p>
            </header>

            <div className="text-center my-2">
                <h2 className="text-sm font-bold uppercase">THÔNG BÁO HỌC PHÍ</h2>
                <p className="text-gray-600 italic">Ngày: {new Date().toLocaleDateString('vi-VN')}</p>
            </div>

            <div className="mb-2">
                <p><span className="font-bold">Học viên:</span> {student.name}</p>
                <p><span className="font-bold">Mã HV:</span> {student.id}</p>
            </div>

            <div className="flex-grow border-t border-b border-gray-200 py-2 mb-2">
                <table className="w-full text-left">
                    <thead>
                        <tr className="font-bold border-b border-gray-200">
                            <th className="pb-1 w-20">Ngày</th>
                            <th className="pb-1">ND</th>
                            <th className="pb-1 text-right">Tiền</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recentTransactions.map(t => (
                            <tr key={t.id}>
                                <td className="py-1 align-top">{new Date(t.date).toLocaleDateString('vi-VN', {day: '2-digit', month:'2-digit'})}</td>
                                <td className="py-1 align-top">{t.description.substring(0, 20)}{t.description.length > 20 ? '...' : ''}</td>
                                <td className={`py-1 align-top text-right font-semibold ${t.amount >= 0 ? 'text-green-600' : 'text-black'}`}>
                                    {formatCurrency(t.amount)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <div className="flex justify-between items-center my-2 py-2 border-t border-b border-gray-800">
                <span className="font-bold uppercase text-xs">Cần thanh toán</span>
                <span className="font-bold text-lg">{formatCurrency(totalDue)}</span>
            </div>

            <div className="mt-1">
                 <p className="font-bold underline mb-1">Thanh toán qua ngân hàng:</p>
                 <p>{settings.bankName} - {settings.bankAccountNumber}</p>
                 <p>Chủ TK: {settings.bankAccountHolder}</p>
                 <div className="mt-1">
                    <span className="font-bold">Nội dung CK: </span>
                    <span className="font-mono font-bold">{`HOC PHI ${student.id}`}</span>
                </div>
            </div>
            
            {qrCodeUrl && (
                <div className="text-center mt-3 pt-2 border-t border-dashed border-gray-400">
                    <img src={qrCodeUrl} alt="QR Code" className="w-24 h-24 mx-auto" crossOrigin="anonymous" />
                    <p className="mt-1 font-semibold">Quét mã thanh toán</p>
                </div>
            )}
            
            <div className="text-center mt-4 italic text-[9px]">
                Cảm ơn Quý phụ huynh!
            </div>
        </div>
    );
};
