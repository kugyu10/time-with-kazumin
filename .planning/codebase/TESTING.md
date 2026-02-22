# Testing Patterns

**Analysis Date:** 2026-02-22

## Test Framework

**Runner:**
- Node.js built-in `node:test` module (no external test framework)
- Config: tests embedded in test file, no separate config file
- Version: Uses native Node.js test runner available in recent Node.js versions

**Assertion Library:**
- Node.js built-in `node:assert` module
- Matchers: `assert.ok()`, `assert.strictEqual()`, `assert.deepStrictEqual()`
- No third-party assertion library

**Run Commands:**
```bash
node /path/to/gsd-tools.test.cjs              # Run all tests
npm test                                       # Run tests (if script exists)
```

**Test File Location:**
- File: `/Users/kugyu10/work/かずみん/Time-with-Kazumin/.claude/get-shit-done/bin/gsd-tools.test.cjs`
- Paired with implementation: `gsd-tools.cjs`

## Test File Organization

**Location:**
- `*.test.cjs` alongside source files (collocated pattern)
- Single test file for entire application (2302 lines)

**Naming:**
- `gsd-tools.test.cjs` matches implementation `gsd-tools.cjs`
- Test suites named by command: `history-digest command`, `phases list command`, `state-snapshot command`
- Test names describe behavior: `empty phases directory returns valid schema`, `nested frontmatter fields extracted correctly`

**Structure:**
```
.claude/get-shit-done/bin/
  ├── gsd-tools.cjs           # Main implementation (5324 lines)
  └── gsd-tools.test.cjs      # Tests (2302 lines)
```

## Test Structure

**Suite Organization:**
```javascript
describe('history-digest command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('empty phases directory returns valid schema', () => {
    const result = runGsdTools('history-digest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const digest = JSON.parse(result.output);

    assert.deepStrictEqual(digest.phases, {}, 'phases should be empty object');
    assert.deepStrictEqual(digest.decisions, [], 'decisions should be empty array');
    assert.deepStrictEqual(digest.tech_stack, [], 'tech_stack should be empty array');
  });
});
```

**Patterns:**
- `describe()` wraps related test cases
- `beforeEach()` creates fresh temp directory for each test (critical for isolation)
- `afterEach()` cleans up temp directory and files
- Avoid `beforeAll()` due to test isolation requirements
- Each test restores state via cleanup helper

**Test Flow:**
1. **Setup:** `beforeEach()` creates isolated project structure
2. **Arrange:** Create test data (files, directories, YAML frontmatter)
3. **Act:** Call `runGsdTools()` helper with command and args
4. **Assert:** Use `assert.*()` methods with descriptive messages

## Mocking

**Framework:**
- No mocking library used (no Jest, Sinon, or Vitest)
- File system isolation via temp directories: `fs.mkdtempSync()`
- Process isolation via subprocess execution: `execSync()` to run CLI

**Patterns:**
```javascript
// Mock via temporary file system
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
});

// Mock via subprocess execution (actual CLI invocation)
function runGsdTools(args, cwd = process.cwd()) {
  try {
    const result = execSync(`node "${TOOLS_PATH}" ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, output: result.trim() };
  } catch (err) {
    return {
      success: false,
      output: err.stdout?.toString().trim() || '',
      error: err.stderr?.toString().trim() || err.message,
    };
  }
}
```

**What to Mock:**
- File system: Use temp directories, create test files with `fs.writeFileSync()`
- Child processes: Mocked by real subprocess execution (integration test approach)
- State files: Create real SUMMARY.md, STATE.md, ROADMAP.md with test content

**What NOT to Mock:**
- Core logic: Tests execute real implementation via subprocess
- YAML parsing: Tests exercise actual frontmatter extraction
- File I/O: Uses real temp filesystem, not mocked

## Fixtures and Factories

**Test Data:**
```javascript
// Factory function in test file
function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  return tmpDir;
}

