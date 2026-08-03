#!/bin/bash

set -e

# --- UI Helpers ---
GREEN="\e[32m"
RED="\e[31m"
YELLOW="\e[33m"
CYAN="\e[36m"
RESET="\e[0m"

echo_info() { echo -e "${CYAN}[INFO]${RESET} $1"; }
echo_success() { echo -e "${GREEN}[SUCCESS]${RESET} $1"; }
echo_warn() { echo -e "${YELLOW}[WARN]${RESET} $1"; }
echo_error() { echo -e "${RED}[ERROR]${RESET} $1"; }

# --- Dependency Checkers ---
command_exists() { command -v "$1" >/dev/null 2>&1; }

# --- Main Script ---
echo -e "${GREEN}==========================================${RESET}"
echo -e "${GREEN}      Pegasus Bot & Dashboard Installer   ${RESET}"
echo -e "${GREEN}==========================================${RESET}"
echo ""

# 1. Ask for removal
echo -e "Do you want to ${RED}REMOVE${RESET} an existing installation first? (y/N)"
read -r -p "> " remove_opt
if [[ "$remove_opt" =~ ^[Yy]$ ]]; then
    echo_warn "This will stop and delete PM2 processes or Docker containers named 'pegasus-*' and remove 'pegasus-bot' and 'pegasus-dashboard' directories."
    read -r -p "Are you sure? (y/N) > " confirm_remove
    if [[ "$confirm_remove" =~ ^[Yy]$ ]]; then
        echo_info "Removing existing installation..."
        if command_exists pm2; then
            pm2 delete pegasus-bot pegasus-dashboard 2>/dev/null || true
            pm2 save --force 2>/dev/null || true
        fi
        if command_exists docker; then
            docker rm -f pegasus-bot pegasus-dashboard pegasus-db pegasus-redis 2>/dev/null || true
            docker network rm pegasus-network 2>/dev/null || true
        fi
        rm -rf pegasus-bot pegasus-dashboard
        echo_success "Previous installation removed."
    fi
fi

# 2. Select Components
echo ""
echo -e "What do you want to install?"
echo "1) Bot only"
echo "2) Dashboard only"
echo "3) Both Bot and Dashboard"
read -r -p "Select an option (1-3) [3]: " comp_opt
comp_opt=${comp_opt:-3}

install_bot=false
install_dash=false

case $comp_opt in
    1) install_bot=true ;;
    2) install_dash=true ;;
    *) install_bot=true; install_dash=true ;;
esac

# 3. Execution Method
echo ""
echo "How do you want to run the application?"
echo "1) PM2 (Requires Node.js installed)"
echo "2) Docker (Will install Docker if missing)"
read -r -p "Select an option (1-2) [2]: " exec_opt
exec_opt=${exec_opt:-2}

use_docker=false
if [[ "$exec_opt" == "2" ]]; then
    use_docker=true
fi

# 4. Clone Repositories
echo ""
echo_info "Cloning repositories..."
if [ "$install_bot" = true ]; then
    if [ ! -d "pegasus-bot" ]; then
        git clone https://github.com/semi-constructor/pegasus.git pegasus-bot
    else
        echo_warn "pegasus-bot directory already exists, skipping clone."
    fi
fi

if [ "$install_dash" = true ]; then
    if [ ! -d "pegasus-dashboard" ]; then
        git clone https://github.com/semi-constructor/pegasus-dashboard.git pegasus-dashboard
    else
        echo_warn "pegasus-dashboard directory already exists, skipping clone."
    fi
fi

# 5. Env Variables Collection
echo ""
echo_info "Configuration Setup (.env)"

prompt_env() {
    local var_name=$1
    local description=$2
    local is_required=$3
    local default_val=$4
    local current_val=$5
    
    echo -e "\n${CYAN}${var_name}${RESET}: ${description}"
    
    local prompt_text="Enter value"
    if [ ! -z "$default_val" ]; then
        prompt_text="$prompt_text (Default: $default_val)"
    fi
    if [ "$is_required" = false ]; then
        prompt_text="$prompt_text [Press Enter to skip]"
    fi
    
    local input=""
    while true; do
        read -r -p "${prompt_text} > " input
        if [ -z "$input" ]; then
            if [ ! -z "$default_val" ]; then
                echo "$default_val"
                return
            elif [ "$is_required" = false ]; then
                echo ""
                return
            else
                echo_error "This variable is REQUIRED."
            fi
        else
            echo "$input"
            return
        fi
    done
}

BOT_DISCORD_TOKEN=""
BOT_DISCORD_CLIENT_ID=""
DB_URL="postgresql://pegasus:changeme@localhost:5432/pegasus"
BOT_API_TOKEN="secure_random_token_$(date +%s)"
DASH_DISCORD_SECRET=""
DASH_NEXTAUTH_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "fallback_secret_$(date +%s)")

