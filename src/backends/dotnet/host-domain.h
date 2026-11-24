#ifndef LB_DOTNET_HOST_DOMAIN_H
#define LB_DOTNET_HOST_DOMAIN_H
#include "host-frame.h"
#ifndef LB_DN_DOMAIN_PREFIX
#error "Use the content-addressed CLR host domain ABI"
#endif
#define LB_DND_JOIN_(a,b) a##b
#define LB_DND_JOIN(a,b) LB_DND_JOIN_(a,b)
#define LB_DND(x) LB_DND_JOIN(LB_DN_DOMAIN_PREFIX,x)
#define LB_DND_API __attribute__((visibility("default")))
typedef struct { const char *key; int strong; } lb_dnd_spec;
typedef struct lb_dnd_session lb_dnd_session;
enum { DN_BOUND=0, DN_INCOMPATIBLE=1, DN_CLOSED=2, DN_ACTIVE=3, DN_DOMAIN_FATAL=4 };
LB_DND_API int LB_DND(open)(lb_dn_frame *,const char *,const lb_dnd_spec *,size_t);
LB_DND_API int LB_DND(close)(lb_dn_frame *,const char *);
LB_DND_API lb_dnd_session *LB_DND(enter)(lb_dn_frame *,const char *);
LB_DND_API void LB_DND(leave)(lb_dn_frame *,lb_dnd_session *);
LB_DND_API lean_object *LB_DND(wrap)(lb_dn_frame *,lb_dnd_session *,unsigned,uint64_t,uint64_t);
LB_DND_API uint64_t LB_DND(object)(lb_dnd_session *,unsigned,b_lean_obj_arg);
LB_DND_API uint64_t LB_DND(export)(lb_dn_frame *,lb_dnd_session *,unsigned,b_lean_obj_arg);
LB_DND_API void LB_DND(admit)(lean_object *);
LB_DND_API size_t LB_DND(live)(lb_dn_frame *);
#endif
