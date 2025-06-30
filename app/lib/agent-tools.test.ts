import assert from 'assert';
// executeAgentTool と availableTools は app/lib/agent-tools.ts からエクスポートされている前提
// _internal_resetToolCallHistory も同様
import { executeAgentTool, _internal_resetToolCallHistory, availableTools } from './agent-tools';
import { setupTestEnvironment, cleanupTestEnvironment, createWorkspaceFile } from './test-utils';


async function testToolLoopDetection() {
  console.log('Testing Tool Loop Detection...');
  const testToolName = 'get_current_time'; // パラメータなしのツール

  // --- Test Case 1: Detect loop ---
  console.log('Running Loop Test Case 1: Detect loop');
  _internal_resetToolCallHistory();
  for (let i = 0; i < 3; i++) { // MAX_IDENTICAL_CALLS_IN_WINDOW = 3
    const result = await executeAgentTool(testToolName, {});
    if (i < 2) { // 最初の2回は成功するはず
      assert(result.success, `Loop Test 1-${i}: Expected success before loop detection. Result: ${JSON.stringify(result)}`);
    } else { // 3回目でループ検出
      assert(!result.success, `Loop Test 1-${i}: Expected loop detection failure. Result: ${JSON.stringify(result)}`);
      assert(result.isLoopDetected, `Loop Test 1-${i}: Expected isLoopDetected to be true. Result: ${JSON.stringify(result)}`);
      assert(String(result.error).includes('infinite loop'), `Loop Test 1-${i}: Error message should mention loop. Error: ${result.error}`);
    }
  }
  console.log('Loop Test Case 1 PASSED');

  // --- Test Case 2: No loop with different params ---
  console.log('Running Loop Test Case 2: No loop with different params');
  _internal_resetToolCallHistory();
  const fileTool = 'create_file';
  // workspaceディレクトリが存在し、書き込み可能である必要がある
  await setupTestEnvironment(); // Ensure clean environment for this specific test case
  let result = await executeAgentTool(fileTool, { path: 'test1.txt', content: 'hello' });
  assert(result.success, `Loop Test 2-1: Create file 1 should succeed. Result: ${JSON.stringify(result)}`);
  result = await executeAgentTool(fileTool, { path: 'test2.txt', content: 'hello' });
  assert(result.success, `Loop Test 2-2: Create file 2 should succeed (different params). Result: ${JSON.stringify(result)}`);
  result = await executeAgentTool(fileTool, { path: 'test1.txt', content: 'world' }); // 同じパスだが内容が異なる
  assert(result.success, `Loop Test 2-3: Create file 1 again with different content should succeed. Result: ${JSON.stringify(result)}`);
  await cleanupTestEnvironment(); // Clean up after this specific test case
  console.log('Loop Test Case 2 PASSED');


  // --- Test Case 3: No loop with different tools ---
  console.log('Running Loop Test Case 3: No loop with different tools');
  _internal_resetToolCallHistory();
  result = await executeAgentTool('get_current_time', {});
  assert(result.success, `Loop Test 3-1: Tool 1 (get_current_time) should succeed. Result: ${JSON.stringify(result)}`);
  result = await executeAgentTool('list_files', {}); // 別のツール
  assert(result.success, `Loop Test 3-2: Tool 2 (list_files) should succeed. Result: ${JSON.stringify(result)}`);
  result = await executeAgentTool('get_current_time', {});
  assert(result.success, `Loop Test 3-3: Tool 1 (get_current_time) again should succeed. Result: ${JSON.stringify(result)}`);
  console.log('Loop Test Case 3 PASSED');


  // --- Test Case 4: Loop detection resets after window ---
  console.log('Running Loop Test Case 4: Loop detection resets after window');
  _internal_resetToolCallHistory();
  await executeAgentTool(testToolName, {}); // call 1
  // assert(toolCallHistory.length === 1, "History length should be 1 after first call"); // 内部状態のテストは避ける
  await executeAgentTool(testToolName, {}); // call 2
  // assert(toolCallHistory.length === 2, "History length should be 2 after second call"); // 内部状態のテストは避ける

  console.log(`Loop Test Case 4: Waiting for ${5000 + 1000}ms for history window to pass...`); // LOOP_DETECTION_WINDOW_MS = 5000ms
  await new Promise(resolve => setTimeout(resolve, 6000)); // 少し長めに待つ

  result = await executeAgentTool(testToolName, {}); // call 3 (should not be a loop as window passed)
  assert(result.success, `Loop Test Case 4: Expected success after window passed. Result: ${JSON.stringify(result)}`);
  // 内部状態 `toolCallHistory.length` のアサーションは削除またはコメントアウト
  // console.log('Debug: History length after third call (window passed):', _internal_getToolCallHistoryLength()); // テスト用ヘルパーがあれば

  // さらに、MAX_HISTORY_AGE_MS を超えるテスト
  console.log(`Loop Test Case 4: Waiting for ${60 * 1000 + 1000}ms for MAX_HISTORY_AGE_MS to pass...`);
  _internal_resetToolCallHistory(); // Reset for this specific sub-test
  await executeAgentTool(testToolName, {}); // Call 1, timestamp recorded
  await new Promise(resolve => setTimeout(resolve, 61000)); // MAX_HISTORY_AGE_MS = 60000ms, so Call 1 is now old

  // Call 2, pruneOldHistory in recordCall should remove Call 1
  await executeAgentTool(testToolName, {});
  // ここで履歴の長さを確認するには、やはりテスト用のヘルパーが必要になる。
  // 今回は、このシナリオでループが発生しないこと（つまり executeAgentTool が成功すること）を暗黙的に確認するに留める。
  // もしループ検出ロジックが pruneOldHistory を正しく呼ばないと、古い Call 1 が原因で誤検出する可能性があるが、
  // LOOP_DETECTION_WINDOW_MS の方がずっと短いため、この特定のテストでは MAX_HISTORY_AGE_MS の prune の効果は直接観測しにくい。
  // このテストは、主に「長期間後に再度呼び出しても問題ない」ことを確認する。

  console.log('Loop Test Case 4 PASSED');

  console.log('Tool Loop Detection tests completed.');
}

