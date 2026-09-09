package com.goat.webview.lifecycle

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

class GoatLifecycleManagerTest {

    @Test
    fun testCompleteLifecycleStateTransitions() {
        val manager = GoatLifecycleManager()
        assertEquals(GoatLifecycleState.UNINITIALIZED, manager.state)

        val launchOpts = GoatLaunchOptions(
            entryRoute = "/pages/home",
            queryParams = mapOf("tab" to "feed"),
            referrerInfo = mapOf("appId" to "host.superapp"),
            scene = 1001
        )

        assertTrue(manager.startLaunch(launchOpts))
        assertEquals(GoatLifecycleState.LAUNCHING, manager.state)
        assertEquals("/pages/home", manager.lastLaunchOptions?.entryRoute)

        assertTrue(manager.enterForeground())
        assertEquals(GoatLifecycleState.FOREGROUND_ACTIVE, manager.state)

        assertTrue(manager.enterBackground())
        assertEquals(GoatLifecycleState.BACKGROUND_PAUSED, manager.state)

        assertTrue(manager.enterForeground())
        assertEquals(GoatLifecycleState.FOREGROUND_ACTIVE, manager.state)

        assertTrue(manager.terminate())
        assertEquals(GoatLifecycleState.TERMINATED, manager.state)
    }

    @Test
    fun testInvalidTransitionsAreRejected() {
        val manager = GoatLifecycleManager()

        assertFalse(manager.enterForeground())
        assertEquals(GoatLifecycleState.UNINITIALIZED, manager.state)

        assertFalse(manager.enterBackground())
        assertEquals(GoatLifecycleState.UNINITIALIZED, manager.state)

        manager.startLaunch()
        assertFalse(manager.startLaunch())
        assertFalse(manager.enterBackground())

        manager.terminate()
        assertEquals(GoatLifecycleState.TERMINATED, manager.state)

        assertFalse(manager.startLaunch())
        assertFalse(manager.enterForeground())
        assertFalse(manager.enterBackground())
        assertFalse(manager.terminate())
    }

    @Test
    fun testMovingToBackgroundUnder10ms() {
        val manager = GoatLifecycleManager()
        manager.startLaunch()
        manager.enterForeground()

        val start = System.nanoTime()
        val success = manager.enterBackground()
        val elapsedMs = (System.nanoTime() - start) / 1_000_000.0

        assertTrue(success)
        assertEquals(GoatLifecycleState.BACKGROUND_PAUSED, manager.state)
        assertTrue(elapsedMs < 10.0)
    }

    @Test
    fun testLaunchOptionsDeliveredOnAppShow() {
        val manager = GoatLifecycleManager()
        var receivedPayload: Map<String, Any?>? = null

        manager.addEventObserver("ON_APP_SHOW") { payload ->
            receivedPayload = payload
        }

        val launchOpts = GoatLaunchOptions(
            entryRoute = "/pages/checkout",
            queryParams = mapOf("orderId" to "9876"),
            referrerInfo = mapOf("source" to "campaign"),
            scene = 1089
        )

        manager.startLaunch(launchOpts)
        manager.enterForeground()

        assertNotNull(receivedPayload)
        assertEquals("/pages/checkout", receivedPayload?.get("entryRoute"))
        assertEquals(mapOf("orderId" to "9876"), receivedPayload?.get("queryParams"))
        assertEquals(mapOf("source" to "campaign"), receivedPayload?.get("referrerInfo"))
        assertEquals(1089, receivedPayload?.get("scene"))
    }

    @Test
    fun testLifecycleListenerTracking() {
        val manager = GoatLifecycleManager()
        val transitions = mutableListOf<Pair<GoatLifecycleState, GoatLifecycleState>>()

        val listener = object : GoatLifecycleListener {
            override fun onStateChanged(from: GoatLifecycleState, to: GoatLifecycleState) {
                transitions.add(from to to)
            }
        }

        manager.addLifecycleListener(listener)
        manager.startLaunch()
        manager.enterForeground()
        manager.enterBackground()
        manager.removeLifecycleListener(listener)
        manager.terminate()

        assertEquals(3, transitions.size)
        assertEquals(GoatLifecycleState.UNINITIALIZED to GoatLifecycleState.LAUNCHING, transitions[0])
        assertEquals(GoatLifecycleState.LAUNCHING to GoatLifecycleState.FOREGROUND_ACTIVE, transitions[1])
        assertEquals(GoatLifecycleState.FOREGROUND_ACTIVE to GoatLifecycleState.BACKGROUND_PAUSED, transitions[2])
    }

