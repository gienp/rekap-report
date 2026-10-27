/**
 * Supabase Cloud PostgreSQL Client & Integration Engine
 * Telecom Operations Portal - PLN Icon Plus
 * Connects directly to Cloud PostgreSQL via Supabase HTTPS REST API
 */
(function() {
  'use strict';

  const SUPABASE_URL = "https://lujqgwpldwkjxmlxnfij.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1anFnd3BsZHdranhtbHhuZmlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNjU4MTMsImV4cCI6MjEwODY0MTgxM30.LSCAwRRpGu7jDFFlGBkCGLFonsFmmkz3FDCwr7Y2uZY";

  let client = null;

  function getClient() {
    if (client) return client;
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return client;
    }
    return null;
  }

  // Resilient REST fetch fallback (works even before CDN loads)
  async function restFetch(table, options = {}) {
    const method = options.method || 'GET';
    let url = `${SUPABASE_URL}/rest/v1/${table}`;
    if (options.query) url += `?${options.query}`;
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation'
    };
    const init = { method, headers };
    if (options.body) init.body = JSON.stringify(options.body);
    const res = await fetch(url, init);
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Supabase] REST Error (${res.status}):`, errText);
      throw new Error(`Supabase REST Error (${res.status}): ${errText}`);
    }
    return res.json().catch(() => null);
  }

  window.SupabaseManager = {
    isConfigured: () => true,
    getClient: getClient,
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    
    // Fetch all records
    async fetchCollection(table) {
      const cl = getClient();
      if (cl) {
        try {
          const { data, error } = await cl.from(table).select('*').order('id', { ascending: false });
          if (!error && data) return data;
        } catch (e) {
          console.warn(`[Supabase] SDK fetch error for ${table}, falling back to REST:`, e);
        }
      }
      return restFetch(table, { query: 'order=id.desc' });
    },

    // Add new record
    async addRecord(table, record) {
      const cl = getClient();
      if (cl) {
        try {
          const { data, error } = await cl.from(table).insert([record]).select();
          if (!error && data && data[0]) return data[0];
        } catch (e) {
          console.warn(`[Supabase] SDK insert error for ${table}, falling back to REST:`, e);
        }
      }
      const res = await restFetch(table, { method: 'POST', body: record });
      return res && res[0] ? res[0] : record;
    },

    // Update existing record
    async updateRecord(table, id, changes) {
      const cl = getClient();
      if (cl) {
        try {
          const { data, error } = await cl.from(table).update(changes).eq('id', id).select();
          if (!error && data && data[0]) return data[0];
        } catch (e) {
          console.warn(`[Supabase] SDK update error for ${table}, falling back to REST:`, e);
        }
      }
      const res = await restFetch(table, { method: 'PATCH', query: `id=eq.${id}`, body: changes });
      return res && res[0] ? res[0] : changes;
    },

    // Delete record
    async deleteRecord(table, id) {
      const cl = getClient();
      if (cl) {
        try {
          const { error } = await cl.from(table).delete().eq('id', id);
          if (!error) return true;
        } catch (e) {
          console.warn(`[Supabase] SDK delete error for ${table}, falling back to REST:`, e);
        }
      }
      await restFetch(table, { method: 'DELETE', query: `id=eq.${id}` });
      return true;
    }
  };

  console.log('[Supabase] Supabase PostgreSQL Client initialized successfully (Singapore: lujqgwpldwkjxmlxnfij)');
})();
