import { promises as fs } from "fs";
import { join } from "path";

// ディレクトリ定義
export const WORKSPACE_DIR = join(process.cwd(), "workspace");
export const TODOS_DIR = join(process.cwd(), "todos");
export const PYTHON_SCRIPTS_DIR = join(process.cwd(), "python_scripts");

// パスサニタイズ関数
export function sanitizePath(inputPath: string): string {
  // Remove any path traversal attempts
  return inputPath.replace(/\.\./g, '').replace(/^\/+/, '');
}

// ディレクトリ存在確認・作成
export async function ensureDirectories(): Promise<void> {
  for (const dir of [WORKSPACE_DIR, TODOS_DIR, PYTHON_SCRIPTS_DIR]) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
} 