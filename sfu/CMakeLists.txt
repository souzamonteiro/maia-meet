cmake_minimum_required(VERSION 3.20)
project(maia_sfu VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(maia-sfu src/main.cpp)
target_include_directories(maia-sfu PRIVATE include)

target_compile_options(maia-sfu PRIVATE -Wall -Wextra -Wpedantic)
