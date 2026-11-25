/* Private scalar helpers, including length-delimited (not NUL-terminated) UTF-8. */
static inline int lb_charge(const void *ptr,size_t n,size_t unit,size_t *used) {
    const size_t max=16u*1024u*1024u;
    if((n && !ptr) || n>(max-*used)/unit) return 0;
    *used+=n*unit; return 1;
}
static inline int lb_utf8(const uint8_t *p,size_t len) {
    for(size_t i=0;i<len;) {
        unsigned a=p[i++]; if(a<128) continue;
        unsigned n=a<224?1:a<240?2:3;
        if(a<194 || a>244 || n>len-i) return 0;
        unsigned b=p[i];
        if((a==224 && b<160) || (a==237 && b>=160) || (a==240 && b<144) || (a==244 && b>=144)) return 0;
        while(n--) if((p[i++]&192)!=128) return 0;
    }
    return 1;
}
static inline uint32_t lb_f32(float f) { uint32_t u; memcpy(&u,&f,4); return u; }
static inline uint64_t lb_f64(double f) { uint64_t u; memcpy(&u,&f,8); return u; }
static inline float lb_get_f32(uint64_t w) { uint32_t u=(uint32_t)w; float f; memcpy(&f,&u,4); return f; }
static inline double lb_get_f64(uint64_t u) { double f; memcpy(&f,&u,8); return f; }
