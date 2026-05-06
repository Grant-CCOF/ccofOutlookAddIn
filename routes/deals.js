/**
 * GET /api/deals/by-invoice/:invoice
 *
 * Public-ish lookup that powers the CCOF Job Sheet form's "Connect to HubSpot
 * Deal" button. Returns a strict allowlist of deal fields by invoice number.
 *
 * SECURITY NOTES (read before deploying):
 * --------------------------------------------------------------------
 * The fields returned include AP contact info and remittance address, which
 * are valuable to invoice-redirection / BEC fraudsters. Two protections are
 * available — set EITHER (or both):
 *
 *   1. DEALS_API_KEY env var: when set, this endpoint requires
 *      `Authorization: Bearer <DEALS_API_KEY>`. The form already supports
 *      this — set window.BIDDING_API_KEY in the form's host page.
 *
 *   2. DEALS_HMAC_SECRET env var: when set, the request must include
 *      ?sig=<hex hmac-sha256(invoice, secret)>. The form generator computes
 *      this when it issues the form URL.
 *
 * If neither env var is set, the endpoint is open. The 10/hr rate limit and
 * 50/hr abuse alert are LAST-LINE defenses, not primary protection. They
 * don't stop a determined enumeration attack with rotating IPs.
 * --------------------------------------------------------------------
 */

const express = require('express');
const crypto = require('crypto');
const { param } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');
const { dynamicLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');
const hubspotService = require('../services/hubspotService');

const router = express.Router();

// ---------------------------------------------------------------------------
// CORS — per spec: wildcard origin, GET/OPTIONS only, no credentials.
// We set headers directly (not via the cors() package) so this route is
// independent of the app-wide CORS config.
// ---------------------------------------------------------------------------
function applyCors(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    // Authorization is included so the form can pass a bearer token if
    // DEALS_API_KEY is configured. Browsers won't allow it through preflight
    // otherwise. Including it is harmless when no key is required.
    res.setHeader('Access-Control-Allow-Headers', 'Accept, Authorization');
    res.setHeader('Vary', 'Origin');
    // Explicitly DO NOT set Access-Control-Allow-Credentials.
}

router.use((req, res, next) => {
    applyCors(req, res);
    next();
});

router.options('/by-invoice/:invoice', (req, res) => {
    res.status(204).end();
});

// ---------------------------------------------------------------------------
// Optional bearer-token gate. Active only when DEALS_API_KEY is set.
// ---------------------------------------------------------------------------
function optionalBearerAuth(req, res, next) {
    const expected = process.env.DEALS_API_KEY;
    if (!expected) return next(); // gate disabled

    const header = req.get('Authorization') || '';
    const match = /^Bearer\s+(.+)$/.exec(header);
    const provided = match ? match[1].trim() : '';

    // Constant-time comparison
    const ok =
        provided.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));

    if (!ok) {
        logger.warn(
            `Deals lookup unauthorized: ip=${req.ip} ` +
            `invoice=${req.params.invoice} hasHeader=${!!header}`
        );
        return res.status(401).json({ error: 'unauthorized' });
    }
    next();
}

// ---------------------------------------------------------------------------
// Optional HMAC gate. Active only when DEALS_HMAC_SECRET is set.
// Expects ?sig=<hex hmac-sha256(invoice, secret)>.
// ---------------------------------------------------------------------------
function optionalHmacAuth(req, res, next) {
    const secret = process.env.DEALS_HMAC_SECRET;
    if (!secret) return next();

    const sig = String(req.query.sig || '');
    const expected = crypto
        .createHmac('sha256', secret)
        .update(String(req.params.invoice))
        .digest('hex');

    const ok =
        sig.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));

    if (!ok) {
        logger.warn(
            `Deals lookup HMAC failure: ip=${req.ip} invoice=${req.params.invoice}`
        );
        return res.status(401).json({ error: 'unauthorized' });
    }
    next();
}

// ---------------------------------------------------------------------------
// Per-route rate limit: 10 req/hr per IP, per spec.
// (The global /api limiter still applies on top.)
// ---------------------------------------------------------------------------
const dealsLookupLimiter = dynamicLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: parseInt(process.env.DEALS_RATE_LIMIT_MAX, 10) || 10,
    message: 'Too many deal lookups. Please try again later.',
});

