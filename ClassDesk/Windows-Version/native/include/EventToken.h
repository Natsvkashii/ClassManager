// EventRegistrationToken for WebView2.h: the Windows SDK header that newer zig/mingw-w64 releases no longer ship.
#ifndef __eventtoken_h__
#define __eventtoken_h__
#include <stdint.h>
typedef struct EventRegistrationToken { int64_t value; } EventRegistrationToken;
#endif