if [ "$install_bot" = true ]; then
    echo "--- Bot Configuration ---"
    BOT_DISCORD_TOKEN=$(prompt_env "DISCORD_TOKEN" "Your Discord Bot Token (Get from Discord Developer Portal -> Bot)" true "")
    BOT_DISCORD_CLIENT_ID=$(prompt_env "DISCORD_CLIENT_ID" "Your Discord Client ID (Get from Developer Portal -> General Information)" true "")
    DEVELOPER_IDS=$(prompt_env "DEVELOPER_IDS" "Array of Developer Discord IDs" false "[]")
    DB_URL=$(prompt_env "DATABASE_URL" "PostgreSQL Connection String" true "postgresql://pegasus:changeme@localhost:5432/pegasus")
    BOT_API_TOKEN=$(prompt_env "BOT_API_TOKEN" "Secret token for Dashboard to communicate with Bot API" true "$BOT_API_TOKEN")
    ENCRYPTION_KEY=$(prompt_env "ENCRYPTION_KEY" "32-character key for encrypting data" true "$(openssl rand -hex 16 2>/dev/null || echo '12345678901234567890123456789012')")
    
    ENABLE_ECONOMY=$(prompt_env "ENABLE_ECONOMY" "Enable Economy module" false "true")
    ENABLE_MODERATION=$(prompt_env "ENABLE_MODERATION" "Enable Moderation module" false "true")
    ENABLE_XP=$(prompt_env "ENABLE_XP" "Enable XP module" false "true")
    ENABLE_TICKETS=$(prompt_env "ENABLE_TICKETS" "Enable Tickets module" false "true")
    ENABLE_GIVEAWAYS=$(prompt_env "ENABLE_GIVEAWAYS" "Enable Giveaways module" false "true")
    
    STEAM_API_KEY=$(prompt_env "STEAM_API_KEY" "Steam API Key (Optional)" false "")
    SENTRY_DSN=$(prompt_env "SENTRY_DSN" "Sentry DSN (Optional)" false "")
    
    RATE_LIMIT_WINDOW=$(prompt_env "RATE_LIMIT_WINDOW" "Rate Limit Window (ms)" false "60000")
    RATE_LIMIT_MAX_REQUESTS=$(prompt_env "RATE_LIMIT_MAX_REQUESTS" "Rate Limit Max Requests" false "10")
    
    LOG_LEVEL=$(prompt_env "LOG_LEVEL" "Log Level (info, debug, error)" false "info")
    LOG_FILE_PATH=$(prompt_env "LOG_FILE_PATH" "Log File Path" false "./logs")
    
    cat > pegasus-bot/.env << EOF
DISCORD_TOKEN=$BOT_DISCORD_TOKEN
DISCORD_CLIENT_ID=$BOT_DISCORD_CLIENT_ID
DEVELOPER_IDS=$DEVELOPER_IDS
DATABASE_URL=$DB_URL
ENABLE_API=true
API_PORT=2000
BOT_API_TOKEN=$BOT_API_TOKEN
API_TOKEN=$BOT_API_TOKEN
ENCRYPTION_KEY=$ENCRYPTION_KEY
ENABLE_ECONOMY=$ENABLE_ECONOMY
ENABLE_MODERATION=$ENABLE_MODERATION
ENABLE_XP=$ENABLE_XP
ENABLE_TICKETS=$ENABLE_TICKETS
ENABLE_GIVEAWAYS=$ENABLE_GIVEAWAYS
STEAM_API_KEY=$STEAM_API_KEY
SENTRY_DSN=$SENTRY_DSN
RATE_LIMIT_WINDOW=$RATE_LIMIT_WINDOW
RATE_LIMIT_MAX_REQUESTS=$RATE_LIMIT_MAX_REQUESTS
LOG_LEVEL=$LOG_LEVEL
LOG_FILE_PATH=$LOG_FILE_PATH
EOF
    echo_success "Bot .env created."
fi

