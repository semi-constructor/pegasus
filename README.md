<div align="center">

# 🦅 Pegasus

**A production-ready, feature-rich Discord bot built with TypeScript.**  
Economy · Moderation · XP · Tickets · Giveaways · AutoMod · JTC · i18n

[![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?style=flat-square&logo=discord&logoColor=white)](https://discord.js.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-316192?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

[Support Server](https://discord.gg/vaultscope) · [Developer](https://cptcr.uk) · [Report a Bug](https://github.com/cptcr/pegasus/issues)

</div>

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Commands](#commands)
  - [Admin](#-admin)
  - [Configuration](#-configuration)
  - [Economy](#-economy)
  - [Fun](#-fun)
  - [Giveaways](#-giveaways)
  - [Moderation & AutoMod](#-moderation--automod)
  - [Tickets](#-tickets)
  - [Utility](#-utility)
  - [XP & Engagement](#-xp--engagement)
- [Bot Permissions](#bot-permissions)
- [Security](#security)
- [Internationalization](#internationalization)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### 🛡️ Advanced Moderation
Complete staff moderation toolkit with audit trails and automated penalty escalation.
- **Core Actions** — Ban, kick, timeout, mute, unmute, unban, purge, lock, unlock, slowmode
- **Warning Engine** — Title, description, level, and proof attachment support. Automation rules that automatically timeout or ban users when warning thresholds are hit
- **AutoMod V2** — Keyword, regex, mention-spam, and attachment-spam triggers with configurable actions (delete, warn, timeout, infraction points)
- **Quarantine Vault** — Automatically isolates suspicious accounts by stripping roles until staff review and release them
- **Word Filter** — Literal and regex pattern filtering with severity levels (Low / Medium / High / Critical), auto-delete, and log channel alerts
- **Case Management** — Persistent moderation case log with per-case view and delete

### 💰 Full Economy System
- **Earning** — Daily rewards with streak bonuses, structured `work` command (cooldown-gated), `rob` with protection items
- **Gambling** — Dice, coinflip, slots, blackjack, roulette
- **Shop** — Fully customisable server item shop with buy, use, and inventory management

### 📈 XP, Leveling & Engagement
- **Text & Voice XP** — Configurable multipliers per channel and for server boosters
- **Visual Rank Cards** — Fully customisable colour and aesthetic settings
- **Leaderboards** — Paginated server-wide rankings
- **Role Rewards** — Automatic role grants at configurable level milestones
- **Quests** — Daily message and voice-time goals
- **Achievements** — Unlockable achievement system
- **Prestige** — Reset at max level to gain a prestige rank
- **Reputation / Thanks** — Peer-to-peer recognition system

### 🎉 Giveaway System
- Simple and advanced (modal-driven) giveaway creation
- Multi-winner selection, custom embed image and thumbnail
- Entry requirements — required role, minimum XP level, minimum account age
- Bonus entry multipliers for specific roles or server boosters
- Immediate end, winner reroll, post-giveaway announcements

### 🎟️ Ticket System
- Multi-panel setup with custom titles, descriptions, button styles, and welcome messages
- Multi-department support with per-department staff roles and category routing
- Staff actions — claim, close (with reason), lock, freeze
- Ticket statistics dashboard

### 🔊 Join-to-Create (JTC)
- Users join a master base channel to instantly spawn a private voice room
- Interactive management panel — lock/unlock, set user limit
- Automatic cleanup when the last user leaves
- Custom channel name format templates

### ⚙️ Configuration
- Welcome / goodbye messages with rich embed builder
- Auto-role on join
- Server-wide and per-user language settings
- XP and economy per-guild configuration
- Mod-log channel routing by category (messages, members, moderation, word filter)
- Custom rich embeds and reaction roles

### 🔧 Utility
- User / role / server info lookups
- Full-size avatar and profile banner fetcher
- Steam profile integration
- Websocket latency check
- Interactive help command with autocomplete

### 🌐 REST API & Monitoring Dashboard
- Secure Express REST API with Bearer token authentication
- Endpoints for live guild analytics, database query profiling, cache metrics, and module management
- Multi-tier rate limiting, in-memory caching, and batch query aggregation

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **TypeScript 5.0** | Type-safe, strict-mode development |
| **Discord.js v14** | Latest Discord API (slash commands, modals, select menus) |
| **PostgreSQL 16** | Primary relational database |
| **Drizzle ORM** | Type-safe, schema-first database queries |
| **Zod** | Runtime input validation |
| **i18next** | Internationalisation framework |
| **Express** | Built-in REST API server |
| **Winston** | Structured logging |
| **Node.js 18+** | Runtime |

---

## Prerequisites

- **Node.js** v18.0.0 or higher
- **PostgreSQL** v14 or higher
- **npm** v9.0.0 or higher
- A [Discord Application](https://discord.com/developers/applications) with a bot token

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/cptcr/pegasus.git
cd pegasus
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create the database

```sql
CREATE DATABASE pegasus;
```

### 4. Configure environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

See [Configuration](#configuration) for a full explanation of every variable.

### 5. Run database migrations

```bash
npm run migrate
```

### 6. Deploy slash commands

```bash
npm run deploy
```

### 7. Start the bot

```bash
# Development (auto-reload)
npm run dev

# Production
npm run build && npm start
```

---

## Configuration

| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | ✅ | Your bot token from the Discord Developer Portal |
| `DISCORD_CLIENT_ID` | ✅ | Your application / client ID |
| `DEVELOPER_IDS` | ✅ | JSON array of Discord user IDs with developer access — e.g. `["123456789"]` |
| `DATABASE_URL` | ✅ | PostgreSQL connection string — `postgresql://user:pass@host:5432/pegasus` |
| `ENCRYPTION_KEY` | ✅ | 32-character string used for sensitive data encryption |
| `ENABLE_API` | ➖ | Set to `true` to enable the built-in REST API server (default: `false`) |
| `API_PORT` | ➖ | Port the REST API listens on (default: `2000`) |
| `BOT_API_TOKEN` | ➖ | Bearer token for authenticating REST API requests |
| `ENABLE_ECONOMY` | ➖ | Toggle the economy module (default: `true`) |
| `ENABLE_MODERATION` | ➖ | Toggle the moderation module (default: `true`) |
| `ENABLE_XP` | ➖ | Toggle the XP module (default: `true`) |
| `ENABLE_TICKETS` | ➖ | Toggle the ticket module (default: `true`) |
| `ENABLE_GIVEAWAYS` | ➖ | Toggle the giveaway module (default: `true`) |
| `STEAM_API_KEY` | ➖ | Steam Web API key — enables `/utils steam` |
| `SENTRY_DSN` | ➖ | Sentry DSN for error tracking |
| `LOG_LEVEL` | ➖ | Winston log level: `error`, `warn`, `info`, `debug` (default: `info`) |
| `LOG_FILE_PATH` | ➖ | Directory for log files (default: `./logs`) |
| `RATE_LIMIT_WINDOW` | ➖ | Rate limit window in milliseconds (default: `60000`) |
| `RATE_LIMIT_MAX_REQUESTS` | ➖ | Max requests per window (default: `10`) |

---

## Commands

> **Key:**  
> `<option>` = required · `[option]` = optional  
> Permissions shown are the **minimum** Discord permission required to run the command.

---

### 👑 Admin

These commands are restricted to bot developers (`DEVELOPER_IDS`) regardless of server permissions.

| Command | Description |
|---|---|
| `/blacklist user <user> [reason]` | Add a user to the global bot blacklist |
| `/blacklist remove <user>` | Remove a user from the global blacklist |
| `/blacklist view [page]` | View the paginated blacklist |

---

### ⚙️ Configuration

All configuration commands require **Manage Guild**.

| Command | Description |
|---|---|
| `/config xp` | View and configure the XP system settings |
| `/config eco` | View and configure economy settings |
| `/config lang <language>` | Set the server-wide language (`en`, `de`, `es`, `fr`) |
| `/config welcome` | Configure welcome message channel and embed |
| `/config goodbye` | Configure goodbye message channel and embed |
| `/config autorole` | Configure role automatically assigned to new members |
| `/embed create <channel> <title> <description> [...]` | Send a custom rich embed to a channel |
| `/reactionrole add <message_id> <emoji> <role> [channel]` | Add a reaction role to a message |
| `/reactionrole remove <message_id> <emoji>` | Remove a reaction role |
| `/reactionrole list [channel]` | List all configured reaction roles |

---

### 💰 Economy

Economy commands require no special permissions (any member can use them).

| Command | Description |
|---|---|
| `/eco balance [user]` | Check your or another user's coin balance |
| `/eco daily` | Claim your daily coin reward |
| `/eco work` | Work to earn coins (hourly cooldown) |
| `/eco rob <user>` | Attempt to steal coins from another user |
| `/eco gamble dice <amount>` | Roll dice against the house |
| `/eco gamble flip <amount> <heads\|tails>` | Flip a coin |
| `/eco gamble slots <amount>` | Play the slot machine |
| `/eco gamble blackjack <amount>` | Play blackjack |
| `/eco gamble roulette <amount> <bet>` | Play roulette |
| `/eco shop list` | Browse the server item shop |
| `/eco shop buy <item_id>` | Purchase an item |
| `/eco shop info <item_id>` | View item details |
| `/eco shop use <item_id>` | Use an item from your inventory |
| `/eco shop inventory [user]` | View your or another user's inventory |

---

### 🎮 Fun

Fun commands require no special permissions.

| Command | Description |
|---|---|
| `/fun meme` | Fetch a random meme |
| `/fun fact` | Get a random interesting fact |
| `/fun quote` | Get a random inspirational quote |
| `/fun joke` | Get a random joke |
| `/fun dadjoke` | Get a random dad joke |

---

### 🎉 Giveaways

All giveaway commands require **Manage Guild**.

| Command | Description |
|---|---|
| `/gw start <prize> <duration> [winners] [channel] [...]` | Start a giveaway with a full advanced configuration modal |
| `/gw simple <prize> <duration> <winners> [...]` | Quickly start a simple giveaway |
| `/gw end <giveaway_id>` | Immediately end an active giveaway and draw winners |
| `/gw reroll <giveaway_id> [winners]` | Select new winners for a finished giveaway |
| `/gw configure <giveaway_id> [...]` | Open the configuration editor for an active giveaway |

---

### 🛡️ Moderation & AutoMod

| Command | Permission | Description |
|---|---|---|
| `/warn create <user> <title> [description] [level] [proof]` | Moderate Members | Issue a warning |
| `/warn edit <warnid>` | Moderate Members | Edit an existing warning via modal |
| `/warn lookup <warnid>` | Moderate Members | View a specific warning |
| `/warn view <user>` | Moderate Members | View all warnings for a user |
| `/warn delete <warnid>` | Moderate Members | Delete a warning |
| `/warn purge <user>` | Moderate Members | Remove all warnings for a user |
| `/warn automation create <trigger_type> <trigger_value> [channel]` | Moderate Members | Set up an automated penalty trigger |
| `/warn automation view` | Moderate Members | List all warning automations |
| `/warn automation delete <automation_id>` | Moderate Members | Delete a warning automation |
| `/ban <user> [reason] [delete_days]` | Ban Members | Ban a user |
| `/unban <user_id> [reason]` | Ban Members | Unban a user by ID |
| `/kick <user> [reason]` | Kick Members | Kick a user |
| `/mute <user> [duration] [reason]` | Moderate Members | Assign the mute role |
| `/unmute <user> [reason]` | Moderate Members | Remove the mute role |
| `/timeout <user> <duration> [reason]` | Moderate Members | Apply a Discord timeout |
| `/purge <amount> [user] [channel]` | Manage Messages | Bulk-delete messages |
| `/lock [channel] [reason]` | Manage Roles | Lock a channel (deny @everyone send messages) |
| `/unlock [channel] [reason]` | Manage Roles | Unlock a previously locked channel |
| `/slowmode <seconds> [channel] [reason]` | Manage Channels | Set channel slowmode (0 to disable) |
| `/modlog [user] [limit]` | Moderate Members | View moderation case history |
| `/case view <id>` | Moderate Members | View a specific moderation case |
| `/case delete <id>` | Manage Guild | Delete a moderation case |
| `/reset-xp <user> <confirm>` | Moderate Members | Reset a user's XP to zero |
| `/automod add_rule <name> <trigger> <action> [...]` | Manage Guild | Add an AutoMod V2 rule |
| `/automod list_rules` | Manage Guild | List all AutoMod V2 rules |
| `/automod remove_rule <rule_id>` | Manage Guild | Delete an AutoMod V2 rule |
| `/automod quarantine_list` | Manage Guild | View users in the Quarantine Vault |
| `/automod quarantine_release <user>` | Manage Guild | Release a user from Quarantine |
| `/filter add <pattern> [match_type] [severity] [...]` | Manage Messages | Add a word filter rule |
| `/filter remove <rule_id>` | Manage Messages | Remove a word filter rule |
| `/filter list` | Manage Messages | List all word filter rules |

---

### 🎟️ Tickets

| Command | Permission | Description |
|---|---|---|
| `/ticket panel create <panel_id> <title> <description> [...]` | Manage Channels | Create a new ticket panel |
| `/ticket panel load <panel_id> <channel>` | Manage Channels | Send a panel embed to a channel |
| `/ticket panel edit <panel_id>` | Manage Channels | Open the interactive panel editor |
| `/ticket panel delete <panel_id>` | Manage Channels | Delete a panel configuration |
| `/ticket panel list` | Manage Channels | List all ticket panels |
| `/ticket panel add_dept <panel_id> <dept_id> <name> <description> [...]` | Manage Channels | Add a department to a panel |
| `/ticket panel list_depts <panel_id>` | Manage Channels | List departments on a panel |
| `/ticket panel remove_dept <panel_id> <dept_id>` | Manage Channels | Remove a department from a panel |
| `/ticket claim` | Support Role or Manage Channels | Claim the current ticket |
| `/ticket close [reason]` | Support Role or Manage Channels | Close the current ticket |
| `/ticket stats` | Manage Channels | View ticket system statistics |

---

### 🔧 Utility

| Command | Permission | Description |
|---|---|---|
| `/help [command]` | None | Interactive command help with autocomplete |
| `/ping` | None | Check bot latency and API response time |
| `/utils avatar [user]` | None | View a user's full-size avatar |
| `/utils banner [user]` | None | View a user's profile banner |
| `/utils userinfo [user]` | None | View detailed user and member information |
| `/utils whois <user_id>` | None | Look up any user by Discord ID |
| `/utils roleinfo <role>` | None | View detailed role information |
| `/utils serverinfo` | None | View server statistics and boost info |
| `/utils steam <username>` | None | Look up a Steam profile |
| `/utils support` | None | Get the support server invite |
| `/utils stats` | None | View bot uptime and system statistics |
| `/language available` | None | List all supported languages |
| `/language current` | None | View your active language setting |
| `/language set <language>` | None | Change your personal language preference |
| `/jtc setup <base_voice> <category> <panel_channel> [name_format]` | Manage Guild | Configure Join-to-Create |
| `/jtc panel` | Manage Guild | Send or refresh the JTC management panel |
| `/jtc disable` | Manage Guild | Disable JTC and clear its configuration |

---

### 📈 XP & Engagement

| Command | Permission | Description |
|---|---|---|
| `/xp rank [user]` | None | View a visual XP rank card |
| `/xp leaderboard [page]` | None | View the server XP leaderboard |
| `/xp configuration` | None | View XP settings (multipliers, role rewards) |
| `/xp card` | None | Customise your rank card colours |
| `/quests` | None | View active quests and your progress |
| `/achievements` | None | View unlocked and available achievements |
| `/prestige` | None | Prestige at max level for exclusive rewards |
| `/thanks <user> [reason]` | None | Give reputation points to another user |

---

## Bot Permissions

When inviting Pegasus to your server, grant the following permissions so all features work correctly.

| Permission | Required by |
|---|---|
| View Channels | All commands |
| Send Messages | All commands |
| Send Messages in Threads | Ticket threads |
| Embed Links | All embeds |
| Attach Files | Rank cards, transcripts |
| Read Message History | Purge, word filter |
| Add Reactions | Reaction roles |
| Use External Emojis | Embeds |
| Manage Messages | Purge, word filter auto-delete |
| Manage Roles | Lock / unlock channels, mute role, JTC, reaction roles |
| Manage Channels | Slowmode, JTC channel creation/deletion |
| Kick Members | `/kick` |
| Ban Members | `/ban`, `/unban` |
| Moderate Members | Timeouts |
| Move Members | JTC management |
| Connect | Voice XP tracking |

> **Important:** Pegasus does **not** require the Administrator permission to function.

---

## Security

- **Input Validation** — Zod schemas validate all user input at runtime
- **SQL Injection Prevention** — Drizzle ORM uses fully parameterised queries
- **Rate Limiting** — Per-user cooldowns on every command plus global API rate limiting
- **Developer-Only Commands** — Admin commands (`/blacklist`, eval, presence) are gated by `DEVELOPER_IDS` regardless of server permissions
- **Blacklist System** — Globally block malicious users from all bot interactions
- **Audit Logging** — Every moderation action is written to a persistent audit log
- **Encrypted Storage** — Sensitive data is encrypted at rest using the configured `ENCRYPTION_KEY`
- **Bearer Token API** — The REST API is protected by a configurable bearer token

---

## Internationalization

Pegasus ships with full translations for four languages. Both command descriptions (shown in the Discord command picker) and all bot responses are localised.

| Code | Language |
|---|---|
| `en` | 🇬🇧 English (default) |
| `de` | 🇩🇪 Deutsch |
| `es` | 🇪🇸 Español |
| `fr` | 🇫🇷 Français |

Language can be set per-user with `/language set` or server-wide with `/config lang`.

---

## Deployment

### Docker Compose

```bash
docker compose up -d
```

The included `docker-compose.yml` spins up the bot and a PostgreSQL instance together.

### Manual (PM2)

```bash
npm run build
npm install -g pm2
pm2 start dist/index.js --name pegasus
pm2 save && pm2 startup
```

### Hosting Recommendations

| Provider | Notes |
|---|---|
| DigitalOcean / Linode / Vultr | Affordable VPS, full control |
| Railway | Simple one-click deploy, free tier available |
| Render | Free tier with auto-sleep; upgrade for always-on |
| AWS EC2 / GCP | Enterprise-grade, most scalable |

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch — `git checkout -b feature/your-feature`
3. Commit your changes — `git commit -m 'feat: add your feature'`
4. Push to the branch — `git push origin feature/your-feature`
5. Open a Pull Request

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for code style guidelines, commit conventions, and testing requirements.

---

## License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

---

<div align="center">

Made with ❤️ by [cptcr](https://github.com/cptcr)  
Sponsored by **[VaultScope](https://vaultscope.dev)**

[![Stars](https://img.shields.io/github/stars/cptcr/pegasus?style=social)](https://github.com/cptcr/pegasus/stargazers)
[![Forks](https://img.shields.io/github/forks/cptcr/pegasus?style=social)](https://github.com/cptcr/pegasus/network/members)

</div>
