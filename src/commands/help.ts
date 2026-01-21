export function renderHelp(): string {
  return `repo-slice - deterministic repo context bundler

Usage:
  repo-slice pack [options]
  repo-slice workspaces
  repo-slice version

Pack options:
  --entry <path>           Add entry file anchor (repeatable)
  --symbol <query>         Add symbol query anchor (repeatable)
  --symbol-strict          Fail if any symbol resolves to multiple definitions
  --from-diff <revRange>   Add changed files + hunks as anchors
  --from-log <path>        Parse logs into file/line anchors
  --workspace <auto|name|path>
  --all-workspaces
  --fallback-all
  --depth <n>
  --budget-chars <n>
  --budget-tokens <n>
  --include-tests <auto|true|false>
  --format <md|json>
  --out <path>
  --reason
  --redact
  --debug
  --no-timestamp

Exit codes:
  0 success
  1 runtime error
  2 anchor resolution failure
  3 invalid CLI usage
`;
}
