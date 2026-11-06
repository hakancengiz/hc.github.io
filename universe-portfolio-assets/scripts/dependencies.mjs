import {createRequire} from 'node:module';
import path from 'node:path';
import os from 'node:os';
const local=createRequire(import.meta.url);
export function devPackage(name){
  try{return local(name);}catch{}
  const bundled=path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules',name,'package.json');
  try{return createRequire(bundled)(name);}catch{throw Error('Development dependency missing. Run npm --prefix universe-portfolio-assets install first: '+name);}
}
