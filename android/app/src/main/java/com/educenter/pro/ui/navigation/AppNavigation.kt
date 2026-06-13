package com.educenter.pro.ui.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.educenter.pro.ui.screens.dashboard.DashboardScreen
import com.educenter.pro.ui.screens.login.LoginScreen
import com.educenter.pro.ui.screens.splash.SplashScreen
import com.educenter.pro.ui.screens.classes.ClassesScreen
import com.educenter.pro.ui.screens.students.StudentsScreen
import com.educenter.pro.ui.screens.profile.ProfileScreen
import com.educenter.pro.ui.screens.teachers.TeachersScreen
import com.educenter.pro.ui.screens.attendance.AttendanceScreen
import com.educenter.pro.ui.screens.reports.ReportsScreen
import com.educenter.pro.ui.screens.finance.FinanceScreen
import com.educenter.pro.ui.screens.announcements.AnnouncementsScreen
import com.educenter.pro.ui.screens.qrscanner.QRScannerScreen
import com.educenter.pro.ui.screens.staff.StaffScreen
import com.educenter.pro.ui.screens.progress.ProgressReportScreen
import com.educenter.pro.data.model.UserRole

import androidx.compose.runtime.collectAsState
import androidx.hilt.navigation.compose.hiltViewModel

sealed class Screen(val route: String, val title: String? = null, val icon: ImageVector? = null) {
    object Splash : Screen("splash")
    object Login : Screen("login")
    object Home : Screen("home", "Trang chủ", Icons.Filled.Home)
    object Classes : Screen("classes", "Lớp học", Icons.Filled.Class)
    object Students : Screen("students", "Học viên", Icons.Filled.People)
    object Teachers : Screen("teachers", "Giáo viên", Icons.Filled.Person)
    object Profile : Screen("profile", "Cá nhân", Icons.Filled.AccountCircle)
    object Transactions : Screen("transactions", "Sổ Quỹ")
    object Attendance : Screen("attendance", "Điểm danh", Icons.Filled.Checklist)
    object Reports : Screen("reports", "Báo cáo", Icons.Filled.Assessment)
    object Finance : Screen("finance", "Tài chính", Icons.Filled.Payments)
    object Announcements : Screen("announcements", "Thông báo", Icons.Filled.Campaign)
    object QRScanner : Screen("qr_scanner", "Quét QR")
    object Staff : Screen("staff", "Nhân viên")
    object ProgressReport : Screen("progress_report", "Nhận xét HS")
    object More : Screen("more", "Thêm", Icons.Filled.MoreHoriz)
    object MyPayslip : Screen("my_payslip", "Bảng lương")
    object TeacherCalendar : Screen("teacher_calendar", "Lịch dạy")
}

// Bottom nav: 4 tabs for clean UX
val bottomNavItems = listOf(Screen.Home, Screen.Students, Screen.Attendance, Screen.More)

