import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/browser',fullyParallel:false,workers:1,timeout:20000,
 use:{baseURL:'http://127.0.0.1:4173',headless:true,screenshot:'only-on-failure',trace:'retain-on-failure',launchOptions:process.env.PW_CHANNEL?{channel:process.env.PW_CHANNEL}:{}},
 projects:[{name:'mobile',use:{viewport:{width:390,height:844}}},{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'narrow',use:{viewport:{width:320,height:740}}}],
 webServer:{command:'npm run serve',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI}
});
