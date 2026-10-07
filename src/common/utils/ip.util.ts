import { Request } from 'express';

/**
 * Extract real client IP from incoming request behind Cloudflare, Nginx, or Docker reverse proxy.
 */
export function extractClientIp(req: Request | any): string {
  // 1. Cloudflare header (highest trust when using CF)
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) {
    const ip = Array.isArray(cfIp) ? cfIp[0] : cfIp;
    if (isValidPublicIp(ip)) return ip.trim();
  }

  // 2. True-Client-IP header (Akamai, Cloudflare Enterprise)
  const trueClientIp = req.headers['true-client-ip'];
  if (trueClientIp) {
    const ip = Array.isArray(trueClientIp) ? trueClientIp[0] : trueClientIp;
    if (isValidPublicIp(ip)) return ip.trim();
  }

  // 3. X-Real-IP header (Nginx proxy)
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    const ip = Array.isArray(realIp) ? realIp[0] : realIp;
    if (isValidPublicIp(ip)) return ip.trim();
  }

  // 4. X-Forwarded-For header (comma-separated list: client, proxy1, proxy2...)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const forwardList = Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor;
    const parts = forwardList.split(',').map((p: string) => p.trim());
    // Pick first non-private / public IP if available
    for (const part of parts) {
      if (isValidPublicIp(part)) {
        return part;
      }
    }
    // If all are local/private, fallback to first entry
    if (parts.length > 0 && parts[0]) {
      return parts[0];
    }
  }

  // 5. Express req.ip (when trust proxy is enabled)
  if (req.ip && isValidPublicIp(req.ip)) {
    return req.ip;
  }

  // 6. Direct socket fallback
  const socketIp = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
  return socketIp.replace('::ffff:', '').trim();
}

/**
 * Filter out localhost and Docker internal network IPs (127.0.0.1, 172.x.x.x, 10.x.x.x, 192.168.x.x)
 */
function isValidPublicIp(ip: string): boolean {
  if (!ip) return false;
  const cleaned = ip.replace('::ffff:', '').trim();
  if (cleaned === '127.0.0.1' || cleaned === '::1' || cleaned === 'localhost') return false;
  // Docker internal bridge commonly 172.16.0.0 - 172.31.255.255
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleaned)) return false;
  // 10.0.0.0 - 10.255.255.255
  if (/^10\./.test(cleaned)) return false;
  return true;
}
