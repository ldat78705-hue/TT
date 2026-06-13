@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@file:Suppress("DEPRECATION")
package com.educenter.pro.ui.screens.qrscanner

import android.annotation.SuppressLint

import android.util.Log
import android.util.Size
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val GreenAccent = Color(0xFF10B981)
private val RedAccent = Color(0xFFEF4444)

@OptIn(ExperimentalPermissionsApi::class, ExperimentalMaterial3Api::class)
@Composable
fun QRScannerScreen(
    onBack: () -> Unit,
    viewModel: QRScannerViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val cameraPermission = rememberPermissionState(android.Manifest.permission.CAMERA)

    LaunchedEffect(Unit) {
        if (!cameraPermission.status.isGranted) {
            cameraPermission.launchPermissionRequest()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("📷 Quét QR Điểm danh", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Quay lại")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF4F46E5),
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when {
                !cameraPermission.status.isGranted -> {
                    // Permission not granted
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(32.dp)) {
                            Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(64.dp), tint = Color(0xFF94A3B8))
                            Spacer(modifier = Modifier.height(16.dp))
                            Text("Cần quyền Camera", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("Vui lòng cho phép truy cập camera để quét mã QR điểm danh.", textAlign = TextAlign.Center, color = Color(0xFF64748B))
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(onClick = { cameraPermission.launchPermissionRequest() }) {
                                Text("Cho phép Camera")
                            }
                        }
                    }
                }

                uiState.selectedClassId.isEmpty() -> {
                    // Step 1: Select class
                    ClassSelector(
                        classes = uiState.availableClasses,
                        studentCounts = uiState.classStudentCounts,
                        onSelectClass = { viewModel.selectClass(it) }
                    )
                }

                !uiState.isFinished -> {
                    // Step 2: Scanning
                    ScanningView(
                        uiState = uiState,
                        onQRDetected = { viewModel.processQR(it) },
                        onFinish = { viewModel.finish() },
                        onBack = { viewModel.resetSelection() }
                    )
                }

                else -> {
                    // Step 3: Summary
                    SummaryView(
                        uiState = uiState,
                        onDone = onBack,
                        onScanAgain = { viewModel.resetSelection() }
                    )
                }
            }
        }
    }
}

@Composable
private fun ClassSelector(
    classes: List<com.educenter.pro.data.model.ClassModel>,
    studentCounts: Map<String, Int>,
    onSelectClass: (String) -> Unit
) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFEEF2FF))
            ) {
                Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Info, contentDescription = null, tint = Color(0xFF4F46E5))
                    Spacer(modifier = Modifier.width(12.dp))
                    Text("Chọn lớp để bắt đầu quét QR điểm danh", fontSize = 14.sp, color = Color(0xFF3730A3))
                }
            }
        }

        item {
            Text("📚 Lớp học hôm nay", fontWeight = FontWeight.Bold, fontSize = 18.sp, modifier = Modifier.padding(top = 8.dp))
        }

        if (classes.isEmpty()) {
            item {
                Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    Text("Không có lớp nào hôm nay", color = Color(0xFF94A3B8))
                }
            }
        }

        items(classes) { cls ->
            val count = studentCounts[cls.id] ?: 0
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                elevation = CardDefaults.cardElevation(2.dp),
                onClick = { onSelectClass(cls.id) }
            ) {
                Row(
                    modifier = Modifier.padding(16.dp).fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier.size(48.dp).clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFF4F46E5).copy(alpha = 0.1f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Class, contentDescription = null, tint = Color(0xFF4F46E5))
                    }
                    Spacer(modifier = Modifier.width(16.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(cls.name, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text("${cls.subject} • $count học viên", fontSize = 13.sp, color = Color(0xFF64748B))
                        val todaySchedule = cls.schedule.firstOrNull()
                        if (todaySchedule != null) {
                            Text("${todaySchedule.startTime} - ${todaySchedule.endTime}", fontSize = 12.sp, color = Color(0xFF4F46E5), fontWeight = FontWeight.Medium)
                        }
                    }
                    Icon(Icons.Default.ChevronRight, contentDescription = null, tint = Color(0xFFCBD5E1))
                }
            }
        }
    }
}