// --- File System Tools Tests ---
async function testFileSystemTools() {
  console.log('Testing File System Tools...');
  await setupTestEnvironment(); // このテストスイート専用のセットアップ

  const createFileTool = 'create_file';
  const readFileTool = 'read_file';
  const listFilesTool = 'list_files';
  const createFolderTool = 'create_folder';

  // Test create_file and read_file
  console.log('Running FS Test: create_file & read_file');
  const filePath = 'test_fs_file.txt';
  const fileContent = `Hello from test! Timestamp: ${Date.now()}`;
  let result = await executeAgentTool(createFileTool, { path: filePath, content: fileContent });
  assert(result.success, `FS Test: create_file should succeed. ${JSON.stringify(result)}`);
  assert(result.success && result.result && (result.result as any).path === filePath, `FS Test: create_file path mismatch. ${(result.result as any)?.path}`);

  result = await executeAgentTool(readFileTool, { path: filePath });
  assert(result.success, `FS Test: read_file should succeed. ${JSON.stringify(result)}`);
  assert(result.success && result.result && (result.result as any).content === fileContent, `FS Test: read_file content mismatch.`);
  console.log('FS Test: create_file & read_file PASSED');

  // Test list_files
  console.log('Running FS Test: list_files');
  result = await executeAgentTool(listFilesTool, { path: '.' }); // Current workspace dir
  assert(result.success, `FS Test: list_files should succeed. ${JSON.stringify(result)}`);
  assert(result.success && result.result && Array.isArray((result.result as any).files), `FS Test: list_files should return an array of files. ${JSON.stringify(result.result)}`);
  const foundFile = result.success && result.result && (result.result as any).files.find((f: any) => f.name === filePath);
  assert(foundFile, `FS Test: list_files should contain the created file. ${filePath}`);
  console.log('FS Test: list_files PASSED');

  // Test create_folder
  console.log('Running FS Test: create_folder');
  const folderPath = 'test_fs_folder';
  result = await executeAgentTool(createFolderTool, { path: folderPath });
  assert(result.success, `FS Test: create_folder should succeed. ${JSON.stringify(result)}`);
  assert(result.success && result.result && (result.result as any).path === folderPath, `FS Test: create_folder path mismatch. ${(result.result as any)?.path}`);

  result = await executeAgentTool(listFilesTool, { path: '.' });
  const foundFolder = result.success && result.result && (result.result as any).files.find((f: any) => f.name === folderPath && f.type === 'directory');
  assert(foundFolder, `FS Test: list_files should contain the created folder. ${folderPath}`);
  console.log('FS Test: create_folder PASSED');

  // Error case: read non-existent file
  console.log('Running FS Test: read non-existent file');
  result = await executeAgentTool(readFileTool, { path: 'non_existent_file.txt' });
  assert(result.success, `FS Test: executeAgentTool for read non-existent file should succeed at wrapper level. ${JSON.stringify(result)}`);
  assert(result.result && !(result.result as any).success, `FS Test: read non-existent file's inner result should indicate failure. ${JSON.stringify(result.result)}`);
  assert(result.result && (result.result as any).errorType === 'FileNotFoundError', `FS Test: read non-existent file wrong error type. ${(result.result as any)?.errorType}`);
  console.log('FS Test: read non-existent file PASSED');

  // Error case: create file in non-existent nested path (should be created by recursive mkdir in tool)
  console.log('Running FS Test: create file in deep path');
  const deepFilePath = 'deep/nested/test_deep_file.txt';
  result = await executeAgentTool(createFileTool, { path: deepFilePath, content: "deep content" });
  assert(result.success, `FS Test: create_file in deep path should succeed. ${JSON.stringify(result)}`);
  // 確認のために読み込む
  result = await executeAgentTool(readFileTool, { path: deepFilePath });
  assert(result.success && result.result && (result.result as any).content === "deep content", `FS Test: read deep file content mismatch. Found: ${(result.result as any)?.content}`);
  console.log('FS Test: create file in deep path PASSED');


  await cleanupTestEnvironment(); // このテストスイート専用のクリーンアップ
  console.log('File System Tools tests completed.');
}


