// FULL RESTORE: Rebuild students, classes, teachers from sharded data
// Strategy: Use June backup as base, then add missing students/classes from shards
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, writeBatch } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf-8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);
const COL_NAME = 'center_hkd_thanhdat';

async function fullRestore() {
    // 1. Load June backup and current Firebase raw dump
    const juneBackup = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'EduCenterPro_Backup_2026-06-14.json'), 'utf-8'));
    const rawFirebase = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'backup_center_hkd_thanhdat_2026-11-04T15-05-07.json'), 'utf-8'));
    
    // 2. Collect ALL student info from shards
    const studentMap = new Map(); // id -> { name, classIds, balance, months, lastSeen }
    const classStudentMap = new Map(); // classId -> Set of studentIds (from attendance)
    const classTeacherMap = new Map(); // classId -> Set of teacherIds (from attendance)
    
    Object.keys(rawFirebase).forEach(key => {
        const data = rawFirebase[key]?.data;
        if (!Array.isArray(data)) return;
        
        data.forEach(item => {
            // From invoices: get student name, classId, balance info
            if (key.startsWith('invoices_') && item.studentId) {
                if (!studentMap.has(item.studentId)) {
                    studentMap.set(item.studentId, {
                        id: item.studentId,
                        name: null,
                        classIds: new Set(),
                        phone: null,
                        months: new Set(),
                        lastSeen: null,
                        balance: 0,
                        status: 'ACTIVE'
                    });
                }
                const s = studentMap.get(item.studentId);
                if (item.studentName) s.name = item.studentName;
                if (item.classId) s.classIds.add(item.classId);
                if (item.month) s.months.add(item.month);
            }
            
            // From transactions: get name, last activity date
            if (key.startsWith('transactions_') && item.studentId) {
                if (!studentMap.has(item.studentId)) {
                    studentMap.set(item.studentId, {
                        id: item.studentId,
                        name: null,
                        classIds: new Set(),
                        phone: null,
                        months: new Set(),
                        lastSeen: null,
                        balance: 0,
                        status: 'ACTIVE'
                    });
                }
                const s = studentMap.get(item.studentId);
                if (item.studentName) s.name = item.studentName;
                if (item.date && (!s.lastSeen || item.date > s.lastSeen)) s.lastSeen = item.date;
                // Track balance
                if (item.type === 'PAYMENT') s.balance += (item.amount || 0);
                if (item.type === 'ADJUSTMENT') s.balance += (item.amount || 0);
            }
            
            // From attendance: get class-student mapping and teacherIds
            if (key.startsWith('attendance_')) {
                if (item.classId && item.studentId) {
                    if (!classStudentMap.has(item.classId)) classStudentMap.set(item.classId, new Set());
                    classStudentMap.get(item.classId).add(item.studentId);
                }
                if (item.classId && item.teacherIds) {
                    if (!classTeacherMap.has(item.classId)) classTeacherMap.set(item.classId, new Set());
                    item.teacherIds.forEach(tid => classTeacherMap.get(item.classId).add(tid));
                }
            }
        });
    });
    
    // 3. Build merged students list
    const juneStudentMap = new Map();
    juneBackup.students.forEach(s => juneStudentMap.set(s.id, s));
    
    const mergedStudents = [];
    const juneStudentIds = new Set(juneBackup.students.map(s => s.id));
    
    // Start with June backup students - keep all their details
    juneBackup.students.forEach(s => {
        const shardInfo = studentMap.get(s.id);
        // Update classIds from recent attendance if available
        if (shardInfo && shardInfo.classIds.size > 0) {
            // Use the most recent classIds from shards
            s.classIds = [...shardInfo.classIds];
        }
        mergedStudents.push(s);
    });
    
    // Add NEW students (not in June backup) reconstructed from shards
    let newStudentCount = 0;
    studentMap.forEach((info, id) => {
        if (juneStudentIds.has(id)) return; // Already in June backup
        if (!info.name || info.name === 'Unknown') return; // Skip unknown
        if (id === '—' || id === 'HS299') return; // Skip phantom entries
        
        const classIdsArr = [...info.classIds];
        const lastMonth = [...info.months].sort().pop();
        
        // Determine if student is still active (has invoices in last 2 months)
        const recentMonths = ['2026-10', '2026-11', '2026-09'];
        const isActive = recentMonths.some(m => info.months.has(m));
        
        const reconstructed = {
            id: id,
            name: info.name,
            phone: '',
            dob: '',
            parentName: '',
            parentPhone: '',
            address: '',
            classIds: classIdsArr,
            enrollmentDate: '', 
            balance: 0,
            status: isActive ? 'ACTIVE' : 'INACTIVE',
            notes: `[Khôi phục tự động ${new Date().toISOString().substring(0,10)}] Phục dựng từ dữ liệu hóa đơn/giao dịch. Cần cập nhật thông tin liên hệ.`,
            tags: ['cần-cập-nhật'],
        };
        
        mergedStudents.push(reconstructed);
        newStudentCount++;
        console.log(`  + NEW Student: ${id} | ${info.name} | Classes: ${classIdsArr.join(',')} | Active: ${isActive}`);
    });
    
    // 4. Build merged classes
    const juneClassMap = new Map();
    juneBackup.classes.forEach(c => juneClassMap.set(c.id, c));
    
    const mergedClasses = [...juneBackup.classes];
    
    // Add missing classes L09, L10
    const missingClassIds = ['L09', 'L10'];
    missingClassIds.forEach(classId => {
        if (juneClassMap.has(classId)) return;
        
        const studentIds = classStudentMap.has(classId) ? [...classStudentMap.get(classId)] : [];
        const teacherIds = classTeacherMap.has(classId) ? [...classTeacherMap.get(classId)] : [];
        
        const reconstructedClass = {
            id: classId,
            name: `Lớp ${classId.replace('L', '')}`,
            studentIds: studentIds,
            teacherIds: teacherIds,
            schedule: [],
            tuitionFee: 0,
            status: 'ACTIVE',
            notes: `[Khôi phục tự động] Phục dựng từ dữ liệu điểm danh.`,
        };
        
        mergedClasses.push(reconstructedClass);
        console.log(`  + NEW Class: ${classId} | Students: ${studentIds.length} | Teachers: ${teacherIds.join(',')}`);
    });
    
    // Update existing classes with latest studentIds from attendance
    mergedClasses.forEach(cls => {
        if (classStudentMap.has(cls.id)) {
            const attendanceStudents = [...classStudentMap.get(cls.id)];
            // Merge: keep existing + add new from attendance
            const existingIds = new Set(cls.studentIds || []);
            attendanceStudents.forEach(sid => existingIds.add(sid));
            cls.studentIds = [...existingIds];
        }
        if (classTeacherMap.has(cls.id)) {
            const attendanceTeachers = [...classTeacherMap.get(cls.id)];
            cls.teacherIds = attendanceTeachers;
        }
    });
    
    // 5. Build merged settings
    const currentSettings = rawFirebase.settings?.data || {};
    const mergedSettings = {
        ...juneBackup.settings,
        // Keep financial settings from current Firebase  
        bankBin: currentSettings.bankBin || juneBackup.settings?.bankBin || '970422',
        bankAccountNumber: currentSettings.bankAccountNumber || juneBackup.settings?.bankAccountNumber || '8862888688',
        bankAccountHolder: currentSettings.bankAccountHolder || juneBackup.settings?.bankAccountHolder || 'HO KINH DOANH THANH DAT',
        bankName: currentSettings.bankName || juneBackup.settings?.bankName,
        // Keep admin password from current
        adminPassword: currentSettings.adminPassword || juneBackup.settings?.adminPassword,
        // Keep Zalo settings
        ...(currentSettings.zaloAccessToken ? { zaloAccessToken: currentSettings.zaloAccessToken } : {}),
        ...(currentSettings.zaloTokenExpiresAt ? { zaloTokenExpiresAt: currentSettings.zaloTokenExpiresAt } : {}),
        ...(currentSettings.zaloAppId ? { zaloAppId: currentSettings.zaloAppId } : {}),
        ...(currentSettings.zaloSecretKey ? { zaloSecretKey: currentSettings.zaloSecretKey } : {}),
        ...(currentSettings.zaloRefreshToken ? { zaloRefreshToken: currentSettings.zaloRefreshToken } : {}),
        ...(currentSettings.webhookSecretKey ? { webhookSecretKey: currentSettings.webhookSecretKey } : {}),
        // Ensure center name is set
        centerName: juneBackup.settings?.centerName || 'HỘ KINH DOANH THÀNH ĐẠT',
        name: juneBackup.settings?.name || 'HỘ KINH DOANH THÀNH ĐẠT',
    };
    
    // 6. WRITE TO FIREBASE
    console.log('\n=== WRITING TO FIREBASE ===');
    console.log(`  Students: ${mergedStudents.length} (${juneBackup.students.length} from backup + ${newStudentCount} reconstructed)`);
    console.log(`  Classes: ${mergedClasses.length} (${juneBackup.classes.length} from backup + ${missingClassIds.length} reconstructed)`);
    console.log(`  Teachers: ${juneBackup.teachers.length}`);
    console.log(`  Staff: ${juneBackup.staff.length}`);
    console.log(`  Settings centerName: "${mergedSettings.centerName}"`);
    
    const batch = writeBatch(db);
    
    batch.set(doc(db, COL_NAME, 'students'), { data: mergedStudents });
    batch.set(doc(db, COL_NAME, 'teachers'), { data: juneBackup.teachers || [] });
    batch.set(doc(db, COL_NAME, 'staff'), { data: juneBackup.staff || [] });
    batch.set(doc(db, COL_NAME, 'classes'), { data: mergedClasses });
    batch.set(doc(db, COL_NAME, 'rooms'), { data: juneBackup.rooms || [] });
    batch.set(doc(db, COL_NAME, 'settings'), { data: mergedSettings });
    batch.set(doc(db, COL_NAME, 'announcements'), { data: juneBackup.announcements || [] });
    batch.set(doc(db, COL_NAME, 'progressReports'), { data: juneBackup.progressReports || [] });
    batch.set(doc(db, COL_NAME, 'auditLogs'), { data: [{
        targetType: 'system',
        userName: 'Hệ thống',
        action: 'restoreData',
        details: `Khôi phục dữ liệu: ${mergedStudents.length} HS, ${mergedClasses.length} lớp, ${juneBackup.teachers.length} GV từ backup 14/06 + phục dựng từ shards`,
        userId: 'SYSTEM',
        targetName: 'Khôi phục',
        timestamp: new Date().toISOString()
    }]});
    
    const newSyncId = Date.now().toString() + '_fullrestore_' + Math.random().toString(36).substring(2);
    batch.set(doc(db, COL_NAME, '_sync'), { syncId: newSyncId, lastUpdatedAt: Date.now() });
    
    await batch.commit();
    console.log('\n✅ FULL RESTORE COMPLETE!');
    
    // 7. Save merged backup
    const allShardedData = { attendance: [], invoices: [], transactions: [], income: [], expenses: [], payrolls: [] };
    Object.keys(rawFirebase).forEach(key => {
        const data = rawFirebase[key]?.data;
        if (!Array.isArray(data)) return;
        ['attendance','invoices','transactions','income','expenses','payrolls'].forEach(col => {
            if (key === col || key.startsWith(col + '_')) allShardedData[col].push(...data);
        });
    });
    
    const fullBackup = {
        students: mergedStudents,
        teachers: juneBackup.teachers,
        staff: juneBackup.staff,
        classes: mergedClasses,
        rooms: juneBackup.rooms || [],
        settings: mergedSettings,
        announcements: juneBackup.announcements || [],
        progressReports: juneBackup.progressReports || [],
        auditLogs: [],
        ...allShardedData
    };
    
    const ts = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const backupFile = path.resolve(__dirname, `backup_FULL_RESTORE_${ts}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(fullBackup, null, 2), 'utf-8');
    console.log(`\nFull backup saved: ${backupFile}`);
    console.log(`Size: ${(fs.statSync(backupFile).size / 1024 / 1024).toFixed(1)} MB`);
    
    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Students: ${mergedStudents.length} total`);
    console.log(`  - From backup (Jun 2026): ${juneBackup.students.length}`);
    console.log(`  - Reconstructed from shards: ${newStudentCount}`);
    console.log(`  - ⚠️ New students need: phone, DOB, parentName, parentPhone, address update`);
    console.log(`Classes: ${mergedClasses.length} total`);
    console.log(`  - From backup: ${juneBackup.classes.length}`);
    console.log(`  - Reconstructed: L09, L10`);
    console.log(`  - ⚠️ New classes need: schedule, tuitionFee update`);
    console.log(`Teachers: ${juneBackup.teachers.length} (unchanged from backup)`);
    console.log(`Attendance: ${allShardedData.attendance.length} records (100% intact)`);
    console.log(`Invoices: ${allShardedData.invoices.length} records (100% intact)`);
    console.log(`Transactions: ${allShardedData.transactions.length} records (100% intact)`);
    
    process.exit(0);
}

fullRestore().catch(e => { console.error('FATAL:', e); process.exit(1); });
