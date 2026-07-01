# ARCHITECTURE_ANDROID.md

# Computer Refurbishment Mobile App Architecture

> Kiến trúc Android APK app cho hệ thống quản lý cửa hàng máy tính cũ, linh kiện, kho, lắp ráp, bán hàng và bảo hành.

---

# 1. Mục tiêu

Ứng dụng Android dùng cho nhân viên cửa hàng thao tác nhanh trên điện thoại hoặc máy tính bảng.

App phục vụ các nghiệp vụ:

* Đăng nhập nhân viên
* Quét mã QR / barcode linh kiện
* Nhập máy cũ
* Kiểm tra máy
* Tháo máy
* Nhập kho linh kiện
* Kiểm tra tồn kho
* Lắp ráp máy
* Bán hàng
* Bảo hành
* Chụp ảnh linh kiện / hóa đơn
* Đồng bộ dữ liệu với server online

---

# 2. Kiến trúc tổng thể

```text
Android App
    │
    ▼
REST API / HTTPS
    │
    ▼
Backend Server
    │
    ├── PostgreSQL Database
    ├── Redis Queue
    ├── Object Storage
    └── Monitoring / Logging
```

App Android không nên tự lưu dữ liệu chính vĩnh viễn.

Dữ liệu chính nằm ở backend server.

App chỉ lưu:

* Token đăng nhập
* Cache tạm
* Dữ liệu offline tạm thời nếu mất mạng
* Ảnh chờ upload
* Queue thao tác chưa đồng bộ

---

# 3. Công nghệ đề xuất

## Android

```text
Android Studio
Kotlin
Jetpack Compose
Material 3
Gradle Kotlin DSL
Min SDK 26
Target SDK 35
```

## Architecture Pattern

```text
MVVM
Clean Architecture
Repository Pattern
Use Case Layer
```

## Networking

```text
Retrofit
OkHttp
Kotlinx Serialization hoặc Moshi
```

## Local Storage

```text
Room Database
DataStore
EncryptedSharedPreferences
```

## Async

```text
Kotlin Coroutines
Flow
WorkManager
```

## Camera / QR

```text
CameraX
ML Kit Barcode Scanning
```

## Dependency Injection

```text
Hilt
```

## Image Loading

```text
Coil
```

---

# 4. Cấu hình Android Studio

## Project Settings

```text
Language: Kotlin
UI: Jetpack Compose
Build configuration: Kotlin DSL
Minimum SDK: 26
Target SDK: 35
Compile SDK: 35
```

## Package name

```text
com.pcstore.refurb
```

## App name

```text
PC Refurb
```

## Version

```text
versionCode 1
versionName "1.0.0"
```

---

# 5. Gradle cấu hình đề xuất

## settings.gradle.kts

```kotlin
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "PCRefurb"
include(":app")
```

---

## build.gradle.kts cấp project

```kotlin
plugins {
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.0.21" apply false
    id("com.google.dagger.hilt.android") version "2.52" apply false
    id("com.google.devtools.ksp") version "2.0.21-1.0.25" apply false
}
```

---

## app/build.gradle.kts

```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.google.dagger.hilt.android")
    id("com.google.devtools.ksp")
}

android {
    namespace = "com.pcstore.refurb"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.pcstore.refurb"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            buildConfigField("String", "BASE_URL", "\"https://api-dev.example.com/api/v1/\"")
        }

        release {
            isMinifyEnabled = true
            isShrinkResources = true
            buildConfigField("String", "BASE_URL", "\"https://api.example.com/api/v1/\"")

            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.15"
    }

    kotlin {
        jvmToolchain(17)
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.10.01"))

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.6")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.6")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")

    implementation("androidx.navigation:navigation-compose:2.8.3")

    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.jakewharton.retrofit:retrofit2-kotlinx-serialization-converter:1.0.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    implementation("androidx.datastore:datastore-preferences:1.1.1")

    implementation("androidx.work:work-runtime-ktx:2.9.1")

    implementation("com.google.dagger:hilt-android:2.52")
    ksp("com.google.dagger:hilt-android-compiler:2.52")

    implementation("io.coil-kt:coil-compose:2.7.0")

    implementation("androidx.camera:camera-core:1.3.4")
    implementation("androidx.camera:camera-camera2:1.3.4")
    implementation("androidx.camera:camera-lifecycle:1.3.4")
    implementation("androidx.camera:camera-view:1.3.4")

    implementation("com.google.mlkit:barcode-scanning:17.3.0")
}
```

