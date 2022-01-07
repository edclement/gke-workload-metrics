import bowser from 'bowser';
import client from 'prom-client';

const UNKNOWN = 'UNKNOWN';
const PATH_FAVICO = '/favicon.ico';
const { PATH_HEALTH = '/health', PATH_METRICS = '/metrics' } = process.env;

// This is our Prometheus counter metric
// https://prometheus.io/docs/concepts/metric_types/#counter
const requestsCounter = new client.Counter({
  name: 'workload_http_requests',
  help: 'HTTP request metadata',
  labelNames: ['httpMethod', 'platform', 'os', 'browser'],
});

export default async function handler(req, res) {
  const { url, headers, method: httpMethod } = req;
  const [path] = url.split('?');

  // Ensure we return 200 on health check request or a browser request for /favicon.ico
  if (httpMethod === 'GET' && [PATH_HEALTH, PATH_FAVICO].includes(path)) {
    res.writeHead(200);
    res.end();
    return;
  }

  // Return the metrics response when a request to the metrics endpoint is made
  if (httpMethod === 'GET' && path === PATH_METRICS) {
    res.writeHead(200, { 'Content-Type': client.register.contentType });
    res.write(await client.register.metrics());
    res.end();
    return;
  }

  // Try to derive metadata about the client making the request from the 'user-agent' header
  const [, userAgentString] = Object.entries(headers).find(([header]) => header.toLowerCase() === 'user-agent') || [];
  let userAgentData = null;
  try {
    userAgentData = bowser.parse(userAgentString);
  } catch (error) {
    console.error(JSON.stringify({ message: `Error parsing user agent string ${userAgentString}` }));
  }

  // Collect the label values that will be used when incrementing the counter
  const platform = snakeCase(userAgentData?.platform?.type) || UNKNOWN;
  const os = snakeCase(userAgentData?.os?.name) || UNKNOWN;
  const browser = snakeCase(userAgentData?.browser?.name) || UNKNOWN;
  const metricData = { httpMethod, platform, os, browser };

  // Increment the counter using the label values
  console.info(JSON.stringify({ message: 'capturing metrics for request', ...metricData }));
  requestsCounter.labels(metricData).inc(1);

  // Respond back to the client and provide the metric data that was recorded
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.write(JSON.stringify({ currentRequest: metricData, metrics: await client.register.getMetricsAsJSON() }, null, 2));
  res.end();
}

function snakeCase(string) {
  if (!string || typeof string !== 'string') return null;
  return string
    .replace(/\W+/g, ' ')
    .split(/ |\B(?=[A-Z])/)
    .map((word) => word.toLowerCase())
    .join('_');
}
