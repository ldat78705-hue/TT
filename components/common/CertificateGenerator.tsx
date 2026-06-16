import React, { useState } from 'react';
import { Student, Class, CenterSettings } from '../../types';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

interface Props {
    student: Student;
    classes: Class[];
    settings: CenterSettings;
}

export const CertificateGenerator: React.FC<Props> = ({ student, classes, settings }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [completionDate, setCompletionDate] = useState(new Date().toISOString().split('T')[0]);
    const [grade, setGrade] = useState('Xuất sắc');

    // Get classes this student is enrolled in
    const enrolledClasses = classes.filter(c => c.studentIds.includes(student.id));

    const handlePrint = () => {
        const selectedClass = classes.find(c => c.id === selectedClassId);
        if (!selectedClass) return;

        const centerName = settings.name || 'Trung tâm';
        const centerAddress = settings.address || '';
        const formattedDate = new Date(completionDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        
        const gradeColors: Record<string, string> = {
            'Xuất sắc': '#f59e0b',
            'Giỏi': '#10b981',
            'Khá': '#6366f1',
            'Đạt': '#64748b',
        };
        const accentColor = gradeColors[grade] || '#6366f1';

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ChungChi_${student.id}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f1f5f9;font-family:'Inter',sans-serif}
.cert{width:297mm;height:210mm;background:white;position:relative;overflow:hidden;padding:20mm 25mm}
.border-frame{position:absolute;inset:8mm;border:3px solid ${accentColor};border-radius:4px}
.border-inner{position:absolute;inset:11mm;border:1px solid ${accentColor}40;border-radius:2px}
.corner{position:absolute;width:30px;height:30px;border-color:${accentColor}}
.corner-tl{top:14mm;left:14mm;border-top:3px solid;border-left:3px solid}
.corner-tr{top:14mm;right:14mm;border-top:3px solid;border-right:3px solid}
.corner-bl{bottom:14mm;left:14mm;border-bottom:3px solid;border-left:3px solid}
.corner-br{bottom:14mm;right:14mm;border-bottom:3px solid;border-right:3px solid}
.content{position:relative;z-index:1;text-align:center;height:100%;display:flex;flex-direction:column;justify-content:space-between}
.header h1{font-family:'Playfair Display',serif;font-size:16px;color:#64748b;letter-spacing:4px;text-transform:uppercase;margin-bottom:4px}
.header h2{font-family:'Playfair Display',serif;font-size:42px;color:${accentColor};margin:8px 0;letter-spacing:2px}
.header .subtitle{font-size:14px;color:#94a3b8;letter-spacing:3px;text-transform:uppercase}
.body{flex:1;display:flex;flex-direction:column;justify-content:center;gap:16px}
.body .label{font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:2px}
.body .name{font-family:'Playfair Display',serif;font-size:36px;color:#1e293b;border-bottom:2px solid ${accentColor}40;padding-bottom:8px;display:inline-block}
.body .course{font-size:18px;color:#475569;margin-top:12px}
.body .course strong{color:${accentColor};font-weight:700}
.body .grade{display:inline-block;padding:6px 24px;border:2px solid ${accentColor};border-radius:50px;font-size:14px;font-weight:700;color:${accentColor};letter-spacing:2px;text-transform:uppercase;margin-top:8px}
.body .desc{font-size:12px;color:#94a3b8;max-width:500px;margin:8px auto 0;line-height:1.5}
.footer{display:flex;justify-content:space-between;align-items:flex-end}
.footer .date{font-size:12px;color:#64748b}
.footer .sign{text-align:center}
.footer .sign-line{width:150px;border-top:1px solid #cbd5e1;margin:4px auto}
.footer .sign-name{font-size:11px;color:#94a3b8}
.footer .sign-title{font-size:10px;color:#cbd5e1}
@media print{body{background:white;min-height:auto}.cert{box-shadow:none}@page{size:A4 landscape;margin:0}}
</style></head>
<body>
<div class="cert">
    <div class="border-frame"></div>
    <div class="border-inner"></div>
    <div class="corner corner-tl"></div>
    <div class="corner corner-tr"></div>
    <div class="corner corner-bl"></div>
    <div class="corner corner-br"></div>
    <div class="content">
        <div class="header">
            <h1>${centerName}</h1>
            <h2>CHỨNG NHẬN</h2>
            <p class="subtitle">Certificate of Completion</p>
        </div>
        <div class="body">
            <p class="label">Được cấp cho</p>
            <p class="name">${student.name}</p>
            <p class="course">Đã hoàn thành khóa học <strong>${selectedClass.name}</strong></p>
            <p class="course">${selectedClass.subject ? `Môn: ${selectedClass.subject}` : ''}</p>
            <span class="grade">Xếp loại: ${grade}</span>
            <p class="desc">Đã hoàn thành đầy đủ nội dung chương trình đào tạo và đạt yêu cầu đầu ra của khóa học.</p>
        </div>
        <div class="footer">
            <div class="date">
                <p>${centerAddress}</p>
                <p>Ngày cấp: ${formattedDate}</p>
            </div>
            <div class="sign">
                <p style="height:40px"></p>
                <div class="sign-line"></div>
                <p class="sign-name">${settings.adminDisplayName || 'Giám đốc'}</p>
                <p class="sign-title">Giám đốc Trung tâm</p>
            </div>
        </div>
    </div>
</div>
</body></html>`;

        const pw = window.open('', '_blank');
        if (pw) {
            pw.document.write(html);
            pw.document.close();
            pw.onload = () => setTimeout(() => pw.print(), 500);
        }
    };

    return (
        <>
            <Button variant="secondary" onClick={() => setIsOpen(true)} className="text-sm">
                🎓 Cấp chứng nhận
            </Button>
            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Cấp chứng nhận hoàn thành">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Học viên</label>
                        <p className="form-input bg-gray-50 dark:bg-gray-700 cursor-default">{student.name} ({student.id})</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Khóa học / Lớp <span className="text-red-500">*</span></label>
                        <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} className="form-select">
                            <option value="">-- Chọn lớp --</option>
                            {enrolledClasses.map(c => (
                                <option key={c.id} value={c.id}>{c.name} — {c.subject}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Ngày cấp</label>
                            <input type="date" value={completionDate} onChange={e => setCompletionDate(e.target.value)} className="form-input" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Xếp loại</label>
                            <select value={grade} onChange={e => setGrade(e.target.value)} className="form-select">
                                <option>Xuất sắc</option>
                                <option>Giỏi</option>
                                <option>Khá</option>
                                <option>Đạt</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                        <Button variant="secondary" onClick={() => setIsOpen(false)}>Hủy</Button>
                        <Button onClick={handlePrint} disabled={!selectedClassId}>
                            🖶️ In chứng nhận
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
};
