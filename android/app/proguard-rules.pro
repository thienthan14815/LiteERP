# Add project specific ProGuard rules here.

# WebView + JS bridges: Capacitor exposes Java -> JS via reflection/JS interfaces,
# nên cần giữ class & method gốc của runtime.
-keep class com.getcapacitor.** { *; }
-keep class com.getcapacitor.plugin.** { *; }
-keep class com.capacitorjs.** { *; }
-keep class * extends com.getcapacitor.Plugin
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.annotation.CapacitorPlugin <fields>;
    @com.getcapacitor.PluginMethod <methods>;
}

# Cordova compatibility shim do Capacitor sinh ra.
-keep class org.apache.cordova.** { *; }

# JavaScript interfaces (annotated với @JavascriptInterface)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Giữ stack trace dễ debug ANR / crash production.
-keepattributes SourceFile,LineNumberTable
