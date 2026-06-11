import React, { useState, useMemo } from 'react';
import { useData } from '../hooks/useDataContext';
import { useToast } from '../hooks/useToast';
import { Room } from '../types';
import { ICONS } from '../constants';
import { Button } from '../components/common/Button';

const DAYS = [
    { key: 'Monday', label: 'T2' }, { key: 'Tuesday', label: 'T3' },
    { key: 'Wednesday', label: 'T4' }, { key: 'Thursday', label: 'T5' },
    { key: 'Friday', label: 'T6' }, { key: 'Saturday', label: 'T7' },
    { key: 'Sunday', label: 'CN' }
];

export const RoomsScreen: React.FC = () => {
    const { state, addRoom, updateRoom, deleteRoom } = useData();
    const { toast } = useToast();
    const rooms = state.rooms || [];
    const classes = state.classes || [];
    const [showModal, setShowModal] = useState(false);
    const [editRoom, setEditRoom] = useState<Room | null>(null);
    const [formName, setFormName] = useState('');
    const [formCapacity, setFormCapacity] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Build room schedule map: roomId -> [{ className, day, time }]
    const roomScheduleMap = useMemo(() => {
        const map: Record<string, { className: string; day: string; startTime: string; endTime: string }[]> = {};
        classes.forEach(cls => {
            cls.schedule.forEach(s => {
                if (s.roomId) {
                    if (!map[s.roomId]) map[s.roomId] = [];
                    map[s.roomId].push({ className: cls.name, day: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime });
                }
            });
        });
        return map;
    }, [classes]);

    const openAdd = () => { setEditRoom(null); setFormName(''); setFormCapacity(''); setFormDesc(''); setShowModal(true); };
    const openEdit = (r: Room) => { setEditRoom(r); setFormName(r.name); setFormCapacity(r.capacity.toString()); setFormDesc(r.description); setShowModal(true); };

    const handleSave = async () => {
        if (!formName.trim()) { toast.error('Tên phòng không được trống'); return; }
        setIsLoading(true);
        try {
            if (editRoom) {
                await updateRoom({ id: editRoom.id, name: formName.trim(), capacity: parseInt(formCapacity) || 0, description: formDesc.trim() });
                toast.success('Cập nhật phòng thành công');
            } else {
                await addRoom({ name: formName.trim(), capacity: parseInt(formCapacity) || 0, description: formDesc.trim() });
                toast.success('Thêm phòng thành công');
            }
            setShowModal(false);
        } catch (e: any) {
            toast.error(e.message || 'Lỗi');
        } finally { setIsLoading(false); }
    };

    const handleDelete = async (roomId: string) => {
        if (!window.confirm('Xóa phòng này? Các lịch học liên quan sẽ bỏ gán phòng.')) return;
        try {
            await deleteRoom(roomId);
            toast.success('Đã xóa phòng');
        } catch (e: any) { toast.error(e.message); }
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🏫 Quản lý Phòng học</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Quản lý phòng học và lịch sử dụng phòng</p>
                </div>
                <Button onClick={openAdd} className="!py-2.5">
                    {React.cloneElement(ICONS.plus, { className: 'w-5 h-5 mr-1' })} Thêm phòng
                </Button>
            </div>

            {/* Room cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rooms.map(room => {
                    const schedule = roomScheduleMap[room.id] || [];
                    const usageCount = schedule.length;
                    return (
                        <div key={room.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{room.name}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{room.description || 'Không có mô tả'}</p>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => openEdit(room)} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">{React.cloneElement(ICONS.edit, { className: 'w-4 h-4' })}</button>
                                    <button onClick={() => handleDelete(room.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">{React.cloneElement(ICONS.delete, { className: 'w-4 h-4' })}</button>
                                </div>
                            </div>
                            <div className="flex gap-3 text-sm mb-3">
                                <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-lg font-medium">👥 {room.capacity} chỗ</span>
                                <span className={`px-2 py-1 rounded-lg font-medium ${usageCount > 0 ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-50 dark:bg-gray-700 text-gray-500'}`}>
                                    📅 {usageCount} buổi/tuần
                                </span>
                            </div>
                            {schedule.length > 0 && (
                                <div className="border-t dark:border-gray-700 pt-3 space-y-1">
                                    {schedule.map((s, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs">
                                            <span className="font-medium text-gray-600 dark:text-gray-400 w-6">{DAYS.find(d => d.key === s.day)?.label}</span>
                                            <span className="text-gray-500">{s.startTime}-{s.endTime}</span>
                                            <span className="text-primary font-medium truncate">{s.className}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
                {rooms.length === 0 && (
                    <div className="col-span-full text-center py-16 text-gray-400">
                        <p className="text-5xl mb-4">🏫</p>
                        <p className="text-lg font-medium">Chưa có phòng học nào</p>
                        <p className="text-sm mt-1">Bấm "Thêm phòng" để bắt đầu</p>
                    </div>
                )}
            </div>

            {/* Weekly timetable */}
            {rooms.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">📅 Lịch sử dụng phòng theo tuần</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr>
                                    <th className="text-left p-2 border-b dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-400">Phòng</th>
                                    {DAYS.map(d => <th key={d.key} className="text-center p-2 border-b dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-400">{d.label}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {rooms.map(room => (
                                    <tr key={room.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                        <td className="p-2 border-b dark:border-gray-700 font-medium">{room.name}</td>
                                        {DAYS.map(d => {
                                            const entries = (roomScheduleMap[room.id] || []).filter(s => s.day === d.key);
                                            return (
                                                <td key={d.key} className="p-2 border-b dark:border-gray-700 text-center">
                                                    {entries.map((e, i) => (
                                                        <div key={i} className="text-xs bg-primary/10 text-primary rounded px-1 py-0.5 mb-0.5 font-medium">
                                                            {e.startTime}<br/>{e.className}
                                                        </div>
                                                    ))}
                                                    {entries.length === 0 && <span className="text-gray-300 dark:text-gray-600">—</span>}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4">{editRoom ? '✏️ Sửa phòng' : '🏫 Thêm phòng mới'}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Tên phòng *</label>
                                <input value={formName} onChange={e => setFormName(e.target.value)} className="form-input w-full" placeholder="Phòng 1" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Sức chứa (số chỗ)</label>
                                <input type="number" value={formCapacity} onChange={e => setFormCapacity(e.target.value)} className="form-input w-full" placeholder="30" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Mô tả</label>
                                <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} className="form-input w-full" rows={2} placeholder="Tầng 2, có máy chiếu..." />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <Button onClick={() => setShowModal(false)} className="flex-1 !bg-gray-200 !text-gray-700 hover:!bg-gray-300">Hủy</Button>
                            <Button onClick={handleSave} isLoading={isLoading} className="flex-1">{editRoom ? 'Lưu thay đổi' : 'Thêm phòng'}</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