---

# 6. Cấu trúc thư mục app

```text
app/src/main/java/com/pcstore/refurb/
│
├── MainActivity.kt
├── PCRefurbApplication.kt
│
├── core/
│   ├── common/
│   ├── config/
│   ├── network/
│   ├── database/
│   ├── datastore/
│   ├── security/
│   ├── sync/
│   └── ui/
│
├── data/
│   ├── auth/
│   ├── purchase/
│   ├── machine/
│   ├── component/
│   ├── inventory/
│   ├── assembly/
│   ├── sale/
│   ├── warranty/
│   └── report/
│
├── domain/
│   ├── model/
│   ├── repository/
│   └── usecase/
│
├── feature/
│   ├── auth/
│   ├── dashboard/
│   ├── purchase/
│   ├── machine_inspection/
│   ├── disassembly/
│   ├── inventory/
│   ├── assembly/
│   ├── sale/
│   ├── warranty/
│   ├── scanner/
│   └── settings/
│
└── navigation/
```

---

# 7. Clean Architecture

```text
UI Layer
    ↓
ViewModel
    ↓
Use Case
    ↓
Repository Interface
    ↓
Repository Implementation
    ↓
Remote API / Local Database
```

Nguyên tắc:

* UI không gọi Retrofit trực tiếp.
* ViewModel không biết API implementation.
* Repository quyết định lấy dữ liệu từ server hay cache.
* Use Case chứa logic nghiệp vụ.
* Domain model không phụ thuộc Android framework.

---

# 8. Các màn hình chính

```text
LoginScreen
DashboardScreen
PurchaseListScreen
PurchaseCreateScreen
MachineInspectionScreen
DisassemblyScreen
ComponentListScreen
ComponentDetailScreen
ScannerScreen
AssemblyCreateScreen
FinishedPcListScreen
SaleCreateScreen
WarrantyListScreen
WarrantyDetailScreen
SettingsScreen
```

---

# 9. Navigation

Sử dụng Navigation Compose.

```text
/login
/dashboard
/purchases
/purchases/create
/machines/{id}/inspect
/machines/{id}/disassemble
/components
/components/{id}
/scanner
/assemblies/create
/finished-pcs
/sales/create
/warranties
/warranties/{id}
/settings
```

---

# 10. Authentication Flow

```text
User nhập email/password
        ↓
POST /auth/login
        ↓
Nhận accessToken + refreshToken
        ↓
Lưu token an toàn
        ↓
Đi vào Dashboard
```

Token lưu trong:

```text
EncryptedSharedPreferences
hoặc
DataStore + encryption layer
```

Mỗi API request gắn:

```text
Authorization: Bearer <access_token>
```

Nếu access token hết hạn:

```text
OkHttp Authenticator gọi /auth/refresh
```

Nếu refresh token hết hạn:

```text
Logout user
```

---

# 11. API Client

```kotlin
interface AuthApi {
    @POST("auth/login")
    suspend fun login(
        @Body request: LoginRequest
    ): LoginResponse

    @POST("auth/refresh")
    suspend fun refresh(
        @Body request: RefreshTokenRequest
    ): LoginResponse
}
```

```kotlin
interface ComponentApi {
    @GET("components")
    suspend fun getComponents(
        @Query("keyword") keyword: String?,
        @Query("status") status: String?,
        @Query("page") page: Int,
        @Query("limit") limit: Int
    ): PageResponse<ComponentDto>

    @GET("components/{id}")
    suspend fun getComponent(
        @Path("id") id: String
    ): ComponentDto
}
```

---

# 12. Local Database

Room dùng để cache và hỗ trợ offline.

Bảng local:

```text
cached_components
cached_finished_pcs
cached_customers
pending_sync_actions
offline_attachments
```

Không dùng Room làm nguồn dữ liệu chính.

Server vẫn là source of truth.

---

# 13. Offline Mode

App cần hỗ trợ mất mạng ở mức cơ bản.

Cho phép offline:

* Xem dữ liệu đã cache
* Quét mã linh kiện
* Tạo phiếu kiểm tra tạm
* Chụp ảnh tạm
* Lưu thao tác chờ đồng bộ

