import { spawn } from 'node:child_process';
// Local runtime never inherits provider credentials. Proxy/CA settings remain intact.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(CLOUDFLARE_|CF_|AWS_|R2_)/.test(key)));
env.WRANGLER_SEND_METRICS = 'false';
env.XDG_CONFIG_HOME ||= '/tmp/nellie-wrangler-config';
const child = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'dev', '--local', '--ip', '127.0.0.1', '--port', '8787', ...process.argv.slice(2)], { env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 1));
