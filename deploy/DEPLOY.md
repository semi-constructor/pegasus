# Self-Hosting Pegasus

Guides:
- [Docker Compose](#docker-compose-recommended)
- [Podman](#podman)
- [Local](#local-deployment-from-source)
- [Pterodactyl](#pterodactyl)
- [PM2](#pm2-deployment)
- [Coolify](#coolify)

---

# Docker / Podman

Pegasus includes a `Dockerfile` and `docker-compose.yml` configuration for easy containerized deployment.

## Requirements

- Docker Engine + Docker Compose plugin

or

- Podman + Podman Compose

---

## Docker Compose (Recommended)

Docker Compose is the recommended deployment method for most users.

### 1. Clone the repository

```bash
git clone https://github.com/semi-constructor/pegasus.git
cd pegasus
````

### 2. Create your environment configuration

```bash
cp .env.example .env
```

Edit the `.env` file:

```bash
nano .env
```

Configure all required variables, including:

* Discord bot token
* Discord client ID
* Database connection
* Required external services

### 3. Start Pegasus

```bash
docker compose up -d
```

### 4. Check status

```bash
docker compose ps
```

### 5. View logs

```bash
docker compose logs -f
```

Pegasus should now be running.

---

## Updating Docker Deployment

To update Pegasus:

```bash
git pull
docker compose pull
docker compose up -d --build
```

---

## Stopping Pegasus

Stop and remove containers:

```bash
docker compose down
```

Stop without removing containers:

```bash
docker compose stop
```

---

# Podman

Pegasus is also compatible with Podman.

Podman commands are mostly identical to Docker commands.

## Start with Podman Compose

Clone the repository:

```bash
git clone https://github.com/semi-constructor/pegasus.git
cd pegasus
```

Create your environment file:

```bash
cp .env.example .env
```

Configure your variables and start Pegasus:

```bash
podman compose up -d
```

Check status:

```bash
podman ps
```

View logs:

```bash
podman compose logs -f
```

---

# Local Deployment (From Source)

Pegasus can be deployed directly from source code.

This method is recommended for developers or users who need full control over the runtime environment.

## Requirements

* Node.js (latest LTS recommended)
* npm, pnpm, or yarn
* Git
* Database instance
* Configured environment variables

---

## Installing Pegasus

### 1. Clone the repository

```bash
git clone https://github.com/semi-constructor/pegasus.git
cd pegasus
```

### 2. Install dependencies

Using npm:

```bash
npm install
```

Using pnpm:

```bash
pnpm install
```

Using yarn:

```bash
yarn install
```

### 3. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit it:

```bash
nano .env
```

Fill in all required values.

---

## Running Pegasus

### Development

```bash
npm run dev
```

### Production

Build Pegasus:

```bash
npm run build
```

Start Pegasus:

```bash
npm start
```

---

# PM2 Deployment

For production deployments, PM2 is recommended to keep Pegasus running permanently, restart it after crashes, and automatically start it after reboots.

## Install PM2

```bash
npm install -g pm2
```

Verify:

```bash
pm2 --version
```

---

## Start Pegasus

Build the application:

```bash
npm run build
```

Start with PM2:

```bash
pm2 start npm --name pegasus -- start
```

Check status:

```bash
pm2 status
```

View logs:

```bash
pm2 logs pegasus
```

---

## Enable Automatic Startup

Generate startup configuration:

```bash
pm2 startup
```

Run the command PM2 provides.

Save the current process list:

```bash
pm2 save
```

Pegasus will now automatically start after system reboots.

---

## Updating PM2 Deployment

```bash
git pull
npm install
npm run build
pm2 restart pegasus
```

---

## PM2 Management Commands

Restart:

```bash
pm2 restart pegasus
```

Stop:

```bash
pm2 stop pegasus
```

Remove:

```bash
pm2 delete pegasus
```

Monitor:

```bash
pm2 monit
```

---

# Pterodactyl

> **Requirements**
>
> Administrative access to a [Pterodactyl](https://pterodactyl.io) panel.

## Installing Pterodactyl

If you do not already have Pterodactyl installed:

* Official Guide:
  [https://pterodactyl.io/panel/1.0/getting_started.html](https://pterodactyl.io/panel/1.0/getting_started.html)

* Community Installer:
  [https://github.com/pterodactyl-installer/pterodactyl-installer](https://github.com/pterodactyl-installer/pterodactyl-installer)

---

## Importing the Pegasus Egg

1. Download the egg file:

```
https://github.com/semi-constructor/pegasus/blob/main/deploy/pterodactyl/egg.json
```

2. Open your Pterodactyl panel.
3. Navigate to:

```
Nests
```

4. Click:

```
Import Egg
```

5. Select the downloaded `egg.json`.
6. Select the Nest where the egg should be imported.
7. Save the import.

The Pegasus egg is now available when creating servers.

---

> [!IMPORTANT]
> If you plan to provide Pegasus through a hosting provider or shared Pterodactyl environment, configure rate limits first.

1. Open the Pegasus Discord Bot egg.
2. Navigate to **Variables**.
3. Find:

   * `RATE_LIMIT_WINDOW`
   * `RATE_LIMIT_MAX_REQUESTS`
4. Configure suitable values.
5. Disable **Users Can Edit** for both variables if required.

This prevents users from modifying limits and helps protect against abuse.

---

# Coolify

> **Requirements**
>
> A running [Coolify](https://coolify.io) installation.

> [!NOTE]
> An official Coolify template requires 1,000 GitHub stars.
>
> More information:
> [https://coolify.io/docs/get-started/contribute/service](https://coolify.io/docs/get-started/contribute/service)

---

## Deploying Pegasus

### 1. Open Coolify

Go to your Coolify dashboard.

### 2. Create a project

Create a new project or select an existing one.

Select your deployment environment.

Usually:

```
Production
```

### 3. Add repository

Click:

```
+ New
```

Select:

```
Public Repository
```

Repository URL:

```
https://github.com/semi-constructor/pegasus
```

Click:

```
Check Repository
```

---

## Verify Settings

Make sure these values are correct:

| Setting        | Value      |
| -------------- | ---------- |
| Branch         | `main`     |
| Build Pack     | `Nixpacks` |
| Base Directory | `/`        |
| Port           | `2000`     |
| Static Site    | Disabled   |

> Note:
>
> Coolify may detect port `3000` by default.
> Change it to `2000` or update the Pegasus environment variables accordingly.

---

## Configure Environment Variables

1. Continue to configuration.
2. Open:

```
Environment Variables
```

3. Enable:

```
Developer View
```

4. Copy the contents of:

```
.env.example
```

5. Fill in all required values.

---

## Deploy

Click:

```
Deploy
```

After deployment completes, Pegasus should be running on your Coolify instance.

---

# Production Recommendations

For production deployments:

* Never commit `.env` files or secrets.
* Use a dedicated system user.
* Keep dependencies updated.
* Configure database backups.
* Monitor resource usage.
* Use a reverse proxy such as Nginx, Caddy, or Traefik when exposing services publicly.
* Configure rate limits when running Pegasus for multiple users.

