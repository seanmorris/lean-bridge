#include <stdint.h>
typedef struct {
    uint32_t (*call)(void *, const void *, void *);
    void *context;
} php_recursive_callback;
uint32_t php_recursive_forward(const php_recursive_callback *callback, const void *input, void *output) {
    if (!callback || !callback->call || !input || !output) return 1;
    return callback->call(callback->context,input,output);
}
uint32_t php_recursive_twice(const php_recursive_callback *callback, const void *input, void *output) {
    uint32_t first = php_recursive_forward(callback,input,output);
    uint32_t second = php_recursive_forward(callback,input,output);
    return first ? first : second;
}
