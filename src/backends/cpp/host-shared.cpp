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
    const std::type_info *type;
};
struct claim { char key[65]; const std::type_info *type; unsigned users; claim *next; };
claim *claims=nullptr;
bool key_ok(const char *s) noexcept {
    return s && std::strlen(s)==64 && std::strspn(s,"0123456789abcdef")==64;
}
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
    *cursor=b->next;
    if(b->type) LB_CPP_OWNER(unbind_type)(b->key,b->type);
    delete b;
}
void dispose(lb_cr_fn fn,void *ptr) noexcept {
    reinterpret_cast<void(*)(void *)>(fn)(ptr);
}
}

static int pin(const char *key,const std::type_info *type,const std::shared_ptr<void> *p,lb_cr_ref *out) noexcept {
    if(!owner()) return CR_UNAVAILABLE;
    if(!key || std::strlen(key)!=64 || std::strspn(key,"0123456789abcdef")!=64 ||
       !p || !p->get() || !p->use_count() || !out || out->domain || out->ticket) return CR_INVALID;
    for(box *b=live;b;b=b->next) {
        if(b->address!=p->get()) continue;
        if(b->retiring || std::strcmp(b->key,key) || bool(type)!=bool(b->type) || (type && *type!=*b->type) || b->value.owner_before(*p) || p->owner_before(b->value))
            return CR_INVALID;
        return LB_CR(adopt)(key,b,reinterpret_cast<lb_cr_fn>(destroy),dispose,out);
    }
    auto *b=new(std::nothrow) box{*p,p->get(),{},live,false,type};
    if(!b) return CR_LIMIT;
    if(type) { int code=LB_CPP_OWNER(bind_type)(key,type); if(code!=CR_OK) { delete b; return code; } }
    std::memcpy(b->key,key,65);
    const int rc=LB_CR(adopt)(key,b,reinterpret_cast<lb_cr_fn>(destroy),dispose,out);
    if(rc==CR_OK) live=b; else { if(type) LB_CPP_OWNER(unbind_type)(key,type); delete b; }
    return rc;
}
static int share(const char *key,const std::type_info *type,lb_cr_ref ref,std::shared_ptr<void> *out) noexcept {
    if(!owner()) return CR_UNAVAILABLE;
    if(!out || out->get() || out->use_count()) return CR_INVALID;
    void *raw=nullptr; const int rc=LB_CR(get)(key,ref,&raw);
    if(rc!=CR_OK) return rc;
    // A valid registry ticket alone is not evidence of a C++ shared owner.
    for(box *b=live;b;b=b->next) if(b==raw && !b->retiring && !std::strcmp(b->key,key)) {
        if(bool(type)!=bool(b->type) || (type && *type!=*b->type)) return CR_INVALID;
        *out=b->value; return CR_OK;
    }
    return CR_INVALID;
}
int LB_CPP_OWNER(pin)(const char *key,const std::shared_ptr<void> *p,lb_cr_ref *out) noexcept { return pin(key,nullptr,p,out); }
int LB_CPP_OWNER(share)(const char *key,lb_cr_ref r,std::shared_ptr<void> *out) noexcept { return share(key,nullptr,r,out); }
int LB_CPP_OWNER(bind_type)(const char *key,const std::type_info *type) noexcept {
    if(!owner()) return CR_UNAVAILABLE;
    if(!key_ok(key) || !type) return CR_INVALID;
    for(claim *c=claims;c;c=c->next) if(!std::strcmp(c->key,key)) {
        if(*c->type!=*type) return CR_INVALID;
        if(c->users==UINT32_MAX) return CR_LIMIT;
        ++c->users; return CR_OK;
    }
    auto *c=new(std::nothrow) claim{{},type,1,claims}; if(!c) return CR_LIMIT;
    std::memcpy(c->key,key,65); claims=c; return CR_OK;
}
int LB_CPP_OWNER(unbind_type)(const char *key,const std::type_info *type) noexcept {
    if(!owner()) return CR_UNAVAILABLE;
    if(!key_ok(key) || !type) return CR_INVALID;
    for(claim **at=&claims;*at;at=&(*at)->next) if(!std::strcmp((*at)->key,key)) {
        claim *c=*at; if(*c->type!=*type) return CR_INVALID;
        if(!--c->users) { *at=c->next; delete c; } return CR_OK;
    }
    return CR_STALE;
}
int LB_CPP_OWNER(pin_typed)(const char *key,const std::type_info *type,const std::shared_ptr<void> *p,uint64_t *words) noexcept {
    if(!words || words[0] || words[1] || !type) return CR_INVALID;
    lb_cr_ref out{}; int rc=pin(key,type,p,&out);
    if(rc==CR_OK) {words[0]=out.domain; words[1]=out.ticket;} return rc;
}
int LB_CPP_OWNER(share_typed)(const char *key,const std::type_info *type,const uint64_t *words,std::shared_ptr<void> *out) noexcept {
    if(!words || !type) return CR_INVALID;
    return share(key,type,{words[0],words[1]},out);
}
