# dotodo MCP Server

**Manage your todos from Claude and ChatGPT.**

[dotodo](https://dotodo.co) is a free todo app with soft deadlines. This MCP server lets you add, update, complete, and review todos directly from your AI assistant — no app switching needed.

## Quick Start

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "dotodo": {
      "command": "npx",
      "args": ["-y", "dotodo-mcp@latest"],
      "env": {
        "DOTODO_API_URL": "https://api.dotodo.co",
        "DOTODO_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add dotodo \
  -e DOTODO_API_URL=https://api.dotodo.co \
  -e DOTODO_API_KEY=your-api-key \
  -- npx -y dotodo-mcp@latest
```

### Get Your API Key

1. Sign in at [dotodo.co](https://dotodo.co)
2. Go to **Profile → API Keys**
3. Create a new key and copy it

## Tools

| Tool | Description |
|------|-------------|
| `add_todo` | Create a todo with optional deadline, priority, project |
| `add_todos` | Batch create up to 50 todos at once |
| `list_todos` | List and filter todos by date, week, month, quarter, status |
| `complete_todo` | Toggle todo completion |
| `complete_todos` | Batch toggle up to 100 todos |
| `update_todo` | Update title, deadline, priority, status |
| `delete_todo` | Soft-delete a todo |
| `delete_todos` | Batch delete up to 100 todos |
| `get_project_todos` | Get all todos for a specific project |
| `list_projects` | List all projects |
| `create_project` | Create a new project |
| `add_tag` | Create a tag |
| `list_tags` | List all tags |

## Usage Examples

```
You: "What do I need to finish this week?"
AI:  5 todos this week (W12):
     • Update and submit resume
     • Prepare team meeting slides
     • Book an oil change
     • Call parents
     • Drop off comforter at dry cleaner
```

```
You: "Add a follow-up with the client for next month"
AI:  Created todo: "Follow-up with client" (due: April 2026)
```

```
You: "Mark the resume task as done"
AI:  Completed: "Update and submit resume"
```

## Soft Deadlines

dotodo supports flexible time-based deadlines:

- **Date** — specific day (`2026-03-19`)
- **Week** — this week, next week (`W12`)
- **Month** — this month, next month
- **Quarter** — Q1, Q2, Q3, Q4
- **Year** — annual goals
- **Bucket list** — no deadline, someday items

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DOTODO_API_URL` | No | API server URL (default: `https://api.dotodo.co`) |
| `DOTODO_API_KEY` | Yes | Your API key from dotodo.co |

## Requirements

- Node.js 20+
- A free [dotodo.co](https://dotodo.co) account

## Free Plan Limits

- 1,000 todos
- 20 projects
- 1 API key
- 100 AI calls / day

Need more? [Upgrade to Pro](https://dotodo.co) for unlimited todos and AI calls.

## Links

- [dotodo.co](https://dotodo.co)
- [Claude setup guide](https://dotodo.co/en/claude)
- [ChatGPT setup guide](https://dotodo.co/en/chatgpt)

## License

MIT
