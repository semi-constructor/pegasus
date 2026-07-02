# Pegasus API Documentation (`API_DOC.md`)

This document provides a comprehensive specification of all HTTP REST endpoints exposed by the Pegasus bot's built-in Express API server. It details every route, request/response schema, authentication requirement, rate limit policy, caching behavior, and error response.

All data returned by the API represents real, live data obtained directly from the Discord.js `client`, active system diagnostics, and Drizzle ORM PostgreSQL database queries.

---

## Table of Contents

1. [General Information](#general-information)
   - [Base URL & Versioning](#base-url--versioning)
   - [Authentication](#authentication)
   - [Rate Limits & Caching](#rate-limits--caching)
   - [Standard Error Responses](#standard-error-responses)
2. [Health & System Endpoints](#health--system-endpoints)
   - [GET `/health`](#get-health)
   - [GET `/cache/stats`](#get-cachestats)
   - [GET `/status`](#get-status)
   - [GET `/stats`](#get-stats)
3. [Dashboard API (`/dashboard`)](#dashboard-api-dashboard)
   - [GET `/dashboard/overview`](#get-dashboardoverview)
   - [GET `/dashboard/guilds`](#get-dashboardguilds)
   - [GET `/dashboard/guilds/:guildId/overview`](#get-dashboardguildsguildidoverview)
4. [Batch API (`/batch`)](#batch-api-batch)
   - [POST `/batch/guilds`](#post-batchguilds)
   - [POST `/batch/members`](#post-batchmembers)
   - [POST `/batch/stats`](#post-batchstats)
5. [Monitoring API (`/monitoring`)](#monitoring-api-monitoring)
   - [GET `/monitoring/health`](#get-monitoringhealth)
   - [GET `/monitoring/metrics`](#get-monitoringmetrics)
   - [GET `/monitoring/cache`](#get-monitoringcache)
   - [POST `/monitoring/cache/clear`](#post-monitoringcacheclear)
   - [GET `/monitoring/queries`](#get-monitoringqueries)
   - [POST `/monitoring/queries/reset`](#post-monitoringqueriesreset)
   - [GET `/monitoring/rate-limits`](#get-monitoringrate-limits)
   - [GET `/monitoring/dashboard`](#get-monitoringdashboard)
6. [Guild Analytics API (`/guilds`)](#guild-analytics-api-guilds)
   - [GET `/guilds/:guildId/economy`](#get-guildsguildideconomy)
   - [GET `/guilds/:guildId/moderation`](#get-guildsguildidmoderation)
   - [GET `/guilds/:guildId/tickets`](#get-guildsguildidtickets)
   - [GET `/guilds/:guildId/xp`](#get-guildsguildidxp)
   - [GET `/guilds/:guildId/giveaways`](#get-guildsguildidgiveaways)
   - [GET `/guilds/:guildId/settings`](#get-guildsguildidsettings)
   - [GET `/guilds/:guildId/members`](#get-guildsguildidmembers)
   - [GET `/guilds/:guildId/logs`](#get-guildsguildidlogs)
   - [GET `/guilds/:guildId/notifications`](#get-guildsguildidnotifications)
7. [Tickets Management API (`/guilds/:guildId/tickets`)](#tickets-management-api-guildsguildidtickets)
   - [POST `/guilds/:guildId/tickets/panels`](#post-guildsguildidticketspanels)
   - [PATCH `/guilds/:guildId/tickets/panels/:panelId`](#patch-guildsguildidticketspanelspanelid)
   - [DELETE `/guilds/:guildId/tickets/panels/:panelId`](#delete-guildsguildidticketspanelspanelid)
   - [POST `/guilds/:guildId/tickets/:ticketId/close`](#post-guildsguildidticketsticketidclose)
   - [GET `/guilds/:guildId/tickets/:ticketId`](#get-guildsguildidticketsticketid)
8. [Economy Management API (`/guilds/:guildId/economy`)](#economy-management-api-guildsguildideconomy)
   - [POST `/guilds/:guildId/economy/shop-items`](#post-guildsguildideconomyshop-items)
   - [PATCH `/guilds/:guildId/economy/shop-items/:itemId`](#patch-guildsguildideconomyshop-itemsitemid)
   - [DELETE `/guilds/:guildId/economy/shop-items/:itemId`](#delete-guildsguildideconomyshop-itemsitemid)
   - [PATCH `/guilds/:guildId/economy/settings`](#patch-guildsguildideconomysettings)
   - [POST `/guilds/:guildId/economy/reset`](#post-guildsguildideconomyreset)
9. [Moderation Management API (`/guilds/:guildId/moderation`)](#moderation-management-api-guildsguildidmoderation)
   - [POST `/guilds/:guildId/moderation/warn`](#post-guildsguildidmoderationwarn)
   - [POST `/guilds/:guildId/moderation/ban`](#post-guildsguildidmoderationban)
   - [POST `/guilds/:guildId/moderation/kick`](#post-guildsguildidmoderationkick)
   - [POST `/guilds/:guildId/moderation/mute`](#post-guildsguildidmoderationmute)
   - [PATCH `/guilds/:guildId/moderation/settings`](#patch-guildsguildidmoderationsettings)
10. [XP Management API (`/guilds/:guildId/xp`)](#xp-management-api-guildsguildidxp)
    - [PATCH `/guilds/:guildId/xp/settings`](#patch-guildsguildidxpsettings)
    - [POST `/guilds/:guildId/xp/rewards`](#post-guildsguildidxprewards)
    - [DELETE `/guilds/:guildId/xp/rewards/:level`](#delete-guildsguildidxprewardslevel)
    - [POST `/guilds/:guildId/xp/reset`](#post-guildsguildidxpreset)
    - [GET `/guilds/:guildId/xp/user/:userId`](#get-guildsguildidxpuseruserid)
    - [PATCH `/guilds/:guildId/xp/user/:userId`](#patch-guildsguildidxpuseruserid)
11. [Giveaways Management API (`/guilds/:guildId/giveaways`)](#giveaways-management-api-guildsguildidgiveaways)
    - [POST `/guilds/:guildId/giveaways`](#post-guildsguildidgiveaways)
    - [PATCH `/guilds/:guildId/giveaways/:giveawayId`](#patch-guildsguildidgiveawaysgiveawayid)
    - [DELETE `/guilds/:guildId/giveaways/:giveawayId`](#delete-guildsguildidgiveawaysgiveawayid)
    - [POST `/guilds/:guildId/giveaways/:giveawayId/end`](#post-guildsguildidgiveawaysgiveawayidend)
    - [POST `/guilds/:guildId/giveaways/:giveawayId/reroll`](#post-guildsguildidgiveawaysgiveawayidreroll)
12. [Settings API (`/guilds/:guildId/settings`)](#settings-api-guildsguildidsettings)
    - [PATCH `/guilds/:guildId/settings`](#patch-guildsguildidsettings)
    - [GET `/guilds/:guildId/settings/export`](#get-guildsguildidsettingsexport)
    - [POST `/guilds/:guildId/settings/import`](#post-guildsguildidsettingsimport)
13. [Geizhals API (`/geizhals`)](#geizhals-api-geizhals)
    - [POST / GET `/geizhals/search`](#post--get-geizhalssearch)
    - [POST / GET `/geizhals/categories`](#post--get-geizhalscategories)
    - [POST `/geizhals/categorylist`](#post-geizhalscategorylist)
    - [POST `/geizhals/bestprice_development`](#post-geizhalsbestprice_development)
14. [Dashboard Direct Management API (`/api`)](#dashboard-direct-management-api-api)
    - [POST / PATCH `/api/tickets/close`](#post--patch-apiticketsclose)
    - [POST / PATCH `/api/tickets/lock`](#post--patch-apiticketslock)
    - [POST / PATCH `/api/tickets/freeze`](#post--patch-apiticketsfreeze)
    - [POST / PATCH `/api/tickets/claim`](#post--patch-apiticketsclaim)
    - [GET `/api/jtc/config`](#get-apijtcconfig)
    - [POST / PATCH `/api/jtc/config`](#post--patch-apijtcconfig)
    - [POST / PATCH `/api/jtc/panel/update`](#post--patch-apijtcpanelupdate)
    - [POST / PATCH `/api/jtc/channels/lock`](#post--patch-apijtcchannelslock)
    - [POST / PATCH `/api/jtc/channels/unlock`](#post--patch-apijtcchannelsunlock)
    - [POST / PATCH `/api/jtc/channels/limit`](#post--patch-apijtcchannelslimit)

---

## General Information

### Base URL & Versioning
- **Base Protocol & Port:** `http(s)://<host>:<config.API_PORT>` (Port defaults to `2000`).
- **Content-Type:** All requests with a body must have `Content-Type: application/json`.
- **Accept Header:** Responses are returned as JSON (`Accept: application/json`).

### Authentication
All routes except `GET /health` require an `Authorization` header using the Bearer token scheme:
```http
Authorization: Bearer <config.BOT_API_TOKEN>
```
If the header is missing, malformed, or contains an incorrect token, the API rejects the request with `401 Unauthorized`.

### Rate Limits & Caching
The API enforces rate limiting across multiple tiers to ensure system stability:
- **Global IP Limit:** 200 requests per minute per IP.
- **Stats Endpoints (`/stats`):** 2 requests per 500ms.
- **Batch Endpoints (`/batch/*`):** 5 requests per second.
- **Per-Guild Write Endpoints:** 10 requests per second per guild.

**Caching Headers:**
Read endpoints utilize an in-memory cache manager. Responses include the following HTTP headers:
- `X-Cache`: `HIT` or `MISS`
- `X-Cache-TTL`: Remaining time-to-live in milliseconds.

| Resource Type | Cache TTL |
| :--- | :--- |
| Stats & Dashboard overview | 5,000 ms (5s) |
| Guild summaries & Overviews | 10,000 ms (10s) |
| Member lists | 7,500 ms (7.5s) |

---

## Standard Error Responses

When an error occurs, the API returns a structured JSON payload alongside the corresponding HTTP status code.

### `400 Bad Request` (Validation Error)
Returned when request parameters or body fail Zod validation schema parsing.
```json
{
  "error": "Validation Error",
  "message": "Invalid request body",
  "details": [
    {
      "code": "too_small",
      "minimum": 1,
      "type": "string",
      "inclusive": true,
      "exact": false,
      "message": "String must contain at least 1 character(s)",
      "path": ["prize"]
    }
  ]
}
```

### `401 Unauthorized`
Returned when the `Authorization` header is missing or incorrect.
```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid Authorization header"
}
```

### `403 Forbidden`
Returned when the bot lacks the required Discord permissions (e.g., trying to ban a user with a higher role hierarchy).
```json
{
  "error": "Forbidden",
  "message": "Missing required Discord permissions to perform this action"
}
```

### `404 Not Found`
Returned when a requested resource (guild, ticket, giveaway, shop item, etc.) does not exist.
```json
{
  "error": "Not Found",
  "message": "Guild not found"
}
```

### `409 Conflict`
Returned when attempting to create a resource that conflicts with an existing one (e.g., duplicate XP role reward level).
```json
{
  "error": "Conflict",
  "message": "A role reward already exists for level 10"
}
```

### `429 Too Many Requests`
Returned when rate limit policies are exceeded.
```json
{
  "error": "Too Many Requests",
  "message": "Too many requests, please try again later."
}
```

### `500 Internal Server Error`
Returned on unhandled exceptions or database connection failures.
```json
{
  "error": "Internal Server Error",
  "message": "Failed to fetch bot statistics"
}
```

---

## Health & System Endpoints

### GET `/health`
Public endpoint verifying server liveness, cache statistics, and aggregator status.
- **Auth Required:** No
- **Request Parameters:** None
- **Response Schema:**
```json
{
  "status": "ok",
  "timestamp": "2026-05-04T17:21:09.123Z",
  "cache": {
    "size": 15,
    "hits": 142,
    "misses": 24,
    "hitRate": 0.855
  },
  "aggregator": {
    "running": true,
    "age": 1240
  }
}
```

### GET `/cache/stats`
Returns current statistics for the in-memory cache manager.
- **Auth Required:** Yes
- **Request Parameters:** None
- **Response Schema:**
```json
{
  "size": 15,
  "hits": 142,
  "misses": 24,
  "hitRate": 0.855,
  "keys": ["batch:stats:123456789", "dashboard:overview"]
}
```

### GET `/status`
Provides a complete hardware, OS, and service status diagnostic snapshot.
- **Auth Required:** Yes
- **Request Parameters:** None
- **Response Schema:**
```json
{
  "bot": {
    "username": "Pegasus#1234",
    "id": "98765432101234567",
    "status": "online",
    "uptime": 86400,
    "guildCount": 42,
    "userCount": 15420,
    "wsPing": 24,
    "memoryUsage": 128.4
  },
  "system": {
    "platform": "win32",
    "release": "10.0.22631",
    "arch": "x64",
    "uptime": 1205400,
    "loadavg": [0.15, 0.10, 0.05]
  },
  "cpu": {
    "model": "AMD Ryzen 7 5800X 8-Core Processor",
    "cores": 16,
    "speed": 3800,
    "usage": 14.2
  },
  "memory": {
    "total": 34359738368,
    "free": 16124502016,
    "used": 18235236352,
    "active": 12458212352,
    "available": 18451241984,
    "usage": 53.07
  },
  "gpu": {
    "controllers": [
      {
        "vendor": "NVIDIA",
        "model": "GeForce RTX 3080",
        "vram": 10240,
        "vramDynamic": true
      }
    ],
    "displays": [
      {
        "vendor": "Dell",
        "model": "S2721DGF",
        "main": true,
        "resolutionX": 2560,
        "resolutionY": 1440,
        "refreshRate": 165
      }
    ]
  },
  "disk": [
    {
      "fs": "C:",
      "type": "NTFS",
      "size": 1024215240704,
      "used": 512107620352,
      "use": 50.0,
      "mount": "C:"
    }
  ],
  "network": [
    {
      "iface": "Ethernet",
      "ip4": "192.168.1.100",
      "ip6": "fe80::1ff:fe23:4567",
      "mac": "00:1A:2B:3C:4D:5E",
      "operstate": "up",
      "speed": 1000
    }
  ],
  "services": {
    "discord": {
      "status": "online",
      "shards": 1,
      "latency": 24
    },
    "database": {
      "status": "online",
      "latency": 5
    },
    "external": {
      "steam": { "status": "online", "latency": 45 },
      "weather": { "status": "online", "latency": 32 },
      "news": { "status": "online", "latency": 68 }
    }
  },
  "timestamp": "2026-06-28T00:40:00.000Z"
}
```

### GET `/stats`
Returns aggregated, auto-refreshing real-time bot performance and feature usage metrics.
- **Auth Required:** Yes
- **Request Parameters:** None
- **Response Schema:**
```json
{
  "status": "online",
  "uptime": 86400,
  "started_at": "2026-06-27T00:40:00.000Z",
  "guilds": {
    "total": 42,
    "large": 5,
    "voice_active": 12
  },
  "users": {
    "total": 15420,
    "unique": 14980,
    "active_today": 3420,
    "online": 4120
  },
  "commands": {
    "total_executed": 152480,
    "today": 12450,
    "this_hour": 842,
    "per_minute": 14.2,
    "most_used": [
      { "command": "help", "count": 4521 },
      { "command": "daily", "count": 3842 },
      { "command": "rank", "count": 2951 }
    ]
  },
  "system": {
    "memory_usage": 128450120,
    "memory_total": 34359738368,
    "cpu_usage": 14.2,
    "latency": 24,
    "shard_count": 1
  },
  "features": {
    "music": false,
    "moderation": true,
    "economy": true,
    "leveling": true,
    "giveaways": true,
    "tickets": true,
    "activity": {
      "economy": 4512,
      "moderation": 312,
      "tickets": 152,
      "giveaways": 89,
      "xp": 89412
    }
  },
  "version": "1.0.0",
  "cache_age": 1240
}
```

---

## Dashboard API (`/dashboard`)

### GET `/dashboard/overview`
Aggregates bot-wide KPIs and recent activity feeds for the web dashboard.
- **Auth Required:** Yes
- **Request Parameters:** None
- **Response Schema:**
```json
{
  "bot": {
    "status": "online",
    "uptime": 86400,
    "ping": 24
  },
  "guilds": {
    "total": 42,
    "large": 5,
    "top": [
      {
        "id": "12345678901234567",
        "name": "Support Server",
        "icon": "a_bcdef123456",
        "memberCount": 5420
      }
    ]
  },
  "users": {
    "total": 15420,
    "online": 4120
  },
  "commands": {
    "total": 152480,
    "today": 12450
  },
  "system": {
    "memoryUsage": 128.4,
    "cpuUsage": 14.2
  },
  "totals": {
    "tickets": 152,
    "moderation": 312,
    "configuredGuilds": 38
  },
  "recentActivity": [
    {
      "type": "ticket",
      "guildId": "12345678901234567",
      "userId": "98765432109876543",
      "action": "open",
      "timestamp": "2026-06-28T00:39:55.000Z"
    },
    {
      "type": "moderation",
      "guildId": "12345678901234567",
      "userId": "11122233344455566",
      "action": "warn",
      "reason": "Spamming in general",
      "timestamp": "2026-06-28T00:38:12.000Z"
    },
    {
      "type": "economy",
      "guildId": "12345678901234567",
      "userId": "98765432109876543",
      "action": "daily",
      "amount": 100,
      "timestamp": "2026-06-28T00:35:00.000Z"
    }
  ],
  "cacheAge": 1420,
  "generatedAt": "2026-06-28T00:40:00.000Z"
}
```

### GET `/dashboard/guilds`
Returns paginated summaries of guilds the bot is currently in.
- **Auth Required:** Yes
- **Query Parameters:**
  - `limit` (optional integer, default `25`, max `100`)
  - `offset` (optional integer, default `0`)
  - `search` (optional string, filters by name or guild ID)
- **Response Schema:**
```json
{
  "guilds": [
    {
      "id": "12345678901234567",
      "name": "Support Server",
      "icon": "a_bcdef123456",
      "memberCount": 5420,
      "onlineCount": 1240,
      "roleCount": 32,
      "channelCount": 45,
      "boostLevel": 2,
      "boostCount": 12,
      "isConfigured": true
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 25,
    "offset": 0,
    "hasMore": true
  }
}
```

### GET `/dashboard/guilds/:guildId/overview`
Provides deep diagnostics and recent module actions for a specific guild.
- **Auth Required:** Yes
- **Request Parameters:** `guildId` (string in URL path)
- **Response Schema:**
```json
{
  "guild": {
    "id": "12345678901234567",
    "name": "Support Server",
    "icon": "a_bcdef123456",
    "memberCount": 5420,
    "boostCount": 12,
    "shard": 0,
    "ownerId": "11122233344455566",
    "createdAt": "2021-01-15T12:00:00.000Z"
  },
  "settings": {
    "prefix": "!",
    "language": "en",
    "welcomeEnabled": true,
    "logsEnabled": true,
    "xpEnabled": true,
    "securityEnabled": true
  },
  "metrics": {
    "moderation": { "totalCases": 312, "activeMutes": 3, "activeBans": 15 },
    "tickets": { "openTickets": 4, "totalTickets": 152, "avgResolutionTimeMinutes": 34, "panelCount": 2 },
    "economy": { "totalCurrency": 12458900, "activeAccounts": 1420, "shopItemCount": 12 },
    "xp": { "totalXp": 89412500, "topLevel": 64, "roleRewardsCount": 5 },
    "engagement": { "messagesToday": 4521, "activeVoiceUsers": 18 }
  },
  "recentActivity": [
    {
      "id": "act_1",
      "type": "ticket",
      "action": "open",
      "userId": "98765432109876543",
      "timestamp": "2026-06-28T00:39:55.000Z"
    }
  ],
  "modules": {
    "economy": { "enabled": true, "stats": { "transactionsToday": 152 } },
    "moderation": { "enabled": true, "stats": { "actionsToday": 12 } },
    "tickets": { "enabled": true, "stats": { "openCount": 4 } },
    "giveaways": { "enabled": true, "stats": { "activeCount": 2 } },
    "xp": { "enabled": true, "stats": { "activeUsersToday": 412 } }
  }
}
```

---

## Batch API (`/batch`)

### POST `/batch/guilds`
Fetches high-level summary information for multiple guilds simultaneously.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "guildIds": ["12345678901234567", "98765432109876543"],
  "fields": ["basic", "features", "settings", "stats"]
}
```
- **Response Schema:**
```json
{
  "guilds": [
    {
      "id": "12345678901234567",
      "name": "Support Server",
      "icon": "a_bcdef123456",
      "memberCount": 5420,
      "onlineCount": 1240,
      "features": {
        "economy": true,
        "moderation": true,
        "tickets": true,
        "xp": true,
        "giveaways": true
      },
      "settings": {
        "prefix": "!",
        "language": "en"
      },
      "stats": {
        "totalMembers": 5420,
        "activeMembers": 4120,
        "economyBalance": 12458900
      }
    }
  ],
  "total": 1,
  "cached": 0
}
```

### POST `/batch/members`
Fetches top member XP leaderboards for multiple guilds.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "guildIds": ["12345678901234567"],
  "limit": 5
}
```
- **Response Schema:**
```json
{
  "guilds": {
    "12345678901234567": [
      {
        "userId": "98765432109876543",
        "xp": 15420,
        "level": 12,
        "messages": 1542
      }
    ]
  },
  "total": 1
}
```

### POST `/batch/stats`
Fetches live structural statistics for multiple guilds.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "guildIds": ["12345678901234567"]
}
```
- **Response Schema:**
```json
{
  "guilds": {
    "12345678901234567": {
      "memberCount": 5420,
      "onlineCount": 1240,
      "boostLevel": 2,
      "boostCount": 12,
      "channelCount": 45,
      "roleCount": 32
    }
  },
  "total": 1
}
```

---

## Monitoring API (`/monitoring`)

### GET `/monitoring/health`
Detailed operational health view including database pool state and cache memory.
- **Auth Required:** Yes
- **Response Schema:**
```json
{
  "status": "healthy",
  "timestamp": "2026-06-28T00:40:00.000Z",
  "uptime": 86400,
  "components": {
    "database": { "status": "healthy", "latency": 4, "pool": { "total": 10, "idle": 8, "waiting": 0 } },
    "cache": { "status": "healthy", "size": 15, "hitRate": 0.855, "memoryUsageKb": 1024 },
    "rateLimiter": { "status": "healthy", "trackedIps": 12, "trackedGuilds": 5 },
    "statsAggregator": { "status": "healthy", "lastRefresh": "2026-06-28T00:39:58.000Z", "freshnessMs": 2000 }
  },
  "system": {
    "memoryUsageMb": 128.4,
    "cpuUsagePercent": 14.2
  }
}
```

### GET `/monitoring/metrics`
Historical metrics on cache performance and query profiling.
- **Auth Required:** Yes
- **Response Schema:**
```json
{
  "cache": { "hitRate": 0.855, "evictionCount": 0, "totalOperations": 166 },
  "database": { "queriesPerMinute": 142.5, "averageQueryDurationMs": 3.2, "slowQueryCount": 0 },
  "aggregator": { "refreshCount": 17280, "averageCalculationTimeMs": 12.4 }
}
```

### GET `/monitoring/cache`
Current cache stats and general optimization recommendations.
- **Auth Required:** Yes
- **Response Schema:**
```json
{
  "size": 15,
  "hits": 142,
  "misses": 24,
  "hitRate": 0.855,
  "memoryUsageKb": 1024,
  "advice": "Cache hit rate is healthy (> 80%). No parameter tuning required."
}
```

### POST `/monitoring/cache/clear`
Clears matching keys from the in-memory cache.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "pattern": "batch:*"
}
```
*(Passing an empty body clears the entire cache).*
- **Response Schema:**
```json
{
  "success": true,
  "clearedCount": 4,
  "pattern": "batch:*"
}
```

### GET `/monitoring/queries`
Shows recorded slow queries and execution time analytics.
- **Auth Required:** Yes
- **Response Schema:**
```json
{
  "totalQueriesTracked": 15420,
  "slowQueries": [
    {
      "query": "SELECT * FROM economy_balances WHERE guild_id = $1 ORDER BY balance DESC LIMIT 100",
      "durationMs": 142,
      "timestamp": "2026-06-28T00:15:22.000Z"
    }
  ],
  "averageDurationMs": 3.2
}
```

### POST `/monitoring/queries/reset`
Wipes stored query tracking metrics.
- **Auth Required:** Yes
- **Request Body Schema:** `{}` (Empty body)
- **Response Schema:**
```json
{
  "success": true,
  "message": "Query metrics reset successfully"
}
```

### GET `/monitoring/rate-limits`
Retrieves rate limiter configurations and current tracking maps.
- **Auth Required:** Yes
- **Response Schema:**
```json
{
  "configuredLimits": {
    "ip": { "windowMs": 60000, "max": 200 },
    "stats": { "windowMs": 500, "max": 2 },
    "guildWrite": { "windowMs": 1000, "max": 10 }
  },
  "currentTrackedIps": 12,
  "currentTrackedGuilds": 5
}
```

### GET `/monitoring/dashboard`
Consolidated top-level summary for the operations health dashboard.
- **Auth Required:** Yes
- **Response Schema:**
```json
{
  "uptime": 86400,
  "cacheHitRate": 0.855,
  "activeDatabaseConnections": 2,
  "aggregatorFreshnessMs": 2000,
  "status": "healthy"
}
```

---

## Guild Analytics API (`/guilds`)

### GET `/guilds/:guildId/economy`
Returns economy leaderboard and available shop items for a guild.
- **Auth Required:** Yes
- **Request Parameters:** `guildId`
- **Response Schema:**
```json
{
  "settings": {
    "enabled": true,
    "currency_name": "coins",
    "currency_symbol": "🪙",
    "starting_balance": 100,
    "daily_amount": 50,
    "daily_streak_bonus": 10
  },
  "shop_items": [
    {
      "id": "item_123",
      "name": "VIP Role",
      "description": "Access to VIP channels",
      "price": 10000,
      "type": "role",
      "effect_type": "role_grant",
      "effect_value": { "roleId": "99988877766655544" },
      "stock": -1,
      "requires_role": null,
      "enabled": true
    }
  ],
  "top_balances": [
    {
      "userId": "98765432109876543",
      "balance": 154200,
      "bankBalance": 500000
    }
  ]
}
```

### GET `/guilds/:guildId/moderation`
Returns active moderation cases, warnings, and aggregate counts.
- **Auth Required:** Yes
- **Request Parameters:** `guildId`
- **Response Schema:**
```json
{
  "settings": {
    "enabled": true,
    "mute_role_id": "99988877766655544",
    "log_channel_id": "88877766655544433",
    "max_warnings": 3,
    "anti_spam_enabled": true
  },
  "recent_warnings": [
    {
      "id": "warn_123",
      "userId": "11122233344455566",
      "moderatorId": "98765432109876543",
      "reason": "Swearing",
      "createdAt": "2026-06-28T00:15:00.000Z"
    }
  ],
  "recent_cases": [
    {
      "id": "case_123",
      "caseNumber": 152,
      "type": "ban",
      "userId": "11122233344455566",
      "moderatorId": "98765432109876543",
      "reason": "Exceeded max warnings",
      "createdAt": "2026-06-28T00:20:00.000Z"
    }
  ],
  "stats": {
    "total_cases": 152,
    "warnings": 110,
    "mutes": 22,
    "kicks": 15,
    "bans": 5
  }
}
```

### GET `/guilds/:guildId/tickets`
Returns active ticket queues, existing ticket panels, and resolution metrics.
- **Auth Required:** Yes
- **Request Parameters:** `guildId`
- **Response Schema:**
```json
{
  "settings": {
    "enabled": true,
    "max_open_tickets": 3,
    "support_role_ids": ["99988877766655544"],
    "category_id": "88877766655544433",
    "log_channel_id": "77766655544433322"
  },
  "active_panels": [
    {
      "id": "panel_123",
      "title": "General Support",
      "description": "Click the button below to open a support ticket.",
      "categoryId": "88877766655544433",
      "channelId": "77766655544433322",
      "messageId": "66655544433322211"
    }
  ],
  "active_tickets": [
    {
      "id": "ticket_123",
      "userId": "11122233344455566",
      "channelId": "55544433322211100",
      "status": "open",
      "createdAt": "2026-06-28T00:30:00.000Z"
    }
  ],
  "stats": {
    "total_tickets": 152,
    "open_tickets": 1,
    "closed_tickets": 151,
    "avg_response_time_mins": 12
  }
}
```

### GET `/guilds/:guildId/xp`
Returns XP leaderboard, level rewards, and configuration.
- **Auth Required:** Yes
- **Request Parameters:** `guildId`
- **Response Schema:**
```json
{
  "settings": {
    "enabled": true,
    "xp_rate": 15,
    "xp_cooldown": 60,
    "announce_level_up": true,
    "level_up_channel_id": null
  },
  "rewards": [
    {
      "level": 10,
      "roleId": "99988877766655544"
    }
  ],
  "leaderboard": [
    {
      "userId": "98765432109876543",
      "xp": 15420,
      "level": 12,
      "messages": 1542
    }
  ]
}
```

### GET `/guilds/:guildId/giveaways`
Returns active and recently ended giveaways.
- **Auth Required:** Yes
- **Request Parameters:** `guildId`
- **Response Schema:**
```json
{
  "active_giveaways": [
    {
      "id": "giveaway_123",
      "prize": "Discord Nitro",
      "channelId": "77766655544433322",
      "messageId": "66655544433322211",
      "endTime": "2026-06-29T00:00:00.000Z",
      "winnerCount": 1,
      "hostedBy": "98765432109876543",
      "participantCount": 42
    }
  ],
  "ended_giveaways": [
    {
      "id": "giveaway_001",
      "prize": "Steam Key",
      "channelId": "77766655544433322",
      "endedAt": "2026-06-27T00:00:00.000Z",
      "winners": ["11122233344455566"]
    }
  ],
  "stats": {
    "total_giveaways": 25,
    "active_giveaways": 1,
    "total_participants": 1240
  }
}
```

### GET `/guilds/:guildId/settings`
Returns core bot configuration settings for the guild.
- **Auth Required:** Yes
- **Request Parameters:** `guildId`
- **Response Schema:**
```json
{
  "general": {
    "prefix": "!",
    "language": "en"
  },
  "notifications": {
    "welcome_enabled": true,
    "welcome_channel": "77766655544433322",
    "welcome_message": "Welcome {user} to {server}!",
    "goodbye_enabled": false,
    "goodbye_channel": null,
    "goodbye_message": null
  },
  "automod": {
    "enabled": true,
    "anti_spam": true,
    "anti_invite": true,
    "max_mentions": 5
  },
  "logging": {
    "enabled": true,
    "log_channel": "88877766655544433"
  }
}
```

### GET `/guilds/:guildId/members`
Returns member overview statistics and a partial member array.
- **Auth Required:** Yes
- **Request Parameters:** `guildId`
- **Response Schema:**
```json
{
  "members": [
    {
      "id": "98765432109876543",
      "username": "User#1234",
      "displayName": "Nickname",
      "avatar": "a_bcdef123456",
      "bot": false,
      "online": true,
      "roles": ["99988877766655544"]
    }
  ],
  "stats": {
    "total": 5420,
    "online": 1240,
    "bots": 15,
    "humans": 5405
  }
}
```

### GET `/guilds/:guildId/logs`
Returns recent audit log entries for the guild.
- **Auth Required:** Yes
- **Request Parameters:** `guildId`
- **Response Schema:**
```json
{
  "logs": []
}
```

### GET `/guilds/:guildId/notifications`
Returns current notification configuration along with available text channels for selection.
- **Auth Required:** Yes
- **Request Parameters:** `guildId`
- **Response Schema:**
```json
{
  "settings": {
    "welcome_enabled": true,
    "welcome_channel": "77766655544433322",
    "welcome_message": "Welcome {user} to {server}!",
    "goodbye_enabled": false,
    "goodbye_channel": null,
    "goodbye_message": null
  },
  "available_channels": [
    {
      "id": "77766655544433322",
      "name": "general"
    },
    {
      "id": "88877766655544433",
      "name": "bot-logs"
    }
  ]
}
```

---

## Tickets Management API (`/guilds/:guildId/tickets`)

### POST `/guilds/:guildId/tickets/panels`
Creates a new ticket panel, sends an embed with a button to the target Discord channel, and saves the configuration.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "title": "Support Panel",
  "description": "Click the button below to open a ticket.",
  "categoryId": "88877766655544433",
  "channelId": "77766655544433322",
  "welcomeMessage": "Hello! Support will be with you shortly.",
  "buttonLabel": "Create Ticket",
  "buttonEmoji": "🎫",
  "buttonStyle": 1,
  "supportRoles": ["99988877766655544"],
  "maxTicketsPerUser": 3
}
```
- **Response Schema (`201 Created`):**
```json
{
  "success": true,
  "panel": {
    "id": "panel_123456789",
    "title": "Support Panel",
    "description": "Click the button below to open a ticket.",
    "categoryId": "88877766655544433",
    "channelId": "77766655544433322",
    "messageId": "66655544433322211"
  }
}
```

### PATCH `/guilds/:guildId/tickets/panels/:panelId`
Updates an existing ticket panel and edits the Discord embed message if title or description changed.
- **Auth Required:** Yes
- **Request Parameters:** `guildId`, `panelId`
- **Request Body Schema:** *(Any subset of the creation schema)*
```json
{
  "title": "Updated Support Panel Title"
}
```
- **Response Schema:**
```json
{
  "success": true,
  "panel": {
    "id": "panel_123456789",
    "title": "Updated Support Panel Title",
    "description": "Click the button below to open a ticket.",
    "categoryId": "88877766655544433",
    "channelId": "77766655544433322"
  }
}
```

### DELETE `/guilds/:guildId/tickets/panels/:panelId`
Deletes a ticket panel and removes the embed message from Discord.
- **Auth Required:** Yes
- **Request Parameters:** `guildId`, `panelId`
- **Response Schema:**
```json
{
  "success": true,
  "message": "Ticket panel deleted successfully"
}
```

### POST `/guilds/:guildId/tickets/:ticketId/close`
Closes an active ticket, deletes its Discord channel, and sends a closure DM to the user.
- **Auth Required:** Yes
- **Request Parameters:** `guildId`, `ticketId`
- **Request Body Schema:**
```json
{
  "closedBy": "98765432109876543",
  "reason": "Issue resolved successfully"
}
```
- **Response Schema:**
```json
{
  "success": true,
  "message": "Ticket closed successfully"
}
```

### GET `/guilds/:guildId/tickets/:ticketId`
Fetches current state and metadata for a specific ticket.
- **Auth Required:** Yes
- **Request Parameters:** `guildId`, `ticketId`
- **Response Schema:**
```json
{
  "id": "ticket_123",
  "userId": "11122233344455566",
  "channelId": "55544433322211100",
  "panelId": "panel_123456789",
  "status": "closed",
  "createdAt": "2026-06-28T00:30:00.000Z",
  "closedAt": "2026-06-28T00:40:00.000Z",
  "closedBy": "98765432109876543",
  "closedReason": "Issue resolved successfully"
}
```

---

## Economy Management API (`/guilds/:guildId/economy`)

### POST `/guilds/:guildId/economy/shop-items`
Creates a new economy item available for purchase in the shop.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "name": "XP Booster",
  "price": 5000,
  "description": "Doubles XP gain for 24 hours",
  "type": "booster",
  "effectType": "xp_boost",
  "effectValue": { "multiplier": 2, "duration": 86400 },
  "stock": 100,
  "requiresRole": null,
  "enabled": true
}
```
- **Response Schema (`201 Created`):**
```json
{
  "success": true,
  "item": {
    "id": "item_456",
    "guildId": "12345678901234567",
    "name": "XP Booster",
    "price": 5000,
    "description": "Doubles XP gain for 24 hours",
    "type": "booster",
    "effectType": "xp_boost",
    "effectValue": { "multiplier": 2, "duration": 86400 },
    "stock": 100,
    "requiresRole": null,
    "enabled": true,
    "createdAt": "2026-06-28T00:40:00.000Z",
    "updatedAt": "2026-06-28T00:40:00.000Z"
  }
}
```

### PATCH `/guilds/:guildId/economy/shop-items/:itemId`
Updates properties of an existing shop item.
- **Auth Required:** Yes
- **Request Parameters:** `guildId`, `itemId`
- **Request Body Schema:** *(Any subset of the creation schema)*
```json
{
  "price": 4000
}
```
- **Response Schema:**
```json
{
  "success": true,
  "item": {
    "id": "item_456",
    "guildId": "12345678901234567",
    "name": "XP Booster",
    "price": 4000,
    "description": "Doubles XP gain for 24 hours",
    "type": "booster",
    "effectType": "xp_boost",
    "effectValue": { "multiplier": 2, "duration": 86400 },
    "stock": 100,
    "requiresRole": null,
    "enabled": true,
    "createdAt": "2026-06-28T00:40:00.000Z",
    "updatedAt": "2026-06-28T00:41:00.000Z"
  }
}
```

### DELETE `/guilds/:guildId/economy/shop-items/:itemId`
Removes a shop item from the database.
- **Auth Required:** Yes
- **Request Parameters:** `guildId`, `itemId`
- **Response Schema:**
```json
{
  "success": true,
  "message": "Shop item deleted successfully"
}
```

### PATCH `/guilds/:guildId/economy/settings`
Updates economy operational parameters.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "currencySymbol": "🪙",
  "currencyName": "coins",
  "startingBalance": 500,
  "dailyAmount": 100,
  "workMinAmount": 50,
  "workMaxAmount": 200,
  "workCooldown": 3600,
  "robEnabled": true,
  "robSuccessRate": 50,
  "robCooldown": 86400
}
```
- **Response Schema:**
```json
{
  "success": true,
  "message": "Economy settings updated successfully"
}
```

### POST `/guilds/:guildId/economy/reset`
Resets user balances, shop items, or transaction logs transactionally.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "resetBalances": true,
  "resetShop": false,
  "resetTransactions": false
}
```
- **Response Schema:**
```json
{
  "success": true,
  "message": "Economy data reset successfully",
  "reset": {
    "balances": true,
    "shop": false,
    "transactions": false
  }
}
```

---

## Moderation Management API (`/guilds/:guildId/moderation`)

### POST `/guilds/:guildId/moderation/warn`
Issues a warning to a user, logs a moderation case, and attempts to DM the user.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "userId": "11122233344455566",
  "moderatorId": "98765432109876543",
  "reason": "Inappropriate language",
  "level": 1
}
```
- **Response Schema (`201 Created`):**
```json
{
  "success": true,
  "case": {
    "id": "case_153",
    "guildId": "12345678901234567",
    "caseNumber": 153,
    "type": "warn",
    "userId": "11122233344455566",
    "moderatorId": "98765432109876543",
    "reason": "Inappropriate language",
    "createdAt": "2026-06-28T00:40:00.000Z"
  },
  "warning": {
    "id": "warn_124",
    "userId": "11122233344455566",
    "reason": "Inappropriate language",
    "level": 1
  }
}
```

### POST `/guilds/:guildId/moderation/ban`
Bans a user from the guild. Supports temporary bans via `duration` (ms) and deleting recent messages.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "userId": "11122233344455566",
  "moderatorId": "98765432109876543",
  "reason": "Severe rule violations",
  "duration": 86400000, 
  "deleteMessageDays": 1
}
```
*(Where `duration` is in milliseconds; `86400000` = 1 day).*
- **Response Schema (`201 Created`):**
```json
{
  "success": true,
  "case": {
    "id": "case_154",
    "guildId": "12345678901234567",
    "caseNumber": 154,
    "type": "ban",
    "userId": "11122233344455566",
    "moderatorId": "98765432109876543",
    "reason": "Severe rule violations",
    "expiresAt": "2026-06-29T00:40:00.000Z",
    "createdAt": "2026-06-28T00:40:00.000Z"
  }
}
```

### POST `/guilds/:guildId/moderation/kick`
Kicks a member from the guild.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "userId": "11122233344455566",
  "moderatorId": "98765432109876543",
  "reason": "Disruptive behavior"
}
```
- **Response Schema (`201 Created`):**
```json
{
  "success": true,
  "case": {
    "id": "case_155",
    "guildId": "12345678901234567",
    "caseNumber": 155,
    "type": "kick",
    "userId": "11122233344455566",
    "moderatorId": "98765432109876543",
    "reason": "Disruptive behavior",
    "createdAt": "2026-06-28T00:40:00.000Z"
  }
}
```

### POST `/guilds/:guildId/moderation/mute`
Applies the "Muted" role to a user. Supports temporary mutes via `duration` (ms).
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "userId": "11122233344455566",
  "moderatorId": "98765432109876543",
  "reason": "Spamming",
  "duration": 3600000
}
```
*(Where `duration` is in milliseconds; `3600000` = 1 hour).*
- **Response Schema (`201 Created`):**
```json
{
  "success": true,
  "case": {
    "id": "case_156",
    "guildId": "12345678901234567",
    "caseNumber": 156,
    "type": "mute",
    "userId": "11122233344455566",
    "moderatorId": "98765432109876543",
    "reason": "Spamming",
    "expiresAt": "2026-06-28T01:40:00.000Z",
    "createdAt": "2026-06-28T00:40:00.000Z"
  }
}
```

### PATCH `/guilds/:guildId/moderation/settings`
Updates moderation configuration settings (e.g. anti-spam toggles, log channels).
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "antiSpamEnabled": true,
  "logChannelId": "88877766655544433"
}
```
- **Response Schema:**
```json
{
  "success": true,
  "message": "Moderation settings updated successfully"
}
```

---

## XP Management API (`/guilds/:guildId/xp`)

### PATCH `/guilds/:guildId/xp/settings`
Updates XP generation rates, cooldowns, and level-up announcement behaviors.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "enabled": true,
  "xpRate": 15,
  "xpCooldown": 60,
  "levelUpMessage": "Congrats {user}! You reached level {level}!",
  "levelUpChannel": null,
  "announceLevelUp": true,
  "xpBlacklistRoles": [],
  "xpBlacklistChannels": [],
  "xpMultiplierRoles": {
    "99988877766655544": 1.5
  }
}
```
- **Response Schema:**
```json
{
  "success": true,
  "message": "XP settings updated successfully"
}
```

### POST `/guilds/:guildId/xp/rewards`
Configures a role reward granted automatically upon reaching a target level.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "level": 15,
  "roleId": "99988877766655544"
}
```
- **Response Schema (`201 Created`):**
```json
{
  "success": true,
  "reward": {
    "level": 15,
    "roleId": "99988877766655544"
  }
}
```

### DELETE `/guilds/:guildId/xp/rewards/:level`
Removes a configured role reward for a specific level.
- **Auth Required:** Yes
- **Request Parameters:** `guildId`, `level` (integer in URL path)
- **Response Schema:**
```json
{
  "success": true,
  "message": "Role reward deleted successfully"
}
```

### POST `/guilds/:guildId/xp/reset`
Resets member XP, role rewards, or settings.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "resetLevels": true,
  "resetRewards": false,
  "keepSettings": true
}
```
- **Response Schema:**
```json
{
  "success": true,
  "message": "XP data reset successfully",
  "reset": {
    "levels": true,
    "rewards": false,
    "settings": false
  }
}
```

### GET `/guilds/:guildId/xp/user/:userId`
Retrieves exact XP, level, and progress percentage to the next level for a member.
- **Auth Required:** Yes
- **Request Parameters:** `guildId`, `userId`
- **Response Schema:**
```json
{
  "userId": "11122233344455566",
  "xp": 1450,
  "level": 3,
  "messages": 145,
  "xpProgress": 550,
  "xpNeeded": 700,
  "progressPercentage": 78,
  "lastXpGain": null
}
```

### PATCH `/guilds/:guildId/xp/user/:userId`
Directly sets or increments a user's XP or level. Creates the member record if absent.
- **Auth Required:** Yes
- **Request Parameters:** `guildId`, `userId`
- **Request Body Schema:**
```json
{
  "addXp": 500,
  "addLevel": 1
}
```
*(Alternatively, exact values can be passed via `xp` or `level`).*
- **Response Schema:**
```json
{
  "success": true,
  "message": "User XP updated successfully"
}
```

---

## Giveaways Management API (`/guilds/:guildId/giveaways`)

### POST `/guilds/:guildId/giveaways`
Creates a giveaway, posts an interactive embed with an entry button in Discord, and schedules the auto-end timer.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "prize": "Discord Nitro",
  "description": "Monthly subscription giveaway!",
  "channelId": "77766655544433322",
  "duration": 86400000,
  "winnerCount": 2,
  "hostedBy": "98765432109876543",
  "requiredRole": "99988877766655544",
  "bonusEntries": [
    { "roleId": "88877766655544433", "entries": 2 }
  ],
  "allowedRoles": [],
  "blockedRoles": [],
  "embedTitle": "Custom Giveaway!",
  "embedImage": "https://example.com/giveaway-banner.png",
  "embedThumbnail": "https://example.com/icon.png",
  "embedColor": "#FF5500"
}
```
*(Where `duration` is in milliseconds; `86400000` = 1 day).*
- **Response Schema (`201 Created`):**
```json
{
  "success": true,
  "giveaway": {
    "id": "giveaway_uuid_12345",
    "prize": "Discord Nitro",
    "channelId": "77766655544433322",
    "messageId": "66655544433322211",
    "endTime": "2026-06-29T00:40:00.000Z",
    "winnerCount": 2
  }
}
```

### PATCH `/guilds/:guildId/giveaways/:giveawayId`
Updates properties of an active giveaway and edits the Discord embed message.
- **Auth Required:** Yes
- **Request Parameters:** `guildId`, `giveawayId`
- **Request Body Schema:** *(Any subset of the creation schema)*
```json
{
  "winnerCount": 3,
  "embedTitle": "Updated Custom Giveaway!",
  "embedImage": "https://example.com/new-giveaway-banner.png",
  "embedThumbnail": "https://example.com/new-icon.png",
  "embedColor": "#00AAFF"
}
```
- **Response Schema:**
```json
{
  "success": true,
  "message": "Giveaway updated successfully"
}
```

### DELETE `/guilds/:guildId/giveaways/:giveawayId`
Deletes a giveaway, removes its Discord message, and wipes entry records.
- **Auth Required:** Yes
- **Request Parameters:** `guildId`, `giveawayId`
- **Response Schema:**
```json
{
  "success": true,
  "message": "Giveaway deleted successfully"
}
```

### POST `/guilds/:guildId/giveaways/:giveawayId/end`
Manually forces an active giveaway to end immediately, selecting winners and announcing them in Discord.
- **Auth Required:** Yes
- **Request Parameters:** `guildId`, `giveawayId`
- **Response Schema:**
```json
{
  "success": true,
  "winners": ["11122233344455566", "22233344455566677"],
  "message": "Giveaway ended successfully"
}
```

### POST `/guilds/:guildId/giveaways/:giveawayId/reroll`
Rerolls winners for an ended giveaway, excluding previous winners, and announces the new winners in Discord.
- **Auth Required:** Yes
- **Request Parameters:** `guildId`, `giveawayId`
- **Request Body Schema:**
```json
{
  "count": 1
}
```
- **Response Schema:**
```json
{
  "success": true,
  "newWinners": ["33344455566677788"],
  "message": "Giveaway rerolled successfully"
}
```

---

## Settings API (`/guilds/:guildId/settings`)

### PATCH `/guilds/:guildId/settings`
Updates composite settings for a guild across `guilds` and `guild_settings` tables.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "prefix": "!",
  "language": "en",
  "notifications": {
    "welcome_enabled": true,
    "welcome_channel": "77766655544433322",
    "welcome_message": "Welcome {user}!"
  },
  "automod": {
    "enabled": true,
    "anti_spam": true,
    "max_mentions": 5
  },
  "logging": {
    "enabled": true,
    "log_channel": "88877766655544433"
  }
}
```
- **Response Schema:**
```json
{
  "success": true,
  "message": "Settings updated successfully"
}
```

### GET `/guilds/:guildId/settings/export`
Exports the complete configuration profile of a guild (settings, shop items, XP rewards, ticket panels, automations) into a portable JSON structure.
- **Auth Required:** Yes
- **Request Parameters:** `guildId`
- **Response Schema:**
```json
{
  "version": "1.0.0",
  "exportedAt": "2026-06-28T00:40:00.000Z",
  "guildId": "12345678901234567",
  "settings": {
    "prefix": "!",
    "language": "en",
    "welcomeEnabled": true
  },
  "economy": {
    "shopItems": [
      { "name": "VIP Role", "price": 10000, "type": "role", "description": "VIP access" }
    ]
  },
  "xp": {
    "rewards": [
      { "level": 10, "roleId": "99988877766655544" }
    ]
  },
  "tickets": {
    "panels": [
      { "title": "Support", "description": "Open a ticket", "buttonLabel": "Create" }
    ]
  },
  "moderation": {
    "automations": []
  }
}
```

### POST `/guilds/:guildId/settings/import`
Imports a previously exported configuration profile into a guild.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "data": {
    "version": "1.0.0",
    "settings": { "prefix": "!", "language": "en" },
    "economy": { "shopItems": [] },
    "xp": { "rewards": [] },
    "tickets": { "panels": [] },
    "moderation": { "automations": [] }
  },
  "options": {
    "importSettings": true,
    "importEconomy": true,
    "importXp": true,
    "importTickets": true,
    "importModeration": true,
    "overwrite": true
  }
}
```
- **Response Schema:**
```json
{
  "success": true,
  "message": "Settings imported successfully",
  "imported": {
    "settings": true,
    "economy": true,
    "xp": true,
    "tickets": true,
    "moderation": true
  }
}
```

---

## Geizhals API (`/geizhals`)

These endpoints provide direct access to price comparison data via the integrated `GeizhalsService`.

### POST / GET `/geizhals/search`
Searches for products across Geizhals categories.
- **Auth Required:** Yes
- **Request Parameters (POST Body or GET Query Params):**
```json
{
  "query": "RTX 4090",
  "loc": "de",
  "lang": "de",
  "n_offers": 5,
  "locale": "de_DE"
}
```
- **Response Schema:**
```json
{
  "products": [
    {
      "name": "ASUS TUF Gaming GeForce RTX 4090 OC",
      "category": "Grafikkarten",
      "bestPrice": 1799.00,
      "currency": "EUR",
      "offersCount": 24,
      "url": "https://geizhals.de/asus-tuf-gaming-geforce-rtx-4090-a2819584.html"
    }
  ]
}
```

### POST / GET `/geizhals/categories`
Retrieves available product categories.
- **Auth Required:** Yes
- **Request Parameters (POST Body or GET Query Params):**
```json
{
  "loc": "de",
  "lang": "de"
}
```
- **Response Schema:**
```json
{
  "categories": [
    {
      "id": "cat_1",
      "name": "Hardware",
      "subcategoriesCount": 15
    }
  ]
}
```

### POST `/geizhals/categorylist`
Retrieves the list of products within a specific category ID.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "cat": "cat_1",
  "loc": "de",
  "lang": "de"
}
```
- **Response Schema:**
```json
{
  "categoryId": "cat_1",
  "categoryName": "Hardware",
  "items": [
    {
      "id": "prod_123",
      "name": "AMD Ryzen 7 7800X3D",
      "price": 349.00
    }
  ]
}
```

### POST `/geizhals/bestprice_development`
Fetches historical best-price development trends for a specific product or category.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "cat": "prod_123",
  "loc": "de",
  "lang": "de"
}
```
- **Response Schema:**
```json
{
  "productId": "prod_123",
  "history": [
    { "date": "2026-05-01", "price": 369.00 },
    { "date": "2026-06-01", "price": 355.00 },
    { "date": "2026-06-25", "price": 349.00 }
  ]
}
```

---

## Dashboard Direct Management API (`/api`)

These endpoints are specifically tailored for integration with the web dashboard, enabling remote ticket lifecycle operations and J2C (Join to Create) voice channel management directly from the UI. All endpoints support both `POST` and `PATCH` HTTP methods.

### POST / PATCH `/api/tickets/close`
Closes a ticket, sends an embed message in Discord, deletes the channel, and sends a closure DM to the ticket author.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "ticketId": "ticket_uuid_12345",
  "guildId": "12345678901234567", 
  "reason": "Request fulfilled",
  "userId": "98765432109876543"
}
```
*(Where `guildId`, `reason`, and `userId`/`closedBy` are optional).*
- **Response Schema:**
```json
{
  "success": true,
  "message": "Ticket closed successfully",
  "ticket": {
    "id": "ticket_uuid_12345",
    "status": "closed",
    "closedBy": "98765432109876543",
    "closedReason": "Request fulfilled",
    "closedAt": "2026-06-28T00:45:00.000Z"
  }
}
```

### POST / PATCH `/api/tickets/lock`
Locks a ticket by updating channel permission overwrites so the author can no longer send messages, and posts a lock announcement embed.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "ticketId": "ticket_uuid_12345",
  "guildId": "12345678901234567",
  "reason": "Investigation ongoing",
  "userId": "98765432109876543"
}
```
- **Response Schema:**
```json
{
  "success": true,
  "message": "Ticket locked successfully",
  "ticket": {
    "id": "ticket_uuid_12345",
    "status": "locked",
    "lockedBy": "98765432109876543",
    "lockedAt": "2026-06-28T00:45:00.000Z"
  }
}
```

### POST / PATCH `/api/tickets/freeze`
Freezes a ticket by revoking message sending and reaction permissions in the channel, and posts a freeze announcement embed.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "ticketId": "ticket_uuid_12345",
  "guildId": "12345678901234567",
  "reason": "Administrative review",
  "userId": "98765432109876543"
}
```
- **Response Schema:**
```json
{
  "success": true,
  "message": "Ticket frozen successfully",
  "ticket": {
    "id": "ticket_uuid_12345",
    "status": "frozen",
    "frozenBy": "98765432109876543",
    "frozenAt": "2026-06-28T00:45:00.000Z"
  }
}
```

### POST / PATCH `/api/tickets/claim`
Claims a ticket on behalf of a dashboard support staff member, updating the database status and sending a claim notice in the Discord ticket channel.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "ticketId": "ticket_uuid_12345",
  "guildId": "12345678901234567",
  "userId": "98765432109876543" 
}
```
*(Where `userId` / `claimedBy` is required).*
- **Response Schema:**
```json
{
  "success": true,
  "message": "Ticket claimed successfully",
  "ticket": {
    "id": "ticket_uuid_12345",
    "status": "claimed",
    "claimedBy": "98765432109876543",
    "updatedAt": "2026-06-28T00:45:00.000Z"
  }
}
```

### GET `/api/jtc/config`
Retrieves the J2C (Join to Create) voice configuration for a specific guild. Supports both `/api/jtc/config?guildId=...` and `/api/jtc/config/:guildId`.
- **Auth Required:** Yes
- **Request Parameters:** `guildId` (query param or URL param)
- **Response Schema:**
```json
{
  "success": true,
  "config": {
    "id": "jtc_uuid_12345",
    "guildId": "12345678901234567",
    "baseVoiceChannelId": "88877766655544433",
    "categoryId": "77766655544433322",
    "panelChannelId": "66655544433322211",
    "panelMessageId": "55544433322211100",
    "channelNameFormat": "{user}'s Channel",
    "createdAt": "2026-06-28T00:40:00.000Z",
    "updatedAt": "2026-06-28T00:40:00.000Z"
  }
}
```

### POST / PATCH `/api/jtc/config`
Creates or updates the J2C voice configuration for a guild. Automatically posts or edits the interactive management panel embed with control buttons (Lock, Unlock, Set Limit) in the specified Discord channel.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "guildId": "12345678901234567",
  "baseVoiceChannelId": "88877766655544433",
  "categoryId": "77766655544433322",
  "panelChannelId": "66655544433322211",
  "channelNameFormat": "{user}'s Channel",
  "panelTitle": "🔊 Join to Create Voice Channel",
  "panelDescription": "Join the base voice channel to instantly create your own temporary voice channel!"
}
```
- **Response Schema:**
```json
{
  "success": true,
  "message": "JTC configuration saved successfully",
  "config": {
    "id": "jtc_uuid_12345",
    "guildId": "12345678901234567",
    "baseVoiceChannelId": "88877766655544433",
    "categoryId": "77766655544433322",
    "panelChannelId": "66655544433322211",
    "panelMessageId": "55544433322211100",
    "channelNameFormat": "{user}'s Channel"
  }
}
```

### POST / PATCH `/api/jtc/panel/update`
Edits the content (title and description) of the existing J2C management panel embed message in Discord.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "guildId": "12345678901234567",
  "title": "🔊 Updated JTC Voice Panel",
  "description": "Click the buttons below to manage your active voice session."
}
```
- **Response Schema:**
```json
{
  "success": true,
  "message": "JTC panel message updated successfully"
}
```

### POST / PATCH `/api/jtc/channels/lock`
Locks an active J2C voice channel, preventing new users from joining by modifying the `@everyone` Connect permission overwrite.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "guildId": "12345678901234567",
  "channelId": "99988877766655544"
}
```
- **Response Schema:**
```json
{
  "success": true,
  "message": "JTC channel locked successfully"
}
```

### POST / PATCH `/api/jtc/channels/unlock`
Unlocks an active J2C voice channel, allowing new users to join freely by resetting the `@everyone` Connect permission overwrite.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "guildId": "12345678901234567",
  "channelId": "99988877766655544"
}
```
- **Response Schema:**
```json
{
  "success": true,
  "message": "JTC channel unlocked successfully"
}
```

### POST / PATCH `/api/jtc/channels/limit`
Sets the maximum user capacity limit for an active J2C voice channel.
- **Auth Required:** Yes
- **Request Body Schema:**
```json
{
  "guildId": "12345678901234567",
  "channelId": "99988877766655544",
  "userLimit": 5
}
```
*(Where `userLimit` must be an integer between `0` and `99`).*
- **Response Schema:**
```json
{
  "success": true,
  "message": "JTC channel user limit set to 5"
}
```
