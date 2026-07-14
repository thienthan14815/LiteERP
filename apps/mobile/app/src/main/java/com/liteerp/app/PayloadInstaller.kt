package com.liteerp.app

import android.content.Context
import android.util.Log
import java.io.File
import java.io.FileOutputStream
import java.nio.channels.Channels
import java.nio.channels.FileChannel
import java.util.zip.ZipFile

// Extracts the Node payload from the APK to filesDir/nodejs-project.
//
// The naive approach — assets.open("payload.zip") into ZipInputStream — clocked
// at ~10 KB/s on real hardware. Suspected cause: ZipInputStream can't seek in
// AssetInputStream and the underlying mmap doesn't play nicely with sequential
// small reads.
//
// The two-phase approach here:
//   1. Copy the stored zip asset to filesDir/payload.zip via FileChannel
//      transfer — a single bulk read of a memory-mapped stored asset.
//   2. Open the local copy with ZipFile (random-access) and extract to
//      filesDir/nodejs-project.
//
// Phase 1 runs at raw filesystem speed (~100+ MB/s on flash). Phase 2 is
// CPU-bound file writes but avoids Android's asset I/O layer entirely.

object PayloadInstaller {
    private const val TAG = "PayloadInstaller"
    private const val ASSET_ZIP = "payload.zip"
    private const val EXTRACT_DIR = "nodejs-project"
    private const val VERSION_FILE = ".version"

    fun ensureInstalled(context: Context, onProgress: (String) -> Unit = {}): File {
        val target = File(context.filesDir, EXTRACT_DIR)
        val installedVersion = readInstalledVersion(target)
        val bundledVersion = context.packageManager
            .getPackageInfo(context.packageName, 0).longVersionCode.toString()

        if (installedVersion == bundledVersion) {
            Log.i(TAG, "payload up-to-date (v=$bundledVersion), skipping extract")
            return target
        }

        Log.i(TAG, "extracting payload (bundled=$bundledVersion installed=$installedVersion)")
        if (target.exists()) target.deleteRecursively()
        target.mkdirs()

        val localZip = File(context.filesDir, ASSET_ZIP)
        try {
            copyAssetToFile(context, ASSET_ZIP, localZip, onProgress)
            unzipToDir(localZip, target, onProgress)
            File(target, VERSION_FILE).writeText(bundledVersion)
        } finally {
            localZip.delete()
        }
        return target
    }

    private fun copyAssetToFile(context: Context, assetName: String, dest: File, onProgress: (String) -> Unit) {
        val start = System.currentTimeMillis()
        onProgress("Đang chuẩn bị dữ liệu…")

        val afd = context.assets.openFd(assetName)
        try {
            val inputChannel = Channels.newChannel(afd.createInputStream())
            FileOutputStream(dest).use { out ->
                val outChannel = out.channel
                var pos = 0L
                val total = afd.length
                val chunk = 8 * 1024 * 1024L
                while (pos < total) {
                    val transferred = outChannel.transferFrom(inputChannel, pos, chunk.coerceAtMost(total - pos))
                    if (transferred <= 0) break
                    pos += transferred
                    if ((pos / chunk) % 4 == 0L) {
                        onProgress("Đã sao chép ${pos / 1_000_000} / ${total / 1_000_000} MB…")
                    }
                }
            }
        } finally {
            afd.close()
        }
        Log.i(TAG, "asset copy: ${dest.length() / 1_000_000} MB in ${System.currentTimeMillis() - start} ms")
    }

    private fun unzipToDir(zipFile: File, target: File, onProgress: (String) -> Unit) {
        val start = System.currentTimeMillis()
        onProgress("Đang giải nén…")

        var fileCount = 0
        var byteCount = 0L
        val buf = ByteArray(256 * 1024)

        ZipFile(zipFile).use { zip ->
            val entries = zip.entries()
            while (entries.hasMoreElements()) {
                val entry = entries.nextElement()
                val outFile = File(target, entry.name)
                if (entry.isDirectory) {
                    outFile.mkdirs()
                    continue
                }
                outFile.parentFile?.mkdirs()
                zip.getInputStream(entry).use { input ->
                    FileOutputStream(outFile).use { out ->
                        var n = input.read(buf)
                        while (n > 0) {
                            out.write(buf, 0, n)
                            byteCount += n
                            n = input.read(buf)
                        }
                    }
                }
                fileCount++
                if (fileCount % 2000 == 0) {
                    onProgress("Giải nén $fileCount / ~13k files (${byteCount / 1_000_000} MB)…")
                    Log.i(TAG, "unzip: $fileCount files, ${byteCount / 1_000_000} MB")
                }
            }
        }
        Log.i(TAG, "unzip done: $fileCount files, ${byteCount / 1_000_000} MB in ${System.currentTimeMillis() - start} ms")
    }

    private fun readInstalledVersion(target: File): String? {
        val f = File(target, VERSION_FILE)
        return if (f.exists()) runCatching { f.readText().trim() }.getOrNull() else null
    }
}
