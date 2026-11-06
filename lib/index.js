import { startHost } from '../src/host.mjs';
export const name = 'dsh-whale-status';
export const inject = ['webServer', 'connection', 'tools', 'llm'];
export async function apply(ctx) {
  const host = await startHost(ctx);
  ctx.effect(() => () => host.close(), 'liuli-companion lifecycle');
}
