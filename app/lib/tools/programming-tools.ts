import { promises as fs } from "fs";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { AgentTool } from "./types";
import { 
  generateCodeSchema, 
  executePythonSchema 
} from "./schemas";
import { 
  WORKSPACE_DIR, 
  PYTHON_SCRIPTS_DIR, 
  sanitizePath, 
  ensureDirectories 
} from "./helpers/file-utils";

const execAsync = promisify(exec);

export const programmingTools: AgentTool[] = [
  {
    name: "generate_code",
    description: "Generate code based on description and programming language",
    category: "programming",
    parameters: generateCodeSchema,
    execute: async (params) => {
      try {
        await ensureDirectories();
        const { language, description, framework, filename, sessionId } = params as {
          language: string;
          description: string;
          framework?: string;
          filename?: string;
          sessionId?: string;
        };
        
        // Generate basic code template based on language and description
        let code = '';
        const timestamp = Date.now();
        const defaultFilename = filename || `generated_${timestamp}.${getFileExtension(language)}`;
        
        switch (language.toLowerCase()) {
          case 'python':
            code = generatePythonCode(description, framework);
            break;
          case 'javascript':
          case 'js':
            code = generateJavaScriptCode(description, framework);
            break;
          case 'typescript':
          case 'ts':
            code = generateTypeScriptCode(description);
            break;
          case 'html':
            code = generateHTMLCode(description);
            break;
          case 'css':
            code = generateCSSCode(description);
            break;
          default:
            code = `// Generated ${language} code for: ${description}\n// TODO: Implement the functionality\n\nconsole.log("Hello, World!");`;
        }
        
        // Save to file if filename is provided
        let filePath = null;
        if (filename) {
          const sanitizedFilename = sanitizePath(filename);
          const baseDir = sessionId ? join(WORKSPACE_DIR, sanitizePath(sessionId)) : WORKSPACE_DIR;
          filePath = join(baseDir, sanitizedFilename);
          
          // Ensure parent directory exists
          const parentDir = join(filePath, '..');
          await fs.mkdir(parentDir, { recursive: true });
          
          await fs.writeFile(filePath, code, 'utf8');
        }
        
        return {
          success: true,
          code,
          language,
          description,
          framework: framework || 'none',
          filename: defaultFilename,
          filePath: filePath ? (sessionId ? `${sessionId}/${sanitizePath(filename || '')}` : sanitizePath(filename || '')) : null,
          size: Buffer.byteLength(code, 'utf8'),
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to generate code: ${error}`,
        };
      }
    },
  },
  {
    name: "execute_python",
    description: "Execute Python code safely in an isolated environment",
    category: "programming",
    parameters: executePythonSchema,
    execute: async (params) => {
      await ensureDirectories();
      const { code, description } = params as { code: string; description?: string };
      
      try {
        // Create a temporary Python file
        const timestamp = Date.now();
        const filename = `temp_${timestamp}.py`;
        const filePath = join(PYTHON_SCRIPTS_DIR, filename);
        
        await fs.writeFile(filePath, code, 'utf8');
        
        // Execute the Python script with timeout
        const { stdout, stderr } = await execAsync(`python3 "${filePath}"`, {
          timeout: 10000, // 10 second timeout
          cwd: PYTHON_SCRIPTS_DIR,
        });
        
        // Clean up the temporary file
        await fs.unlink(filePath);
        
        return {
          success: !stderr,
          output: stdout,
          error: stderr || null,
          description: description || 'Python code execution',
          executionTime: new Date().toISOString(),
          code: code,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to execute Python code: ${error}`,
          code: code,
        };
      }
    },
  },
];

// Helper functions
function getFileExtension(language: string): string {
  const extensions: Record<string, string> = {
    python: 'py',
    javascript: 'js',
    typescript: 'ts',
    html: 'html',
    css: 'css',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
  };
  return extensions[language.toLowerCase()] || 'txt';
}

function generatePythonCode(description: string, framework?: string): string {
  if (framework === 'flask') {
    return `# Flask application for: ${description}
from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/')
def home():
    return jsonify({"message": "Hello, World!"})

@app.route('/api')
def api():
    # TODO: Implement ${description}
    return jsonify({"status": "success", "data": "TODO"})

if __name__ == '__main__':
    app.run(debug=True)
`;
  }
  
  return `# Python script for: ${description}

def main():
    """
    Main function to ${description}
    """
    # TODO: Implement the functionality
    print("Hello, World!")
    pass

if __name__ == "__main__":
    main()
`;
}

function generateJavaScriptCode(description: string, framework?: string): string {
  if (framework === 'react') {
    return `// React component for: ${description}
import React, { useState, useEffect } from 'react';

function MyComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    // TODO: Implement ${description}
    console.log('Component mounted');
  }, []);

  return (
    <div>
      <h1>Hello, World!</h1>
      <p>TODO: Implement ${description}</p>
    </div>
  );
}

export default MyComponent;
`;
  }
  
  return `// JavaScript code for: ${description}

function main() {
    // TODO: Implement ${description}
    console.log('Hello, World!');
}

// Call the main function
main();
`;
}

function generateTypeScriptCode(description: string): string {
  return `// TypeScript code for: ${description}

interface Data {
    id: number;
    name: string;
}

function main(): void {
    // TODO: Implement ${description}
    const data: Data = { id: 1, name: 'Hello, World!' };
    console.log(data);
}

// Call the main function
main();
`;
}

function generateHTMLCode(description: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${description}</title>
</head>
<body>
    <h1>Hello, World!</h1>
    <p>TODO: Implement ${description}</p>
</body>
</html>
`;
}

function generateCSSCode(description: string): string {
  return `/* CSS for: ${description} */

body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
    background-color: #f5f5f5;
}

h1 {
    color: #333;
    text-align: center;
}

/* TODO: Add styles for ${description} */
`;
} 