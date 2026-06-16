import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import compression from 'compression';
import dataHandler from './api/data.js';
import resetHandler from './api/reset.js';
import authHandler from './api/auth.js';
import mbbankWebhookHandler from './api/webhook.js';
import zaloHandler from './api/zalo.js';
import exportHandler from './api/export.js';
import centersPublicHandler from './api/centers-public.js';
import centersHandler from './api/centers.js';

dotenv.config();

// --- Simple in-memory rate limiter for auth endpoint ---
const authAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // max 10 attempts per minute per IP

function authRateLimiter(req: any, res: any, next: () => void) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = authAttempts.get(ip);

  if (entry && now < entry.resetAt) {
    if (entry.count >= RATE_LIMIT_MAX) {
      return res.status(429).json({ error: 'Quá nhiều lần thử đăng nhập. Vui lòng đợi 1 phút.' });
    }
    entry.count++;
  } else {
    authAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  }

  // Cleanup old entries periodically
  if (authAttempts.size > 1000) {
    for (const [key, val] of authAttempts) {
      if (now > val.resetAt) authAttempts.delete(key);
    }
  }

  next();
}

// --- JWT Secret validation ---
if (process.env.NODE_ENV === 'production' && !process.env.API_SECRET_KEY) {
  console.error('FATAL: API_SECRET_KEY environment variable is required in production!');
  process.exit(1);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // CORS: restrict in production, open in development
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(s => s.trim()) || [];
  if (process.env.NODE_ENV === 'production' && allowedOrigins.length > 0) {
    app.use(cors({ origin: allowedOrigins, credentials: true }));
  } else {
    app.use(cors());
  }

  // Security headers (no external dependency needed)
  app.use((_req: any, res: any, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  app.use(compression());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Health check endpoint with DB connectivity
  app.get('/api/health', async (_req, res) => {
    const health: any = { status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' };
    try {
      // Quick Firestore connectivity check
      const { getFirestore, doc, getDoc } = await import('firebase/firestore');
      const { initializeApp, getApps, getApp } = await import('firebase/app');
      const fs = await import('fs');
      const path = await import('path');
      const config = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));
      const fbApp = !getApps().length ? initializeApp(config) : getApp();
      const db = getFirestore(fbApp, config.firestoreDatabaseId);
      await getDoc(doc(db, 'centers_registry', '__health_check__'));
      health.db = 'connected';
    } catch (e) {
      health.db = 'unreachable';
      health.status = 'degraded';
    }
    res.status(health.status === 'ok' ? 200 : 503).json(health);
  });

  // API routes — ALL registered here for both local dev and production
  app.all('/api/data', dataHandler);
  app.all('/api/reset', resetHandler);
  app.all('/api/auth', authRateLimiter, authHandler);
  app.all('/api/webhook', mbbankWebhookHandler);
  app.all('/api/zalo', zaloHandler);
  app.all('/api/export', exportHandler);
  app.all('/api/centers-public', centersPublicHandler);
  app.all('/api/centers', centersHandler);

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
