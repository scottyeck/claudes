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

# Output session data as JSON
claudes --json
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

## Raycast Extension

A Raycast extension is included for quick access to Claude sessions from anywhere.

### Setup

The Raycast extension reads from a cache file that must be kept updated by a background daemon.

**1. Install the daemon:**

```bash
# Copy the launchd plist to LaunchAgents
cp com.claudes.cache.plist ~/Library/LaunchAgents/

# Load the daemon (starts immediately, runs every 30 seconds)
launchctl load ~/Library/LaunchAgents/com.claudes.cache.plist
```

**2. Install the Raycast extension:**

```bash
cd raycast-extension
npm install
npm run dev   # Opens in Raycast for development
```

To install permanently, use `npm run build` and import the extension in Raycast.

### Managing the Daemon

```bash
# Check if daemon is running
launchctl list | grep claudes

# Stop the daemon
launchctl unload ~/Library/LaunchAgents/com.claudes.cache.plist

# Start the daemon
launchctl load ~/Library/LaunchAgents/com.claudes.cache.plist

# View daemon errors
cat /tmp/claudes-cache.err
```

### Why a Daemon?

Raycast runs extensions in a sandboxed environment that blocks `lsof` (used to discover Claude processes). The daemon runs outside the sandbox and writes session data to `~/.claude/sessions-cache.json`, which the Raycast extension reads directly.

## Requirements

- Node.js >= 18
- tmux (for jump-to-pane functionality)
- Claude Code instances running in tmux panes
- macOS (for Raycast extension and launchd daemon)

## How It Works

1. Discovers Claude Code processes via `lsof`
2. Reads session data from `~/.claude/projects/`
3. Correlates processes to tmux panes via TTY matching
4. Provides navigation to jump between sessions

## Project Structure

```
src/
├── index.ts      # CLI entry point
├── cli.ts        # CLI argument parsing
├── tui.ts        # Interactive TUI
├── render.ts     # Rendering functions
├── session.ts    # Session data collection
├── process.ts    # Process discovery
├── tmux.ts       # tmux integration
├── exec.ts       # Shell execution helper
└── types.ts      # TypeScript types

raycast-extension/
├── src/
│   └── index.tsx # Raycast extension
├── package.json  # Raycast manifest
└── assets/       # Extension icon

com.claudes.cache.plist  # launchd daemon config
```

## License

MIT
