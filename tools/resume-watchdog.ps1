# 小鲸鱼状态面板 - 自动断点续跑守护脚本
# 仅使用本地 agentapi 工具与进度文件，不调用任何付费服务，不购买配额
$ProgressFile = "D:\deepseenhanress\dsh-whale-status\DEVELOPMENT_PROGRESS.json"
$ConversationId = "ae37f740-c256-471e-9000-7a2980e61e0b"

if (!(Test-Path $ProgressFile)) {
    Write-Host "进度文件不存在，退出。"
    exit 0
}

$progress = Get-Content -Raw -Path $ProgressFile | ConvertFrom-Json
if (-not $progress.resume_enabled) {
    Write-Host "续跑机制已关闭 (resume_enabled=false)，退出。"
    exit 0
}

Write-Host "当前开发阶段: $($progress.current_phase)"
Write-Host "准备检查会话并发送唤醒提示..."

$prompt = "【自动续跑通知】正在继续「小鲸鱼状态面板」开发。请读取 D:\deepseenhanress\dsh-whale-status\DEVELOPMENT_PROGRESS.json 推进下一步任务。若全部完成，请将 resume_enabled 设为 false 并注销守护。"
agentapi send-message $ConversationId $prompt
Write-Host "已向会话 $ConversationId 发送续跑指令。"
