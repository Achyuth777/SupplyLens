import {spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync, copyFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const result = spawnSync(process.execPath, ['scripts/run-framework.mjs', 'build'], {stdio: 'inherit'});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

// Deploy the existing Vinext output, never run OpenNext auto-migration.
const configPath = 'dist/server/wrangler.json';
const config = JSON.parse(readFileSync(configPath, 'utf8'));
if (config.main !== 'index.js') throw new Error('Unexpected Vinext entrypoint; review before deployment.');
config.name = 'supplylens';
config.main = 'cloudflare-entry.mjs';
config.workers_dev = true;
// This first migration stage publishes the public pages only. The Sites D1 ID
// belongs to the managed host and must never be deployed to another account.
config.d1_databases = [];
config.services = [];
delete config.build;
copyFileSync('scripts/cloudflare-entry.mjs', 'dist/server/cloudflare-entry.mjs');
copyFileSync('scripts/cloudflare-access.mjs', 'dist/server/cloudflare-access.mjs');
writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('Cloudflare bundle ready: public pages enabled; workspace awaits Google authentication and D1 setup.');
