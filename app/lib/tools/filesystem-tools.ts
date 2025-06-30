import { promises as fs } from "fs";
import { join } from "path";
import { AgentTool } from "./types";
import { 
  createFileSchema, 
  createFolderSchema, 
  readFileSchema, 
  listFilesSchema 
} from "./schemas";
import { 
  WORKSPACE_DIR, 
  sanitizePath, 
  ensureDirectories 
} from "./helpers/file-utils";

export const filesystemTools: AgentTool[] = [
  {
    name: "create_file",
    description: "Create a new file with specified content in the workspace",
    category: "filesystem",
    parameters: createFileSchema,
    execute: async (params) => {
      try {
        await ensureDirectories();
        const { path, content, sessionId } = params as { path: string; content: string; sessionId?: string };
        const sanitizedPath = sanitizePath(path);
        const baseDir = sessionId ? join(WORKSPACE_DIR, sanitizePath(sessionId)) : WORKSPACE_DIR;
        const fullPath = join(baseDir, sanitizedPath);
        
        // Ensure parent directory exists
        const parentDir = join(fullPath, '..');
        await fs.mkdir(parentDir, { recursive: true });
        
        await fs.writeFile(fullPath, content, 'utf8');
        const stats = await fs.stat(fullPath);
        
        return {
          success: true,
          message: `File created at workspace/${sessionId ? `${sessionId}/` : ''}${sanitizedPath}`,
          path: sessionId ? `${sessionId}/${sanitizedPath}` : sanitizedPath,
          size: stats.size,
          content: content,
          fullPath: fullPath,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to create file: ${error}`,
        };
      }
    },
  },
  {
    name: "create_folder",
    description: "Create a new folder in the workspace",
    category: "filesystem",
    parameters: createFolderSchema,
    execute: async (params) => {
      try {
        await ensureDirectories();
        const { path, sessionId } = params as { path: string; sessionId?: string };
        const sanitizedPath = sanitizePath(path);
        const baseDir = sessionId ? join(WORKSPACE_DIR, sanitizePath(sessionId)) : WORKSPACE_DIR;
        const fullPath = join(baseDir, sanitizedPath);
        
        await fs.mkdir(fullPath, { recursive: true });
        
        return {
          success: true,
          message: `Folder created at workspace/${sessionId ? `${sessionId}/` : ''}${sanitizedPath}`,
          path: sessionId ? `${sessionId}/${sanitizedPath}` : sanitizedPath,
          fullPath: fullPath,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to create folder: ${error}`,
        };
      }
    },
  },
  {
    name: "read_file",
    description: "Read the contents of a file from the workspace",
    category: "filesystem",
    parameters: readFileSchema,
    execute: async (params) => {
      try {
        await ensureDirectories();
        const { path, sessionId } = params as { path: string; sessionId?: string };
        const sanitizedPath = sanitizePath(path);
        const baseDir = sessionId ? join(WORKSPACE_DIR, sanitizePath(sessionId)) : WORKSPACE_DIR;
        const fullPath = join(baseDir, sanitizedPath);
        
        const content = await fs.readFile(fullPath, 'utf8');
        const stats = await fs.stat(fullPath);
        
        return {
          success: true,
          content,
          path: sessionId ? `${sessionId}/${sanitizedPath}` : sanitizedPath,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          encoding: 'utf8',
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to read file: ${error}`,
        };
      }
    },
  },
  {
    name: "list_files",
    description: "List files and folders in a directory within the workspace",
    category: "filesystem",
    parameters: listFilesSchema,
    execute: async (params) => {
      try {
        await ensureDirectories();
        const { path = '.', sessionId } = params as { path?: string; sessionId?: string };
        const sanitizedPath = sanitizePath(path);
        const baseDir = sessionId ? join(WORKSPACE_DIR, sanitizePath(sessionId)) : WORKSPACE_DIR;
        const fullPath = join(baseDir, sanitizedPath);
        
        const entries = await fs.readdir(fullPath, { withFileTypes: true });
        const files = [];
        const folders = [];
        
        for (const entry of entries) {
          const entryPath = join(fullPath, entry.name);
          const stats = await fs.stat(entryPath);
          
          const item = {
            name: entry.name,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            relativePath: join(sanitizedPath, entry.name).replace(/\\/g, '/'),
          };
          
          if (entry.isDirectory()) {
            folders.push(item);
          } else {
            files.push(item);
          }
        }
        
        return {
          success: true,
          path: sessionId ? `${sessionId}/${sanitizedPath}` : sanitizedPath,
          files,
          folders,
          totalFiles: files.length,
          totalFolders: folders.length,
          workspaceRoot: baseDir,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to list files: ${error}`,
        };
      }
    },
  },
]; 