@SuppressLint("UnsafeOptInUsageError")
@Composable
private fun ScanningView(
    uiState: QRScannerUiState,
    onQRDetected: (String) -> Unit,
    onFinish: () -> Unit,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val scannedSet = remember { mutableSetOf<String>() }
    var lastProcessedTime by remember { mutableStateOf(0L) }

    Column(modifier = Modifier.fillMaxSize()) {
        // Progress header
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(0.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onBack, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.ArrowBack, contentDescription = null, modifier = Modifier.size(20.dp))
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(uiState.selectedClassName, fontWeight = FontWeight.Bold, fontSize = 16.sp, modifier = Modifier.weight(1f))
                    Text(
                        "✅ ${uiState.scannedStudents.size}/${uiState.totalStudents}",
                        fontWeight = FontWeight.Bold,
                        color = GreenAccent,
                        fontSize = 15.sp
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))
                val progress = if (uiState.totalStudents > 0) uiState.scannedStudents.size.toFloat() / uiState.totalStudents else 0f
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                    color = GreenAccent,
                    trackColor = Color(0xFFE2E8F0)
                )
            }
        }

        // Camera preview
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .background(Color.Black)
        ) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { ctx ->
                    val previewView = PreviewView(ctx)
                    val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)

                    cameraProviderFuture.addListener({
                        val cameraProvider = cameraProviderFuture.get()
                        val preview = Preview.Builder().build().also {
                            it.setSurfaceProvider(previewView.surfaceProvider)
                        }

                        val imageAnalysis = ImageAnalysis.Builder()
                            .setTargetResolution(Size(640, 480))
                            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                            .build()

                        val scanner = BarcodeScanning.getClient()

                        imageAnalysis.setAnalyzer(ContextCompat.getMainExecutor(ctx)) { imageProxy ->
                            val now = System.currentTimeMillis()
                            if (now - lastProcessedTime < 500) {
                                imageProxy.close()
                                return@setAnalyzer
                            }

                            val mediaImage = imageProxy.image
                            if (mediaImage != null) {
                                val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
                                scanner.process(image)
                                    .addOnSuccessListener { barcodes ->
                                        for (barcode in barcodes) {
                                            if (barcode.format == Barcode.FORMAT_QR_CODE) {
                                                val value = barcode.rawValue?.trim()?.uppercase()
                                                if (value != null && !scannedSet.contains(value)) {
                                                    scannedSet.add(value)
                                                    lastProcessedTime = now
                                                    onQRDetected(value)
                                                }
                                            }
                                        }
                                    }
                                    .addOnCompleteListener {
                                        imageProxy.close()
                                    }
                            } else {
                                imageProxy.close()
                            }
                        }

                        try {
                            cameraProvider.unbindAll()
                            cameraProvider.bindToLifecycle(
                                lifecycleOwner,
                                CameraSelector.DEFAULT_BACK_CAMERA,
                                preview,
                                imageAnalysis
                            )
                        } catch (e: Exception) {
                            Log.e("QRScanner", "Camera bind failed", e)
                        }
                    }, ContextCompat.getMainExecutor(ctx))

                    previewView
                }
            )

            // Scan frame overlay
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(250.dp)
                        .border(3.dp, Color.White.copy(alpha = 0.6f), RoundedCornerShape(16.dp))
                )
            }

            // Last scanned notification
            androidx.compose.animation.AnimatedVisibility(
                visible = uiState.lastScannedName != null,
                enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
                exit = fadeOut(),
                modifier = Modifier.align(Alignment.BottomCenter).padding(16.dp)
            ) {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = GreenAccent)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color.White)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(uiState.lastScannedName ?: "", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    }
                }
            }
        }

        // Scan log + Finish button
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            elevation = CardDefaults.cardElevation(8.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                // Recent scans
                if (uiState.scanLog.isNotEmpty()) {
                    Text("Quét gần đây:", fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = Color(0xFF64748B))
                    Spacer(modifier = Modifier.height(4.dp))
                    uiState.scanLog.take(3).forEach { log ->
                        Row(modifier = Modifier.padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                            val icon = when (log.status) {
                                "success" -> "✅"
                                "duplicate" -> "🔄"
                                else -> "❌"
                            }
                            Text(icon, fontSize = 14.sp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(log.name, fontSize = 14.sp, modifier = Modifier.weight(1f), fontWeight = FontWeight.Medium)
                            Text(log.time, fontSize = 12.sp, color = Color(0xFF94A3B8))
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                }

                // Finish button
                Button(
                    onClick = onFinish,
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = GreenAccent),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.CheckCircle, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Hoàn tất điểm danh (${uiState.scannedStudents.size}/${uiState.totalStudents})", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun SummaryView(
    uiState: QRScannerUiState,
    onDone: () -> Unit,
    onScanAgain: () -> Unit
) {
    val present = uiState.scannedStudents.size
    val absent = uiState.totalStudents - present

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Header
        item {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp)) {
                Text("🎓", fontSize = 48.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Text("Điểm danh hoàn tất!", fontWeight = FontWeight.ExtraBold, fontSize = 22.sp)
                Text(uiState.selectedClassName, fontSize = 15.sp, color = Color(0xFF64748B))
            }
        }

        // Summary cards
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                SummaryCard("Có mặt", present.toString(), GreenAccent, Modifier.weight(1f))
                SummaryCard("Vắng", absent.toString(), RedAccent, Modifier.weight(1f))
                SummaryCard("Tổng", uiState.totalStudents.toString(), Color(0xFF3B82F6), Modifier.weight(1f))
            }
        }

        // Absent list
        if (uiState.absentStudents.isNotEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF2F2))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Học viên vắng mặt (${uiState.absentStudents.size})", fontWeight = FontWeight.Bold, color = RedAccent, fontSize = 15.sp)
                        Spacer(modifier = Modifier.height(8.dp))
                        uiState.absentStudents.forEach { name ->
                            Row(modifier = Modifier.padding(vertical = 3.dp)) {
                                Text("• ", color = RedAccent)
                                Text(name, fontSize = 14.sp)
                            }
                        }
                    }
                }
            }
        }

        // Present list
        if (uiState.scannedStudents.isNotEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFF0FDF4))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Học viên có mặt (${present})", fontWeight = FontWeight.Bold, color = GreenAccent, fontSize = 15.sp)
                        Spacer(modifier = Modifier.height(8.dp))
                        uiState.scannedStudents.forEach { (_, name) ->
                            Row(modifier = Modifier.padding(vertical = 3.dp)) {
                                Text("✓ ", color = GreenAccent)
                                Text(name, fontSize = 14.sp)
                            }
                        }
                    }
                }
            }
        }

        // Buttons
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = onScanAgain, modifier = Modifier.weight(1f).height(48.dp), shape = RoundedCornerShape(12.dp)) {
                    Text("Quét lớp khác")
                }
                Button(onClick = onDone, modifier = Modifier.weight(1f).height(48.dp), shape = RoundedCornerShape(12.dp)) {
                    Text("Xong")
                }
            }
        }
    }
}

@Composable
private fun SummaryCard(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = color.copy(alpha = 0.1f))
    ) {
        Column(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(value, fontWeight = FontWeight.ExtraBold, fontSize = 28.sp, color = color)
            Text(label, fontSize = 13.sp, color = color, fontWeight = FontWeight.Medium)
        }
    }
}
