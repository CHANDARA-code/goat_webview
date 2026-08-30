package com.goat.webview

import android.content.ClipData
import android.content.Context
import android.content.ContextWrapper
import android.content.SharedPreferences
import android.content.res.Configuration
import android.content.res.Resources
import android.util.DisplayMetrics
import java.io.File
import java.util.concurrent.ConcurrentHashMap

class FakeSharedPreferences : SharedPreferences {
    val data = ConcurrentHashMap<String, Any>()

    override fun getAll(): MutableMap<String, *> = HashMap(data)
    override fun getString(key: String?, defValue: String?): String? = (data[key] as? String) ?: defValue
    override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? = null
    override fun getInt(key: String?, defValue: Int): Int = (data[key] as? Int) ?: defValue
    override fun getLong(key: String?, defValue: Long): Long = (data[key] as? Long) ?: defValue
    override fun getFloat(key: String?, defValue: Float): Float = (data[key] as? Float) ?: defValue
    override fun getBoolean(key: String?, defValue: Boolean): Boolean = (data[key] as? Boolean) ?: defValue
    override fun contains(key: String?): Boolean = data.containsKey(key)
    override fun edit(): SharedPreferences.Editor = FakeEditor(this)
    override fun registerOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}
    override fun unregisterOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}

    class FakeEditor(private val prefs: FakeSharedPreferences) : SharedPreferences.Editor {
        private val temp = HashMap<String, Any?>()
        private var clearAll = false

        override fun putString(key: String?, value: String?): SharedPreferences.Editor {
            if (key != null) {
                if (value != null) temp[key] = value else temp[key] = null
            }
            return this
        }

        override fun putStringSet(key: String?, values: MutableSet<String>?): SharedPreferences.Editor = this
        override fun putInt(key: String?, value: Int): SharedPreferences.Editor {
            if (key != null) temp[key] = value
            return this
        }

        override fun putLong(key: String?, value: Long): SharedPreferences.Editor {
            if (key != null) temp[key] = value
            return this
        }

        override fun putFloat(key: String?, value: Float): SharedPreferences.Editor {
            if (key != null) temp[key] = value
            return this
        }

        override fun putBoolean(key: String?, value: Boolean): SharedPreferences.Editor {
            if (key != null) temp[key] = value
            return this
        }

        override fun remove(key: String?): SharedPreferences.Editor {
            if (key != null) temp[key] = null
            return this
        }

        override fun clear(): SharedPreferences.Editor {
            clearAll = true
            return this
        }

        override fun commit(): Boolean {
            apply()
            return true
        }

        override fun apply() {
            if (clearAll) {
                prefs.data.clear()
            }
            for ((k, v) in temp) {
                if (v == null) {
                    prefs.data.remove(k)
                } else {
                    prefs.data[k] = v
                }
            }
        }
    }
}

class FakeTestContext : ContextWrapper(null) {
    private var primaryClipData: ClipData? = null
    private val prefsMap = ConcurrentHashMap<String, FakeSharedPreferences>()

    override fun getApplicationContext(): Context = this
    override fun getFilesDir(): File = File(System.getProperty("java.io.tmpdir"), "goat_test_files").apply { mkdirs() }

    override fun getSharedPreferences(name: String?, mode: Int): SharedPreferences {
        val safeName = name ?: "default"
        return prefsMap.computeIfAbsent(safeName) { FakeSharedPreferences() }
    }

    @Suppress("DEPRECATION")
    override fun getResources(): Resources {
        val config = Configuration().apply {
            screenWidthDp = 411
            screenHeightDp = 891
            uiMode = Configuration.UI_MODE_NIGHT_YES
        }
        val metrics = DisplayMetrics().apply {
            density = 2.625f
        }
        return object : Resources(null, metrics, config) {
            override fun getConfiguration(): Configuration = config
            override fun getDisplayMetrics(): DisplayMetrics = metrics
        }
    }
}
