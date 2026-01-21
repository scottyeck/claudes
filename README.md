# claudes

Interactive CLI for managing Claude Code instances with tmux navigation.

## Features

- View status of all running Claude Code instances
- See project name, uptime, CPU usage, and conversation context
- Jump directly to any session's tmux pane
- Vim-style keyboard navigation
- Search/filter sessions by project name or prompt text

## Installation

```bash
npm install -g claudes
```

Or clone and link locally:

```bash
git clone https://github.com/scottyeck/claude-sessions
cd claude-sessions
npm install
npm run build
npm link
```

## Development

```bash
npm install          # Install dependencies
npm run build        # Build TypeScript to dist/
npm run dev          # Watch mode for development
npm start            # Run the built CLI
```

## Usage

```bash
# Launch interactive TUI
claudes

# Jump directly to session #2
claudes 2

# Jump to first project matching "cloud"
claudes cloud

# Non-interactive list output
claudes --list
```

## TUI Navigation

| Key | Action |
|-----|--------|
| `j` / `↓` | Move selection down |
| `k` / `↑` | Move selection up |
| `Enter` | Jump to selected session |
| `1-9` | Jump directly to session by number |
| `/` | Enter search mode |
| `Escape` | Exit search mode |
| `q` | Quit |

## Requirements

- Node.js >= 18
- tmux (for jump-to-pane functionality)
- Claude Code instances running in tmux panes

## How It Works

1. Discovers Claude Code processes via `lsof`
2. Reads session data from `~/.claude/projects/`
3. Correlates processes to tmux panes via TTY matching
4. Provides navigation to jump between sessions

## Project Structure

```
src/
├── index.ts    # Entry point
├── cli.ts      # CLI argument parsing
├── tui.ts      # Interactive TUI
├── render.ts   # Rendering functions
├── session.ts  # Session data collection
├── process.ts  # Process discovery
├── tmux.ts     # tmux integration
├── exec.ts     # Shell execution helper
└── types.ts    # TypeScript types
```

## License

MIT
