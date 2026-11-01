# EduCenter Pro — Tài liệu Kỹ thuật Toàn diện

> **Phiên bản**: 2.7 | **Cập nhật**: 17/06/2026  
> **Web Stack**: React 18 + TypeScript + Express + Firestore + Vite + TailwindCSS  
> **Android Stack**: Kotlin + Jetpack Compose + Hilt + Room + Retrofit  
> **Repo**: `https://github.com/ldat78705-hue/TT.git` | Branch: `main`

---

## Mục lục
1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Cấu trúc thư mục](#2-cấu-trúc-thư-mục)
3. [Luồng dữ liệu](#3-luồng-dữ-liệu)
4. [Hệ thống xác thực & phân quyền](#4-hệ-thống-xác-thực--phân-quyền)
5. [API Endpoints](#5-api-endpoints)
6. [Cơ sở dữ liệu (Firestore)](#6-cơ-sở-dữ-liệu-firestore)
7. [Danh sách tính năng & Screens](#7-danh-sách-tính-năng--screens)
8. [Components quan trọng](#8-components-quan-trọng)
9. [Cơ chế tối ưu hiệu năng](#9-cơ-chế-tối-ưu-hiệu-năng)
10. [Bảo mật](#10-bảo-mật)
11. [Testing & CI/CD](#11-testing--cicd)
12. [Lệnh phát triển](#12-lệnh-phát-triển)
13. [Biến môi trường](#13-biến-môi-trường)
14. [Lưu ý khi nâng cấp](#14-lưu-ý-quan-trọng-khi-nâng-cấp)
15. [Android App](#15-android-app)

---

## 1. Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────┐
│                   Client (SPA)                  │
│  React 18 + React Router 6 + TailwindCSS        │
│  Context: AuthContext ← DataContext ← Toast      │
│  26 screens (lazy-loaded) + 60+ components       │
└──────────────────────┬──────────────────────────┘
                       │ HTTP (fetch)
┌──────────────────────▼──────────────────────────┐
│              Express Server (server.ts)          │
│  Middleware: CORS → Security Headers →           │
│  Compression → Rate Limiter (auth)               │
│  Routes: /api/data, /api/auth, /api/zalo, etc.   │
└──────────────────────┬──────────────────────────┘
                       │ Firebase SDK
┌──────────────────────▼──────────────────────────┐
│            Firestore Database                    │
│  Multi-tenant: center_{id} collections           │
│  Legacy: db_core_v2_secure_9a8b7c6d5e4f3g2h1     │
│  Registry: centers_registry                      │
└─────────────────────────────────────────────────┘
```

**Monolith architecture**: Một Express server phục vụ cả API lẫn static files (Vite build). Dev mode dùng Vite middleware, production serve từ `dist/`.

---

## 2. Cấu trúc thư mục

```
ttonline/
├── api/                          # Backend API handlers
│   ├── _lib/                     # Shared backend logic
│   │   ├── crypto.ts             # Password hashing (bcrypt + SHA-256 fallback)
│   │   ├── jwt.ts                # JWT sign/verify (jose, HS256)
│   │   ├── mockData.ts           # Default data for reset
│   │   ├── operations.ts         # ⭐ CORE: Pure state mutation functions (1081 dòng)
│   │   ├── operations.test.ts    # Unit tests (31 tests, vitest)
│   │   ├── serverAuth.ts         # Firebase Admin auth
│   │   └── validation.ts         # Zod input validation (16 schemas)
│   ├── auth.ts                   # POST /api/auth — Login handler
│   ├── data.ts                   # ⭐ CORE: GET/POST /api/data — Main data handler
│   ├── centers.ts                # Super Admin center management
│   ├── centers-public.ts         # Public center list (no auth)
│   ├── export.ts                 # Excel export (exceljs)
│   ├── reset.ts                  # Reset to mock data
│   ├── webhook.ts                # Banking webhook (auto-match payments)
│   └── zalo.ts                   # Zalo OA integration
│
├── components/                   # React components
│   ├── common/                   # Shared UI (18 files)
│   │   ├── Button.tsx            # Primary button with loading state
│   │   ├── Modal.tsx             # Reusable modal
│   │   ├── Table.tsx             # Sortable data table
│   │   ├── Toast.tsx             # Toast notifications
│   │   ├── ErrorBoundary.tsx     # Crash recovery
│   │   ├── ScreenSkeleton.tsx    # Skeleton loading placeholder
│   │   ├── GlobalSearch.tsx      # Ctrl+K global search
│   │   ├── Calendar.tsx          # Calendar picker
│   │   ├── Pagination.tsx        # Table pagination
│   │   ├── CertificateGenerator.tsx  # Certificate PDF
│   │   └── ...
│   ├── layout/                   # App layout (5 files)
│   │   ├── Sidebar.tsx           # Desktop navigation
│   │   ├── Header.tsx            # Top header with search
│   │   ├── BottomNav.tsx         # Mobile bottom navigation
│   │   ├── ParentHeader.tsx      # Parent portal header
│   │   └── NotificationBell.tsx  # Notification dropdown
│   ├── finance/                  # Finance module (22 files)
│   │   ├── InvoicesTab.tsx       # Invoice generation & management
│   │   ├── PayrollTab.tsx        # Teacher payroll
│   │   ├── IncomeTab.tsx / ExpenseTab.tsx  # Thu/chi
│   │   ├── PaymentModal.tsx      # Payment recording
│   │   ├── AdvancePaymentModal.tsx  # Advance payment
│   │   ├── Receipt.tsx / ReceiptModal.tsx  # Receipt printing
│   │   ├── TuitionFeeNotice.tsx  # Tuition notice printing
│   │   ├── BalanceStatement.tsx  # Student balance report
│   │   └── ...
│   ├── attendance/               # Attendance module (2 files)
│   │   ├── QRAttendanceModal.tsx # QR code attendance
│   │   └── AbsentStudentsModal.tsx
│   ├── reports/                  # Reports module (10 files)
│   │   ├── AttendanceReportTab.tsx
│   │   ├── TaxReportTab.tsx
│   │   ├── TeacherPerformanceTab.tsx
│   │   ├── WebhookReportTab.tsx
│   │   └── ...
│   ├── dashboard/                # Dashboard widgets
│   ├── progress/                 # Progress report components
│   └── auth/                     # Auth components
│
├── screens/                      # Page-level components (20 screens)
│   ├── DashboardScreen.tsx       # Main dashboard
│   ├── StudentsScreen.tsx        # Student list + CRUD
│   ├── StudentDetailScreen.tsx   # Student detail (balance, notes, tags)
│   ├── TeachersScreen.tsx        # Teacher list + CRUD
│   ├── StaffScreen.tsx           # Staff management
│   ├── ClassesScreen.tsx         # Class list + CRUD
│   ├── ClassDetailScreen.tsx     # Class detail (schedule, students)
│   ├── AttendanceHubScreen.tsx   # Attendance calendar overview
│   ├── AttendanceScreen.tsx      # Per-class attendance marking
│   ├── FinanceScreen.tsx         # Finance tabs container
│   ├── ReportsScreen.tsx         # Reports & analytics
│   ├── SettingsScreen.tsx        # Center settings (branding, bank, Zalo)
│   ├── AnnouncementsScreen.tsx   # Announcements CRUD
│   ├── RoomsScreen.tsx           # Room management
│   ├── AuditLogScreen.tsx        # Activity history
│   ├── SuperAdminScreen.tsx      # Multi-tenant management
│   ├── LoginScreen.tsx           # Login page
│   ├── LandingPage.tsx           # Public marketing page
│   ├── GuidePage.tsx             # User guide
│   ├── parent/                   # Parent portal (4 screens)
│   │   ├── ParentDashboardScreen.tsx
│   │   ├── ParentAttendanceScreen.tsx
│   │   ├── ParentFinanceScreen.tsx
│   │   └── ParentReportsScreen.tsx
│   └── teacher/
│       └── TeacherCalendarScreen.tsx
│
├── context/                      # React Context providers
│   ├── AuthContext.tsx            # Auth state + login/logout
│   ├── DataContext.tsx            # ⭐ Global data state + API wrappers
│   └── ToastContext.tsx           # Toast notifications
│
├── hooks/                        # Custom hooks
│   ├── useAuth.tsx               # Auth context consumer
│   ├── useDataContext.ts         # Data context consumer
│   ├── useDebounce.ts            # Debounced value hook
│   └── useToast.tsx              # Toast context consumer
│
├── services/
│   └── api.ts                    # ⭐ Frontend API client (fetch wrappers + ETag cache)
│
├── utils/
│   ├── date.ts                   # Date formatting helpers
│   └── html.ts                   # HTML sanitization
│
├── server.ts                     # ⭐ Express server entry point
├── App.tsx                       # ⭐ React app root (routing, layouts)
├── index.tsx                     # React DOM render
├── types.ts                      # ⭐ TypeScript interfaces & enums
├── constants.tsx                 # Routes & icons constants
├── styles.css                    # Global CSS + TailwindCSS
├── vite.config.ts                # Vite + PWA config
├── tsconfig.json                 # TypeScript config
├── package.json                  # Dependencies & scripts
├── firestore.rules               # Firestore security rules
├── manifest.json                 # PWA manifest (legacy)
├── sw.js                         # Service Worker (legacy, replaced by VitePWA)
└── .github/workflows/ci.yml     # GitHub Actions CI pipeline
```

---

## 3. Luồng dữ liệu

### Đọc dữ liệu (GET /api/data)
```
Client                    Server (data.ts)              Firestore
  │                           │                            │
  │── GET /api/data ──────────▶                            │
  │   (If-None-Match: etag)   │                            │
  │                           │── Read center_{id}/* ──────▶
  │                           │◀── 6 documents ────────────│
  │                           │                            │
  │                           │── Apply role filter ──────│
  │                           │   (parent: only own data) │
  │                           │   (teacher: own classes)  │
  │                           │                            │
  │◀── 200 JSON (with ETag) ──│                            │
  │    or 304 Not Modified     │                            │
```

### Ghi dữ liệu (POST /api/data)
```
Client                    Server (data.ts)              Firestore
  │                           │                            │
  │── POST { op, payload } ───▶                            │
  │                           │── Zod validate ──────────│
  │                           │── Role permission check ─│
  │                           │── Hash passwords ────────│
  │                           │                            │
  │                           │── acquireLock(centerId) ──│
  │                           │── Read current state ─────▶
  │                           │── applyOperation() ───────│
  │                           │   (pure function)          │
  │                           │── Smart shard compare ────│
  │                           │── Write changed shards ───▶
  │                           │── releaseLock() ──────────│
  │                           │                            │
  │◀── 200 JSON (full state) ──│                            │
```

### Optimistic UI (Client)
```
User action → applyOperation() local → Update UI immediately
           → API call in background → If success: update with server state
                                     → If error: ROLLBACK to previousState
```

---

## 4. Hệ thống xác thực & phân quyền

### 6 vai trò (UserRole)

| Role | Quyền | Giới hạn |
|------|-------|----------|
| `ADMIN` | Toàn quyền | Không giới hạn |
| `MANAGER` | Toàn bộ data CRUD | Không được: clearCollections, updateSettings |
| `ACCOUNTANT` | Finance only | Chỉ: invoices, transactions, payrolls, income, expenses |
| `TEACHER` | Classes & attendance | Chỉ lớp mình dạy: attendance, progressReports, notes, announcements |
| `PARENT` | View own child | Chỉ xem: con mình, xin nghỉ phép, đọc thông báo |
| `VIEWER` | Read-only | Không thể POST bất kỳ mutation nào |

### Flow xác thực
1. `POST /api/auth` → verify credentials → return JWT (30 ngày)
2. Client lưu JWT + userId + role vào `localStorage`
3. Mọi request gửi `Authorization: Bearer {token}`
4. Server verify JWT → extract `userId`, `role`, `centerId`
5. Role-based filtering áp dụng ở cả server (data.ts) và client (ProtectedRoute)

### Password hashing
- **Mới**: bcrypt (10 rounds) — file `api/_lib/crypto.ts`
- **Legacy**: SHA-256 (backward-compatible, tự migrate khi user đổi mật khẩu)
- **Detection**: `$2a$`/`$2b$` prefix = bcrypt, 64 hex chars = SHA-256

---

## 5. API Endpoints

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| `POST` | `/api/auth` | ❌ | Đăng nhập (rate limited: 10/phút/IP) |
| `GET` | `/api/data` | ✅ | Tải toàn bộ dữ liệu (hỗ trợ ETag 304) |
| `POST` | `/api/data` | ✅ | Mutation `{ op: string, payload: any }` |
| `POST` | `/api/reset` | ✅ Admin | Reset về dữ liệu mẫu |
| `GET` | `/api/export` | ✅ | Xuất Excel toàn bộ dữ liệu |
| `POST` | `/api/zalo` | ✅ | Zalo OA: send messages, get followers |
| `POST` | `/api/webhook` | ❌ | Banking webhook (auto-match payments) |
| `GET` | `/api/centers-public` | ❌ | Danh sách trung tâm (public) |
| `ALL` | `/api/centers` | ✅ SA | Super Admin center management |
| `GET` | `/api/health` | ❌ | Health check + DB connectivity |

### Danh sách Operations (POST /api/data)

**Student**: `addStudent`, `updateStudent`, `deleteStudent`, `addStudentNote`, `deleteStudentNote`, `updateStudentTags`

**Teacher**: `addTeacher`, `updateTeacher`, `deleteTeacher`

**Staff**: `addStaff`, `updateStaff`, `deleteStaff`

**Class**: `addClass`, `updateClass`, `deleteClass`

**Attendance**: `updateAttendance`, `updateSingleAttendance`, `deleteAttendanceForDate`, `deleteAttendanceByMonth`

**Finance**: `generateInvoices`, `cancelInvoice`, `updateInvoiceStatus`, `addAdjustment`, `addAdvancePayment`, `updateTransaction`, `deleteTransaction`, `clearAllTransactions`

**Payroll**: `generatePayrolls`, `updatePayroll`

**Income/Expense**: `addIncome`, `updateIncome`, `deleteIncome`, `addExpense`, `updateExpense`, `deleteExpense`

**Reports**: `addProgressReport`, `addBulkProgressReports`, `updateProgressReport`, `deleteProgressReport`

**Announcements**: `addAnnouncement`, `deleteAnnouncement`, `markAnnouncementRead`, `markAnnouncementsReadBatch`

**Rooms**: `addRoom`, `updateRoom`, `deleteRoom`

**Settings**: `updateSettings`, `updateUserPassword`

**System**: `clearCollections`, `compactData`, `restoreData`

---

## 6. Cơ sở dữ liệu (Firestore)

### Multi-tenant Structure
```
Firestore Database
├── centers_registry/              # Danh sách trung tâm
│   ├── {centerId}/                # name, slug, status, expiresAt, loginUsername, loginPassword
│
├── center_{centerId}/             # Dữ liệu từng trung tâm
│   ├── students     → { data: Student[] }
│   ├── teachers     → { data: Teacher[] }
│   ├── staff        → { data: Staff[] }
│   ├── classes      → { data: Class[] }
│   ├── attendance   → { data: AttendanceRecord[] }
│   ├── invoices     → { data: Invoice[] }
│   ├── transactions → { data: Transaction[] }
│   ├── progressReports → { data: ProgressReport[] }
│   ├── income       → { data: Income[] }
│   ├── expenses     → { data: Expense[] }
│   ├── settings     → { data: CenterSettings }
│   ├── payrolls     → { data: Payroll[] }
│   ├── announcements → { data: Announcement[] }
│   ├── auditLogs    → { data: AuditLog[] }
│   └── rooms        → { data: Room[] }
│
└── db_core_v2_secure_9a8b7c6d5e4f3g2h1/  # Legacy single-tenant (cùng cấu trúc)
```

### Sharding Strategy
Mỗi collection (students, teachers, ...) là 1 **Firestore document** chứa toàn bộ data dưới dạng JSON. Server load toàn bộ, apply mutation, rồi ghi lại **chỉ các shard thay đổi** (smart shard comparison).

---

## 7. Danh sách tính năng & Screens

| Screen | File | Vai trò truy cập |
|--------|------|-------------------|
| Dashboard | `DashboardScreen.tsx` | Admin, Manager, Accountant, Teacher, Viewer |
| Học viên | `StudentsScreen.tsx` | Admin, Manager, Accountant, Viewer |
| Chi tiết HV | `StudentDetailScreen.tsx` | Admin, Manager |
| Giáo viên | `TeachersScreen.tsx` | Admin, Manager, Viewer |
| Nhân viên | `StaffScreen.tsx` | Admin, Manager |
| Lớp học | `ClassesScreen.tsx` | Tất cả (Teacher: chỉ lớp mình) |
| Chi tiết lớp | `ClassDetailScreen.tsx` | Admin, Manager, Teacher |
| Lịch điểm danh | `AttendanceHubScreen.tsx` | Admin, Manager, Teacher, Accountant |
| Điểm danh | `AttendanceScreen.tsx` | Admin, Manager, Teacher |
| Tài chính | `FinanceScreen.tsx` | Admin, Manager, Accountant |
| Báo cáo | `ReportsScreen.tsx` | Admin, Manager, Accountant |
| Thông báo | `AnnouncementsScreen.tsx` | Admin, Manager, Teacher |
| Phòng học | `RoomsScreen.tsx` | Admin, Manager, Viewer |
| Lịch sử | `AuditLogScreen.tsx` | Admin, Manager, Viewer |
| Cài đặt | `SettingsScreen.tsx` | Admin only |
| Super Admin | `SuperAdminScreen.tsx` | Super Admin only |
| Cổng PH - Dashboard | `parent/ParentDashboardScreen.tsx` | Parent |
| Cổng PH - Điểm danh | `parent/ParentAttendanceScreen.tsx` | Parent |
| Cổng PH - Tài chính | `parent/ParentFinanceScreen.tsx` | Parent |
| Cổng PH - Báo cáo | `parent/ParentReportsScreen.tsx` | Parent |
| Lịch dạy | `teacher/TeacherCalendarScreen.tsx` | Admin, Manager, Teacher |
| Landing Page | `LandingPage.tsx` | Public |
| Hướng dẫn | `GuidePage.tsx` | Public |
| Đăng nhập | `LoginScreen.tsx` | Public |

---

## 8. Components quan trọng

### Core Files (⭐ phải hiểu trước khi sửa)

| File | Dòng | Vai trò |
|------|------|---------|
| `api/_lib/operations.ts` | ~1081 | Toàn bộ business logic (pure functions) |
| `api/data.ts` | ~1240 | API handler: auth, cache, shard, Firestore I/O |
| `context/DataContext.tsx` | ~301 | Global state + optimistic UI + API wrappers |
| `services/api.ts` | ~317 | Frontend HTTP client + ETag caching |
| `App.tsx` | ~356 | Routing + layouts (3 layouts: Admin, Parent, Public) |
| `types.ts` | ~321 | Tất cả TypeScript interfaces & enums |

### Cascade khi thay đổi ID
Khi đổi ID học viên/giáo viên/lớp, hệ thống tự động cập nhật dây chuyền:

- **updateStudent (ID change)** → attendance, invoices, progressReports, transactions
- **updateTeacher (ID change)** → classes.teacherIds, attendance.teacherIds, payrolls, expenses
- **updateClass (ID change)** → attendance.classId, progressReports.classId
- **deleteRoom** → classes.schedule[].roomId = undefined

Logic cascade nằm trong `operations.ts`, mapping trong `data.ts:getAffectedCollections()`.

---

## 9. Cơ chế tối ưu hiệu năng

| # | Tối ưu | File | Chi tiết |
|---|--------|------|----------|
| 1 | Lazy Loading | `App.tsx` | 26 screens dùng `React.lazy()` |
| 2 | ETag + 304 | `api.ts`, `data.ts` | Client gửi `If-None-Match`, server trả 304 nếu data chưa đổi |
| 3 | Smart Shard Compare | `data.ts` | Chỉ ghi Firestore shards thực sự thay đổi |
| 4 | In-place Attendance Cache | `data.ts` | Ghi nhận điểm danh không cần re-read toàn bộ state |
| 5 | In-place Tuition Cache | `data.ts` | Ghi nhận thanh toán tương tự |
| 6 | Per-center Lock | `data.ts` | Parallel writes cho các center khác nhau |
| 7 | Center Registry Cache | `data.ts` | Cache 60 giây, tránh đọc registry mỗi request |
| 8 | Gzip Compression | `server.ts` | Toàn bộ response được nén |
| 9 | Optimistic UI | `DataContext.tsx` | UI cập nhật ngay, rollback nếu API lỗi |
| 10 | SessionStorage Cache | `api.ts` | Cache data JSON ở client |

---

## 10. Bảo mật

| Hạng mục | Cách triển khai | File |
|----------|----------------|------|
| Authentication | JWT HS256, 30 ngày | `api/_lib/jwt.ts` |
| Password | bcrypt (10 rounds) + SHA-256 fallback | `api/_lib/crypto.ts` |
| Rate Limiting | 10 lần/phút/IP cho login | `server.ts` |
| RBAC | 6 roles, whitelist operations | `api/data.ts` |
| Input Validation | Zod schemas (16 operations) | `api/_lib/validation.ts` |
| HTTP Headers | X-Frame-Options, HSTS, nosniff, XSS | `server.ts` |
| Firestore Rules | Server-only access (service account) | `firestore.rules` |
| JWT Secret | Bắt buộc env var trong production | `server.ts` |
| XSS | React auto-escape + HTML sanitization | `utils/html.ts` |

---

## 11. Testing & CI/CD

### Unit Tests
```bash
npm test                    # Chạy 31 tests (vitest)
npx vitest run --reporter=verbose  # Chi tiết
```

**Test coverage**: Student CRUD (8), Teacher (3), Class (4), Attendance (2), Finance (4), Income/Expense (3), Rooms (2), Announcements (2), Settings (1), Staff (2)

### CI/CD Pipeline (`.github/workflows/ci.yml`)
- Triggers: push to `main`, pull requests
- Matrix: Node 18.x + 20.x
- Steps: install → `tsc --noEmit` → `vitest run` → `npm run build`

---

## 12. Lệnh phát triển

```bash
# Phát triển
npm run dev                 # Start dev server (localhost:3000)

# Kiểm tra
npm run lint                # TypeScript check (tsc --noEmit)
npm test                    # Unit tests (vitest)

# Production
npm run build               # Vite build + esbuild server
npm start                   # Run production (node dist/server.cjs)
```

---

## 13. Biến môi trường

| Biến | Bắt buộc | Mô tả |
|------|----------|-------|
| `API_SECRET_KEY` | ✅ Production | JWT signing secret (min 32 chars) |
| `CORS_ORIGINS` | ❌ | Comma-separated allowed origins |
| `NODE_ENV` | ❌ | `production` hoặc `development` |
| `firebase-applet-config.json` | ✅ | Firebase project config (apiKey, projectId, firestoreDatabaseId) |

---

## 14. Lưu ý quan trọng khi nâng cấp

### ⚠️ KHÔNG được làm
1. **KHÔNG tách DataContext** thành nhiều context — toàn bộ app phụ thuộc vào 1 global state. Nếu tách, phải refactor ~40 screens/components.
2. **KHÔNG đổi cấu trúc Firestore** mà không migration — mỗi collection là 1 document chứa array JSON. Nếu đổi schema, phải migrate toàn bộ data.
3. **KHÔNG xóa SHA-256 fallback** trong `crypto.ts` — nhiều user vẫn dùng password cũ (SHA-256). Fallback phải giữ cho đến khi 100% user đã đổi mật khẩu.

### ✅ An toàn khi nâng cấp
1. **Thêm screen mới**: Tạo component lazy-loaded trong `screens/`, thêm route trong `App.tsx`, thêm nav link trong `Sidebar.tsx`.
2. **Thêm operation mới**: Thêm case trong `operations.ts`, thêm API wrapper trong `api.ts`, thêm function trong `DataContext.tsx`.
3. **Thêm field vào entity**: Thêm vào interface trong `types.ts`. Dùng `?.` optional access vì data cũ không có field mới.
4. **Thêm component**: Tạo trong `components/{domain}/`, import vào screen.
5. **Thêm validation**: Thêm schema trong `validation.ts`, tự động áp dụng.

### 🔑 Files quan trọng nhất (phải đọc trước)
1. `types.ts` — Hiểu cấu trúc dữ liệu
2. `api/_lib/operations.ts` — Hiểu business logic
3. `api/data.ts` — Hiểu cách server hoạt động
4. `App.tsx` — Hiểu routing & layouts
5. `context/DataContext.tsx` — Hiểu state management

---

## 15. Android App

### Tổng quan

```
┌─────────────────────────────────────────────────────────────┐
│                    Android App (Kotlin)                       │
│  Jetpack Compose + Material3 + Hilt DI + Room + Retrofit     │
│  17 screens, 6 roles, offline-first, auto-update             │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS (Retrofit + OkHttp)
                       │ Bearer Token (JWT)
┌──────────────────────▼──────────────────────────────────────┐
│              Express Server (server.ts)                      │
│  Base URL: https://tt.thaydat.edu.vn/                        │
└──────────────────────────────────────────────────────────────┘
```

### Cấu trúc thư mục Android

```
android/app/src/main/java/com/educenter/pro/
├── di/                          # Hilt Dependency Injection
│   └── AppModule.kt             # Room, EncryptedPrefs, OkHttp, Retrofit
│
├── data/
│   ├── model/
│   │   └── Models.kt            # Data classes (Student, Teacher, Class, etc.)
│   ├── remote/
│   │   ├── ApiService.kt        # Retrofit interface (login, getData, executeOp)
│   │   └── GitHubApiService.kt  # GitHub Releases API (auto-update)
│   ├── local/
│   │   ├── AppDatabase.kt       # Room database (version 2)
│   │   ├── ShardDao.kt          # Cache dao (app_data JSON)
│   │   ├── ShardEntity.kt       # Cache entity
│   │   ├── PendingOperationDao.kt   # Offline queue dao
│   │   └── PendingOperationEntity.kt # Offline queue entity
│   └── repository/
│       └── DataRepository.kt    # ⭐ Central data layer (~571 dòng)
│
├── ui/
│   ├── theme/                   # Material3 theming
│   │   ├── Color.kt             # Color palette definitions
│   │   ├── Theme.kt             # Light/Dark themes
│   │   ├── Type.kt              # Typography
│   │   ├── ThemeManager.kt      # Dark mode toggle persistence
│   │   └── AppColors.kt         # App-wide color tokens
│   ├── components/              # Shared composables
│   │   ├── PullRefreshWrapper.kt    # Pull-to-refresh wrapper
│   │   ├── ShimmerEffect.kt         # Loading skeletons
│   │   └── AppSearchBar.kt          # Search bar component
│   ├── navigation/
│   │   └── AppNavigation.kt    # ⭐ Nav graph + Bottom nav + MoreScreen
│   └── screens/
│       ├── splash/              # SplashScreen + SplashViewModel
│       ├── login/               # LoginScreen + LoginViewModel (biometric)
│       ├── dashboard/           # DashboardScreen + DashboardViewModel
│       ├── attendance/          # AttendanceScreen + AttendanceViewModel (1155 dòng)
│       ├── qrscanner/           # QRScannerScreen + QRScannerViewModel (CameraX + ML Kit)
│       ├── finance/             # FinanceScreen + FinanceViewModel
│       ├── staff/               # StaffScreen + StaffViewModel
│       ├── profile/             # ProfileScreen + ProfileViewModel
│       ├── parent/              # 5 files: Dashboard, Attendance, Finance, Reports, ViewModel
│       ├── announcements/       # AnnouncementsScreen + ViewModel
│       └── students/            # StudentsScreen + ViewModel
│
├── sync/
│   └── SyncWorker.kt            # WorkManager background sync (mỗi 30 phút)
│
├── update/
│   ├── AppUpdateManager.kt      # GitHub Releases checker + APK installer
│   └── UpdateDialog.kt          # Update notification dialog
│
└── EduCenterProApplication.kt   # Application class (Hilt entry point)
```

### Dependencies chính (build.gradle.kts)

| Library | Version | Mục đích |
|---------|---------|----------|
| Compose BOM | 2024.02.02 | UI framework |
| Material3 | BOM | Design system |
| Hilt | 2.48 | Dependency Injection |
| Room | 2.6.1 | Local database (offline cache) |
| Retrofit | 2.9.0 | HTTP client |
| OkHttp | 4.12.0 | HTTP + interceptors |
| CameraX | 1.3.1 | Camera preview |
| ML Kit | 17.2.0 | QR code scanning |
| Firebase | BOM 32.7.2 | Push notifications |
| WorkManager | 2.9.0 | Background sync |
| Biometric | 1.1.0 | Fingerprint login |
| Security-Crypto | 1.1.0 | Encrypted SharedPreferences |

### Luồng dữ liệu Android

```
┌──────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
│  Screen  │───▶│  ViewModel   │───▶│ DataRepository│───▶│ Retrofit │
│ Compose  │    │  StateFlow   │    │   (central)   │    │  API     │
└──────────┘    └──────────────┘    └───────┬───────┘    └──────────┘
                                           │
                              ┌────────────┼────────────┐
                              │            │            │
                        ┌─────▼─────┐ ┌────▼────┐ ┌────▼─────────┐
                        │ Room DB   │ │ OkHttp  │ │ PendingOpDao │
                        │ (cache)   │ │ (ETag)  │ │ (offline Q)  │
                        └───────────┘ └─────────┘ └──────────────┘
```

1. **Online**: Screen → ViewModel → DataRepository → Retrofit → Server → Update Room cache
2. **Offline fallback**: DataRepository → Queue vào PendingOperationDao → SyncWorker sync khi có mạng
3. **Cache**: OkHttp interceptor tự gửi `If-None-Match` ETag → 304 = dùng cache

### Bảo mật Android

| Hạng mục | Triển khai | File |
|----------|-----------|------|
| Token storage | EncryptedSharedPreferences (AES256-GCM) | `AppModule.kt` |
| Biometric creds | EncryptedSharedPreferences | `LoginScreen.kt` |
| Network | Bearer token auto-attach via OkHttp interceptor | `AppModule.kt` |
| API base URL | Hard-coded production URL | `AppModule.kt` |
| APK signing | educenter-release.keystore | CI workflow |

### 17 Screens Android

| Screen | Vai trò | Mô tả |
|--------|---------|-------|
| Splash | All | Animation + auto-login check |
| Login | Public | Email/password + biometric fingerprint |
| Dashboard | Admin, Manager, Viewer | Tổng quan: học viên, tài chính, lớp học |
| Attendance | Admin, Manager, Teacher | Điểm danh theo ngày, lịch, batch save |
| QR Scanner | Admin, Manager, Teacher | CameraX + ML Kit QR → auto attendance |
| Students | Admin, Manager | Danh sách + CRUD học viên |
| Finance | Admin, Manager, Accountant | Hóa đơn, thu chi, payroll |
| Staff | Admin | Quản lý nhân viên (MANAGER/ACCOUNTANT) |
| Profile | All | Thông tin user, sync, dark mode, logout |
| Announcements | Admin, Manager, Teacher | Thông báo CRUD |
| Parent Dashboard | Parent | Tổng quan con em |
| Parent Attendance | Parent | Lịch chuyên cần con |
| Parent Finance | Parent | Học phí, VietQR, hóa đơn |
| Parent Reports | Parent | Nhận xét giáo viên, tiến bộ |
| More | All | Đổi mật khẩu, phiên bản, cập nhật |
| Update Dialog | All | Check GitHub Releases + download APK |
| Transactions | Admin, Manager, Accountant | Lịch sử giao dịch |

### Auto-update cơ chế

```
App start → AppUpdateManager.checkForUpdate()
  → GitHub API: GET /repos/ldat78705-hue/TT/releases/latest
  → Compare normalizeVersion(remote) > normalizeVersion(current)
  → If update available → Show UpdateDialog
  → User clicks "Download" → DownloadManager → FileProvider → Install APK
```

### CI/CD Android (`.github/workflows/build-apk.yml`)

Trigger: push to `main` → GitHub Actions:
1. Setup JDK 17 + Android SDK
2. `./gradlew assembleRelease`
3. Rename APK → `EduCenterPro-v{version}.apk`
4. Create GitHub Release with APK attached
5. App tự phát hiện bản mới → dialog cập nhật

### Lưu ý khi nâng cấp Android

#### ⚠️ KHÔNG được làm
1. **KHÔNG đổi `applicationId`** (`com.educenter.pro`) — sẽ thành app mới, user mất data
2. **KHÔNG đổi Room schema** mà không tăng `version` + thêm migration — app crash
3. **KHÔNG xóa `passthrough()` trong Zod schemas** — Android gửi extra fields sẽ bị reject

#### ✅ An toàn khi nâng cấp
1. **Thêm screen mới**: Tạo `ui/screens/{name}/`, thêm route trong `AppNavigation.kt`
2. **Thêm API operation**: Thêm hàm trong `DataRepository.kt`, gọi từ ViewModel
3. **Thêm field mới**: Thêm vào Model với `= ""` default → Gson tự bỏ qua nếu server không gửi
4. **Bump version**: Tăng `versionCode` + `versionName` trong `app/build.gradle.kts`
5. **Thêm dependency**: Thêm vào `app/build.gradle.kts`, inject qua `AppModule.kt`

#### 🔑 Files quan trọng nhất (Android)
1. `data/model/Models.kt` — Cấu trúc dữ liệu Android
2. `data/repository/DataRepository.kt` — Toàn bộ business logic
3. `ui/navigation/AppNavigation.kt` — Routing + phân quyền
4. `di/AppModule.kt` — DI configuration (API URL, Room, Auth)
5. `app/build.gradle.kts` — Dependencies + version

---

> **Tạo bởi**: Antigravity AI Assistant | **Dự án**: EduCenter Pro v2.7 | **Cập nhật**: 17/06/2026
