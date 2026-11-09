#!/usr/bin/env bash
# Cross-compiles the two Windows llama-server builds Crow Companion ships (on Linux, mingw-w64 posix):
#   vendor/llama/win32-x64/llama-server.exe         AVX2/FMA/F16C (most PCs since ~2013)
#   vendor/llama/win32-x64/llama-server-compat.exe  SSE4.2 only, tried when the first one can't start
# Fully static: the exes only import KERNEL32, ADVAPI32, WS2_32 and msvcrt.
set -euo pipefail
PIN=12e9084dc1c88fe73bdd2886723b4b8b7d790be8
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
WORK="${CROW_LLAMA_WORK:-$REPO/.llama-build}"
OUT="$REPO/vendor/llama/win32-x64"
mkdir -p "$WORK" "$OUT"
if [ ! -d "$WORK/llama.cpp/.git" ]; then git clone https://github.com/ggml-org/llama.cpp "$WORK/llama.cpp"; fi
git -C "$WORK/llama.cpp" fetch --depth 1 origin "$PIN" 2>/dev/null || true
git -C "$WORK/llama.cpp" checkout --detach "$PIN"
COMMON=(-G Ninja -DCMAKE_TOOLCHAIN_FILE="$HERE/mingw.cmake" -DCMAKE_BUILD_TYPE=Release -DGGML_NATIVE=OFF -DGGML_BMI2=OFF
  -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF -DLLAMA_CURL=OFF -DLLAMA_OPENSSL=OFF -DGGML_CCACHE=OFF -DGGML_OPENMP=OFF
  -DBUILD_SHARED_LIBS=OFF "-DCMAKE_EXE_LINKER_FLAGS=-static -static-libgcc -static-libstdc++")
cmake -S "$WORK/llama.cpp" -B "$WORK/build-avx2" "${COMMON[@]}" -DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON
cmake --build "$WORK/build-avx2" --target llama-server -j"${JOBS:-3}"
cmake -S "$WORK/llama.cpp" -B "$WORK/build-compat" "${COMMON[@]}" -DGGML_AVX=OFF -DGGML_AVX2=OFF -DGGML_FMA=OFF -DGGML_F16C=OFF -DGGML_SSE42=ON
cmake --build "$WORK/build-compat" --target llama-server -j"${JOBS:-3}"
x86_64-w64-mingw32-strip -o "$OUT/llama-server.exe" "$WORK/build-avx2/bin/llama-server.exe"
x86_64-w64-mingw32-strip -o "$OUT/llama-server-compat.exe" "$WORK/build-compat/bin/llama-server.exe"
cp "$WORK/llama.cpp/LICENSE" "$OUT/LICENSE-llama.cpp.txt"
echo "llama.cpp $PIN" > "$OUT/VERSION.txt"
sha256sum "$OUT"/*.exe
