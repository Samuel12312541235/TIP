# 给 Agent 的接入说明（日序 Dayflow）

本文件面向在 DSH 里运行的 Agent：用它可以读写用户电脑上的「日序 Dayflow」日程应用。
应用常驻托盘、开机自启，因此 API 通常一直可用。

## 1. 连接信息

| 项 | 位置 |
| --- | --- |
| Base URL | `http://127.0.0.1:7788`（端口冲突时会顺延，以连接文件为准） |
| Token | `agent/connection.json` 里的 `token`，或 `data/api-token.txt` |
| 完整连接文件 | `agent/connection.json`（应用启动时自动写入） |

请求头：`Authorization: Bearer <token>`，`Content-Type: application/json; charset=utf-8`。

> 只在 127.0.0.1 监听，不会暴露到局域网。

## 2. 最快的用法：CLI

```powershell
agent\dayflow.cmd briefing                 # 今日简报（逾期 / 今日 / 未来 7 天）
agent\dayflow.cmd list --from 2026-11-23 --to 2026-11-30
agent\dayflow.cmd add "整理西电会议摘要" --date 2026-11-29 --time 10:00 --domain research --kind task --priority 3
agent\dayflow.cmd done it_abc123
agent\dayflow.cmd move it_abc123 --date 2026-12-01 --time 09:00
agent\dayflow.cmd command "明天下午三点提醒我交月总结"
```

## 3. 常用 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/briefing` | 结构化简报 + 文本摘要（最适合开场） |
| GET | `/api/items?from=&to=&domain=&status=&q=` | 查询事项 |
| POST | `/api/items` | 新建 `{title,date,time,domain,kind,priority,notes,trackId}` |
| PATCH | `/api/items/:id` | 修改 / 改期 |
| POST | `/api/items/:id/complete` | 完成 |
| POST | `/api/command` | 自然语言 `{text}`，服务端会解析并落库 |
| GET | `/api/state` | 全量状态（含 items / tracks / settings） |
| PATCH | `/api/tracks/:id` | 更新长期规划进度 |

字段约定：

- `date`：`YYYY-MM-DD`（必填）
- `time`：`HH:mm`，可空（表示全天）
- `domain`：`research` 科研 / `duty` 学工 / `study` 课业 / `plan` 长期
- `kind`：`task` 任务 / `deadline` 截止 / `event` 日程 / `quiz` 测验 / `class` 课程 / `idea` 想法
- `priority`：0 备忘、1 轻、2 普通、3 重要
- `trackId`：关联长期主线（干净初始数据里是 `trk_demo` 长期项目示例；实际 ID 以本机数据为准）

## 4. 行为准则

1. 先 `briefing` 再动手，避免重复创建。
2. 新建事项必须给出 `date`；有明确时间点才写 `time`。
3. 只删除用户明确要求删除的事项；不确定时先问。
4. 用户说「这周改出来」这类相对时间时，优先落到本周日；说「周二之前」就落到周二。
5. 课程类事项带上 `course`（干净初始数据里是 `c_demo` 示例课程、`c_seminar` 研讨课；实际 ID 以本机数据为准）。
6. 完成后调用 `complete`，不要删除——完成记录会进入统计与连续天数。
7. 写入后可以顺带确认：`GET /api/items?from=...` 或直接读简报。

## 5. 备注

- 数据文件：`data/profile/data.json`（便携目录，随应用文件夹迁移）。
- 渲染进程与主进程通过 IPC 通信；HTTP API 只面向 Agent/脚本。
- 如果应用没在运行，先执行 `launch.vbs` 或 `start-dayflow.cmd`。
