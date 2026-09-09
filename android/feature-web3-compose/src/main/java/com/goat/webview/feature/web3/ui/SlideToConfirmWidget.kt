package com.goat.webview.feature.web3.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp

/**
 * Slide-to-confirm control.
 *
 * All authorisation logic lives in [Web3ConfirmGate], which is a plain class with its own unit
 * tests; this composable only turns pointer events into `onDrag`/`onRelease` calls and draws the
 * result. Keeping the decision out of the view is what makes the rule "a release below 100%
 * cancels" testable without an instrumented device.
 */
@Composable
fun SlideToConfirmWidget(
    gate: Web3ConfirmGate,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    label: String = "Slide to confirm",
    onConfirmed: () -> Unit
) {
    var progress by remember { mutableFloatStateOf(0f) }
    val thumbSize = 56.dp

    BoxWithConstraints(
        modifier = modifier
            .fillMaxWidth()
            .height(64.dp)
            .clip(RoundedCornerShape(32.dp))
            .background(
                if (enabled) MaterialTheme.colorScheme.secondaryContainer
                else MaterialTheme.colorScheme.surfaceVariant
            )
    ) {
        val trackPx = with(LocalDensity.current) { (maxWidth - thumbSize).toPx() }

        Text(
            text = if (enabled) label else "Acknowledge the warning to continue",
            modifier = Modifier.align(Alignment.Center),
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSecondaryContainer
        )

        Box(
            modifier = Modifier
                .offset { androidx.compose.ui.unit.IntOffset((progress * trackPx).toInt(), 0) }
                .align(Alignment.CenterStart)
                .size(thumbSize)
                .clip(CircleShape)
                .background(
                    if (enabled) MaterialTheme.colorScheme.primary else Color.Gray
                )
                .pointerInput(enabled, gate) {
                    if (!enabled) return@pointerInput
                    detectHorizontalDragGestures(
                        onDragEnd = {
                            if (gate.outcome != SlideOutcome.CONFIRMED) {
                                gate.onRelease()
                                progress = 0f
                            }
                        },
                        onDragCancel = {
                            gate.onCancel()
                            progress = 0f
                        }
                    ) { change, dragAmount ->
                        // A touch the platform reports as obscured is discarded by the gate, not
                        // merely ignored here — that is the tapjacking defence (threat A7).
                        val obscured = !change.pressed && change.previousPressed
                        val next = (progress + dragAmount / trackPx).coerceIn(0f, 1f)
                        when (gate.onDrag(next, obscured = obscured)) {
                            SlideOutcome.CONFIRMED -> {
                                progress = 1f
                                onConfirmed()
                            }
                            SlideOutcome.SLIDING -> progress = gate.progress
                            else -> progress = 0f
                        }
                        change.consume()
                    }
                }
        )
    }
}
