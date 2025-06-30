import { promises as fs } from 'fs';
import { join } from 'path';

const WORKSPACE_DIR = join(process.cwd(), "workspace");
const TODOS_DIR = join(process.cwd(), "todos");
const PYTHON_SCRIPTS_DIR = join(process.cwd(), "python_scripts");
const TEST_DIRECTORIES = [WORKSPACE_DIR, TODOS_DIR, PYTHON_SCRIPTS_DIR];

async function ensureDirectoryExists(dirPath: string) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

async function cleanupDirectory(dirPath: string) {
  try {
    await fs.access(dirPath); // Check if directory exists
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await fs.rm(fullPath, { recursive: true, force: true });
      } else {
        await fs.unlink(fullPath);
      }
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // Directory doesn't exist, which is fine for cleanup
      return;
    }
    console.error(`Error cleaning up directory ${dirPath}:`, error);
    // Optionally re-throw or handle more gracefully
  }
}

export async function setupTestEnvironment() {
  // console.log("Setting up test environment...");
  for (const dir of TEST_DIRECTORIES) {
    await cleanupDirectory(dir); // Clean first
    await ensureDirectoryExists(dir); // Then ensure it exists
  }
  // console.log("Test environment setup complete.");
}

export async function cleanupTestEnvironment() {
  // console.log("Cleaning up test environment...");
  for (const dir of TEST_DIRECTORIES) {
    await cleanupDirectory(dir);
  }
  // console.log("Test environment cleanup complete.");
}

// Helper to create a file in workspace for specific tests
export async function createWorkspaceFile(filePath: string, content: string) {
    const fullPath = join(WORKSPACE_DIR, filePath);
    const dir = join(fullPath, '..');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');
}

// Helper to create a todo file for specific tests
export async function createTodoFile(fileName: string, content: string) {
    const fullPath = join(TODOS_DIR, fileName);
    await fs.mkdir(TODOS_DIR, { recursive: true }); // Ensure todos dir itself exists
    await fs.writeFile(fullPath, content, 'utf8');
}
