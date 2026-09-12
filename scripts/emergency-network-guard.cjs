// Loaded into the build and every child process through NODE_OPTIONS.
const allowed = (value) => {
  const url = new URL(value instanceof Request ? value.url : String(value), 'http://localhost');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('OFFLINE_BUILD_NETWORK_BLOCKED');
  }
};
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => { allowed(input); return originalFetch(input, init); };
for (const protocol of ['http', 'https']) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const transport = require('node:' + protocol);
  for (const name of ['request', 'get']) {
    const original = transport[name];
    transport[name] = function(input, ...args) {
      allowed(typeof input === 'object' && !(input instanceof URL)
        ? protocol + '://' + (input.hostname || input.host || 'localhost') : input);
      return original.call(this, input, ...args);
    };
  }
}
