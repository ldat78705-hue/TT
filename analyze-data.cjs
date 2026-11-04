// Analyze sharded data to find students/classes that exist in current Firebase
// but NOT in June 2026 backup → identify data added after June
const fs = require('fs');
const path = require('path');

const backupFile = path.resolve(__dirname, 'backup_center_hkd_thanhdat_2026-11-04T15-05-07.json');
const juneFile = path.resolve(__dirname, 'EduCenterPro_Backup_2026-06-14.json');

const rawFirebase = JSON.parse(fs.readFileSync(backupFile, 'utf-8'));
const juneBackup = JSON.parse(fs.readFileSync(juneFile, 'utf-8'));

// 1. Collect all studentIds referenced in sharded data
const studentIdsInShards = new Set();
const classIdsInShards = new Set();
const studentInfoFromInvoices = new Map(); // studentId -> { months seen }
const studentInfoFromTransactions = new Map(); // studentId -> { name, amounts }

Object.keys(rawFirebase).forEach(key => {
    const data = rawFirebase[key]?.data;
    if (!Array.isArray(data)) return;
    
    data.forEach(item => {
        if (item.studentId) {
            studentIdsInShards.add(item.studentId);
            
            // Extract info from invoices
            if (key.startsWith('invoices_')) {
                if (!studentInfoFromInvoices.has(item.studentId)) {
                    studentInfoFromInvoices.set(item.studentId, { 
                        months: new Set(), 
                        classId: null, 
                        name: null,
                        amount: 0 
                    });
                }
                const info = studentInfoFromInvoices.get(item.studentId);
                if (item.month) info.months.add(item.month);
                if (item.classId) info.classId = item.classId;
                if (item.studentName) info.name = item.studentName;
            }
            
            // Extract info from transactions
            if (key.startsWith('transactions_')) {
                if (!studentInfoFromTransactions.has(item.studentId)) {
                    studentInfoFromTransactions.set(item.studentId, { 
                        name: null, 
                        dates: new Set(),
                        descriptions: []
                    });
                }
                const info = studentInfoFromTransactions.get(item.studentId);
                if (item.description) {
                    // Extract student name from description like "Thanh toán HP - ghi nhận bởi..."
                    info.descriptions.push(item.description);
                }
                if (item.date) info.dates.add(item.date);
                if (item.studentName) info.name = item.studentName;
            }
        }
        
        if (item.classId) classIdsInShards.add(item.classId);
    });
});

// 2. Check June backup students
const juneStudentIds = new Set(juneBackup.students.map(s => s.id));
const juneClassIds = new Set(juneBackup.classes.map(c => c.id));

// 3. Find gaps
const missingStudents = [];
studentIdsInShards.forEach(id => {
    if (!juneStudentIds.has(id)) {
        const invInfo = studentInfoFromInvoices.get(id);
        const txInfo = studentInfoFromTransactions.get(id);
        missingStudents.push({
            id,
            name: invInfo?.name || txInfo?.name || 'Unknown',
            classId: invInfo?.classId || null,
            invoiceMonths: invInfo ? [...invInfo.months].sort() : [],
            transactionDates: txInfo ? [...txInfo.dates].sort().slice(-3) : [],
        });
    }
});

const missingClasses = [];
classIdsInShards.forEach(id => {
    if (!juneClassIds.has(id)) {
        missingClasses.push(id);
    }
});

console.log('\n=== ANALYSIS RESULTS ===\n');
console.log(`Total unique studentIds in shards: ${studentIdsInShards.size}`);
console.log(`Students in June backup: ${juneStudentIds.size}`);
console.log(`Students in shards but NOT in June backup: ${missingStudents.length}`);
console.log(`\nTotal unique classIds in shards: ${classIdsInShards.size}`);
console.log(`Classes in June backup: ${juneClassIds.size}`);
console.log(`Classes in shards but NOT in June backup: ${missingClasses.length}`);

if (missingStudents.length > 0) {
    console.log('\n=== STUDENTS MISSING FROM JUNE BACKUP ===');
    missingStudents.forEach(s => {
        console.log(`  ${s.id} | Name: ${s.name} | Class: ${s.classId} | Invoices: ${s.invoiceMonths.join(',')} | Last TX: ${s.transactionDates.join(',')}`);
    });
}

if (missingClasses.length > 0) {
    console.log('\n=== CLASSES MISSING FROM JUNE BACKUP ===');
    missingClasses.forEach(c => console.log(`  ${c}`));
}

// 4. Also check students in June backup that might have been removed (not referenced in recent shards)
const recentStudentIds = new Set();
Object.keys(rawFirebase).forEach(key => {
    const data = rawFirebase[key]?.data;
    if (!Array.isArray(data)) return;
    // Only check 2026-06 onwards
    if (key.match(/_2026_(0[6-9]|1[0-2])/)) {
        data.forEach(item => {
            if (item.studentId) recentStudentIds.add(item.studentId);
        });
    }
});

const inactiveStudents = [];
juneBackup.students.forEach(s => {
    if (!recentStudentIds.has(s.id)) {
        inactiveStudents.push({ id: s.id, name: s.name, status: s.status || 'active' });
    }
});

console.log(`\n=== STUDENTS IN JUNE BACKUP BUT INACTIVE SINCE JUNE ===`);
console.log(`  Total: ${inactiveStudents.length}`);
inactiveStudents.forEach(s => {
    console.log(`  ${s.id} | ${s.name} | Status: ${s.status}`);
});

// 5. Check class info in attendance shards
console.log('\n=== CLASSES SEEN IN RECENT ATTENDANCE (2026-06 onwards) ===');
const recentClassInfo = new Map();
Object.keys(rawFirebase).forEach(key => {
    if (!key.startsWith('attendance_2026_')) return;
    const match = key.match(/attendance_(\d{4}_\d{2})_(.+)/);
    if (!match) return;
    const month = match[1];
    const classId = match[2];
    const data = rawFirebase[key]?.data || [];
    if (!recentClassInfo.has(classId)) recentClassInfo.set(classId, { months: new Set(), studentCount: new Set() });
    const info = recentClassInfo.get(classId);
    info.months.add(month);
    data.forEach(a => { if (a.studentId) info.studentCount.add(a.studentId); });
});

recentClassInfo.forEach((info, classId) => {
    const inJune = juneClassIds.has(classId) ? '✅ IN BACKUP' : '❌ NOT IN BACKUP';
    console.log(`  ${classId} | Months: ${[...info.months].sort().join(',')} | Students: ${info.studentCount.size} | ${inJune}`);
});

// Save analysis
const analysis = {
    missingStudents,
    missingClasses,
    inactiveStudents,
    totalStudentsInShards: studentIdsInShards.size,
    juneBackupStudents: juneStudentIds.size,
};
fs.writeFileSync(path.resolve(__dirname, 'data_analysis.json'), JSON.stringify(analysis, null, 2));
console.log('\nSaved analysis to data_analysis.json');