Không nên cho offline:

* Bán hàng
* Xác nhận tháo máy
* Hoàn tất lắp ráp
* Hủy đơn
* Thay linh kiện bảo hành

Lý do: các thao tác này ảnh hưởng trực tiếp tồn kho và cần tránh trùng dữ liệu.

---

# 14. Sync Architecture

```text
User tạo thao tác offline
        ↓
Lưu vào pending_sync_actions
        ↓
WorkManager chạy khi có mạng
        ↓
Gửi request lên server
        ↓
Server xác nhận
        ↓
Xóa pending action
```

Mỗi pending action cần:

```text
id
type
payload_json
created_at
retry_count
last_error
status
```

---

# 15. QR / Barcode Flow

```text
Mở ScannerScreen
        ↓
CameraX bật camera
        ↓
ML Kit detect mã
        ↓
App parse code
        ↓
Gọi API tìm linh kiện / máy
        ↓
Mở màn hình chi tiết
```

Mã QR đề xuất:

```text
COMPONENT:RAM000001
MACHINE:PC000001
FINISHED_PC:PCSALE0001
SALE:SO000001
```

---

# 16. Camera Upload Flow

```text
Người dùng chụp ảnh
        ↓
Compress ảnh
        ↓
Request signed upload URL từ server
        ↓
Upload ảnh lên S3
        ↓
Gửi metadata về server
```

Nếu mất mạng:

```text
Lưu ảnh vào offline_attachments
Đồng bộ lại bằng WorkManager
```

---

# 17. State Management

Mỗi màn hình dùng:

```text
UiState
UiEvent
UiEffect
```

Ví dụ:

```kotlin
data class ComponentListUiState(
    val isLoading: Boolean = false,
    val keyword: String = "",
    val components: List<Component> = emptyList(),
    val errorMessage: String? = null
)
```

---

# 18. Error Handling

Phân loại lỗi:

```text
NetworkError
UnauthorizedError
ForbiddenError
ValidationError
ConflictError
ServerError
UnknownError
```

Hiển thị lỗi tiếng Việt cho người dùng.

Ví dụ:

```text
Không có mạng
Phiên đăng nhập đã hết hạn
Bạn không có quyền thực hiện thao tác này
Linh kiện không còn trong kho
Máy chưa sẵn sàng để bán
```

---

# 19. Permission Handling

App phải kiểm tra permission trước khi hiển thị nút.

Ví dụ:

```text
purchase:create
machine:inspect
machine:disassemble
component:view
assembly:create
sale:create
warranty:update
report:view
```

Không có quyền thì ẩn hoặc disable chức năng.

Backend vẫn phải kiểm tra lại.

---

# 20. Android Permissions

Trong `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />

<uses-permission android:name="android.permission.CAMERA" />

<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

Nếu Android 13 trở lên, cần xin quyền notification runtime.

---

# 21. AndroidManifest.xml

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application
        android:name=".PCRefurbApplication"
        android:allowBackup="false"
        android:label="PC Refurb"
        android:theme="@style/Theme.PCRefurb">

        <activity
            android:name=".MainActivity"
            android:exported="true">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />

                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

        </activity>

    </application>

</manifest>
```

---

# 22. Build Variants

Cần có ít nhất 2 môi trường:

```text
debug
release
```

Có thể thêm:

```text
staging
production
```

Ví dụ:

```text
Debug app:
com.pcstore.refurb.debug

Production app:
com.pcstore.refurb
```

---

# 23. ProGuard Rules

```proguard
-keep class kotlinx.serialization.** { *; }
-keep class com.pcstore.refurb.**Dto { *; }
-keep class retrofit2.** { *; }
-keep class okhttp3.** { *; }
-dontwarn okhttp3.**
-dontwarn retrofit2.**
```

---

# 24. Build APK

## Debug APK

```bash
./gradlew assembleDebug
```

File output:

```text
app/build/outputs/apk/debug/app-debug.apk
```

## Release APK

```bash
./gradlew assembleRelease
```

File output:

```text
app/build/outputs/apk/release/app-release.apk
```

---

# 25. Signing Release APK

Tạo keystore:

