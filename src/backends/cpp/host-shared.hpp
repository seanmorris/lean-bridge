// Private Linux C++ object-domain ABI. Only matching generated components link it.
#ifndef LB_CPP_HOST_SHARED_HPP
#define LB_CPP_HOST_SHARED_HPP
#include <memory>
extern "C" {
#include "host-registry.h"
}
#ifndef LB_CPP_OWNER_PREFIX
#error "Select the runtime-qualified C++ object owner ABI"
#endif
#define LB_CPP_OWNER(n) LB_CR_JOIN(LB_CPP_OWNER_PREFIX,n)
extern "C" {
LB_CR_API int LB_CPP_OWNER(pin)(const char *,const std::shared_ptr<void> *,lb_cr_ref *) noexcept;
LB_CR_API int LB_CPP_OWNER(share)(const char *,lb_cr_ref,std::shared_ptr<void> *) noexcept;
}
#endif
