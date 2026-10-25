import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'booking-owner.browser.spec.mjs',use:{baseURL:'http://127.0.0.1:8765',browserName:'chromium'},webServer:{command:'python3 -m http.server 8765 --bind 127.0.0.1',url:'http://127.0.0.1:8765/booking-owner.html',reuseExistingServer:!process.env.CI,timeout:30000},reporter:'list'});
