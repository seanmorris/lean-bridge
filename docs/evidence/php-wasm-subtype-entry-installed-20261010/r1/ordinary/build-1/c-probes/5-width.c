#include <php.h>
#include <lean/lean.h>
_Static_assert(sizeof(void *) == 4 && sizeof(size_t) == 4 && sizeof(zend_long) == 4, "PHP-Wasm requires wasm32");
_Static_assert(PHP_VERSION_ID == 80401, "PHP headers must match PHP-Wasm 8.4.1");
