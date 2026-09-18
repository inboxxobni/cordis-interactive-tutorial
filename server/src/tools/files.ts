/**
 * Filesystem tools: list_files, read_file, write_file, edit_file.
 * Write/edit emit file_changed so the file tree updates live.
 */
import type { FileAction } from '@cordis-tutorial/shared'
import type { Tool, ToolContext, ToolRunResult } from './registry.js'
import { clip } from './clip.js'

export const listFiles: Tool = {
  def: {
    name: 'list_files',
    description: 'List files and directories at a relative path (default "."). Returns names only.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Relative path to list. Defaults to the workspace root.' } },
    },
  },
  async run(_input, ctx): Promise<ToolRunResult> {
    const files = await ctx.workspace.list()
    return { result: files.length ? files.join('\n') : '(workspace is empty)', isError: false }
  },
}

export const readFile: Tool = {
  def: {
    name: 'read_file',
    description: 'Read the full contents of a file by relative path. Do not use on directories.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Relative path to the file.' } },
      required: ['path'],
    },
  },
  async run(input, ctx): Promise<ToolRunResult> {
    const rel = String(input.path ?? '')
    if (!rel) return { result: 'Error: path is required', isError: true }
    const content = await ctx.workspace.readFile(rel)
    return { result: clip(content), isError: false }
  },
}

export const writeFile: Tool = {
  def: {
    name: 'write_file',
    description: 'Write content to a relative path, creating parent directories as needed. Creates a new file or overwrites an existing one.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to the file.' },
        content: { type: 'string', description: 'Full file content.' },
      },
      required: ['path', 'content'],
    },
  },
  async run(input, ctx): Promise<ToolRunResult> {
    const rel = String(input.path ?? '')
    const content = String(input.content ?? '')
    if (!rel) return { result: 'Error: path is required', isError: true }
    const action = await ctx.workspace.writeFile(rel, content)
    emitFileChanged(ctx, rel, action, content)
    return { result: `Wrote ${content.length} chars to ${rel} (${action}). Call mount_plugin to activate it.`, isError: false }
  },
}

export const editFile: Tool = {
  def: {
    name: 'edit_file',
    description: 'Replace an exact old_str with new_str in a file. old_str must appear exactly once; empty old_str creates the file.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to the file.' },
        old_str: { type: 'string', description: 'Exact text to find. Empty to create the file.' },
        new_str: { type: 'string', description: 'Replacement text.' },
      },
      required: ['path', 'old_str', 'new_str'],
    },
  },
  async run(input, ctx): Promise<ToolRunResult> {
    const rel = String(input.path ?? '')
    const oldStr = String(input.old_str ?? '')
    const newStr = String(input.new_str ?? '')
    if (!rel) return { result: 'Error: path is required', isError: true }
    const action = await ctx.workspace.editFile(rel, oldStr, newStr)
    const content = await ctx.workspace.readFile(rel)
    emitFileChanged(ctx, rel, action, content)
    return { result: `Edited ${rel} (${action}). Call mount_plugin to reload it.`, isError: false }
  },
}

function emitFileChanged(ctx: ToolContext, rel: string, action: 'create' | 'edit', content: string): void {
  const fileAction: FileAction = action
  ctx.emit({ type: 'file_changed', path: rel, action: fileAction, content })
  void ctx.workspace.list().then((files) => {
    ctx.emit({ type: 'workspace_files', files })
  })
}
