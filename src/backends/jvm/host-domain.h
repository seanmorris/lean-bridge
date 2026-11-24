/* Private ABI shared by JVM components using the same Lean runtime and owner. */
#ifndef LB_JVM_HOST_DOMAIN_H
#define LB_JVM_HOST_DOMAIN_H
#include "host-frame.h"
#include "io-owner.h"
#ifndef LB_JVM_DOMAIN_PREFIX
#error "A content-addressed JVM host-domain prefix is required"
#endif
#define LB_JHD(n) LB_JVM_JOIN(LB_JVM_DOMAIN_PREFIX,n)
#define LB_JHD_API __attribute__((visibility("default")))
typedef struct lb_jhd_session lb_jhd_session;
typedef struct { const char *key; int strong; } lb_jhd_spec;
LB_JHD_API int LB_JHD(open)(lb_jh_frame *, const char *component, const lb_jhd_spec *, size_t);
LB_JHD_API int LB_JHD(close)(lb_jh_frame *, const char *component);
LB_JHD_API lb_jhd_session *LB_JHD(enter)(lb_jh_frame *, const char *component);
LB_JHD_API void LB_JHD(leave)(lb_jh_frame *, lb_jhd_session *);
/* wrap returns an owned Lean reference. Admit strong pins only after all
   arguments convert, or after one valid member result has been converted. */
LB_JHD_API lean_object *LB_JHD(wrap)(lb_jh_frame *, lb_jhd_session *, unsigned, jobject, jobject anchor);
LB_JHD_API void LB_JHD(admit)(lean_object *);
LB_JHD_API jobject LB_JHD(object)(lb_jh_frame *, lb_jhd_session *, unsigned, b_lean_obj_arg);
LB_JHD_API size_t LB_JHD(live)(lb_jh_frame *);
#endif
