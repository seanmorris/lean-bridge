/* Reuse the exact existing wasm32 scalar and copied-value implementation.
   In this private pthread link only the three leaf codecs used by host calls
   are needed. Do not publish the synchronous heap's other dispatch ABIs. */
#include <emscripten/emscripten.h>
#undef EMSCRIPTEN_KEEPALIVE
#define EMSCRIPTEN_KEEPALIVE
#include "component_scalar.cpp"
