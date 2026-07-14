// JNI glue that starts the Node.js runtime inside the app process.
//
// nodejs-mobile ships libnode.so with `node::Start(int argc, char** argv)` as
// the entry point. This shim marshals a Java String[] into argv and forwards
// the call.
//
// stdout/stderr are redirected to logcat via a background pipe so console.log
// from the embedded API shows up in `adb logcat`.

#include <jni.h>
#include <android/log.h>
#include <fcntl.h>
#include <unistd.h>
#include <string.h>
#include <errno.h>
#include <cstdlib>
#include <cstdio>
#include <string>
#include <vector>

#include "node.h"

#define LOG_TAG "LiteERPNode"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

// --- stdout/stderr → log file ------------------------------------------------
//
// A pipe+drain-thread redirect to logcat deadlocks in practice: when the drain
// threads die (observed FORTIFY mutex aborts), the 64 KB pipe fills and Node's
// next synchronous write() blocks the runtime forever. A plain file via dup2
// has no reader to die — Java tails the file for diagnostics instead.

static void redirect_stdio_to_file() {
    const char* logPath = getenv("NODE_STDIO_LOG");
    if (logPath == nullptr || logPath[0] == '\0') return;
    int fd = open(logPath, O_WRONLY | O_CREAT | O_TRUNC, 0600);
    if (fd < 0) {
        LOGE("cannot open NODE_STDIO_LOG %s: %s", logPath, strerror(errno));
        return;
    }
    setvbuf(stdout, nullptr, _IOLBF, 0);
    setvbuf(stderr, nullptr, _IONBF, 0);
    dup2(fd, STDOUT_FILENO);
    dup2(fd, STDERR_FILENO);
    if (fd > STDERR_FILENO) close(fd);
    LOGI("node stdout/stderr → %s", logPath);
}

// --- JNI ---------------------------------------------------------------------

extern "C" JNIEXPORT void JNICALL
Java_com_liteerp_app_NodeBridge_setEnv(
        JNIEnv* env,
        jclass /* clazz */,
        jstring key,
        jstring value) {
    const char* k = env->GetStringUTFChars(key, nullptr);
    const char* v = env->GetStringUTFChars(value, nullptr);
    setenv(k, v, 1);
    env->ReleaseStringUTFChars(key, k);
    env->ReleaseStringUTFChars(value, v);
}

extern "C" JNIEXPORT jint JNICALL
Java_com_liteerp_app_NodeBridge_startNodeWithArguments(
        JNIEnv* env,
        jclass /* clazz */,
        jobjectArray arguments) {
    redirect_stdio_to_file();

    const jsize argc = env->GetArrayLength(arguments);
    if (argc <= 0) {
        LOGE("startNodeWithArguments called with empty argv");
        return -1;
    }

    // Copy each jstring into a C string owned by our vector. Node needs a
    // contiguous char** so we build (argv[0..argc], nullptr).
    std::vector<std::string> owned;
    owned.reserve(argc);
    std::vector<char*> argv;
    argv.reserve(argc + 1);

    for (jsize i = 0; i < argc; ++i) {
        auto jstr = (jstring)env->GetObjectArrayElement(arguments, i);
        const char* raw = env->GetStringUTFChars(jstr, nullptr);
        owned.emplace_back(raw);
        env->ReleaseStringUTFChars(jstr, raw);
        env->DeleteLocalRef(jstr);
        argv.push_back(owned.back().data());
    }
    argv.push_back(nullptr);

    LOGI("starting node with %d args, entry=%s", argc, argv[argc > 1 ? 1 : 0]);
    int rc = node::Start(argc, argv.data());
    LOGI("node exited with code %d", rc);
    return rc;
}
