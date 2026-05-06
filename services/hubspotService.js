/**
 * HubSpot service — deal lookup by invoice number.
 *
 * Calls the HubSpot CRM v3 deals search API and applies a STRICT allowlist
 * before returning anything to callers. New properties added to the deal
 * object in HubSpot will NOT be returned here unless explicitly added to
 * PROPERTY_MAP below.
 */
 
const logger = require('../utils/logger');
 
const HUBSPOT_SEARCH_URL = 'https://api.hubapi.com/crm/v3/objects/deals/search';
const HUBSPOT_TIMEOUT_MS = parseInt(process.env.HUBSPOT_TIMEOUT_MS, 10) || 8000;
 
// HubSpot property used as the invoice-number search key.
// (Note: HubSpot internal name is literally "invoice__" with two trailing
// underscores. If that's not actually the case in your HubSpot, change it here.)
const INVOICE_PROPERTY = 'invoice__';
 
// Simple 1:1 mapping. HubSpot property internal name → response field name.
// The RIGHT side is what the form expects and should not change.
// The LEFT side is your HubSpot internal property name.
//
// To expose a new field: create the property in HubSpot, then add a row here
// pairing the HubSpot internal name with the form field name. The list of
// form field names the form already supports is in the comment block below.
const PROPERTY_MAP = Object.freeze({
    company_name:            'company',
    requested_delivery_date: 'deliveryDate',
    delivery_address:        'address',
 
    // ─── Future fields ───────────────────────────────────────────────────
    // The form already has inputs for these. Create the property in HubSpot
    // (any internal name you want), then uncomment and update the LEFT side.
    //
    // <hubspot_property_name>: 'suite',                // delivery suite/unit
    // <hubspot_property_name>: 'floor',                // delivery floor
    // <hubspot_property_name>: 'building',             // building name at delivery
    // <hubspot_property_name>: 'contactName',          // onsite contact name
    // <hubspot_property_name>: 'contactPhone',         // onsite contact phone
    // <hubspot_property_name>: 'apContactPhone',       // AP contact phone
    // <hubspot_property_name>: 'apRemittanceAddress',  // where to send payments
    // <hubspot_property_name>: 'poNumber',             // purchase order number
    // <hubspot_property_name>: 'salesRep',             // assigned sales rep
    // ─────────────────────────────────────────────────────────────────────
});
 
// Property names that need date normalization (HubSpot "date" type returns
// YYYY-MM-DD; "datetime" returns epoch milliseconds. The form wants YYYY-MM-DD).
// Add any new date/datetime properties here.
const DATE_PROPERTIES = new Set(['requested_delivery_date']);
 
// Combined "Name and Email" field that gets split into apContactName +
// apContactEmail. If you ever split the AP contact into separate HubSpot
// fields, delete this constant + the related block in mapProperties() and
// add ap_contact_name / ap_contact_email as normal rows in PROPERTY_MAP.
const AP_COMBINED_PROPERTY = 'account_payable_contact_for_the_client_name_and_email';
 
// Full list of HubSpot properties to request from the API call.
const HUBSPOT_PROPERTIES = [
    ...Object.keys(PROPERTY_MAP),
    AP_COMBINED_PROPERTY,
];
 
/**
 * Normalize HubSpot date/datetime values to YYYY-MM-DD.
 */
