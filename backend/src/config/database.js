const mongoose = require('mongoose');

/**
 * MongoDB connection options tuned for Atlas + flaky local networks:
 * - serverSelectionTimeoutMS / connectTimeoutMS: fail fast (≤10s) instead of
 *   hanging 30s on every request during a network blip.
 * - socketTimeoutMS: give long dashboard aggregations room to finish.
 * - heartbeatFrequencyMS: detect dropped connections sooner.
 * - family 4: force IPv4 to avoid IPv6 timeouts on mixed networks (e.g. WARP).
 */
const CONNECTION_OPTIONS = {
  dbName: 'jewelbiz',
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  heartbeatFrequencyMS: 5000,
  maxPoolSize: 20,
  minPoolSize: 2,
  family: 4,
  autoIndex: process.env.NODE_ENV !== 'production',
};

const MAX_RETRY_WAIT_MS = 30000;
let retryTimer = null;
// Deduplicate concurrent connect() calls: the 'disconnected' handler can fire
// while a connect is already in flight, and calling mongoose.connect() twice
// with different URIs throws "Can't call openUri() on an active connection".
let connectPromise = null;

/**
 * Fallback connection URI.
 *
 * `mongodb+srv://` requires an SRV DNS lookup, which Node performs with its
 * internal resolver (c-ares). Some setups (e.g. Cloudflare WARP) leave that
 * resolver pointed at an unreachable server, so every lookup fails with
 * `querySrv ECONNREFUSED` even though `nslookup` works fine. In that case we
 * fall back to a plain `mongodb://` URI built from the (predictable) Atlas
 * shard hostnames. A plain `mongodb://` URI resolves hosts with the OS
 * resolver (`dns.lookup`) instead of c-ares, so it works where SRV does not.
 * TLS is explicitly enabled because Atlas requires it (SRV mode implied it).
 */
let effectiveUri = process.env.MONGODB_URI;

const buildDirectAtlasUri = (srvUri) => {
  // mongodb+srv://user:pass@<cluster>.<project>.mongodb.net/<db>?<query>
  const m = srvUri.match(/^mongodb\+srv:\/\/([^@]+)@([^/]+)\/([^?]+)(\?.*)?$/);
  if (!m) return null;
  const [, creds, baseHost, db, query] = m;
  const parts = baseHost.split('.');
  if (parts.length < 3) return null;
  const [cluster, project] = parts;
  // Atlas shard hostname pattern: <cluster>-shard-00-0N.<project>.mongodb.net
  const shards = [0, 1, 2]
    .map((n) => `${cluster}-shard-00-0${n}.${project}.mongodb.net:27017`)
    .join(',');
  const queryParams = `${query ? query.slice(1) + '&' : ''}tls=true`;
  return `mongodb://${creds}@${shards}/${db}?${queryParams}`;
};


/**
 * Connect to MongoDB Atlas.
 *
 * Unlike the original version this NEVER crashes the API on a transient
 * network failure – it retries with exponential backoff in the background,
 * so the server keeps serving (and its routes recover the moment the
 * connection is re-established).
 */
const connectDB = async (attempt = 0) => {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set. Add it to backend/.env');
    process.exit(1);
  }

  // Already connected (driver auto-reconnect may have won the race) – nothing to do.
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // Deduplicate concurrent connect requests.
  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = (async () => {
    for (;;) {
      try {
        const conn = await mongoose.connect(effectiveUri, CONNECTION_OPTIONS);
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        return conn;
      } catch (err) {
        // First SRV/DNS failure (e.g. Cloudflare WARP breaks Node's SRV lookups):
        // switch to the direct-URI fallback so this and all later attempts bypass
        // the broken resolver instead of failing the same way every retry.
        if (effectiveUri === process.env.MONGODB_URI && /querySrv|ENOTFOUND|EAI_AGAIN|ECONNREFUSED/i.test(err.message)) {
          const directUri = buildDirectAtlasUri(process.env.MONGODB_URI);
          if (directUri) {
            effectiveUri = directUri;
            console.warn('⚠️  SRV DNS lookup failed (Node resolver / Cloudflare WARP?).');
            console.warn(`    Falling back to direct mongodb:// connection: ${directUri.replace(/\/\/[^@]+@/, '//***@')}`);
            continue; // retry immediately with the direct URI
          }
        }
        const wait = Math.min(MAX_RETRY_WAIT_MS, 2000 * Math.pow(2, Math.min(attempt, 5)));
        console.error(`❌ MongoDB connection failed: ${err.message}`);
        console.warn(`🔄 Retrying connection in ${Math.round(wait / 1000)}s (attempt ${attempt + 1})...`);
        await new Promise((resolve) => {
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(resolve, wait);
        });
        attempt += 1;
      }
    }
  })();

  try {
    return await connectPromise;
  } finally {
    connectPromise = null;
  }
};

/** Read-only status used by the /health endpoint. */
connectDB.getStatus = () => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting', 'disconnected'];
  const readyState = mongoose.connection.readyState;
  return {
    readyState,
    state: states[readyState] || 'unknown',
  };
};

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected. Attempting reconnect...');
  // The driver also monitors behind the scenes, but this explicit back-off loop
  // gives deterministic, logged reconnects after network / Atlas hiccups.
  connectDB(0);
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected.');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err.message);
});

module.exports = connectDB;

