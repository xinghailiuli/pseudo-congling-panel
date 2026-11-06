import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const progressFile = 'D:/deepseenhanress/dsh-whale-status/DEVELOPMENT_PROGRESS.json';
const conversationId = 'ae37f740-c256-471e-9000-7a2980e61e0b';

if (!fs.existsSync(progressFile)) {
  console.log('Progress file not found, exiting.');
  process.exit(0);
}

const progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
if (!progress.resume_enabled) {
  console.log('Resume mechanism disabled (resume_enabled=false), exiting.');
  process.exit(0);
}

console.log('Current phase:', progress.current_phase);
console.log('Sending resume message to conversation:', conversationId);

const prompt = '【自动续跑通知】正在继续「小鲸鱼状态面板」开发。请读取 D:/deepseenhanress/dsh-whale-status/DEVELOPMENT_PROGRESS.json 推进下一步任务。若全部完成，请将 resume_enabled 设为 false 并关闭调度。';

try {
  const result = execFileSync('cmd.exe', ['/c', 'agentapi.bat', 'send-message', conversationId, prompt], { encoding: 'utf8' });
  console.log('Success:', result);
} catch (e) {
  console.error('Failed to send message via agentapi:', e.message);
}
