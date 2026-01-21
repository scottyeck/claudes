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
git clone https://github.com/scottyeck/claudes
cd claudes
npm link
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

## License

MIT
