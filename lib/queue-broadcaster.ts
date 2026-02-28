/**
 * @deprecated Replaced by lib/ably-server.ts
 * The in-process EventEmitter broadcaster only worked on a single Node.js
 * process and would silently fail on Vercel (multi-instance / serverless).
 * All callers now import { broadcastToOrg } from '@/lib/ably-server'.
 */
export {};