@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    val profileViewModel: com.educenter.pro.ui.screens.profile.ProfileViewModel = hiltViewModel()
    val currentUserRole by profileViewModel.currentUserRole.collectAsState()

    val visibleNavItems = bottomNavItems.filter { screen ->
        if (currentUserRole == UserRole.ACCOUNTANT) {
            screen == Screen.Students || screen == Screen.More
        } else {
            true
        }
    }

    Scaffold(
        bottomBar = {
            val navBackStackEntry by navController.currentBackStackEntryAsState()
            val currentDestination = navBackStackEntry?.destination

            val mainRoutes = setOf(
                Screen.Home.route, Screen.Students.route, Screen.Attendance.route,
                Screen.More.route, Screen.Profile.route, Screen.Reports.route,
                Screen.Finance.route, Screen.Announcements.route,
                Screen.Classes.route, Screen.Teachers.route
            )
            val showBottomBar = mainRoutes.contains(currentDestination?.route)

            if (showBottomBar) {
                NavigationBar(
                    containerColor = MaterialTheme.colorScheme.surface,
                    tonalElevation = 0.dp,
                    modifier = Modifier
                        .shadow(
                            elevation = 20.dp,
                            spotColor = Color(0x1A000000),
                            ambientColor = Color(0x0D000000)
                        )
                ) {
                    visibleNavItems.forEach { screen ->
                        val isSelected = if (screen == Screen.More) {
                            // "More" is selected when on More, Profile, Finance, Announcements, etc.
                            val moreRoutes = setOf(Screen.More.route, Screen.Profile.route, Screen.Finance.route, Screen.Announcements.route, Screen.Reports.route, Screen.Classes.route, Screen.Teachers.route, Screen.MyPayslip.route)
                            moreRoutes.contains(currentDestination?.route)
                        } else {
                            currentDestination?.hierarchy?.any { it.route == screen.route } == true
                        }
                        NavigationBarItem(
                            icon = {
                                Box(
                                    modifier = if (isSelected) {
                                        Modifier
                                            .clip(RoundedCornerShape(14.dp))
                                            .background(
                                                Brush.horizontalGradient(
                                                    listOf(Color(0xFF667EEA), Color(0xFF764BA2))
                                                )
                                            )
                                            .padding(horizontal = 16.dp, vertical = 6.dp)
                                    } else {
                                        Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
                                    },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        screen.icon!!,
                                        contentDescription = null,
                                        tint = if (isSelected) Color.White else Color(0xFF64748B),
                                        modifier = Modifier.size(22.dp)
                                    )
                                }
                            },
                            label = {
                                Text(
                                    screen.title!!,
                                    fontSize = 12.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.SemiBold,
                                    color = if (isSelected) Color(0xFF667EEA) else Color(0xFF64748B),
                                    maxLines = 1
                                )
                            },
                            selected = isSelected,
                            onClick = {
                                navController.navigate(screen.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            colors = NavigationBarItemDefaults.colors(
                                indicatorColor = Color.Transparent
                            )
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Splash.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.Splash.route) {
                SplashScreen(
                    onNavigateToLogin = {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(Screen.Splash.route) { inclusive = true }
                        }
                    },
                    onNavigateToHome = {
                        val route = if (currentUserRole == UserRole.ACCOUNTANT) Screen.Students.route else Screen.Home.route
                        navController.navigate(route) {
                            popUpTo(Screen.Splash.route) { inclusive = true }
                        }
                    }
                )
            }
            composable(Screen.Login.route) {
                LoginScreen(
                    onLoginSuccess = {
                        val route = if (currentUserRole == UserRole.ACCOUNTANT) Screen.Students.route else Screen.Home.route
                        navController.navigate(route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    }
                )
            }
            composable(Screen.Home.route) {
                DashboardScreen(
                    onNavigateToClasses = { navController.navigate(Screen.Classes.route) },
                    onNavigateToTeachers = { navController.navigate(Screen.Teachers.route) },
                    onNavigateToFinance = { navController.navigate(Screen.Finance.route) },
                    onNavigateToAnnouncements = { navController.navigate(Screen.Announcements.route) }
                )
            }
            composable(Screen.Classes.route) {
                ClassesScreen()
            }
            composable(Screen.Students.route) {
                StudentsScreen()
            }
            composable(Screen.Teachers.route) {
                TeachersScreen()
            }
            composable(Screen.Staff.route) {
                StaffScreen()
            }
            composable(Screen.More.route) {
                MoreScreen(
                    currentUserRole = currentUserRole,
                    onNavigateTo = { route ->
                        navController.navigate(route) {
                            launchSingleTop = true
                        }
                    },
                    onLogout = {
                        profileViewModel.logout()
                        navController.navigate(Screen.Login.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                )
            }
            composable(Screen.Profile.route) {
                ProfileScreen(
                    onLogoutSuccess = {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                    onNavigateToTransactions = {
                        navController.navigate(Screen.Transactions.route)
                    },
                    onNavigateToStaff = {
                        navController.navigate(Screen.Staff.route)
                    },
                    onNavigateToFinance = {
                        navController.navigate(Screen.Finance.route)
                    }
                )
            }
            composable(Screen.Transactions.route) {
                com.educenter.pro.ui.screens.profile.TransactionsScreen(
                    onBack = { navController.popBackStack() }
                )
            }
            composable(Screen.Attendance.route) {
                AttendanceScreen(
                    onNavigateToQR = { navController.navigate(Screen.QRScanner.route) }
                )
            }
            composable(Screen.Reports.route) {
                ReportsScreen()
            }
            composable(Screen.Finance.route) {
                FinanceScreen()
            }
            composable(Screen.Announcements.route) {
                AnnouncementsScreen()
            }
            composable(Screen.QRScanner.route) {
                QRScannerScreen(
                    onBack = { navController.popBackStack() }
                )
            }
            composable(Screen.ProgressReport.route) {
                ProgressReportScreen(
                    onBack = { navController.popBackStack() }
                )
            }
            composable(Screen.MyPayslip.route) {
                com.educenter.pro.ui.screens.payslip.MyPayslipScreen(
                    onBack = { navController.popBackStack() }
                )
            }
        }
    }
}

// ============================================
// "More" Hub Screen — Groups secondary features
// ============================================
@Composable
fun MoreScreen(
    currentUserRole: UserRole,
    onNavigateTo: (String) -> Unit,
    onLogout: () -> Unit
) {
    val profileViewModel: com.educenter.pro.ui.screens.profile.ProfileViewModel = hiltViewModel()
    val email by profileViewModel.userEmail.collectAsState()
    val centerName by profileViewModel.centerName.collectAsState()
    val isSyncing by profileViewModel.isSyncing.collectAsState()
    val isDark by com.educenter.pro.ui.theme.ThemeManager.isDarkMode.collectAsState()
    val context = androidx.compose.ui.platform.LocalContext.current

    val versionName = try {
        context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "1.0"
    } catch (e: Exception) { "1.0" }

    // Change Password state
    var showChangePwd by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
    var currentPwd by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf("") }
    var newPwd by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf("") }
    var confirmPwd by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf("") }
    var pwdError by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<String?>(null) }
    var pwdSuccess by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
    var pwdLoading by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
    val coroutineScope = androidx.compose.runtime.rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
    ) {
        // Profile header
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Brush.verticalGradient(listOf(Color(0xFF2563EB), Color(0xFF3B82F6))))
                .padding(top = 40.dp, bottom = 24.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(
                    modifier = Modifier.size(64.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.AccountCircle, contentDescription = null, modifier = Modifier.size(44.dp), tint = Color.White)
                }
                Spacer(modifier = Modifier.height(8.dp))
                Text(email.ifBlank { "Người dùng" }, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                if (centerName.isNotBlank()) {
                    Text(centerName, color = Color.White.copy(alpha = 0.8f), fontSize = 13.sp)
                }
                Text("Vai trò: ${currentUserRole.name}", color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp)
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Navigation items grouped
        Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {

            // === Quick Actions ===
            Text("Quản lý", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(start = 4.dp, bottom = 2.dp))

            if (currentUserRole != UserRole.ACCOUNTANT) {
                MoreMenuItem(Icons.Default.Class, "Lớp học", Color(0xFF8B5CF6)) { onNavigateTo(Screen.Classes.route) }
            }
            if (currentUserRole == UserRole.ADMIN || currentUserRole == UserRole.MANAGER) {
                MoreMenuItem(Icons.Default.Person, "Giáo viên", Color(0xFF0EA5E9)) { onNavigateTo(Screen.Teachers.route) }
                MoreMenuItem(Icons.Default.Group, "Nhân viên", Color(0xFF6366F1)) { onNavigateTo(Screen.Staff.route) }
            }

            Spacer(modifier = Modifier.height(8.dp))
            Text("Tính năng", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(start = 4.dp, bottom = 2.dp))

            MoreMenuItem(Icons.Default.Assessment, "Báo cáo", Color(0xFF0EA5E9)) { onNavigateTo(Screen.Reports.route) }

            if (currentUserRole == UserRole.ADMIN || currentUserRole == UserRole.MANAGER || currentUserRole == UserRole.TEACHER) {
                MoreMenuItem(Icons.Default.RateReview, "Nhận xét Học viên", Color(0xFF8B5CF6)) { onNavigateTo(Screen.ProgressReport.route) }
            }

            if (currentUserRole != UserRole.TEACHER) {
                MoreMenuItem(Icons.Default.Payments, "Tài chính", Color(0xFFF59E0B)) { onNavigateTo(Screen.Finance.route) }
            }

            MoreMenuItem(Icons.Default.Campaign, "Thông báo", Color(0xFFEC4899)) { onNavigateTo(Screen.Announcements.route) }

            // Teacher: My Payslip
            if (currentUserRole == UserRole.TEACHER) {
                MoreMenuItem(Icons.Default.Receipt, "Bảng lương của tôi", Color(0xFF10B981)) { onNavigateTo("my_payslip") }
            }

            Spacer(modifier = Modifier.height(8.dp))
            Text("Tài khoản", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(start = 4.dp, bottom = 2.dp))

            // Sync
            MoreMenuItem(
                Icons.Default.Sync,
                if (isSyncing) "Đang đồng bộ..." else "Đồng bộ dữ liệu",
                Color(0xFF3B82F6),
                enabled = !isSyncing
            ) { profileViewModel.manualSync() }

            MoreMenuItem(Icons.Default.Receipt, "Lịch sử Thu / Chi", Color(0xFF10B981)) { onNavigateTo(Screen.Transactions.route) }

            // Change Password
            MoreMenuItem(Icons.Default.Lock, "Đổi mật khẩu", Color(0xFFF97316)) { showChangePwd = true }

            // Dark mode toggle
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp).fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier.size(36.dp).clip(CircleShape).background(Color(0xFF8B5CF6).copy(alpha = 0.1f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            if (isDark) Icons.Default.DarkMode else Icons.Default.LightMode,
                            contentDescription = null,
                            tint = Color(0xFF8B5CF6),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(14.dp))
                    Text(
                        if (isDark) "Chế độ tối" else "Chế độ sáng",
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp,
                        color = MaterialTheme.colorScheme.onBackground,
                        modifier = Modifier.weight(1f)
                    )
                    Switch(
                        checked = isDark,
                        onCheckedChange = { com.educenter.pro.ui.theme.ThemeManager.toggleDarkMode(context) }
                    )
                }
            }

            // Version
            Text(
                "Phiên bản: v$versionName",
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )

            Spacer(modifier = Modifier.height(8.dp))

            // === LOGOUT BUTTON — prominent ===
            Button(
                onClick = onLogout,
                modifier = Modifier.fillMaxWidth().height(48.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
            ) {
                Icon(Icons.Default.Logout, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Đăng xuất", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color.White)
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }

    // ===== CHANGE PASSWORD DIALOG =====
    if (showChangePwd) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = {
                showChangePwd = false; currentPwd = ""; newPwd = ""; confirmPwd = ""; pwdError = null; pwdSuccess = false
            },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Lock, contentDescription = null, tint = Color(0xFFF97316), modifier = Modifier.size(24.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Đổi mật khẩu", fontWeight = FontWeight.Bold)
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (pwdSuccess) {
                        Text("✅ Đổi mật khẩu thành công!", color = Color(0xFF10B981), fontWeight = FontWeight.Bold)
                    } else {
                        if (pwdError != null) {
                            Text(pwdError!!, color = Color(0xFFEF4444), fontSize = 13.sp)
                        }
                        OutlinedTextField(
                            value = currentPwd,
                            onValueChange = { currentPwd = it; pwdError = null },
                            label = { Text("Mật khẩu hiện tại") },
                            singleLine = true,
                            visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(),
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp)
                        )
                        OutlinedTextField(
                            value = newPwd,
                            onValueChange = { newPwd = it; pwdError = null },
                            label = { Text("Mật khẩu mới") },
                            singleLine = true,
                            visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(),
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp)
                        )
                        OutlinedTextField(
                            value = confirmPwd,
                            onValueChange = { confirmPwd = it; pwdError = null },
                            label = { Text("Xác nhận mật khẩu mới") },
                            singleLine = true,
                            visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(),
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp)
                        )
                    }
                }
            },
            confirmButton = {
                if (!pwdSuccess) {
                    Button(
                        onClick = {
                            when {
                                currentPwd.isBlank() -> pwdError = "Vui lòng nhập mật khẩu hiện tại"
                                newPwd.length < 6 -> pwdError = "Mật khẩu mới phải có ít nhất 6 ký tự"
                                newPwd != confirmPwd -> pwdError = "Mật khẩu xác nhận không khớp"
                                else -> {
                                    pwdLoading = true
                                    coroutineScope.launch {
                                        try {
                                            profileViewModel.changePassword(currentPwd, newPwd)
                                            pwdSuccess = true
                                            pwdLoading = false
                                        } catch (e: Exception) {
                                            pwdError = e.message ?: "Đổi mật khẩu thất bại"
                                            pwdLoading = false
                                        }
                                    }
                                }
                            }
                        },
                        enabled = !pwdLoading,
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF3B82F6))
                    ) {
                        if (pwdLoading) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                        } else {
                            Text("Xác nhận", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = {
                    showChangePwd = false; currentPwd = ""; newPwd = ""; confirmPwd = ""; pwdError = null; pwdSuccess = false
                }) { Text(if (pwdSuccess) "Đóng" else "Hủy") }
            }
        )
    }
}

@Composable
private fun MoreMenuItem(
    icon: ImageVector,
    label: String,
    color: Color,
    enabled: Boolean = true,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        onClick = onClick,
        enabled = enabled
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier.size(36.dp).clip(CircleShape).background(color.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(18.dp))
            }
            Spacer(modifier = Modifier.width(14.dp))
            Text(
                label,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp,
                color = if (enabled) MaterialTheme.colorScheme.onBackground else MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.weight(1f))
            Icon(
                Icons.Default.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                modifier = Modifier.size(18.dp)
            )
        }
    }
}
