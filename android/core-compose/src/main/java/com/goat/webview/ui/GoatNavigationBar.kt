package com.goat.webview.ui

import android.content.Context
import android.util.AttributeSet
import android.widget.FrameLayout
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.serialization.Serializable
import java.util.Locale

/**
 * Navigation Bar Button Type enumeration.
 */
@Serializable
enum class GoatNavButtonType {
    BACK,
    CLOSE,
    MORE,
    CUSTOM;

    companion object {
        fun fromString(value: String?): GoatNavButtonType {
            if (value == null) return CUSTOM
            return try {
                valueOf(value.uppercase(Locale.US).trim())
            } catch (e: Exception) {
                CUSTOM
            }
        }
    }
}

/**
 * Immutable State Model for Goat Navigation Bar.
 */
data class GoatNavigationBarState(
    val title: String = "",
    val subtitle: String? = null,
    val backgroundColor: Int = 0xFF0F172A.toInt(),
    val textColor: Int = 0xFFF8FAFC.toInt(),
    val isDark: Boolean = false,
    val leftButton: GoatNavButtonType? = GoatNavButtonType.BACK,
    val rightButtons: List<GoatNavButtonType> = listOf(GoatNavButtonType.MORE, GoatNavButtonType.CLOSE),
    val isProgressVisible: Boolean = false,
    val progress: Int? = null // 0..100 or null for indeterminate
)

// GoatColorUtils now lives in :core (Compose-free) so non-Compose callers can use it.

/**
 * Modern Jetpack Compose Navigation Bar for Goat Mini-Apps.
 */
@Composable
fun GoatNavigationBar(
    state: GoatNavigationBarState,
    modifier: Modifier = Modifier,
    onButtonClick: ((GoatNavButtonType) -> Unit)? = null
) {
    val composeBg = androidx.compose.ui.graphics.Color(state.backgroundColor)
    val composeText = androidx.compose.ui.graphics.Color(state.textColor)
    val composeSubtext = composeText.copy(alpha = 0.7f)

    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(composeBg)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Left Action Button
            if (state.leftButton != null) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .clickable { onButtonClick?.invoke(state.leftButton) },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = when (state.leftButton) {
                            GoatNavButtonType.BACK -> "←"
                            GoatNavButtonType.CLOSE -> "✕"
                            GoatNavButtonType.MORE -> "⋮"
                            GoatNavButtonType.CUSTOM -> "•"
                        },
                        color = composeText,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            } else {
                Spacer(modifier = Modifier.width(40.dp))
            }

            // Title & Subtitle Column
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 8.dp),
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = state.title,
                    color = composeText,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (!state.subtitle.isNullOrBlank()) {
                    Text(
                        text = state.subtitle,
                        color = composeSubtext,
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            // Right Action Buttons
            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                state.rightButtons.forEach { btnType ->
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .clickable { onButtonClick?.invoke(btnType) },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = when (btnType) {
                                GoatNavButtonType.BACK -> "←"
                                GoatNavButtonType.CLOSE -> "✕"
                                GoatNavButtonType.MORE -> "⋮"
                                GoatNavButtonType.CUSTOM -> "•"
                            },
                            color = composeText,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        // Progress Bar Indicator at bottom edge
        AnimatedVisibility(
            visible = state.isProgressVisible,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.align(Alignment.BottomCenter)
        ) {
            val progressVal = state.progress
            if (progressVal != null) {
                val fraction = (progressVal.coerceIn(0, 100)) / 100f
                LinearProgressIndicator(
                    progress = { fraction },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(2.5.dp),
                    color = androidx.compose.ui.graphics.Color(0xFF38BDF8),
                    trackColor = androidx.compose.ui.graphics.Color.Transparent
                )
            } else {
                LinearProgressIndicator(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(2.5.dp),
                    color = androidx.compose.ui.graphics.Color(0xFF38BDF8),
                    trackColor = androidx.compose.ui.graphics.Color.Transparent
                )
            }
        }
    }
}

/**
 * Classical Android View implementation of GoatNavigationBar for hybrid layouts.
 */
class GoatNavigationBarView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    private var currentState = GoatNavigationBarState()
    private var onButtonClickListener: ((GoatNavButtonType) -> Unit)? = null

    init {
        try {
            setBackgroundColor(currentState.backgroundColor)
        } catch (e: Throwable) {}
    }

    fun setOnButtonClickListener(listener: (GoatNavButtonType) -> Unit) {
        this.onButtonClickListener = listener
    }

    fun updateState(state: GoatNavigationBarState) {
        this.currentState = state
        try {
            setBackgroundColor(currentState.backgroundColor)
        } catch (e: Throwable) {}
    }

    fun getState(): GoatNavigationBarState = currentState

    fun setTitle(title: String, subtitle: String? = null) {
        updateState(currentState.copy(title = title, subtitle = subtitle))
    }

    fun setColors(backgroundColorHex: String, textColorHex: String, isDark: Boolean = false) {
        val bg = GoatColorUtils.parseHexColor(backgroundColorHex, currentState.backgroundColor)
        val text = GoatColorUtils.parseHexColor(textColorHex, currentState.textColor)
        updateState(currentState.copy(backgroundColor = bg, textColor = text, isDark = isDark))
    }

    fun setButtons(left: GoatNavButtonType?, right: List<GoatNavButtonType>) {
        updateState(currentState.copy(leftButton = left, rightButtons = right))
    }

    fun setProgress(visible: Boolean, progress: Int? = null) {
        updateState(currentState.copy(isProgressVisible = visible, progress = progress))
    }
}
