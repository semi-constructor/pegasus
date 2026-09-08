# Multi-stage build for optimized production image
FROM node:20-slim AS builder

# Install build dependencies for canvas
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Clone repository and install dependencies
RUN git clone https://github.com/semi-constructor/pegasus.git . && \
    npm install

# Build the application
RUN npm run build

# Production stage
FROM node:20-slim

# Install runtime dependencies for canvas including Python for node-gyp and pkg-config
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    fonts-noto \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -s /bin/false -u 1001 -g nodejs nodejs

# Set working directory
WORKDIR /app

# Create logs directory with proper permissions BEFORE switching user
RUN mkdir -p logs && \
    chown -R nodejs:nodejs /app && \
    chown -R nodejs:nodejs logs

# Set default DEVELOPER_IDS if not provided via environment
ENV DEVELOPER_IDS='["931870926797160538"]'
ENV XP_VOICE_PER_MINUTE=20
ENV XP_MESSAGE_MIN=15  
ENV XP_MESSAGE_MAX=25
ENV XP_COOLDOWN=60000
ENV XP_BOOSTER_MULTIPLIER=1.5

# Copy package files
COPY --from=builder /app/package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy other necessary files
COPY --from=builder --chown=nodejs:nodejs /app/drizzle.config.ts ./
COPY --from=builder --chown=nodejs:nodejs /app/src/database ./src/database
COPY --from=builder --chown=nodejs:nodejs /app/src/i18n/locales ./src/i18n/locales
COPY --from=builder --chown=nodejs:nodejs /app/assets ./assets

# Switch to non-root user
USER nodejs

# Expose API port
EXPOSE 2000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:2000/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]