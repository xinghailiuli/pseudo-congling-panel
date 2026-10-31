# 外部服务接入

只使用房间时不需要配置本页。套件包含全部面板页面和适配代码；外部 QQ 机器人、网关、Basic Memory 和日记工具由使用者提供。

## 路径和模型配置

以下字段是 `dsh-whale-status` 插件的 `config`，通过 `apply(ctx, config)` 传入。可以在当前 profile 的 `cordis.patch.yml` 中添加覆盖行；保留该文件已有内容，不要覆盖整个 profile。

```yaml
- id: dsh-whale-status
  config:
    stateRoot: 'C:/liuli-data'
    # 以下按需添加；示例是占位路径，不是随包自带的服务。
    # bridgeRoot: 'C:/your-qq-bridge'
    # diaryFile: 'C:/your-diary/diary.jsonl'
    memoryProject: personal
    # provider: your-provider-id
    # model: your-model-id
```

| 字段 | 默认/作用 |
| --- | --- |
| `stateRoot` | `LIULI_DATA_DIR` 环境变量，或 `$DSH_HOME/data/dsh-whale-status`；未设置 `DSH_HOME` 时用 `~/.dsh` |
| `bridgeRoot` | `LIULI_BRIDGE_ROOT`，否则不接 QQ；指向兼容桥接的目录，不是任意 QQ 插件目录 |
| `diaryFile` | `LIULI_DIARY_FILE`，否则为 `stateRoot/diary.jsonl` |
| `memoryProject` | `personal`，需与 Basic Memory 中的项目对应 |
| `provider` / `model` | 显式配置优先，其次为桥接配置的 `dsh.provider/model`，最后为 `deepseek-official` / `deepseek-flash`；请改成宿主实际存在的模型 ID |

路径必须是绝对路径。多个 profile 同时运行时，给它们不同的 `stateRoot`。更新插件不会重建已有房间，也不会将旧私人数据打进包中；迁移已有个人版时显式指定原数据目录。

## Basic Memory 与日记

Basic Memory 使用 DSH 工具名：

- `mcp__basic_memory__read_note`
- `mcp__basic_memory__write_note`
- `mcp__basic_memory__search_notes`
- `mcp__basic_memory__list_directory`

记忆正文继续存在工具对应的笔记库中；本插件记录来源引用、分级、遗忘与关系元数据。工具名不同的服务需要适配 `src/basic-memory.mjs` 与 `src/host.mjs`。

日记写入使用 `mcp__diary__diary_write`，参数为 `{content, mood}`。`diaryFile` 必须指向该工具实际追加写入的 UTF-8 JSONL 文件。每行建议为 `{ "time": "2026-01-01 20:00", "content": "正文", "mood": "平静" }`。写入后会回读确认，路径不一致会提示结果待核对。本套件不安装 Windows 日记计划任务；定时生成由使用者的外部服务负责。

## QQ 桥接接口要求

`bridgeRoot/config.json` 是你自己的桥接配置，必须自行保存在运行目录，不能提交到 GitHub。适配器从中读取 `consolePort`（默认 3100）、`consoleToken` 或 `state/console-token`、`dsh.provider/model`，以及网关的 `snowluma.httpUrl/accessToken`。管理请求只访问本机，使用 `x-console-token` 鉴权。

这不是“安装任意 QQ 插件即可使用”。外部桥接需提供下面的接口，完整映射位于 `src/bridge-api.mjs` 的 `BRIDGE_ROUTES`：

| 接口 | 主要用途/响应 |
| --- | --- |
| `GET /api/status` | `mode`、`socialV2Paused` 等运行状态 |
| `GET /api/roles` | `current`，当前人格名 |
| `GET /api/roles/content?name=...`、`POST /api/roles/update` | 读取/保存人格正文 `content` |
| `GET/POST /api/socialV2/config` | 二代仿真设置 `{config: ...}` |
| `GET /api/socialV2/states` | `{conversations: [{key, eligible, ...}]}` |
| `GET /api/socialV2/recent`、`GET /api/socialV2/unread` | 指定会话的 `{messages: [...]}` |
| `POST /api/socialV2/wake` | 唤醒已授权会话 |
| `GET /api/whitelist` | 管理员与白名单 |

会话键格式为 `private:数字ID` 或 `group:数字ID`。空间、资料和头像功能还要求网关实现 `src/qq.mjs` 中对应的 OneBot 类接口。能力不足或登录态失效会明确失败，不会假装成功。

## 消息与陪伴状态联动

包内提供轻量的 `dsh-whale-status/companion-client` 适配模块，它是陪伴中心的客户端连接代码，不是 QQ 机器人服务。可在你的桥接中接入：

```js
import {createCompanionClient} from 'dsh-whale-status/companion-client';

const companion = createCompanionClient({
  api: authenticatedDshApi, // 你已有的对象，提供 doFetch(url, init)
  baseUrl: localDshUrl,     // DSH 本机 HTTP 地址，不能使用远程地址
  root: liuliStateRoot,    // 与面板 stateRoot 相同
  eligibility: scope => currentSessionPermission(scope),
});
```

外部桥接应在收到已授权消息时调用 `ingest(event)`，在唤醒前调用 `beforeWake({scope, reason})` 并遵守 `allow`，在构建模型上下文时调用 `context({scope, query})`，真正发出消息后调用 `delivered({scope, reason})`。失败的入站事件保留在本地队列，可调用 `flush()` 重试。事件包含 `scope/id/subject/text/at/authorized/paused/disabled`；授权必须来自桥接的真实会话权限，不能固定写成 `true`。

`/api/liuli/runtime` 同时受 DSH 自身连接鉴权和 `x-liuli-runtime` 保护。`runtime-token` 由面板第一次启动时在 `stateRoot` 中创建，客户端在本机读取；不要上传它。单独使用普通 `fetch` 并不保证通过 DSH 鉴权，需要桥接已有的已鉴权 `doFetch`。

安装套件不会自动修改桥接、发送消息或启用自动联系。只有完成这些接入后，QQ 消息才会驱动相应的记忆、睡眠、主动联系等联动功能。
