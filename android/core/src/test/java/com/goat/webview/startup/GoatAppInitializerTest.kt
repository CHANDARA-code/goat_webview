package com.goat.webview.startup

import android.content.Context
import android.content.ContextWrapper
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File

/**
 * Automated unit test suite for GoatAppInitializer (Task 10083).
 */
class GoatAppInitializerTest {

    private class MinimalContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
        override fun getFilesDir(): File = File(System.getProperty("java.io.tmpdir"), "goat_startup_min").apply {
            mkdirs()
        }
    }

    @Before
    fun setup() {
        GoatAppInitializer.resetForTesting()
    }

    @Test
    fun `test dependencies returns empty list`() {
        val initializer = GoatAppInitializer()
        val deps = initializer.dependencies()
        assertTrue("GoatAppInitializer must have zero dependencies for fast startup", deps.isEmpty())
    }

    @Test
    fun `test create execution marks initialized and is idempotent`() {
        assertFalse("Should not be initialized before create()", GoatAppInitializer.isInitialized())

        val initializer = GoatAppInitializer()
        val context = MinimalContext()

        // 1. First invocation
        initializer.create(context)
        assertTrue("Should be initialized after create()", GoatAppInitializer.isInitialized())

        // 2. Second invocation (idempotency check)
        initializer.create(context)
        assertTrue("Should remain initialized without error on duplicate call", GoatAppInitializer.isInitialized())
    }

    @Test
    fun `test concurrent create calls execute safely`() {
        val initializer = GoatAppInitializer()
        val context = MinimalContext()

        val threads = (1..10).map {
            Thread {
                initializer.create(context)
            }
        }
        threads.forEach { it.start() }
        threads.forEach { it.join() }

        assertTrue(GoatAppInitializer.isInitialized())
    }
}
