package com.goat.webview.compose

import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner
import com.goat.webview.lifecycle.GoatLaunchOptions
import com.goat.webview.lifecycle.GoatLifecycleManager
import com.goat.webview.lifecycle.GoatLifecycleState

class GoatComposeLifecycleObserver(
    private val lifecycleManager: GoatLifecycleManager,
    private val launchOptions: GoatLaunchOptions = GoatLaunchOptions()
) : LifecycleEventObserver {

    override fun onStateChanged(source: LifecycleOwner, event: Lifecycle.Event) {
        when (event) {
            Lifecycle.Event.ON_CREATE -> {
                if (lifecycleManager.state == GoatLifecycleState.UNINITIALIZED) {
                    lifecycleManager.startLaunch(launchOptions)
                }
            }
            Lifecycle.Event.ON_START, Lifecycle.Event.ON_RESUME -> {
                if (lifecycleManager.state == GoatLifecycleState.UNINITIALIZED) {
                    lifecycleManager.startLaunch(launchOptions)
                    lifecycleManager.enterForeground(launchOptions)
                } else if (lifecycleManager.state == GoatLifecycleState.LAUNCHING ||
                    lifecycleManager.state == GoatLifecycleState.BACKGROUND_PAUSED
                ) {
                    lifecycleManager.enterForeground(launchOptions)
                }
            }
            Lifecycle.Event.ON_PAUSE, Lifecycle.Event.ON_STOP -> {
                if (lifecycleManager.state == GoatLifecycleState.FOREGROUND_ACTIVE) {
                    lifecycleManager.enterBackground()
                }
            }
            Lifecycle.Event.ON_DESTROY -> {
                if (lifecycleManager.state != GoatLifecycleState.TERMINATED) {
                    lifecycleManager.terminate()
                }
            }
            else -> {}
        }
    }
}

