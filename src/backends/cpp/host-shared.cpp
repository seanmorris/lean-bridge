#include "host-shared.hpp"
#include <cstring>
#include <new>
#include <sys/syscall.h>
#include <unistd.h>

namespace {
// The C registry owns the box; the box owns precisely one shared_ptr. The
// intrusive index does not extend that lifetime or run application destructors
// during static destruction. Index access is restricted to the process owner.
struct box {
    std::shared_ptr<void> value;
    void *address;
    char key[65];
    box *next;
    bool retiring;
};
box *live=nullptr;
pid_t origin=0;
bool owner() noexcept {
    const pid_t p=getpid();
    if(p!=static_cast<pid_t>(syscall(SYS_gettid)) || (origin && origin!=p)) return false;
    origin=p; return true;
}
void destroy(void *raw) noexcept {
    auto *b=static_cast<box *>(raw);
    b->retiring=true;
    b->value.reset(); // Application deleters can re-enter and change the index.
    box **cursor=&live;
    while(*cursor!=b) cursor=&(*cursor)->next;
    *cursor=b->next; delete b;
}
void dispose(lb_cr_fn fn,void *ptr) noexcept {
    reinterpret_cast<void(*)(void *)>(fn)(ptr);
}
}

int LB_CPP_OWNER(pin)(const char *key,const std::shared_ptr<void> *p,lb_cr_ref *out) noexcept {
    if(!owner()) return CR_UNAVAILABLE;
    if(!key || std::strlen(key)!=64 || std::strspn(key,"0123456789abcdef")!=64 ||
       !p || !p->get() || !p->use_count() || !out || out->domain || out->ticket) return CR_INVALID;
    for(box *b=live;b;b=b->next) {
        if(b->address!=p->get()) continue;
        if(b->retiring || std::strcmp(b->key,key) || b->value.owner_before(*p) || p->owner_before(b->value))
            return CR_INVALID;
        return LB_CR(adopt)(key,b,reinterpret_cast<lb_cr_fn>(destroy),dispose,out);
    }
    auto *b=new(std::nothrow) box{*p,p->get(),{},live,false};
    if(!b) return CR_LIMIT;
    std::memcpy(b->key,key,65);
    const int rc=LB_CR(adopt)(key,b,reinterpret_cast<lb_cr_fn>(destroy),dispose,out);
    if(rc==CR_OK) live=b; else delete b;
    return rc;
}
int LB_CPP_OWNER(share)(const char *key,lb_cr_ref ref,std::shared_ptr<void> *out) noexcept {
    if(!owner()) return CR_UNAVAILABLE;
    if(!out || out->get() || out->use_count()) return CR_INVALID;
    void *raw=nullptr; const int rc=LB_CR(get)(key,ref,&raw);
    if(rc!=CR_OK) return rc;
    // A valid registry ticket alone is not evidence of a C++ shared owner.
    for(box *b=live;b;b=b->next) if(b==raw && !b->retiring && !std::strcmp(b->key,key)) {
        *out=b->value; return CR_OK;
    }
    return CR_INVALID;
}
