package com.goat.webview.feature.web3.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.goat.webview.feature.web3.spi.DecodedTransactionPreview

/**
 * The native transaction confirmation sheet.
 *
 * Everything shown here comes from [DecodedTransactionPreview], which native produced by decoding
 * the actual calldata — never from anything the page said about itself. That is the whole defence
 * against threat A2: a mini-app can render "$1.00" in its own DOM while submitting an unlimited
 * approval, and this sheet is where the discrepancy becomes visible.
 *
 * The window-level protections ([Web3ConfirmWindowGuard]) are applied by the host that presents
 * this composable, because they act on the Window rather than the composition.
 */
@Composable
fun Web3ConfirmModal(
    preview: DecodedTransactionPreview,
    gate: Web3ConfirmGate,
    modifier: Modifier = Modifier,
    onConfirm: () -> Unit,
    onCancel: () -> Unit
) {
    var acknowledged by remember { mutableStateOf(gate.riskAcknowledged) }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .padding(24.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = preview.networkName,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = preview.methodName,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.SemiBold
        )
        Text(text = preview.methodDescription, style = MaterialTheme.typography.bodyMedium)

        DetailRow("Amount", preview.valueFormatted)
        DetailRow("To", preview.recipient)
        preview.recipientDomain?.let { DetailRow("Domain", it) }
        DetailRow("Network fee", preview.feeFormatted)

        if (preview.isPermit2Unlimited) {
            ThreatCard(
                title = "UNLIMITED APPROVAL",
                body = "This lets the spender withdraw all current and future tokens of this type, " +
                    "without prompting you again."
            )
        }

        if (preview.isUnverifiedContract) {
            ThreatCard(
                title = "UNVERIFIED CONTRACT",
                body = "The contract interaction could not be verified. You are approving an " +
                    "unindexed bytecode operation. Proceed with extreme caution."
            )
        }

        for (warning in preview.warnings) {
            Text(
                text = warning,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error
            )
        }

        // An undecodable contract keeps the slider locked until the risk is explicitly accepted.
        if (preview.isUnverifiedContract) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Checkbox(
                    checked = acknowledged,
                    onCheckedChange = {
                        acknowledged = it
                        gate.acknowledgeRisk(it)
                    }
                )
                Text(
                    text = "I understand this contract could not be verified.",
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }

        SlideToConfirmWidget(
            gate = gate,
            enabled = gate.isSliderUnlocked,
            onConfirmed = onConfirm
        )

        TextButton(onClick = onCancel, modifier = Modifier.fillMaxWidth()) {
            Text("Cancel")
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(text = value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun ThreatCard(title: String, body: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.errorContainer)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onErrorContainer
        )
        Text(
            text = body,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onErrorContainer
        )
    }
}
