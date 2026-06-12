package com.educenter.pro.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.graphics.Color

/**
 * Centralized app colors that adapt to light/dark mode.
 * Usage: AppColors.cardBackground (auto-adapts)
 */
object AppColors {
    // Semantic colors that stay the same in both modes
    val PrimaryBlue = Color(0xFF3B82F6)
    val DarkBlue = Color(0xFF2563EB)
    val Red = Color(0xFFEF4444)
    val Green = Color(0xFF10B981)
    val Orange = Color(0xFFF59E0B)
    val Cyan = Color(0xFF0EA5E9)

    // Card & surface backgrounds
    val cardBackground: Color
        @Composable @ReadOnlyComposable
        get() = MaterialTheme.colorScheme.surface

    val cardBackgroundElevated: Color
        @Composable @ReadOnlyComposable
        get() = MaterialTheme.colorScheme.surfaceContainerHigh

    // Text colors
    val textPrimary: Color
        @Composable @ReadOnlyComposable
        get() = MaterialTheme.colorScheme.onSurface

    val textSecondary: Color
        @Composable @ReadOnlyComposable
        get() = MaterialTheme.colorScheme.onSurfaceVariant

    val textTertiary: Color
        @Composable @ReadOnlyComposable
        get() = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)

    // Background for badges/tags (adapts to dark mode)
    @Composable
    fun tagBackground(baseColor: Color): Color {
        return if (isSystemInDarkTheme()) {
            baseColor.copy(alpha = 0.2f)
        } else {
            baseColor.copy(alpha = 0.1f)
        }
    }

    // Light background containers (like info boxes)
    val infoBackground: Color
        @Composable @ReadOnlyComposable
        get() = if (isSystemInDarkTheme()) {
            MaterialTheme.colorScheme.surfaceContainerHigh
        } else {
            Color(0xFFF0F7FF)
        }

    val successBackground: Color
        @Composable @ReadOnlyComposable
        get() = if (isSystemInDarkTheme()) {
            Green.copy(alpha = 0.15f)
        } else {
            Color(0xFFF0FDF4)
        }

    val errorBackground: Color
        @Composable @ReadOnlyComposable
        get() = if (isSystemInDarkTheme()) {
            Red.copy(alpha = 0.15f)
        } else {
            Color(0xFFFEF2F2)
        }

    val dividerColor: Color
        @Composable @ReadOnlyComposable
        get() = MaterialTheme.colorScheme.outlineVariant
}
