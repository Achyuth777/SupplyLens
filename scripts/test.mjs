import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const esbuild=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}));
const dir=await mkdtemp(join(tmpdir(),'supplylens-tests-'));
try{await esbuild.build({entryPoints:['tests/engine.test.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'tests.mjs')});const r=spawnSync(process.execPath,['--test',join(dir,'tests.mjs')],{stdio:'inherit'});process.exitCode=r.status??1;}finally{await rm(dir,{recursive:true,force:true});}