// ---------------------------------------------------------------------------
// Abuse alerting: warn if a single IP exceeds 50 lookups in any rolling hour.
// Logged with ERROR level so the existing log-monitoring picks it up.
// In-memory; resets on restart. For production-grade behavior across
// multiple processes, swap for Redis.
// ---------------------------------------------------------------------------
const ABUSE_THRESHOLD = parseInt(process.env.DEALS_ABUSE_THRESHOLD, 10) || 50;
const ABUSE_WINDOW_MS = 60 * 60 * 1000;
const abuseTracker = new Map();   // ip -> [timestamps]
const abuseAlerted = new Map();   // ip -> last alert timestamp (suppress repeats)
const ABUSE_ALERT_COOLDOWN_MS = 60 * 60 * 1000;

function trackAbuse(ip) {
    const now = Date.now();
    const cutoff = now - ABUSE_WINDOW_MS;

    const arr = abuseTracker.get(ip) || [];
    // Drop expired entries
    const fresh = arr.filter(t => t >= cutoff);
    fresh.push(now);
    abuseTracker.set(ip, fresh);

    if (fresh.length >= ABUSE_THRESHOLD) {
        const lastAlert = abuseAlerted.get(ip) || 0;
        if (now - lastAlert >= ABUSE_ALERT_COOLDOWN_MS) {
            abuseAlerted.set(ip, now);
            logger.error(
                `[ALERT] Deals lookup abuse: ip=${ip} count=${fresh.length} ` +
                `window=1h threshold=${ABUSE_THRESHOLD}`
            );
        }
    }
}

// Periodic cleanup so the maps don't grow unbounded
setInterval(() => {
    const cutoff = Date.now() - ABUSE_WINDOW_MS;
    for (const [ip, arr] of abuseTracker.entries()) {
        const fresh = arr.filter(t => t >= cutoff);
        if (fresh.length === 0) abuseTracker.delete(ip);
        else abuseTracker.set(ip, fresh);
    }
    for (const [ip, ts] of abuseAlerted.entries()) {
        if (Date.now() - ts > ABUSE_ALERT_COOLDOWN_MS) abuseAlerted.delete(ip);
    }
}, 10 * 60 * 1000).unref();

// ---------------------------------------------------------------------------
// The handler.
// ---------------------------------------------------------------------------
router.get(
    '/by-invoice/:invoice',
    [
        param('invoice')
            .matches(/^\d{1,10}$/)
            .withMessage('Invoice must be 1-10 digits'),
        handleValidationErrors,
    ],
    optionalBearerAuth,
    optionalHmacAuth,
    dealsLookupLimiter,
    async (req, res) => {
        const { invoice } = req.params;
        const ip = req.ip;
        const startedAt = Date.now();

        trackAbuse(ip);

        const logRequest = (status, latencyMs, hubspotLatencyMs) => {
            logger.info(
                `[deals.byInvoice] ts=${new Date().toISOString()} ` +
                `ip=${ip} invoice=${invoice} status=${status} ` +
                `total_ms=${latencyMs} hubspot_ms=${hubspotLatencyMs ?? '-'}`
            );
        };

        try {
            const result = await hubspotService.findDealByInvoice(invoice);
            const totalMs = Date.now() - startedAt;

            if (!result.found) {
                logRequest(404, totalMs, result.latencyMs);
                return res.status(404).json({ found: false });
            }

            logRequest(200, totalMs, result.latencyMs);
            return res.status(200).json({
                found: true,
                fields: result.fields,
            });
        } catch (err) {
            const totalMs = Date.now() - startedAt;
            const hubspotMs = err.latencyMs;

            if (err.kind === 'config') {
                // Misconfiguration — operator-visible only
                logger.error(`[deals.byInvoice] config error: ${err.message}`);
                logRequest(500, totalMs, hubspotMs);
                return res.status(500).json({ error: 'internal' });
            }

            if (err.kind === 'auth' || err.kind === 'upstream') {
                logRequest(502, totalMs, hubspotMs);
                return res.status(502).json({ error: 'upstream' });
            }

            // Unknown — log full stack, return generic to client
            logger.error('[deals.byInvoice] unexpected error', err);
            logRequest(500, totalMs, hubspotMs);
            return res.status(500).json({ error: 'internal' });
        }
    }
);

module.exports = router;