function normalizeDate(value) {
    if (value == null || value === '') return undefined;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }
    if (typeof value === 'string' && /^\d+$/.test(value)) {
        const d = new Date(parseInt(value, 10));
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    if (typeof value === 'string') {
        const d = new Date(value);
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    return value;
}
 
/**
 * Split a combined "Name and Email" string into separate parts.
 * Tolerant of various formats people actually type:
 *
 *   "Jane Doe <jane@example.com>"        → { name: 'Jane Doe',  email: 'jane@example.com' }
 *   "Jane Doe - jane@example.com"        → { name: 'Jane Doe',  email: 'jane@example.com' }
 *   "Jane Doe, jane@example.com"         → { name: 'Jane Doe',  email: 'jane@example.com' }
 *   "Jane Doe (jane@example.com)"        → { name: 'Jane Doe',  email: 'jane@example.com' }
 *   "jane@example.com"                   → { name: null,        email: 'jane@example.com' }
 *   "Jane Doe"                           → { name: 'Jane Doe',  email: null }
 *   ""                                   → { name: null,        email: null }
 */
function parseAPContact(combined) {
    if (!combined || typeof combined !== 'string') return { name: null, email: null };
    const trimmed = combined.trim();
    if (!trimmed) return { name: null, email: null };
 
    // First email-shaped token wins
    const emailMatch = trimmed.match(/[^\s<>,;()"']+@[^\s<>,;()"']+\.[^\s<>,;()"']+/);
    if (!emailMatch) {
        return { name: trimmed, email: null };
    }
    const email = emailMatch[0];
    // Strip the email plus common separators from what's left, collapse whitespace
    const name = trimmed
        .replace(email, '')
        .replace(/[<>(),;\-\/|]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return { name: name || null, email };
}
 
/**
 * Apply the allowlist + per-field normalization. Drops any field whose value
 * is null/undefined/empty so the form leaves existing values alone.
 */
function mapProperties(hubspotProps) {
    const out = {};
    if (!hubspotProps || typeof hubspotProps !== 'object') return out;
 
    // Simple 1:1 mappings
    for (const [hsKey, fieldName] of Object.entries(PROPERTY_MAP)) {
        let value = hubspotProps[hsKey];
        if (value == null || value === '') continue;
 
        if (DATE_PROPERTIES.has(hsKey)) {
            value = normalizeDate(value);
            if (value == null || value === '') continue;
        }
 
        out[fieldName] = value;
    }
 
    // Combined AP contact field → split into apContactName + apContactEmail
    const apCombined = hubspotProps[AP_COMBINED_PROPERTY];
    if (apCombined) {
        const { name, email } = parseAPContact(apCombined);
        if (name) out.apContactName = name;
        if (email) out.apContactEmail = email;
    }
 
    return out;
}
 
/**
 * Search HubSpot for a deal by invoice number.
 *
 * Returns:
 *   { found: true,  fields: {...}, latencyMs }   — deal found
 *   { found: false, latencyMs }                  — no deal
 * Throws:
 *   Error with .kind = 'config'   — missing token
 *   Error with .kind = 'auth'     — 401/403 from HubSpot
 *   Error with .kind = 'upstream' — 5xx, network, timeout
 */
async function findDealByInvoice(invoice) {
    const token = process.env.HUBSPOT_TOKEN;
    if (!token) {
        const err = new Error('HUBSPOT_TOKEN not configured');
        err.kind = 'config';
        throw err;
    }
 
    const body = {
        filterGroups: [{
            filters: [{
                propertyName: INVOICE_PROPERTY,
                operator: 'EQ',
                value: String(invoice),
            }],
        }],
        properties: HUBSPOT_PROPERTIES,
        limit: 1,
    };
 
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HUBSPOT_TIMEOUT_MS);
 
    const startedAt = Date.now();
    let response;
    try {
        response = await fetch(HUBSPOT_SEARCH_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
    } catch (e) {
        clearTimeout(timeoutId);
        const latencyMs = Date.now() - startedAt;
        const err = new Error(
            e.name === 'AbortError'
                ? `HubSpot request timed out after ${HUBSPOT_TIMEOUT_MS}ms`
                : `HubSpot request failed: ${e.message}`
        );
        err.kind = 'upstream';
        err.latencyMs = latencyMs;
        throw err;
    }
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startedAt;
 
    if (response.status === 401 || response.status === 403) {
        const text = await response.text().catch(() => '');
        logger.error(
            `HubSpot auth failure (${response.status}). Check HUBSPOT_TOKEN scopes ` +
            `(needs crm.objects.deals.read). Upstream body length: ${text.length}`
        );
        const err = new Error(`HubSpot auth failure: ${response.status}`);
        err.kind = 'auth';
        err.latencyMs = latencyMs;
        throw err;
    }
 
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        logger.error(
            `HubSpot upstream error: status=${response.status} latency=${latencyMs}ms ` +
            `body_preview=${text.slice(0, 200)}`
        );
        const err = new Error(`HubSpot upstream error: ${response.status}`);
        err.kind = 'upstream';
        err.latencyMs = latencyMs;
        throw err;
    }
 
    let json;
    try {
        json = await response.json();
    } catch (e) {
        const err = new Error('HubSpot returned invalid JSON');
        err.kind = 'upstream';
        err.latencyMs = latencyMs;
        throw err;
    }
 
    const results = Array.isArray(json.results) ? json.results : [];
    if (results.length === 0) {
        return { found: false, latencyMs };
    }
 
    const fields = mapProperties(results[0].properties);
    return { found: true, fields, latencyMs };
}
 
module.exports = {
    findDealByInvoice,
    _internal: { mapProperties, normalizeDate, parseAPContact, PROPERTY_MAP },
};