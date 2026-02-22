# Coding Conventions

**Analysis Date:** 2026-02-22

## Naming Patterns

**Files:**
- kebab-case for all files (e.g., `gsd-tools.cjs`, `gsd-tools.test.cjs`)
- Test files: `*.test.cjs` (CommonJS test files, not TypeScript)
- Helper functions defined in same file for command implementations

**Functions:**
- camelCase for all functions (e.g., `safeReadFile`, `loadConfig`, `execGit`)
- Descriptive names prefixed with `cmd` for command handlers (e.g., `cmdGenerateSlug`, `cmdStateLoad`)
- Helper functions: `extract*`, `parse*`, `normalize*`, `exec*`, `create*`, `splice*` patterns
- No special prefix for async functions (all use `execSync` or sync patterns)

**Variables:**
- camelCase for local variables and parameters (e.g., `configPath`, `frontmatter`, `digest`)
- UPPER_SNAKE_CASE for constants in tables (e.g., `MODEL_PROFILES`)
- No underscore prefix (no private marker)
- Clear, descriptive names for complex structures

**Types:**
- Plain objects used as interfaces (no TypeScript interfaces)
- Parameter objects use object notation (e.g., `{ phase, name, overrides }`)
- Return values typically objects: `{ success, output, error }` or `{ created, reason }`

## Code Style

**Formatting:**
- Maintained by developer (no Prettier/ESLint config detected)
- 2 space indentation throughout
- Long lines (120+ characters) are acceptable
- Single quotes for strings (when quoted)
- Semicolons required at end of statements

**Linting:**
- No ESLint or formatting config detected
- Code follows Node.js patterns
- Focus on readability and correctness over automated rules

## Import Organization

**Order:**
1. Node.js built-in modules (`require('fs')`, `require('path')`, `require('child_process')`)
2. No external packages used
3. All functions defined in-file, no module imports

**Module Structure:**
- Single large file (`gsd-tools.cjs`, 5324 lines)
- Clear function sections separated by comments (`// ─── Section Name ───────`)
- Centralized helpers section at top
- Command implementations follow alphabetically

## Error Handling

**Patterns:**
- Defensive try/catch blocks with graceful fallbacks
- `safeReadFile()` returns `null` on error instead of throwing
- `loadConfig()` catches JSON parse errors and returns defaults
- Commands use dedicated `error()` function for exit with status 1
- Process exit codes: 0 for success, 1 for error

**Error Types:**
- Missing files: return `null` (for reads) or skip gracefully (for multiple files)
- Invalid JSON/YAML: catch, log context, return safe defaults
- Command validation: call `error()` immediately to exit
- File system errors: wrapped in try/catch with meaningful fallback behavior
- Always include context in error messages

**Error Messages:**
- Prefixed with 'Error: ' before writing to stderr
- Example: `error('text required for slug generation')`

## Logging

**Framework:**
- No logger library; using `console` or direct `process.stderr.write()`
- Standard output via `process.stdout.write()` for results
- Error output via `process.stderr.write()` for errors

**Patterns:**
- Minimal logging in committed code
- Debug information conveyed through return values (objects with `success`, `error`, `output`)
- Large JSON payloads written to temp files with `@file:` prefix if > 50KB
- Example: `const tmpPath = path.join(require('os').tmpdir(), 'gsd-${Date.now()}.json')`

## Comments

**When to Comment:**
- Document complex YAML parsing logic extensively
- Explain regex patterns and why they match specific structures
- Note edge cases in frontmatter handling
- Mark major sections with separator comments: `// ─── Section Name ────────────────`

**Section Comments:**
- Use `// ─── Section Name ───────────────────────────────────────────────────────` format
- Group related functions under clear headings
- Examples: `// ─── Model Profile Table ─`, `// ─── Helpers ──`, `// ─── Commands ──`

**Inline Comments:**
- Explain why not what (e.g., "Stack to track nested objects")
- Document YAML parsing edge cases
- Note intentional design decisions (e.g., temp files for large payloads)

**TODO Comments:**
- Not observed in codebase

## Function Design

**Size:**
- Functions range from 5-150 lines
- `extractFrontmatter()`: 75 lines (complex YAML parsing, acceptable)
- `reconstructFrontmatter()`: 60 lines (nested object serialization)
- Helpers extracted for reusable logic (e.g., `safeReadFile`, `execGit`)
- No hard line limit enforced, but shorter is preferred

**Parameters:**
- Max 3-4 parameters typical
- Destructuring used for options: `{ phase, name, overrides }`
- Long parameter lists use object pattern
- Example: `function cmdStateRecordMetric(cwd, options, raw)`

**Return Values:**
- Explicit returns always used
- Return objects with specific shape for consistency
- Result objects: `{ success, output, error }` (for command runners)
- JSON-serializable returns throughout
- Large payloads handled via temp file path

## Module Design

**Exports:**
- Single file exports functions at end: `module.exports = { ... }`
- Main entry point handles command routing with `process.argv`
- No barrel files (single-file codebase)

**Organization:**
- Monolithic design: all logic in one file
- Clear sections via comment separators
- Command functions grouped logically
- Helpers at top, commands in middle, main dispatch at bottom

**Boundaries:**
- `output()` function: universal result formatter, handles large payloads
- `error()` function: universal error exit handler
- Command functions: each handles single CLI operation
- No cross-cutting concerns via modules (all in one file)

---

*Convention analysis: 2026-02-22*
*Update when patterns change*
