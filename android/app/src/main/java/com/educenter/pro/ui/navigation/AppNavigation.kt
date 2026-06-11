package com.educenter.pro.ui.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Class
import androidx.compose.material.icons.filled.Home
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.Campaign
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

import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.hilt.navigation.compose.hiltViewModel
import kotlinx.coroutines.launch

sealed class Screen(val route: String, val title: String? = null, val icon: androidx.compose.ui.graphics.vector.ImageVector? = null) {
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
    object More : Screen("more", "Thêm", Icons.Filled.MoreHoriz)
}

// Bottom nav: 5 items max for good UX
val bottomNavItems = listOf(Screen.Home, Screen.Students, Screen.Attendance, Screen.Reports, Screen.Profile)

@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    val profileViewModel: com.educenter.pro.ui.screens.profile.ProfileViewModel = hiltViewModel()
    val currentUserRole by profileViewModel.currentUserRole.collectAsState()

    val visibleNavItems = bottomNavItems.filter { screen ->
        if (currentUserRole == com.educenter.pro.data.model.UserRole.ACCOUNTANT) {
            screen == Screen.Students || screen == Screen.Profile || screen == Screen.Reports
        } else {
            true
        }
    }

    Scaffold(
        bottomBar = {
            val navBackStackEntry by navController.currentBackStackEntryAsState()
            val currentDestination = navBackStackEntry?.destination

            // Show bottom bar on main screens + new screens
            val mainRoutes = setOf(Screen.Home.route, Screen.Students.route, Screen.Attendance.route, Screen.Profile.route, Screen.Reports.route, Screen.Finance.route, Screen.Announcements.route, Screen.Classes.route, Screen.Teachers.route)
            val showBottomBar = mainRoutes.contains(currentDestination?.route)

            if (showBottomBar) {
                NavigationBar(
                    containerColor = androidx.compose.ui.graphics.Color.White,
                    tonalElevation = 0.dp,
                    modifier = Modifier
                        .shadow(
                            elevation = 20.dp,
                            spotColor = androidx.compose.ui.graphics.Color(0x1A000000),
                            ambientColor = androidx.compose.ui.graphics.Color(0x0D000000)
                        )
                ) {
                    visibleNavItems.forEach { screen ->
                        val isSelected = currentDestination?.hierarchy?.any { it.route == screen.route } == true
                        NavigationBarItem(
                            icon = {
                                Box(
                                    modifier = if (isSelected) {
                                        Modifier
                                            .clip(RoundedCornerShape(14.dp))
                                            .background(
                                                Brush.horizontalGradient(
                                                    listOf(
                                                        androidx.compose.ui.graphics.Color(0xFF667EEA),
                                                        androidx.compose.ui.graphics.Color(0xFF764BA2)
                                                    )
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
                                        tint = if (isSelected) androidx.compose.ui.graphics.Color.White
                                               else androidx.compose.ui.graphics.Color(0xFF94A3B8),
                                        modifier = Modifier.size(22.dp)
                                    )
                                }
                            },
                            label = {
                                Text(
                                    screen.title!!,
                                    fontSize = 10.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                    color = if (isSelected) androidx.compose.ui.graphics.Color(0xFF667EEA)
                                           else androidx.compose.ui.graphics.Color(0xFF94A3B8),
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
                                indicatorColor = androidx.compose.ui.graphics.Color.Transparent
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
                        val route = if (currentUserRole == com.educenter.pro.data.model.UserRole.ACCOUNTANT) Screen.Students.route else Screen.Home.route
                        navController.navigate(route) {
                            popUpTo(Screen.Splash.route) { inclusive = true }
                        }
                    }
                )
            }
            composable(Screen.Login.route) {
                LoginScreen(
                    onLoginSuccess = {
                        val route = if (currentUserRole == com.educenter.pro.data.model.UserRole.ACCOUNTANT) Screen.Students.route else Screen.Home.route
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
                    onCheckUpdate = {
                        // Trigger update check from MainActivity's AppUpdateManager
                        val activity = navController.context as? com.educenter.pro.MainActivity
                        activity?.let {
                            kotlinx.coroutines.MainScope().launch {
                                it.appUpdateManager.checkForUpdate(force = true)
                            }
                        }
                    }
                )
            }
            composable(Screen.Transactions.route) {
                com.educenter.pro.ui.screens.profile.TransactionsScreen(
                    onBack = { navController.popBackStack() }
                )
            }
            composable(Screen.Attendance.route) {
                AttendanceScreen()
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
        }
    }
}
