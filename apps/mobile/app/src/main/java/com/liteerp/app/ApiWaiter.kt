package com.liteerp.app

import android.util.Log
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import kotlin.system.measureTimeMillis

/**
 * Polls http://127.0.0.1:3001/api/v1/health until it returns 200 or the timeout
 * expires. Used to gate WebView.loadUrl on the Node process being ready.
 */
object ApiWaiter {
    private const val TAG = "ApiWaiter"

    fun waitForReady(port: Int = 3001, timeoutMs: Long = 120_000L, pollMs: Long = 500L): Boolean {
        val start = System.currentTimeMillis()
        val url = URL("http://127.0.0.1:$port/api/v1/health")
        while (System.currentTimeMillis() - start < timeoutMs) {
            val elapsed = measureTimeMillis {
                val conn = url.openConnection() as HttpURLConnection
                try {
                    conn.connectTimeout = 1_000
                    conn.readTimeout = 1_000
                    conn.requestMethod = "GET"
                    if (conn.responseCode == 200) {
                        Log.i(TAG, "API ready after ${System.currentTimeMillis() - start} ms")
                        return true
                    }
                } catch (e: IOException) {
                    // Not ready yet — keep polling.
                } finally {
                    conn.disconnect()
                }
            }
            val sleepFor = (pollMs - elapsed).coerceAtLeast(0)
            if (sleepFor > 0) Thread.sleep(sleepFor)
        }
        Log.w(TAG, "API failed to start within $timeoutMs ms")
        return false
    }
}