if [ "$install_dash" = true ]; then
    echo "--- Dashboard Configuration ---"
    if [ -z "$BOT_DISCORD_CLIENT_ID" ]; then
        BOT_DISCORD_CLIENT_ID=$(prompt_env "DISCORD_CLIENT_ID" "Your Discord Client ID" true "")
    fi
    if [ -z "$BOT_DISCORD_TOKEN" ]; then
        BOT_DISCORD_TOKEN=$(prompt_env "DISCORD_BOT_TOKEN" "Discord Bot Token (for checking bot presence in guilds)" true "")
    fi
    if [ -z "$BOT_API_TOKEN" ]; then
        BOT_API_TOKEN=$(prompt_env "BOT_API_TOKEN" "Secret token for Dashboard to communicate with Bot API" true "$BOT_API_TOKEN")
    fi
    DASH_DISCORD_SECRET=$(prompt_env "DISCORD_CLIENT_SECRET" "Your Discord Client Secret (Get from Developer Portal -> OAuth2)" true "")
    DASH_NEXTAUTH_SECRET=$(prompt_env "AUTH_SECRET / NEXTAUTH_SECRET" "Secret for session encryption" true "$DASH_NEXTAUTH_SECRET")
    DASH_NEXTAUTH_URL=$(prompt_env "AUTH_URL / NEXTAUTH_URL" "URL where the dashboard will be hosted" true "http://localhost:3000")
    NEXT_PUBLIC_APP_URL=$(prompt_env "NEXT_PUBLIC_APP_URL" "Public App URL (Optional)" false "$DASH_NEXTAUTH_URL")
    REDIS_URL=$(prompt_env "REDIS_URL" "Redis URL (Optional)" false "redis://localhost:6379")
    ADMIN_IDS=$(prompt_env "ADMIN" "Array of Discord User IDs for Dashboard Admins" false "[]")
    
    # Adjust API_URL and REDIS_URL based on execution method
    DEFAULT_API_URL="http://localhost:2000"
    if [ "$use_docker" = true ]; then
        if [ "$install_bot" = true ]; then
            # Since dashboard has its own isolated compose file but maps to host, use host.docker.internal to reach bot's mapped ports
            DEFAULT_API_URL="http://host.docker.internal:2000"
            DB_URL="postgresql://pegasus:changeme@host.docker.internal:5432/pegasus"
        fi
        REDIS_URL="redis://host.docker.internal:6379"
    fi
    
    cat > pegasus-dashboard/.env.production << EOF
API_URL=$DEFAULT_API_URL
BOT_API_TOKEN=$BOT_API_TOKEN
DATABASE_URL=$DB_URL
REDIS_URL=$REDIS_URL
DISCORD_CLIENT_ID=$BOT_DISCORD_CLIENT_ID
NEXT_PUBLIC_DISCORD_CLIENT_ID=$BOT_DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET=$DASH_DISCORD_SECRET
DISCORD_BOT_TOKEN=$BOT_DISCORD_TOKEN
AUTH_URL=$DASH_NEXTAUTH_URL
NEXTAUTH_URL=$DASH_NEXTAUTH_URL
AUTH_SECRET=$DASH_NEXTAUTH_SECRET
NEXTAUTH_SECRET=$DASH_NEXTAUTH_SECRET
NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ADMIN=$ADMIN_IDS
NODE_ENV=production
EOF
    echo_success "Dashboard .env.production created."
fi


# 6. Setup & Execution
if [ "$use_docker" = true ]; then
    echo_info "Setting up Docker deployment..."
    if ! command_exists docker; then
        echo_info "Docker not found. Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER
        echo_success "Docker installed. You might need to restart your terminal later."
    fi
    if ! command_exists docker-compose && ! docker compose version >/dev/null 2>&1; then
        echo_info "Docker Compose not found. Installing..."
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
    fi

    # Run docker-compose from the respective directories
    if [ "$install_bot" = true ]; then
        echo_info "Starting Bot Docker containers..."
        cd pegasus-bot
        if docker compose version >/dev/null 2>&1; then
            docker compose up -d --build
        else
            docker-compose up -d --build
        fi
        cd ..
    fi

    if [ "$install_dash" = true ]; then
        echo_info "Starting Dashboard Docker containers..."
        cd pegasus-dashboard
        
        if docker compose version >/dev/null 2>&1; then
            docker compose up -d --build
        else
            docker-compose up -d --build
        fi
        cd ..
    fi
    echo_success "Started with Docker!"

else
    echo_info "Setting up PM2 deployment..."
    if ! command_exists node; then
        echo_error "Node.js is not installed. Please install Node.js v20+ first."
        exit 1
    fi
    if ! command_exists pm2; then
        echo_info "Installing PM2 globally..."
        sudo npm install -g pm2
    fi

    if [ "$install_bot" = true ]; then
        echo_info "Building Bot..."
        cd pegasus-bot
        npm install
        npm run build
        pm2 start dist/index.js --name "pegasus-bot"
        cd ..
    fi

    if [ "$install_dash" = true ]; then
        echo_info "Building Dashboard..."
        cd pegasus-dashboard
        npm install
        npm run build
        pm2 start npm --name "pegasus-dashboard" -- start
        cd ..
    fi
    
    pm2 save
    echo_success "Started with PM2! Note: You need to have PostgreSQL and Redis running locally for PM2 mode."
fi

echo ""
echo_success "Installation Complete!"
if [ "$install_dash" = true ]; then
    echo "Dashboard available at: http://localhost:3000"
fi
if [ "$install_bot" = true ]; then
    echo "Bot API available at: http://localhost:2000"
fi
