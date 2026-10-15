import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('vendor', {recursive:true});
await copyFile('node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'vendor/supabase.js');
console.log('Pinned Supabase browser bundle copied.');
await copyFile('node_modules/@supabase/supabase-js/LICENSE', 'vendor/SUPABASE-LICENSE');
