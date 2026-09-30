import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
mkdirSync('.sites-runtime',{recursive:true});
const config=path.resolve('.sites-runtime/local-d1.json');
writeFileSync(config,JSON.stringify({name:'replay-local',compatibility_date:'2026-05-15',d1_databases:[{binding:'DB',database_name:'site-creator-d1',database_id:'00000000-0000-4000-8000-000000000000'}]}));
const r=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config',config,'--persist-to',path.resolve('.wrangler/state'),'--file',path.resolve('drizzle/0000_icy_polaris.sql')],{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:path.resolve('.wrangler/logs')}});
process.exit(r.status ?? 1);
