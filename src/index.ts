#!/usr/bin/env node

/**
 * dotodo MCP Server
 *
 * Claude Desktop/Code에서 dotodo API를 직접 사용할 수 있도록
 * Model Context Protocol 서버를 구현합니다.
 *
 * 환경변수:
 *   DOTODO_API_URL  - API 서버 URL (기본: http://localhost:3010)
 *   DOTODO_API_KEY  - API Key (필수, sk_dotodo_... 형식)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { createApiClient } from './client.js'

const API_URL = process.env.DOTODO_API_URL || 'http://localhost:3010'
const API_KEY = process.env.DOTODO_API_KEY

if (!API_KEY) {
  console.error('Error: DOTODO_API_KEY environment variable is required')
  console.error('Get your API key from dotodo web app: Settings > API Keys')
  process.exit(1)
}

const client = createApiClient(API_URL, API_KEY)

const server = new McpServer({
  name: 'dotodo',
  version: '1.0.0',
})

// ============================================
// add_todo
// ============================================
server.registerTool(
  'add_todo',
  {
    description: 'Create a new todo item with optional deadline, priority, and project context',
    inputSchema: {
      title: z.string().describe('Todo title (max 200 chars)'),
      description: z.string().optional().describe('Detailed description (max 2000 chars)'),
      hasDue: z.boolean().optional().describe('Whether this todo has a deadline. Default: false'),
      dueType: z.enum(['date', 'week', 'month', 'quarter', 'year']).optional().describe('Type of deadline'),
      dueDate: z.string().optional().describe('Due date in YYYY-MM-DD format (for date type)'),
      dueYear: z.number().optional().describe('Due year (2000-2100)'),
      dueMonth: z.number().optional().describe('Due month (1-12)'),
      dueWeek: z.number().optional().describe('Due week (1-53)'),
      dueQuarter: z.number().optional().describe('Due quarter (1-4)'),
      priority: z.enum(['high', 'medium', 'low']).optional().describe('Priority level. Default: medium'),
      status: z.enum(['pending', 'in_progress', 'completed']).optional().describe('Initial status. Use "completed" to create already-done todos. Default: pending'),
      projectId: z.string().optional().describe('UUID of the project to assign this todo to'),
      projectName: z.string().optional().describe('Project name for organizing todos by project'),
      projectPath: z.string().optional().describe('Absolute path to project directory'),
      tagIds: z.array(z.string()).optional().describe('Array of tag UUIDs'),
    },
  },
  async (args) => {
    try {
      const body: Record<string, unknown> = {
        title: args.title,
        hasDue: args.hasDue ?? false,
      }
      if (args.description) body.description = args.description
      if (args.dueType) body.dueType = args.dueType
      if (args.dueDate) body.dueDate = args.dueDate
      if (args.dueYear) body.dueYear = args.dueYear
      if (args.dueMonth) body.dueMonth = args.dueMonth
      if (args.dueWeek) body.dueWeek = args.dueWeek
      if (args.dueQuarter) body.dueQuarter = args.dueQuarter
      if (args.priority) body.priority = args.priority
      if (args.status) body.status = args.status
      if (args.projectId) body.projectId = args.projectId
      if (args.projectName) body.projectName = args.projectName
      if (args.projectPath) body.projectPath = args.projectPath
      if (args.tagIds) body.tagIds = args.tagIds

      const todo = await client.post<{ id: string; title: string }>('/todos', body)
      return { content: [{ type: 'text', text: `Created todo: "${todo.title}" (ID: ${todo.id})` }] }
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
    }
  }
)

// ============================================
// list_todos
// ============================================
server.registerTool(
  'list_todos',
  {
    description: `List todos with filters. Common patterns:
- Today's todos: dueType="date", date="2026-02-14"
- This week: dueType="week", year=2026, week=7
- This month: dueType="month", year=2026, month=2
- This quarter: dueType="quarter", year=2026, quarter=1
- This year: dueType="year", year=2026
- Bucket list (no deadline): hasDue=false
- Date range: dueDateFrom="2026-02-14", dueDateTo="2026-02-15"
- Overdue: dueType="date", dueDateTo="2026-02-13", isDone=false
- Active only: isDone=false`,
    inputSchema: {
      status: z.enum(['pending', 'in_progress', 'completed', 'skipped']).optional().describe('Filter by status'),
      isDone: z.boolean().optional().describe('Filter by completion. true=completed, false=active. Simpler alternative to status.'),
      priority: z.enum(['high', 'medium', 'low']).optional().describe('Filter by priority'),
      hasDue: z.boolean().optional().describe('Filter by whether todo has a deadline. false=bucket list items.'),
      dueType: z.enum(['date', 'week', 'month', 'quarter', 'year']).optional().describe('Filter by due type'),
      date: z.string().optional().describe('Exact due date filter (YYYY-MM-DD). Use with dueType="date".'),
      dueDateFrom: z.string().optional().describe('Due date range start (YYYY-MM-DD, inclusive). Filters due_date >= this value.'),
      dueDateTo: z.string().optional().describe('Due date range end (YYYY-MM-DD, inclusive). Filters due_date <= this value.'),
      year: z.number().optional().describe('Filter by due year (e.g. 2026)'),
      month: z.number().optional().describe('Filter by due month (1-12). Use with year.'),
      week: z.number().optional().describe('Filter by due week (1-53). Use with year.'),
      quarter: z.number().optional().describe('Filter by due quarter (1-4). Use with year.'),
      projectId: z.string().optional().describe('Filter by project UUID'),
      projectName: z.string().optional().describe('Filter by project name'),
      projectPath: z.string().optional().describe('Filter by project path'),
      sortBy: z.enum(['deadlineAt', 'priority', 'createdAt', 'updatedAt']).optional().describe('Sort field'),
      sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
      limit: z.number().optional().describe('Max items (default: 50, max: 500)'),
    },
  },
  async (args) => {
    try {
      const params: Record<string, string> = {}
      if (args.status) params.status = args.status
      if (args.isDone !== undefined) params.isDone = String(args.isDone)
      if (args.priority) params.priority = args.priority
      if (args.hasDue !== undefined) params.hasDue = String(args.hasDue)
      if (args.dueType) params.dueType = args.dueType
      if (args.date) params.date = args.date
      if (args.dueDateFrom) params.dueDateFrom = args.dueDateFrom
      if (args.dueDateTo) params.dueDateTo = args.dueDateTo
      if (args.year) params.year = String(args.year)
      if (args.month) params.month = String(args.month)
      if (args.week) params.week = String(args.week)
      if (args.quarter) params.quarter = String(args.quarter)
      if (args.projectId) params.projectId = args.projectId
      if (args.projectName) params.projectName = args.projectName
      if (args.projectPath) params.projectPath = args.projectPath
      if (args.sortBy) params.sortBy = args.sortBy
      if (args.sortOrder) params.sortOrder = args.sortOrder
      if (args.limit) params.limit = String(args.limit)

      interface TodoItem {
        id: string; title: string; status: string; priority: string
        hasDue: boolean; dueType?: string | null; dueDate?: string | null
        dueYear?: number | null; dueMonth?: number | null; dueWeek?: number | null; dueQuarter?: number | null
        projectName?: string | null; tags?: { name: string }[]
      }
      const result = await client.get<{ items: TodoItem[]; total: number; hasMore: boolean }>('/todos', params)

      if (result.items.length === 0) {
        return { content: [{ type: 'text', text: 'No todos found matching the filters.' }] }
      }

      const lines = result.items.map((t) => {
        const check = t.status === 'completed' ? '[x]' : '[ ]'
        const pri = t.priority === 'high' ? ' [HIGH]' : t.priority === 'low' ? ' [LOW]' : ''
        const proj = t.projectName ? ` 📁${t.projectName}` : ''
        const tags = t.tags && t.tags.length > 0 ? ` #${t.tags.map((tg) => tg.name).join(' #')}` : ''
        let due = ''
        if (t.hasDue && t.dueType) {
          if (t.dueType === 'date' && t.dueDate) due = ` 📅${String(t.dueDate).slice(0, 10)}`
          else if (t.dueType === 'week') due = ` 📅W${t.dueWeek}`
          else if (t.dueType === 'month') due = ` 📅${t.dueYear}-${String(t.dueMonth).padStart(2, '0')}`
          else if (t.dueType === 'quarter') due = ` 📅${t.dueYear}Q${t.dueQuarter}`
          else if (t.dueType === 'year') due = ` 📅${t.dueYear}`
        }
        return `${check}${pri} ${t.title}${due}${proj}${tags} (${t.id})`
      })

      return { content: [{ type: 'text', text: `${result.total} todos${result.hasMore ? ' (more available)' : ''}:\n${lines.join('\n')}` }] }
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
    }
  }
)

// ============================================
// complete_todo
// ============================================
server.registerTool(
  'complete_todo',
  {
    description: 'Toggle todo completion. If pending -> completed. If completed -> pending.',
    inputSchema: {
      todoId: z.string().describe('UUID of the todo'),
    },
  },
  async (args) => {
    try {
      const todo = await client.patch<{ id: string; title: string; status: string }>(`/todos/${args.todoId}/done`)
      const action = todo.status === 'completed' ? 'Completed' : 'Reopened'
      return { content: [{ type: 'text', text: `${action}: "${todo.title}"` }] }
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
    }
  }
)

// ============================================
// update_todo
// ============================================
server.registerTool(
  'update_todo',
  {
    description: 'Update an existing todo. Only provide fields you want to change.',
    inputSchema: {
      todoId: z.string().describe('UUID of the todo to update'),
      title: z.string().optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      status: z.enum(['pending', 'in_progress', 'completed', 'skipped']).optional().describe('New status'),
      priority: z.enum(['high', 'medium', 'low']).optional().describe('New priority'),
      hasDue: z.boolean().optional().describe('Whether this todo has a deadline'),
      dueType: z.enum(['date', 'week', 'month', 'quarter', 'year']).optional().describe('Deadline type'),
      dueDate: z.string().optional().describe('Due date YYYY-MM-DD'),
      projectId: z.string().optional().describe('UUID of the project to assign this todo to (null to unassign)'),
      projectName: z.string().optional().describe('Project name'),
      projectPath: z.string().optional().describe('Project path'),
    },
  },
  async (args) => {
    try {
      const { todoId, ...updates } = args
      const body: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) body[key] = value
      }

      const todo = await client.put<{ id: string; title: string; status: string }>(`/todos/${todoId}`, body)
      return { content: [{ type: 'text', text: `Updated: "${todo.title}" (status: ${todo.status})` }] }
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
    }
  }
)

// ============================================
// delete_todo
// ============================================
server.registerTool(
  'delete_todo',
  {
    description: 'Delete a todo (soft delete, can be recovered)',
    inputSchema: {
      todoId: z.string().describe('UUID of the todo to delete'),
    },
  },
  async (args) => {
    try {
      await client.delete(`/todos/${args.todoId}`)
      return { content: [{ type: 'text', text: `Deleted todo: ${args.todoId}` }] }
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
    }
  }
)

// ============================================
// get_project_todos
// ============================================
server.registerTool(
  'get_project_todos',
  {
    description: 'Get all todos for a specific project. Useful for Claude Code to track tasks per project directory.',
    inputSchema: {
      projectName: z.string().optional().describe('Project name to filter by'),
      projectPath: z.string().optional().describe('Project directory path to filter by'),
      status: z.enum(['pending', 'in_progress', 'completed', 'skipped']).optional().describe('Filter by status'),
    },
  },
  async (args) => {
    try {
      if (!args.projectName && !args.projectPath) {
        return { content: [{ type: 'text', text: 'Error: provide either projectName or projectPath' }], isError: true }
      }

      const params: Record<string, string> = { limit: '500' }
      if (args.projectName) params.projectName = args.projectName
      if (args.projectPath) params.projectPath = args.projectPath
      if (args.status) params.status = args.status

      interface TodoItem { id: string; title: string; status: string; priority: string }
      const result = await client.get<{ items: TodoItem[]; total: number }>('/todos', params)

      if (result.items.length === 0) {
        return { content: [{ type: 'text', text: 'No todos found for this project.' }] }
      }

      const pending = result.items.filter((t) => t.status !== 'completed')
      const completed = result.items.filter((t) => t.status === 'completed')

      let text = `Project todos (${result.total} total, ${pending.length} active, ${completed.length} done):\n\n`
      if (pending.length > 0) {
        text += 'Active:\n'
        for (const t of pending) {
          const pri = t.priority === 'high' ? ' [HIGH]' : ''
          text += `  [ ] ${t.title}${pri} (${t.id})\n`
        }
      }
      if (completed.length > 0) {
        text += '\nCompleted:\n'
        for (const t of completed) {
          text += `  [x] ${t.title} (${t.id})\n`
        }
      }

      return { content: [{ type: 'text', text }] }
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
    }
  }
)

// ============================================
// list_projects
// ============================================
server.registerTool(
  'list_projects',
  {
    description: 'List all projects. Use project IDs when creating or updating todos.',
  },
  async () => {
    try {
      interface ProjectItem { id: string; name: string; color: string; description?: string | null }
      const projects = await client.get<ProjectItem[]>('/projects')
      if (projects.length === 0) {
        return { content: [{ type: 'text', text: 'No projects found.' }] }
      }
      const lines = projects.map((p) => {
        const desc = p.description ? ` - ${p.description}` : ''
        return `  ${p.color} ${p.name}${desc} (${p.id})`
      })
      return { content: [{ type: 'text', text: `Projects (${projects.length}):\n${lines.join('\n')}` }] }
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
    }
  }
)

// ============================================
// create_project
// ============================================
server.registerTool(
  'create_project',
  {
    description: 'Create a new project for organizing todos',
    inputSchema: {
      name: z.string().describe('Project name (max 100 chars)'),
      description: z.string().optional().describe('Project description (max 500 chars)'),
      color: z.string().optional().describe('Hex color code e.g. "#22C55E". Default: #6B7280'),
    },
  },
  async (args) => {
    try {
      const body: Record<string, unknown> = { name: args.name }
      if (args.description) body.description = args.description
      if (args.color) body.color = args.color
      const project = await client.post<{ id: string; name: string }>('/projects', body)
      return { content: [{ type: 'text', text: `Created project: "${project.name}" (${project.id})` }] }
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
    }
  }
)

// ============================================
// add_tag
// ============================================
server.registerTool(
  'add_tag',
  {
    description: 'Create a new tag for categorizing todos',
    inputSchema: {
      name: z.string().describe('Tag name (max 50 chars)'),
    },
  },
  async (args) => {
    try {
      const body: Record<string, unknown> = { name: args.name }
      const tag = await client.post<{ id: string; name: string }>('/tags', body)
      return { content: [{ type: 'text', text: `Created tag: "${tag.name}" (${tag.id})` }] }
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
    }
  }
)

// ============================================
// list_tags
// ============================================
server.registerTool(
  'list_tags',
  {
    description: 'List all available tags. Use tag IDs when creating or updating todos.',
  },
  async () => {
    try {
      interface TagItem { id: string; name: string; color: string }
      const tags = await client.get<TagItem[]>('/tags')
      if (tags.length === 0) {
        return { content: [{ type: 'text', text: 'No tags found.' }] }
      }
      const lines = tags.map((t) => `  ${t.color} ${t.name} (${t.id})`)
      return { content: [{ type: 'text', text: `Tags (${tags.length}):\n${lines.join('\n')}` }] }
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
    }
  }
)

// ============================================
// add_todos (batch)
// ============================================
server.registerTool(
  'add_todos',
  {
    description: 'Create multiple todos at once (max 50). More efficient than calling add_todo multiple times.',
    inputSchema: {
      items: z.array(z.object({
        title: z.string().describe('Todo title'),
        description: z.string().optional().describe('Description'),
        hasDue: z.boolean().optional().describe('Has deadline? Default: false'),
        dueType: z.enum(['date', 'week', 'month', 'quarter', 'year']).optional().describe('Deadline type'),
        dueDate: z.string().optional().describe('Due date YYYY-MM-DD'),
        dueYear: z.number().optional().describe('Due year'),
        dueMonth: z.number().optional().describe('Due month (1-12)'),
        dueWeek: z.number().optional().describe('Due week (1-53)'),
        dueQuarter: z.number().optional().describe('Due quarter (1-4)'),
        priority: z.enum(['high', 'medium', 'low']).optional().describe('Priority. Default: medium'),
        status: z.enum(['pending', 'in_progress', 'completed']).optional().describe('Initial status. Use "completed" for already-done todos. Default: pending'),
        projectId: z.string().optional().describe('Project UUID'),
        projectName: z.string().optional().describe('Project name'),
        projectPath: z.string().optional().describe('Project path'),
        tagIds: z.array(z.string()).optional().describe('Tag UUIDs'),
      })).describe('Array of todos to create (max 50)'),
    },
  },
  async (args) => {
    try {
      const result = await client.post<{ created: { id: string; title: string }[]; errors: string[] }>(
        '/todos/batch', { items: args.items }
      )
      const { created, errors } = result
      let text = `Created ${created.length} todos:\n`
      for (const t of created) text += `  - "${t.title}" (${t.id})\n`
      if (errors.length > 0) text += `\nErrors:\n${errors.map((e: string) => `  - ${e}`).join('\n')}`
      return { content: [{ type: 'text', text }] }
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
    }
  }
)

// ============================================
// complete_todos (batch)
// ============================================
server.registerTool(
  'complete_todos',
  {
    description: 'Toggle completion for multiple todos at once (plan-limited: Free 5, Pro 30). Pending->completed, completed->pending.',
    inputSchema: {
      todoIds: z.array(z.string()).describe('Array of todo UUIDs to toggle (plan-limited)'),
    },
  },
  async (args) => {
    try {
      const result = await client.patch<{ toggled: { id: string; title: string; status: string }[]; errors: string[] }>(
        '/todos/batch/done', { todoIds: args.todoIds }
      )
      const { toggled, errors } = result
      const completed = toggled.filter((t: { status: string }) => t.status === 'completed')
      const reopened = toggled.filter((t: { status: string }) => t.status === 'pending')
      let text = ''
      if (completed.length > 0) text += `Completed ${completed.length}: ${completed.map((t: { title: string }) => `"${t.title}"`).join(', ')}\n`
      if (reopened.length > 0) text += `Reopened ${reopened.length}: ${reopened.map((t: { title: string }) => `"${t.title}"`).join(', ')}\n`
      if (errors.length > 0) text += `Errors: ${errors.join(', ')}`
      return { content: [{ type: 'text', text: text.trim() || 'No changes made.' }] }
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
    }
  }
)

// ============================================
// delete_todos (batch)
// ============================================
server.registerTool(
  'delete_todos',
  {
    description: 'Delete multiple todos at once (plan-limited: Free 5, Pro 30, soft delete).',
    inputSchema: {
      todoIds: z.array(z.string()).describe('Array of todo UUIDs to delete (plan-limited)'),
    },
  },
  async (args) => {
    try {
      const result = await client.delete<{ deleted: string[]; errors: string[] }>(
        '/todos/batch', { todoIds: args.todoIds }
      )
      const { deleted, errors } = result
      let text = `Deleted ${deleted.length} todos.`
      if (errors.length > 0) text += `\nErrors: ${errors.join(', ')}`
      return { content: [{ type: 'text', text }] }
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
    }
  }
)

// stdio transport로 서버 시작
const transport = new StdioServerTransport()
await server.connect(transport)
