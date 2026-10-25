import {build} from 'esbuild';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'../..');
const entry=join(here,'cpu-profile.ts');
const out=join(here,'.cpu-profile-run.mjs');
await build({
 entryPoints:[entry],outfile:out,
 bundle:true,platform:'node',format:'esm',target:'node24',
 alias:{'@oss-idle/shared':join(root,'node_modules/oss-idle/packages/shared/src'),'react':join(here,'react-profile-stub.js')},
 external:['rosu-pp-js','osu-parsers','osu-classes','osu-mania-stable'],
 logLevel:'warning'
});
console.log('Offline CPU profiler compiled:',out);
