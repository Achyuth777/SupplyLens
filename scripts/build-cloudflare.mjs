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
// Bind the database created in the destination Cloudflare account.
// Never reuse the managed Sites database identity.
config.d1_databases = [{
  binding: "DB",
  database_name: "supplylens-db",
  database_id: "acc8d0da-c3ff-42af-86b7-e699265e84e5",
}];
config.services = [];
delete config.build;
copyFileSync('scripts/cloudflare-entry.mjs', 'dist/server/cloudflare-entry.mjs');
copyFileSync('scripts/cloudflare-auth.mjs', 'dist/server/cloudflare-auth.mjs');
config.vars = {...config.vars, GOOGLE_CLIENT_ID: '198142915986-nfbhd5odcajhgrok5u06tfol37a0reii.apps.googleusercontent.com'};
writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('Cloudflare bundle ready: Google sign-in and D1 sessions enabled. GOOGLE_CLIENT_SECRET must be set as a runtime secret.');
