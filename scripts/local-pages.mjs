import {spawn} from 'node:child_process';
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^(CLOUDFLARE_|CF_|AWS_|R2_)/.test(key)));
env.WRANGLER_SEND_METRICS='false';env.XDG_CONFIG_HOME||='/tmp/nellie-wrangler-config';
const child=spawn(process.execPath,[process.cwd()+'/node_modules/wrangler/bin/wrangler.js','pages','dev','../dist','--ip','127.0.0.1','--port','8788'],{env,stdio:'inherit',cwd:'pages'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??1));
