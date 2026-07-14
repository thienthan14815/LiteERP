package com.liteerp.app

import android.util.Log

/**
 * JNI bridge to nodejs-mobile.
 *
 * `libnode.so` is the prebuilt Node runtime (ships in jniLibs).
 * `libnative-lib.so` is our CMake-built JNI shim (native-lib.cpp) that binds
 * the `Java_com_liteerp_app_NodeBridge_startNodeWithArguments` symbol and
 * invokes `node::Start(argc, argv)`.
 *
 * The class + package MUST stay `com.liteerp.app.NodeBridge` because the JNI
 * symbol name is baked into native-lib.cpp — renaming here without updating
 * the C++ side will produce UnsatisfiedLinkError at runtime.
 */
object NodeBridge {
    private const val TAG = "NodeBridge"

    @Volatile
    var running: Boolean = false
        private set

    init {
        System.loadLibrary("node")
        System.loadLibrary("native-lib")
        Log.i(TAG, "libnode + native-lib loaded")
    }

    @JvmStatic
    external fun startNodeWithArguments(arguments: Array<String>): Int

    fun startBlocking(entryScript: String, extraEnv: Map<String, String>) {
        // Environment variables must be set BEFORE Node starts — process.env
        // is snapshotted at v8 init. `setEnv` uses libc setenv via the
        // Android NDK glibc-compat.
        for ((k, v) in extraEnv) {
            setEnv(k, v)
        }
        running = true
        val code = startNodeWithArguments(arrayOf("node", entryScript))
        running = false
        Log.i(TAG, "Node exited with code $code")
    }

    @JvmStatic
    external fun setEnv(key: String, value: String)
}
