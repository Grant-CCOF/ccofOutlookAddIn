/**
 * HubSpot service — deal lookup by invoice number.
 *
 * Calls the HubSpot CRM v3 deals search API and applies a STRICT allowlist
 * before returning anything to callers. New properties added to the deal
 * object in HubSpot will NOT be returned here unless explicitly added below.
 */

const logger = require('../utils/logger');

const HUBSPOT_SEARCH_URL = 'https://api.hubapi.com/crm/v3/objects/deals/search';
const HUBSPOT_TIMEOUT_MS = parseInt(process.env.HUBSPOT_TIMEOUT_MS, 10) || 8000;

// HubSpot property name -> response field name.
// This is the COMPLETE allowlist. Adding a key here is the only way to
// expose a new property to the client.
const PROPERTY_MAP = Object.freeze({
    dealname:           'company',
    closedate:          'deliveryDate',
    delivery_address:   'address',
    delivery_suite:     'suite',
    delivery_floor:     'floor',
    building_name:      'building',
    onsite_contact:     'contactName',
    onsite_phone:       'contactPhone',
    ap_contact_name:    'apContactName',
    ap_contact_email:   'apContactEmail',
    ap_contact_phone:   'apContactPhone',
    ap_remittance_addr: 'apRemittanceAddress',
    po_number:          'poNumber',
    sales_rep:          'salesRep',
});

const HUBSPOT_PROPERTIES = Object.keys(PROPERTY_MAP);

/**
 * Normalize HubSpot date/datetime values to YYYY-MM-DD.
 * HubSpot returns date fields as 'YYYY-MM-DD', datetimes as epoch ms strings.
 * The form's date inputs want YYYY-MM-DD.
 */
function normalizeDate(value) {
    if (value == null || value === '') return undefined;
    // Already YYYY-MM-DD
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }
    // Epoch ms (string of digits) — HubSpot datetime fields
    if (typeof value === 'string' && /^\d+$/.test(value)) {
        const d = new Date(parseInt(value, 10));
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    // ISO datetime
    if (typeof value === 'string') {
        const d = new Date(value);
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    return value;
}

/**
 * Apply the allowlist + per-field normalization. Drops any field whose value
 * is null/undefined/empty so the form leaves existing values alone.
 */
function mapProperties(hubspotProps) {
    const out = {};
    if (!hubspotProps || typeof hubspotProps !== 'object') return out;

    for (const [hsKey, fieldName] of Object.entries(PROPERTY_MAP)) {
        let value = hubspotProps[hsKey];
        if (value == null || value === '') continue;

        if (hsKey === 'closedate') {
            value = normalizeDate(value);
            if (value == null || value === '') continue;
        }

        out[fieldName] = value;
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
                propertyName: 'hs_deal_invoice_number',
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
        // Read & DISCARD upstream body — never leak HubSpot's response to the client.
        // Log loudly for the operator.
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
    // Exported for tests only
    _internal: { mapProperties, normalizeDate, PROPERTY_MAP },
};
