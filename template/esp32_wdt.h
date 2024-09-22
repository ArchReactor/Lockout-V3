#include <esp_task_wdt.h>

void set_esp32_wdt_timeout() {
    esp_task_wdt_init(60 /* timeout [s] */, true /* panic */);
}