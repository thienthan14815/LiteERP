cmake_minimum_required(VERSION 3.22.1)
project("liteerp_native")

# Prebuilt libnode.so (nodejs-mobile v18.20.4).
add_library(libnode SHARED IMPORTED)
set_target_properties(libnode PROPERTIES IMPORTED_LOCATION
    ${CMAKE_SOURCE_DIR}/libnode/bin/${ANDROID_ABI}/libnode.so)

# Node's public C++ headers.
include_directories(${CMAKE_SOURCE_DIR}/libnode/include/node/)

# JNI shim — invokes node::Start(argc, argv).
add_library(native-lib SHARED src/main/cpp/native-lib.cpp)

find_library(log-lib log)

target_link_libraries(native-lib libnode ${log-lib})