// Inline test data creation
fs.writeFileSync(
  path.join(phaseDir, '01-01-SUMMARY.md'),
  `---
phase: "01"
name: "Foundation"
provides:
  - "Database"
  - "Auth system"
key-decisions:
  - "Use Prisma over Drizzle"
---

# Summary content
`
);
```

**Location:**
- Factory functions: defined at top of test file (`createTempProject`, `cleanup`)
- Test data: created inline within each test using `fs.writeFileSync()`
- No separate fixtures directory

**Cleanup Helper:**
```javascript
function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
```

## Coverage

**Requirements:**
- No enforced coverage target
- No coverage measurement tool configured
- Coverage tracked for awareness only

**Configuration:**
- No coverage config in test file
- No `--coverage` flag or similar
- Tests are acceptance tests, not unit tests (full CLI invocation)

## Test Types

**Unit Tests:**
- Not strictly unit tests
- Tests focus on individual commands but via full subprocess execution
- Examples: `cmdGenerateSlug`, `cmdCurrentTimestamp`, `cmdListTodos`
- Each command tested in isolation with specific args

**Integration Tests:**
- Majority of tests are integration tests
- Test multiple functions together (e.g., `history-digest` aggregates multiple SUMMARY.md files)
- Use real file system and real YAML parsing
- Examples: `history-digest command`, `state-snapshot command`, `phase-plan-index command`
- Example: `multiple phases merged into single digest` - creates multiple phase directories and verifies aggregation

**E2E Tests:**
- Not explicitly separate E2E tests
- CLI invocation pattern enables end-to-end testing (subprocess execution)
- Could be classified as E2E due to subprocess isolation

**Acceptance Testing Pattern:**
- Tests invoke CLI via subprocess: `execSync('node gsd-tools.cjs ...')`
- Black-box approach: tests verify outputs given inputs
- No mocking of internal functions
- High confidence that implementation works as deployed

## Common Patterns

**Subprocess Invocation:**
```javascript
const result = runGsdTools('history-digest', tmpDir);
assert.ok(result.success, `Command failed: ${result.error}`);
```

**JSON Parsing:**
```javascript
const digest = JSON.parse(result.output);
assert.deepStrictEqual(digest.phases, {}, 'phases should be empty object');
```

**Async File Operations:**
- Not used; all operations are synchronous
- Uses `fs.mkdirSync()`, `fs.writeFileSync()`, `fs.readFileSync()`

**Error Testing:**
```javascript
test('returns error for missing ROADMAP.md', () => {
  const result = runGsdTools('roadmap get-phase 1', tmpDir);
  assert.ok(!result.success, 'should fail');
  assert.ok(result.error.includes('not found'), 'error should mention not found');
});
```

**Backward Compatibility Testing:**
```javascript
test('flat provides field still works (backward compatibility)', () => {
  fs.writeFileSync(
    path.join(phaseDir, '01-01-SUMMARY.md'),
    `---
phase: "01"
provides:
  - "Direct provides"
---`
  );

  const result = runGsdTools('history-digest', tmpDir);
  const digest = JSON.parse(result.output);
  assert.deepStrictEqual(
    digest.phases['01'].provides,
    ['Direct provides'],
    'Direct provides should work'
  );
});
```

**Malformed Input Handling:**
```javascript
test('malformed SUMMARY.md skipped gracefully', () => {
  // Create valid summary
  fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), `---
phase: "01"
provides:
  - "Valid feature"
---`);

  // Create malformed summary (no frontmatter)
  fs.writeFileSync(path.join(phaseDir, '01-02-SUMMARY.md'), `# Just heading
No frontmatter`);

  const result = runGsdTools('history-digest', tmpDir);
  assert.ok(result.success, `Command should succeed despite malformed files`);
  const digest = JSON.parse(result.output);
  assert.ok(digest.phases['01'].provides.includes('Valid feature'));
});
```

## Test Organization by Command

**Test Suites (in order of appearance):**
1. `history-digest command` (7 tests) - YAML frontmatter parsing, aggregation
2. `phases list command` (5 tests) - Phase directory listing
3. `roadmap get-phase command` (5 tests) - Roadmap markdown parsing
4. `phase next-decimal command` (4 tests) - Phase numbering logic
5. `phase-plan-index command` (4 tests) - Plan indexing
6. `state-snapshot command` (4 tests) - STATE.md parsing
7. `config-ensure-section command` (2 tests) - Config initialization
8. `todo complete command` (2 tests) - Todo file operations
9. `scaffold command` (5 tests) - File scaffolding

**Total Test Count:** 38 test cases across 9 test suites

---

*Testing analysis: 2026-02-22*
*Update when test patterns change*
