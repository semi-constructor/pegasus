# 🚀 Pegasus Discord Bot

<div align="center">
  <img src="https://img.shields.io/badge/Discord.js-v14-blue?style=for-the-badge&logo=discord" alt="Discord.js">
  <img src="https://img.shields.io/badge/TypeScript-5.0-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/PostgreSQL-16-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License">
</div>

<div align="center">
  <h3>🏆 A Production-Ready, Feature-Rich Discord Bot Built with TypeScript</h3>
  <p>
    <a href="https://discord.gg/vaultscope">Support Server</a> •
    <a href="https://cptcr.uk">Developer</a> •
    <a href="#-features">Features</a> •
    <a href="#-installation">Installation</a> •
    <a href="#-commands">Commands</a>
  </p>
</div>

<div align="center">
<h1>SPONSORS</h1>
<p>VaultScope</p>
<a>https://vaultscope.dev</a>
</div>

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [🔧 Tech Stack](#-tech-stack)
- [📦 Prerequisites](#-prerequisites)
- [🚀 Installation](#-installation)
- [⚙️ Configuration](#-configuration)
- [📝 Commands](#-commands)
- [🔒 Security Features](#-security-features)
- [🌍 Internationalization](#-internationalization)
- [🚢 Deployment](#-deployment)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [💬 Support](#-support)

## ✨ Features

### 🛡️ Advanced Moderation System
- **Comprehensive Warning System** with automation rules and thresholds
- **Multi-action Moderation** - Ban, kick, timeout with reason tracking
- **Audit Logging** - Complete action history with user tracking
- **Permission Hierarchy** - Role-based command access control
- **Blacklist System** - Developer-only user management

### 💰 Full Economy System
- **Virtual Currency** with balance tracking and transactions
- **5 Gambling Games**:
  - 🎲 Dice - Roll against the house
  - 🪙 Coinflip - 50/50 chance game
  - 🎰 Slots - Classic slot machine
  - ♠️ Blackjack - Full blackjack implementation
  - 🎯 Roulette - Multiple betting options
- **Shop System** - Buy/sell items with inventory management
- **Work & Rob** - Earn money with cooldowns and protection items
- **Daily Rewards** - Streak bonuses for consecutive claims

### 🎉 Advanced Giveaway System
- **Multiple Entry Methods** - Bonus entries for roles/boosters
- **Requirements System** - Role, level, or time-based requirements
- **Live Timer Updates** - Real-time countdown display
- **Automatic Winner Selection** - Fair, weighted random selection
- **Reroll Capability** - Change winners after giveaway ends

### 🎟️ Professional Ticket System
- **Custom Panels** - Design support panels with embeds
- **Category Management** - Organize tickets by type
- **Ticket Actions**:
  - Claim - Assign ticket to staff
  - Close - Close with optional reason
  - Lock - Prevent user messages
  - Freeze - Prevent all messages
- **Transcript Generation** - Save ticket history
- **Statistics Tracking** - Monitor support metrics

### 📈 XP & Leveling System
- **Voice & Text XP** - Earn XP through activity
- **Role Rewards** - Automatic role assignment at levels
- **Custom Rank Cards** - Personalized rank displays
- **Leaderboards** - Server-wide rankings
- **Booster Bonuses** - Extra XP for server boosters
- **Channel Multipliers** - Configure XP rates per channel

### 🌍 Multi-Language Support
- **4 Languages**: English, German, Spanish, French
- **Per-User Language** - Individual language preferences
- **Localized Commands** - Command descriptions in all languages
- **Dynamic Translations** - All bot responses translated

### 🔧 Server Configuration
- **Welcome/Goodbye System** - Custom messages with embeds
- **Auto-Role Assignment** - Automatic roles for new members
- **Language Settings** - Server-wide language preference
- **XP Configuration** - Customize leveling system
- **Economy Settings** - Adjust currency and rewards

## 🔧 Tech Stack

| Technology | Purpose |
|------------|---------|
| **TypeScript 5.0** | Type-safe development with strict mode |
| **Discord.js v14** | Latest Discord API features |
| **PostgreSQL 16** | Robust relational database |
| **Drizzle ORM** | Type-safe database queries |
| **Zod** | Runtime validation and type safety |
| **i18next** | Internationalization framework |
| **Winston** | Advanced logging system |
| **Node.js 18+** | Modern JavaScript runtime |

## 📦 Prerequisites

- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: v14 or higher
- **npm**: v9.0.0 or higher
- **Discord Application**: [Create here](https://discord.com/developers/applications)

### Required Bot Permissions
```
- View Channels
- Send Messages
- Embed Links
- Attach Files
- Manage Messages
- Manage Roles
- Manage Channels
- Use External Emojis
- Add Reactions
- Read Message History
- Connect (for voice XP)
- Move Members
- Moderate Members
```

## 🚀 Installation

### 1. Clone Repository
```bash
git clone https://github.com/cptcr/pegasus.git
cd pegasus
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup
Create a PostgreSQL database:
```sql
CREATE DATABASE pegasus;
```

### 4. Environment Configuration
Create `.env` file in root directory:
```env
# Required Configuration
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_id_here
DATABASE_URL=postgresql://username:password@localhost:5432/pegasus
DEVELOPER_IDS=["your_discord_id_here"]
SUPPORT_SERVER_INVITE=https://discord.gg/your_invite

# Optional Configuration
NODE_ENV=development
DEFAULT_LANGUAGE=en
LOG_LEVEL=info

# Security (Generate a 32-character key)
ENCRYPTION_KEY=your_32_character_encryption_key_here

# Optional Services
REDIS_URL=redis://localhost:6379
STEAM_API_KEY=your_steam_api_key
```

### 5. Build Project
```bash
npm run build
```

### 6. Start Bot
```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

## ⚙️ Configuration

### First-Time Setup
After inviting the bot to your server:

1. **Set Server Language**
   ```
   /config lang
   ```

2. **Configure XP System**
   ```
   /config xp
   ```

3. **Setup Economy**
   ```
   /config eco
   ```

4. **Configure Welcome Messages**
   ```
   /config welcome
   ```

5. **Setup Auto-Roles**
   ```
   /config autorole
   ```

### Database Tables (Auto-Created)
The bot automatically creates all required tables on first startup:
- `users` - User profiles and preferences
- `guilds` - Server configurations
- `guild_settings` - Detailed server settings
- `members` - Per-server user data
- `warnings` - Warning records
- `warning_automations` - Automated moderation rules
- `economy_balances` - User balances
- `economy_transactions` - Transaction history
- `economy_shop_items` - Shop inventory
- `tickets` - Support tickets
- `ticket_panels` - Ticket panel configurations
- `giveaways` - Giveaway data
- `giveaway_entries` - User entries
- `user_xp` - XP and level data
- `xp_rewards` - Level role rewards
- `audit_logs` - Complete action history

## 📝 Commands

### 🛡️ Moderation Commands

| Command | Description | Permission |
|---------|-------------|-----------|
| `/warn create` | Issue warning with title, description, level | Moderate Members |
| `/warn edit` | Edit existing warning via modal | Moderate Members |
| `/warn lookup` | View specific warning by ID | Moderate Members |
| `/warn view` | View all warnings for a user | Moderate Members |
| `/warn automation create` | Setup automated actions | Administrator |
| `/warn automation view` | List all automations | Administrator |
| `/warn automation delete` | Remove automation | Administrator |
| `/moderation ban` | Ban user with optional reason | Ban Members |
| `/moderation kick` | Kick user with optional reason | Kick Members |
| `/moderation timeout` | Timeout user for duration | Moderate Members |
| `/moderation mute` | Apply the server mute role (optional duration) | Moderate Members |
| `/moderation unmute` | Remove the mute role from a user | Moderate Members |
| `/moderation unban <user_id>` | Unban a user by ID | Ban Members |
| `/moderation purge <amount>` | Bulk delete recent messages | Manage Messages |
| `/moderation lock [channel]` | Lock a text channel for @everyone | Manage Channels |
| `/moderation unlock [channel]` | Unlock a previously locked channel | Manage Channels |
| `/moderation slowmode <seconds>` | Set channel slowmode (0 disables) | Manage Channels |
| `/moderation modlog [user]` | Display recent moderation cases | Moderate Members |
| `/moderation case view <id>` | View a specific moderation case | Moderate Members |
| `/moderation case delete <id>` | Delete a moderation case | Manage Guild |
| `/moderation reset-xp` | Reset user's XP to 0 | Manage Guild |

### 💰 Economy Commands

| Command | Description | Cooldown |
|---------|-------------|----------|
| `/balance [user]` | Check balance | None |
| `/daily` | Claim daily reward (100-500) | 24 hours |
| `/work` | Work for money (50-200) | 1 hour |
| `/rob <user>` | Attempt to rob another user | 24 hours |
| `/shop view` | Browse available items | None |
| `/shop buy <item>` | Purchase an item | None |
| `/shop inventory` | View your items | None |
| `/gamble dice <amount>` | Roll dice (1-6 vs dealer) | None |
| `/gamble coinflip <amount> <side>` | Flip coin (heads/tails) | None |
| `/gamble slots <amount>` | Play slot machine | None |
| `/gamble blackjack <amount>` | Play blackjack | None |
| `/gamble roulette <amount> <bet>` | Play roulette | None |

### 🎉 Giveaway Commands

| Command | Description | Permission |
|---------|-------------|-----------|
| `/gw start` | Advanced giveaway with modal | Manage Guild |
| `/gw simple` | Quick giveaway setup | Manage Guild |
| `/gw end <id>` | Manually end giveaway | Manage Guild |
| `/gw reroll <id>` | Select new winners | Manage Guild |
| `/gw configure <id>` | Edit active giveaway | Manage Guild |

### 🎟️ Ticket Commands

| Command | Description | Permission |
|---------|-------------|-----------|
| `/ticket panel create` | Design ticket panel | Manage Guild |
| `/ticket panel load <id>` | Send panel to channel | Manage Guild |
| `/ticket panel delete <id>` | Remove panel | Manage Guild |
| `/ticket panel list` | View all panels | Manage Guild |
| `/ticket claim` | Claim ticket | Support Role |
| `/ticket close [reason]` | Close ticket | Support Role |
| `/ticket stats` | View statistics | Manage Guild |

### 📈 XP Commands

| Command | Description |
|---------|-------------|
| `/xp rank [user]` | View rank card |
| `/xp leaderboard` | Top 10 users |
| `/xp configuration` | View XP settings |
| `/xp card` | Customize rank card |

### ⚙️ Configuration Commands

| Command | Description | Permission |
|---------|-------------|-----------|
| `/config xp` | XP system settings | Manage Guild |
| `/config eco` | Economy settings | Manage Guild |
| `/config lang` | Server language | Manage Guild |
| `/config welcome` | Welcome messages | Manage Guild |
| `/config goodbye` | Goodbye messages | Manage Guild |
| `/config autorole` | Auto-role setup | Manage Guild |

### 🔧 Utility Commands

| Command | Description |
|---------|-------------|
| `/utils help [command]` | Dynamic help menu |
| `/utils avatar [user]` | Display avatar |
| `/utils banner [user]` | Display banner |
| `/utils steam <profile>` | Steam profile info |
| `/utils userinfo [user]` | User details |
| `/utils whois <user>` | Detailed lookup |
| `/utils roleinfo <role>` | Role information |
| `/utils serverinfo` | Server statistics |
| `/utils support` | Support server link |
| `/utils stats` | Bot statistics |
| `/ping` | Check latency |

### 🎮 Fun Commands

| Command | Description |
|---------|-------------|
| `/fun meme` | Random meme |
| `/fun fact` | Fun fact |
| `/fun joke` | Random joke |
| `/fun quote` | Inspirational quote |
| `/fun dadjoke` | Dad joke |

### 🌍 Language Commands

| Command | Description |
|---------|-------------|
| `/language available` | List languages |
| `/language current` | Your language |
| `/language set <lang>` | Change language |

### 👑 Admin Commands

| Command | Description | Permission |
|---------|-------------|-----------|
| `/blacklist user <user>` | Blacklist user | Developer Only |
| `/blacklist view` | View blacklist | Developer Only |
| `/blacklist remove <user>` | Unblacklist | Developer Only |

## 🔒 Security Features

### Input Validation
- **Zod Schemas** - Runtime validation for all inputs
- **SQL Injection Prevention** - Parameterized queries
- **XSS Protection** - Input sanitization
- **Rate Limiting** - Per-user and global limits

### Permission System
- **Hierarchical Permissions** - Role-based access
- **Developer Override** - Emergency access
- **Audit Logging** - Track all actions
- **Blacklist System** - Block malicious users

### Data Protection
- **Encryption** - Sensitive data encryption
- **Secure Tokens** - Environment variable storage
- **HTTPS Only** - Secure API communications
- **Privacy Compliance** - User data protection

## 🌍 Internationalization

### Supported Languages
- 🇬🇧 **English** (en) - Default
- 🇩🇪 **German** (de) - Deutsch
- 🇪🇸 **Spanish** (es) - Español
- 🇫🇷 **French** (fr) - Français

### Translation Coverage
- ✅ All command descriptions
- ✅ All bot responses
- ✅ Error messages
- ✅ Embed content
- ✅ Button/Modal text

## 🚢 Deployment

### Using Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

### Using PM2
```bash
npm install -g pm2
pm2 start dist/index.js --name pegasus
pm2 save
pm2 startup
```

### Hosting Recommendations
- **VPS**: DigitalOcean, Linode, Vultr
- **Cloud**: AWS EC2, Google Cloud, Azure
- **Managed**: Railway, Heroku, Render

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

### Code Standards
- TypeScript strict mode enabled
- No production comments
- Comprehensive error handling
- Unit tests for new features

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file.

## 💬 Support

- **Discord Server**: [discord.gg/vaultscope](https://discord.gg/vaultscope)
- **Developer**: [cptcr.dev](https://cptcr.dev)
- **GitHub Issues**: [Report bugs](https://github.com/cptcr/pegasus/issues)
- **Email**: support@cptcr.dev

## 🙏 Acknowledgments

- Discord.js team for the excellent library
- PostgreSQL team for the robust database
- All contributors and community members
- Open source projects that made this possible

---

<div align="center">
  <h3>⭐ Star this repository if you find it helpful!</h3>
  <p>Made with ❤️ by <a href="https://github.com/cptcr">cptcr</a></p>
  <p>
    <a href="https://github.com/cptcr/pegasus/stargazers">
      <img src="https://img.shields.io/github/stars/cptcr/pegasus?style=social" alt="Stars">
    </a>
    <a href="https://github.com/cptcr/pegasus/network/members">
      <img src="https://img.shields.io/github/forks/cptcr/pegasus?style=social" alt="Forks">
    </a>
  </p>
</div>
