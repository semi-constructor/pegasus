# Multi-stage build for optimized production image
FROM node:20-alpine AS builder

# Install build dependencies for canvas
RUN apk add --no-cache \
    python3 \
    g++ \
    make \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

# Install runtime dependencies for canvas including Python for node-gyp and pkg-config
RUN apk add --no-cache \
    python3 \
    g++ \
    make \
    pkgconf \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev \
    cairo \
    jpeg \
    pango \
    giflib \
    pixman \
    fontconfig \
    ttf-dejavu \
    font-noto \
    font-noto-cjk \
    font-noto-emoji \
    curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

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
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy other necessary files
COPY --chown=nodejs:nodejs drizzle.config.ts ./
COPY --chown=nodejs:nodejs src/database ./src/database
COPY --chown=nodejs:nodejs src/i18n/locales ./src/i18n/locales

# Switch to non-root user
USER nodejs

# Expose API port
EXPOSE 2000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:2000/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]