    @Test
    fun testEventHubDispatchesAllStandardEvents() {
        val manager = GoatLifecycleManager()
        val receivedEvents = mutableMapOf<String, Map<String, Any?>>()

        listOf(
            "ON_APP_SHOW", "onAppShow",
            "ON_APP_HIDE", "onAppHide",
            "ON_PAGE_SCROLL", "onPageScroll",
            "ON_MEMORY_WARNING", "onMemoryWarning",
            "ON_WINDOW_RESIZE", "onWindowResize"
        ).forEach { eventName ->
            manager.addEventObserver(eventName) { payload ->
                receivedEvents[eventName] = payload
            }
        }

        manager.dispatchAppShow(GoatLaunchOptions(entryRoute = "/home"))
        manager.dispatchAppHide()
        manager.dispatchPageScroll(100, 0, 1000, 400)
        manager.dispatchMemoryWarning(80, "critical")
        manager.dispatchWindowResize(390, 844, 390, 844, "portrait")

        assertEquals("/home", receivedEvents["ON_APP_SHOW"]?.get("entryRoute"))
        assertEquals("/home", receivedEvents["onAppShow"]?.get("entryRoute"))
        assertNotNull(receivedEvents["ON_APP_HIDE"]?.get("timestamp"))
        assertNotNull(receivedEvents["onAppHide"]?.get("timestamp"))
        assertEquals(100, receivedEvents["ON_PAGE_SCROLL"]?.get("scrollTop"))
        assertEquals(100, receivedEvents["onPageScroll"]?.get("scrollTop"))
        assertEquals(80, receivedEvents["ON_MEMORY_WARNING"]?.get("level"))
        assertEquals("critical", receivedEvents["onMemoryWarning"]?.get("memoryPressure"))
        assertEquals(390, receivedEvents["ON_WINDOW_RESIZE"]?.get("width"))
        assertEquals("portrait", receivedEvents["onWindowResize"]?.get("orientation"))
    }

    @Test
    fun testScriptEvaluatorExecution() {
        val manager = GoatLifecycleManager()
        val evaluatedScripts = mutableListOf<String>()

        manager.attachScriptEvaluator { script ->
            evaluatedScripts.add(script)
        }

        manager.dispatchAppHide()

        assertEquals(2, evaluatedScripts.size)
        assertTrue(evaluatedScripts[0].contains("native_call"))
        assertTrue(evaluatedScripts[0].contains("ON_APP_HIDE"))
        assertTrue(evaluatedScripts[1].contains("onAppHide"))
    }

    @Test
    fun testConcurrentTransitionsDoNotCorruptState() {
        val manager = GoatLifecycleManager()
        manager.startLaunch()
        val latch = CountDownLatch(10)
        val successCount = AtomicInteger(0)

        for (i in 0 until 10) {
            Thread {
                if (manager.enterForeground()) {
                    successCount.incrementAndGet()
                }
                latch.countDown()
            }.start()
        }

        assertTrue(latch.await(3, TimeUnit.SECONDS))
        assertEquals(1, successCount.get())
        assertEquals(GoatLifecycleState.FOREGROUND_ACTIVE, manager.state)
    }

    @Test
    fun testComposeLifecycleObserverMapping() {
        val manager = GoatLifecycleManager()
        val observer = com.goat.webview.compose.GoatComposeLifecycleObserver(
            manager,
            GoatLaunchOptions(entryRoute = "/compose")
        )
        val owner = object : androidx.lifecycle.LifecycleOwner {
            private val registry = androidx.lifecycle.LifecycleRegistry(this)
            override val lifecycle: androidx.lifecycle.Lifecycle get() = registry
        }

        observer.onStateChanged(owner, androidx.lifecycle.Lifecycle.Event.ON_CREATE)
        assertEquals(GoatLifecycleState.LAUNCHING, manager.state)

        observer.onStateChanged(owner, androidx.lifecycle.Lifecycle.Event.ON_RESUME)
        assertEquals(GoatLifecycleState.FOREGROUND_ACTIVE, manager.state)

        observer.onStateChanged(owner, androidx.lifecycle.Lifecycle.Event.ON_PAUSE)
        assertEquals(GoatLifecycleState.BACKGROUND_PAUSED, manager.state)

        observer.onStateChanged(owner, androidx.lifecycle.Lifecycle.Event.ON_RESUME)
        assertEquals(GoatLifecycleState.FOREGROUND_ACTIVE, manager.state)

        observer.onStateChanged(owner, androidx.lifecycle.Lifecycle.Event.ON_DESTROY)
        assertEquals(GoatLifecycleState.TERMINATED, manager.state)
    }
}
