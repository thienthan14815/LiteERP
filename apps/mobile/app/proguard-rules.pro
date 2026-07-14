# Keep Node runtime JNI hooks — libnode.so binds by JNI class + method name.
-keep class org.nodejs.mobile.** { *; }
-keep class com.liteerp.app.NodeBridge { *; }
