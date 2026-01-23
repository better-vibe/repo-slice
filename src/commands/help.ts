export function renderHelp(): string {
  return `repo-slice - deterministic repo context bundler

Usage:
  repo-slice pack [options]
  repo-slice graph [options]
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

Graph options:
  --entry <path>           Add entry file anchor (repeatable)
  --symbol <query>         Add symbol query anchor (repeatable)
  --from-diff <revRange>   Add changed files as anchors
  --from-log <path>        Parse logs into file/line anchors
  --workspace <auto|name|path>
  --all-workspaces
  --graph-type <imports|calls|combined>
  --depth <n>
  --include-tests <auto|true|false>
  --include-external
  --max-nodes <n>
  --max-edges <n>
  --collapse <none|external|file|class>
  --format <json|dot>
  --out <path>
  --no-timestamp

Exit codes:
  0 success
  1 runtime error
  2 anchor resolution failure
  3 invalid CLI usage
`;
}