// --- Python Execution Test ---
async function testPythonExecution() {
  console.log('Testing Python Execution Tool...');
  await setupTestEnvironment(); // Pythonスクリプトが一時的に作成されるため

  const pythonTool = 'execute_python';

  // Test simple print
  console.log('Running Python Test: simple print');
  let result = await executeAgentTool(pythonTool, { code: 'print("Hello Python")' });
  assert(result.success, `Python Test: simple print should succeed. ${JSON.stringify(result)}`);
  assert(result.success && result.result && String((result.result as any).output).includes("Hello Python"), `Python Test: simple print output mismatch. ${(result.result as any)?.output}`);
  console.log('Python Test: simple print PASSED');

  // Test calculation
  console.log('Running Python Test: calculation');
  result = await executeAgentTool(pythonTool, { code: 'print(1 + 2)' });
  assert(result.success, `Python Test: calculation should succeed. ${JSON.stringify(result)}`);
  assert(result.success && result.result && String((result.result as any).output).includes("3"), `Python Test: calculation output mismatch. ${(result.result as any)?.output}`);
  console.log('Python Test: calculation PASSED');

  // Test error case: syntax error
  console.log('Running Python Test: syntax error');
  result = await executeAgentTool(pythonTool, { code: 'print("Hello" syntax_error)' });
  assert(result.success, `Python Test: executeAgentTool for syntax error should succeed at wrapper level. ${JSON.stringify(result)}`);
  assert(result.result && !(result.result as any).success, `Python Test: syntax error's inner result should indicate failure. ${JSON.stringify(result.result)}`);
  assert(result.result && ((result.result as any).errorType === 'SyntaxError' || String((result.result as any).error).includes("SyntaxError")), `Python Test: syntax error type mismatch. ${(result.result as any)?.errorType} - ${(result.result as any)?.error}`);
  console.log('Python Test: syntax error PASSED');

  // Test error case: runtime error
  console.log('Running Python Test: runtime error');
  result = await executeAgentTool(pythonTool, { code: 'print(1/0)' });
  assert(result.success, `Python Test: executeAgentTool for runtime error should succeed at wrapper level. ${JSON.stringify(result)}`);
  assert(result.result && !(result.result as any).success, `Python Test: runtime error's inner result should indicate failure. ${JSON.stringify(result.result)}`);
  assert(result.result && ((result.result as any).errorType === 'ZeroDivisionError' || String((result.result as any).error).includes("ZeroDivisionError")), `Python Test: runtime error type mismatch. ${(result.result as any)?.errorType} - ${(result.result as any)?.error}`);
  console.log('Python Test: runtime error PASSED');

  console.log('Python Execution Tool tests completed.');
  await cleanupTestEnvironment(); // Pythonテストのクリーンアップ
}


// --- Main test execution ---
async function runAllTests() {
  let testsPassed = true;
  // await setupTestEnvironment(); // 全体的な初期セットアップは各スイートに任せるか、ここで一括か選択
  try {
    console.log("Starting all tests...");
    await testToolLoopDetection(); // これはファイルシステムに依存しない想定
    await testFileSystemTools();
    await testPythonExecution();
    // await testTodoTools(); // Todoツールのテストも追加する場合 (setup/cleanupが必要)
    console.log("All test suites seem to have passed based on no thrown errors by this point.");
  } catch (e: any) {
    console.error("A test suite failed:", e.message, e.stack);
    testsPassed = false;
  } finally {
    // await cleanupTestEnvironment(); // 全体的な最終クリーンアップ (各スイートが個別に行うなら不要な場合も)
    console.log(`All tests finished. Overall status: ${testsPassed ? 'PASSED' : 'FAILED'}`);
    if (!testsPassed) {
        process.exit(1); // エラーがあった場合は終了コード1で抜ける
    }
  }
}

// このファイルが直接実行された場合にテストを実行 (例: node app/lib/agent-tools.test.js)
if (require.main === module) {
  console.log("Running agent-tools tests...");
  runAllTests().catch(error => {
    console.error("Unhandled error during tests:", error);
    process.exit(1);
  });
}

// Export for potential programmatic use (though typically not needed for test files)
export { runAllTests, testToolLoopDetection, testFileSystemTools, testPythonExecution };

// Note: To run this, you'll need:
// 1. Node.js environment.
// 2. `agent-tools.ts` to be compiled to JS or use a TS runner like ts-node.
// 3. The `workspace`, `todos`, `python_scripts` directories to exist or be created by setup.
//    The tools themselves have `ensureDirectories` but tests might need cleaner setup/teardown.
// 4. For Python execution, a `python3` command available in the PATH.
//
// Command to run (assuming agent-tools.js exists in the same directory):
// node agent-tools.test.js
// Or with ts-node:
// npx ts-node app/lib/agent-tools.test.ts
//
// Consider adding a dedicated test script in package.json.
// "test:agent-tools": "npx ts-node app/lib/agent-tools.test.ts"