```bash
keytool -genkeypair \
  -v \
  -keystore pc-refurb-release.keystore \
  -alias pc-refurb \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Tạo file:

```text
keystore.properties
```

```properties
storeFile=../pc-refurb-release.keystore
storePassword=your_store_password
keyAlias=pc-refurb
keyPassword=your_key_password
```

Không commit file này lên Git.

---

# 26. Release Signing Config

Trong `app/build.gradle.kts`:

```kotlin
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("keystore.properties")

if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        create("release") {
            storeFile = file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["storePassword"] as String
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["keyPassword"] as String
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            isShrinkResources = true
        }
    }
}
```

---

# 27. Bảo mật APK

Yêu cầu:

* Không hard-code mật khẩu.
* Không hard-code secret key.
* Không lưu token dạng plain text.
* Bắt buộc HTTPS.
* Có certificate pinning nếu cần bảo mật cao.
* Bật minify cho release.
* Không log token.
* Không log thông tin khách hàng.
* Chặn backup dữ liệu nhạy cảm.
* Kiểm tra thiết bị root nếu cần.

---

# 28. Logging

Debug build:

```text
Cho phép log API basic
```

Release build:

```text
Không log body request chứa dữ liệu nhạy cảm
Không log token
Gửi crash log lên server nếu có
```

Có thể dùng:

```text
Firebase Crashlytics
Sentry
```

---

# 29. Performance

Yêu cầu:

* Mở app dưới 3 giây.
* Danh sách linh kiện phải phân trang.
* Ảnh phải resize trước khi upload.
* Không load toàn bộ kho cùng lúc.
* Scanner phải phản hồi nhanh.
* Cache danh mục linh kiện.
* Dashboard nên cache ngắn hạn.

---

# 30. Testing

Cần test:

```text
Unit test
ViewModel test
Repository test
API error test
Room migration test
UI test
Scanner test
Offline sync test
```

Công cụ:

```text
JUnit
MockK
Turbine
Robolectric
Compose UI Test
```

---

# 31. CI/CD cho APK

Pipeline:

```text
Push code
    ↓
Lint
    ↓
Unit test
    ↓
Build debug APK
    ↓
Build release APK
    ↓
Upload artifact
```

Có thể dùng:

```text
GitHub Actions
GitLab CI
Bitrise
Codemagic
```

---

# 32. GitHub Actions Example

```yaml
name: Android CI

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up JDK
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17

      - name: Grant execute permission
        run: chmod +x ./gradlew

      - name: Run tests
        run: ./gradlew test

      - name: Build Debug APK
        run: ./gradlew assembleDebug

      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: debug-apk
          path: app/build/outputs/apk/debug/app-debug.apk
```

---

# 33. App Module MVP

Phiên bản APK đầu tiên nên có:

```text
Login
Dashboard
Quét QR
Danh sách linh kiện
Chi tiết linh kiện
Nhập máy cũ
Kiểm tra máy
Tháo máy
Lắp ráp máy
Bán hàng cơ bản
Bảo hành cơ bản
Đồng bộ dữ liệu
```

---

# 34. App không nên làm ở MVP

Chưa nên làm ngay:

```text
Offline bán hàng phức tạp
Đa chi nhánh nâng cao
Chat nội bộ
AI định giá
Kế toán đầy đủ
Thông báo real-time phức tạp
```

---

# 35. Backend API yêu cầu cho Android

Android cần các API chính:

```text
POST /auth/login
POST /auth/refresh
GET /me

GET /dashboard/mobile

GET /components
GET /components/{id}
GET /components/by-code/{code}

POST /purchases
POST /machines/{id}/inspect
POST /machines/{id}/disassemble

POST /assemblies
POST /assemblies/{id}/complete

POST /sales
POST /warranties

POST /uploads/signed-url
POST /attachments
```

---

# 36. Kết luận

Kiến trúc Android app phù hợp nhất:

```text
Kotlin
Jetpack Compose
MVVM
Clean Architecture
Retrofit
Room
DataStore
Hilt
WorkManager
CameraX
ML Kit Barcode
```

App Android nên là công cụ thao tác nhanh cho nhân viên, còn dữ liệu chính vẫn nằm ở server.

Nguyên tắc quan trọng:

```text
Server là nguồn dữ liệu chính
App chỉ cache và thao tác
Mọi giao dịch kho quan trọng phải xác nhận qua API
Không bán hàng offline nếu chưa có cơ chế chống trùng tồn kho
QR / barcode là chức năng trọng tâm
```
