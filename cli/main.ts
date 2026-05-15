#!/usr/bin/env bun
import { parseArgs } from './args'
import { SKILL_VERSION } from './version'
import {
  cmdInit,
  cmdAttach,
  cmdDoc,
  cmdCatalogue,
  cmdCompanion,
  cmdHints,
  cmdSource,
  cmdRevert,
  cmdReset,
} from './commands/lifecycle'
import { cmdHeartbeat, cmdNote, cmdTask, cmdTaskRm } from './commands/agent'
import {
  cmdFlagPost,
  cmdPull,
  cmdResolve,
  cmdPatch,
  cmdFullsource,
  cmdPunt,
  cmdCancel,
  cmdAccept,
  cmdDiscard,
  cmdSkip,
  cmdKeep,
  cmdDensity,
  cmdDensityPost,
} from './commands/work'
import { cmdEvents } from './commands/events'

type CommandFn = (args: ReturnType<typeof parseArgs>) => Promise<void>

const COMMANDS: Record<string, CommandFn> = {
  // lifecycle
  init: cmdInit,
  attach: cmdAttach,
  doc: cmdDoc,
  catalogue: cmdCatalogue,
  companion: cmdCompanion,
  hints: cmdHints,
  source: cmdSource,
  revert: cmdRevert,
  reset: cmdReset,
  // agent panel
  heartbeat: cmdHeartbeat,
  note: cmdNote,
  task: cmdTask,
  'task-rm': cmdTaskRm,
  // work
  'flag-post': cmdFlagPost,
  pull: cmdPull,
  resolve: cmdResolve,
  patch: cmdPatch,
  fullsource: cmdFullsource,
  punt: cmdPunt,
  cancel: cmdCancel,
  accept: cmdAccept,
  discard: cmdDiscard,
  skip: cmdSkip,
  keep: cmdKeep,
  density: cmdDensity,
  'density-post': cmdDensityPost,
  // events
  events: cmdEvents,
}

const HELP = `slopmop - CLI for the slopmop steering loop (skill v${SKILL_VERSION})

Usage: slopmop <command> [args] [flags]

Lifecycle:
  init <file> [--title T] [--host URL]    create a doc from a local file
  attach <url-or-id>                      attach to an existing doc
  doc [--json]                            show doc summary
  catalogue                               dump the pattern catalogue
  companion [--out path]                  fetch the wrap-up bundle
  hints get | hints set [--rungs ...]     read or set agent hints
  source <file>                           replace source (If-Match)
  revert [--to-version N]                 roll back to prior source
  reset <reason...>                       drafter soft reset

Agent panel:
  heartbeat                               ping the server
  note <kind> <body|@file|->              post a free-form note
  task <key> <status> [title...]          upsert a task
  task-rm <key>                           drop a task

Work:
  flag-post @file.json | -                submit detected flags
  pull [--rung 1,2] [--limit N] [--json]  pull pending directives
  patch <rid> <fid> <text|@file|->        single-patch resolution
  resolve @batch.json | -                 batch resolution
  fullsource <file> --responded-to rid... full-source push
  accept | discard | skip | keep <fid>    user state-transitions
  punt <rid> <reason...>                  drafter punted
  cancel <rid>                            user rescinded
  density [--json]                        show paragraph density cache
  density-post @file.json | -             submit per-paragraph scores
                                          (axes in [-10, +10]; 0 = baseline)

Events:
  events [--since N]                      stream SSE as NDJSON

Global flags:
  --host URL    override host
  --id DOCID    override doc id
  --json        emit raw JSON (where supported)
  --stdin       read body from stdin

The session lives at .slopmop/session.json in the cwd (auto-found via walk-up).
Set SLOPMOP_HOST and SLOPMOP_ID to override per-call.
`

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h' || argv[0] === 'help') {
    process.stdout.write(HELP)
    return
  }
  if (argv[0] === '--version' || argv[0] === '-v' || argv[0] === 'version') {
    process.stdout.write(`slopmop ${SKILL_VERSION}\n`)
    return
  }

  const args = parseArgs(argv)
  const fn = COMMANDS[args.verb]
  if (!fn) {
    process.stderr.write(`unknown command: ${args.verb}\n\n${HELP}`)
    process.exit(2)
  }

  try {
    await fn(args)
  } catch (e) {
    process.stderr.write(`error: ${e instanceof Error ? e.message : String(e)}\n`)
    process.exit(1)
  }
}

main()
