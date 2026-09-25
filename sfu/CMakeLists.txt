cmake_minimum_required(VERSION 3.20)
project(maia-sfu VERSION 1.0.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

include(FetchContent)

# libjuice
FetchContent_Declare(
    libjuice
    GIT_REPOSITORY https://github.com/paullouisageneau/libjuice.git
    GIT_TAG v1.4.2
)
FetchContent_MakeAvailable(libjuice)

# nlohmann_json
FetchContent_Declare(
    nlohmann_json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG v3.11.3
)
FetchContent_MakeAvailable(nlohmann_json)

# cpp-httplib
FetchContent_Declare(
    cpp-httplib
    GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
    GIT_TAG v0.18.7
)
FetchContent_MakeAvailable(cpp-httplib)

find_package(OpenSSL REQUIRED)
find_package(Threads REQUIRED)

find_library(LIBSRTP2_LIBRARY NAMES srtp2 srtp REQUIRED)
find_path(LIBSRTP2_INCLUDE_DIR NAMES srtp2/srtp.h REQUIRED)

add_executable(maia-sfu)

file(GLOB SOURCES "src/*.cpp")
target_sources(maia-sfu PRIVATE ${SOURCES})

target_include_directories(maia-sfu PRIVATE
    include
    ${LIBSRTP2_INCLUDE_DIR}
    ${libjuice_SOURCE_DIR}/include   # expose juice/juice.h
)

target_link_libraries(maia-sfu PRIVATE
    juice                            # real CMake target name (not libjuice)
    nlohmann_json::nlohmann_json
    httplib::httplib
    OpenSSL::SSL
    OpenSSL::Crypto
    ${LIBSRTP2_LIBRARY}
    Threads::Threads
)

target_compile_options(maia-sfu PRIVATE -Wall -Wextra -Wpedantic)

if(CMAKE_BUILD_TYPE STREQUAL "Debug")
    target_compile_options(maia-sfu PRIVATE -fsanitize=address,undefined)
    target_link_options(maia-sfu PRIVATE -fsanitize=address,undefined)
endif()
