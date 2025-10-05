import Transport from 'winston-transport';
import {
  LoggerProvider,
  BatchLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import {
  resourceFromAttributes,
  defaultResource,
} from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { AnyValue, AnyValueMap } from '@opentelemetry/api-logs';

/**
 * Maps a winston log level to OpenTelemetry severity fields.
 * @param level - winston log level
 * @returns Object containing the mapped severity text and number
 */
function mapLevel(level: string): {
  severityText: string;
  severityNumber: number;
} {
  const l = String(level).toLowerCase();
  // OTEL ranges: TRACE 1–4, DEBUG 5–8, INFO 9–12, WARN 13–16, ERROR 17–20, FATAL 21–24
  if (l === 'silly') return { severityText: 'TRACE', severityNumber: 2 };
  if (l === 'verbose') return { severityText: 'DEBUG', severityNumber: 6 };
  if (l === 'debug') return { severityText: 'DEBUG', severityNumber: 7 };
  if (l === 'http') return { severityText: 'INFO', severityNumber: 10 };
  if (l === 'info') return { severityText: 'INFO', severityNumber: 11 };
  if (l === 'warn' || l === 'warning') {
    return { severityText: 'WARN', severityNumber: 14 };
  }
  if (l === 'error') return { severityText: 'ERROR', severityNumber: 17 };
  if (l === 'fatal') return { severityText: 'FATAL', severityNumber: 21 };
  return { severityText: l.toUpperCase(), severityNumber: 11 };
}

/**
 * Cleans and formats log metadata for OpenTelemetry.
 * @param meta - log metadata object
 * @returns cleaned metadata object
 */
function cleanAttributes(
  meta: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta || {})) {
    if (!isNaN(Number(k))) continue;

    // Handle Error instances explicitly
    if (v instanceof Error) {
      out['exception.type'] = v.name;
      out['exception.message'] = v.message;
      if (v.stack) out['exception.stacktrace'] = v.stack;
      continue;
    }

    // Common printf/error fields
    if (k === 'stack' && typeof v === 'string') {
      out['exception.stacktrace'] = v;
      continue;
    }
    if (k === 'name' && typeof v === 'string') {
      out['exception.type'] = v;
      continue;
    }

    // Serialize objects/arrays safely
    if (typeof v === 'object' && v !== null) {
      try {
        out[k] = JSON.parse(JSON.stringify(v));
      } catch {
        out[k] = String(v);
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Options for configuring the OtelTransport.
 */
interface OtelTransportOptions {
  serviceName: string;
  otlpEndpoint: string;
  headers?: Record<string, string>;
  resourceAttributes?: Record<string, string>;
  batch?: {
    maxQueueSize?: number;
    scheduledDelayMillis?: number;
    exportTimeoutMillis?: number;
    maxExportBatchSize?: number;
  };
}

/**
 * A Winston transport for sending logs to OpenTelemetry via OTLP.
 */
export class OtelTransport extends Transport {
  private provider: LoggerProvider;
  private otelLogger: ReturnType<LoggerProvider['getLogger']>;

  constructor(opts: OtelTransportOptions) {
    super();

    // Build a resource: base + custom attributes
    const base = defaultResource();
    const extra = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: opts.serviceName || 'bot',
      ...(opts.resourceAttributes || {}),
    });
    const resource = base.merge(extra);

    const exporter = new OTLPLogExporter({
      url: opts.otlpEndpoint,
      headers: opts.headers,
    });

    const processor = new BatchLogRecordProcessor(exporter, {
      maxQueueSize: opts.batch?.maxQueueSize ?? 2048,
      scheduledDelayMillis: opts.batch?.scheduledDelayMillis ?? 5000,
      exportTimeoutMillis: opts.batch?.exportTimeoutMillis ?? 30000,
      maxExportBatchSize: opts.batch?.maxExportBatchSize ?? 512,
    });

    this.provider = new LoggerProvider({
      resource,
      processors: [processor],
    });

    this.otelLogger = this.provider.getLogger(opts.serviceName || 'bot');
  }

  log(info: any, next: () => void) {
    setImmediate(() => this.emit('logged', info));

    try {
      const { level, message, timestamp, ...meta } = info;
      const { severityText, severityNumber } = mapLevel(level);

      // Merge splat (if present) into attributes
      // Use the Symbol directly and access via a symbol-compatible index to
      // preserve correct semantics (winston uses Symbol.for('splat')).
      const splatKey = Symbol.for('splat');
      const splat = Array.isArray((info as any)[splatKey])
        ? (info as any)[splatKey]
        : undefined;
      if (splat) meta.splat = splat;

      const attrs = cleanAttributes(meta);
      if (timestamp) attrs['logger.timestamp'] = timestamp;

      // Normalize message body
      const body =
        typeof message === 'string'
          ? message
          : (() => {
              try {
                return JSON.stringify(message);
              } catch {
                return String(message);
              }
            })();
      // Convert Record<string, unknown> to AnyValueMap
      const attributes: AnyValueMap | undefined = Object.keys(attrs).length
        ? Object.entries(attrs).reduce((acc, [key, value]) => {
            acc[key] = value as AnyValue;
            return acc;
          }, {} as AnyValueMap)
        : undefined;

      this.otelLogger.emit({
        body,
        severityText,
        severityNumber,
        attributes,
      });
    } catch {
      // swallow errors inside Transport
    }

    next();
  }

  async close() {
    try {
      await this.provider.shutdown();
    } catch {
      // ignore
    }
  }
}
