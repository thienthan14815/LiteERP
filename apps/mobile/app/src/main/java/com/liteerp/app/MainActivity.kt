package com.liteerp.app

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var bootOverlay: LinearLayout
    private lateinit var bootStatus: TextView

    // WebView does NOT handle <input type="file"> by itself — without an
    // onShowFileChooser implementation taps on file inputs do nothing
    // (backup-restore picker). The launcher relays the system picker's result
    // back into the pending WebView callback.
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = fileChooserCallback
            fileChooserCallback = null
            callback?.onReceiveValue(
                WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data),
            )
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Node boots in-process: if the screen sleeps mid-boot, Android
        // throttles/freezes us and the health poll times out. Keep the screen
        // on while this activity is front — an ERP terminal wants that anyway.
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        webView = findViewById(R.id.webView)
        bootOverlay = findViewById(R.id.bootOverlay)
        bootStatus = findViewById(R.id.bootStatus)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val host = request.url.host ?: return false
                // Keep the WebView pinned to the local Node — external links (Drive
                // OAuth callbacks etc) should open in the system browser.
                return host !in setOf("127.0.0.1", "localhost")
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams,
            ): Boolean {
                // Only one pending chooser at a time; cancel a stale one.
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = callback
                // Always open a broad */* picker: createIntent() maps the web
                // accept attr (".zip,.sql") to MIME filters that grey out the
                // very files the user needs on some pickers. The web app
                // validates the extension itself after selection.
                return try {
                    fileChooserLauncher.launch(
                        Intent(Intent.ACTION_GET_CONTENT).apply {
                            addCategory(Intent.CATEGORY_OPENABLE)
                            type = "*/*"
                        },
                    )
                    true
                } catch (e: Exception) {
                    Log.e(TAG, "file chooser failed", e)
                    fileChooserCallback = null
                    false
                }
            }
        }

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val payloadDir = withContext(Dispatchers.IO) {
                    PayloadInstaller.ensureInstalled(this@MainActivity) { msg ->
                        runOnUiThread { bootStatus.text = msg }
                    }
                }

                bootStatus.text = "Đang khởi động Node…"
                withContext(Dispatchers.IO) {
                    launchNode(payloadDir)
                }

                bootStatus.text = "Đang chờ máy chủ phản hồi…"
                val ready = withContext(Dispatchers.IO) {
                    ApiWaiter.waitForReady()
                }
                if (!ready) {
                    bootStatus.text = getString(R.string.boot_error)
                    return@launch
                }

                bootOverlay.visibility = View.GONE
                webView.visibility = View.VISIBLE
                // Old cached responses may carry stale security headers (the
                // CSP header we removed) — drop the HTTP cache before first load.
                webView.clearCache(true)
                webView.loadUrl("http://127.0.0.1:3001/")
            } catch (t: Throwable) {
                Log.e(TAG, "boot failed", t)
                bootStatus.text = "${getString(R.string.boot_error)}\n\n${t.message}"
            }
        }
    }

    private fun launchNode(payloadDir: File) {
        // Wire filesDir paths into env before Node starts. Prisma expects an
        // absolute DATABASE_URL because the schema.prisma is deep inside the
        // extracted payload and relative resolution changes based on cwd.
        val apiDir = File(payloadDir, "api")
        val dataDir = File(payloadDir, "data").apply { mkdirs() }
        val uploadDir = File(dataDir, "uploads").apply { mkdirs() }
        val webDir = File(payloadDir, "web")
        val entry = File(apiDir, "dist/src/main.js")

        // Node stdout/stderr go to this file (see native-lib.cpp — a pipe
        // redirect to logcat deadlocks when its drain threads die).
        val stdioLog = File(payloadDir, "node-stdio.log")

        // Expose the app's native lib dir so JS side can dlopen jniLibs .so files
        // (sqlite3 addon lives there because Bionic linker namespace prevents
        // loading .node files from filesDir when they DT_NEEDED libnode.so).
        val nativeLibDir = applicationInfo.nativeLibraryDir

        val env = mapOf(
            "ANDROID_NATIVE_LIB_DIR" to nativeLibDir,
            // Android has no writable /tmp; Node's os.tmpdir() falls back to
            // /tmp unless TMPDIR is set (backup copies the DB there, multer
            // stages uploads there → EACCES without this).
            "TMPDIR" to cacheDir.absolutePath,
            "NODE_ENV" to "production",
            "PORT" to "3001",
            "APP_URL" to "http://127.0.0.1:3001",
            "DATABASE_URL" to "file:${File(dataDir, "liteerp.sqlite").absolutePath}",
            "UPLOAD_DIR" to uploadDir.absolutePath,
            "WEB_DIR" to webDir.absolutePath,
            "JWT_ACCESS_SECRET" to "liteerp-android-dev-access-change-in-release",
            "JWT_REFRESH_SECRET" to "liteerp-android-dev-refresh-change-in-release",
            "JWT_ACCESS_EXPIRES_IN" to "15m",
            "JWT_REFRESH_EXPIRES_IN" to "30d",
            "BACKUP_ENABLED" to "false",
            "NODE_STDIO_LOG" to stdioLog.absolutePath,
        )

        // Start Node on a dedicated thread — it never returns until process.exit.
        Thread({
            NodeBridge.startBlocking(entry.absolutePath, env)
        }, "node-runtime").start()
    }

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    companion object {
        private const val TAG = "MainActivity"
    }
}
