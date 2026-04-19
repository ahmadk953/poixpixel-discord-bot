import type { AnyValue, AnyValueMap } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import {
  defaultResource,
  resourceFromAttributes,
} from '@opentelemetry/resources';
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from '@opentelemetry/sdk-logs';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import type { TransformableInfo } from 'logform';
import Transport from 'winston-transport';

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
  if (l === 'silly') {
    return { severityText: 'TRACE', severityNumber: 2 };
  }
  if (l === 'verbose') {
    return { severityText: 'DEBUG', severityNumber: 6 };
  }
  if (l === 'debug') {
    return { severityText: 'DEBUG', severityNumber: 7 };
  }
  if (l === 'http') {
    return { severityText: 'INFO', severityNumber: 10 };
  }
  if (l === 'info') {
    return { severityText: 'INFO', severityNumber: 11 };
  }
  if (l === 'warn' || l === 'warning') {
    return { severityText: 'WARN', severityNumber: 14 };
  }
  if (l === 'error') {
    return { severityText: 'ERROR', severityNumber: 17 };
  }
  if (l === 'crit' || l === 'critical') {
    return { severityText: 'FATAL', severityNumber: 21 };
  }
  if (l === 'fatal') {
    return { severityText: 'FATAL', severityNumber: 24 };
  }
  return { severityText: l.toUpperCase(), severityNumber: 11 };
}

/**
 * Checks if the given key is numeric.
 */
function isNumericKey(key: string): boolean {
  return !Number.isNaN(Number(key));
}

/**
 * Handles Error instances and returns exception attributes.
 */
function extractErrorAttributes(error: Error): Record<string, unknown> {
  const attrs: Record<string, unknown> = {
    'exception.type': error.name,
    'exception.message': error.message,
  };
  if (error.stack) {
    attrs['exception.stacktrace'] = error.stack;
  }
  return attrs;
}

/**
 * Handles common printf/error fields.
 */
function extractCommonErrorField(
  key: string,
  value: unknown,
  isError = false
): Record<string, unknown> | null {
  if (
    key === 'stack' &&
    typeof value === 'string' &&
    (value.includes('\n') || value.includes(' at '))
  ) {
    return {
      stack: value,
      'exception.stacktrace': value,
    };
  }

  if (key === 'name' && typeof value === 'string' && isError) {
    return {
      name: value,
      'exception.type': value,
    };
  }

  return null;
}

/**
 * Safely serializes objects/arrays.
 */
function safeSerialize(value: unknown): unknown {
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return String(value);
    }
  }
  return value;
}

/**
 * Cleans and formats log metadata for OpenTelemetry.
 * @param meta - log metadata object
 * @returns cleaned metadata object
 */
function cleanAttributes(
  meta: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta || {})) {
    if (isNumericKey(k)) {
      continue;
    }

    if (v instanceof Error) {
      Object.assign(out, extractErrorAttributes(v));
      continue;
    }

    const commonField = extractCommonErrorField(k, v, v instanceof Error);
    if (commonField) {
      Object.assign(out, commonField);
      continue;
    }

    out[k] = safeSerialize(v);
  }
  return out;
}

/**
 * Options for configuring the OtelTransport.
 */
interface OtelTransportOptions {
  batch?: {
    maxQueueSize?: number;
    scheduledDelayMillis?: number;
    exportTimeoutMillis?: number;
    maxExportBatchSize?: number;
  };
  headers?: Record<string, string>;
  otlpEndpoint: string;
  resourceAttributes?: Record<string, string>;
  serviceName: string;
}

/**
 * A Winston transport for sending logs to OpenTelemetry via OTLP.
 */
export class OtelTransport extends Transport {
  private readonly provider: LoggerProvider;
  private readonly otelLogger: ReturnType<LoggerProvider['getLogger']>;

  constructor(opts: OtelTransportOptions) {
    super();

    // Build a resource: base + custom attributes
    const base = defaultResource();
    const extra = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: opts.serviceName ?? 'bot',
      ...(opts.resourceAttributes ?? {}),
    });
    const resource = base.merge(extra);

    const exporter = new OTLPLogExporter({
      url: opts.otlpEndpoint,
      headers: opts.headers,
    });

    const processor = new BatchLogRecordProcessor(exporter, {
      maxQueueSize: opts.batch?.maxQueueSize ?? 2048,
      scheduledDelayMillis: opts.batch?.scheduledDelayMillis ?? 5000,
      exportTimeoutMillis: opts.batch?.exportTimeoutMillis ?? 30_000,
      maxExportBatchSize: opts.batch?.maxExportBatchSize ?? 512,
    });

    this.provider = new LoggerProvider({
      resource,
      processors: [processor],
    });

    this.otelLogger = this.provider.getLogger(opts.serviceName ?? 'bot');
  }
  log(info: TransformableInfo, next: () => void) {
    setImmediate(() => this.emit('logged', info));

    try {
      const { level, message, timestamp, ...meta } = info;
      const { severityText, severityNumber } = mapLevel(String(level));

      // Merge splat (if present) into attributes
      // Use the Symbol directly and access via a symbol-compatible index to
      // preserve correct semantics (winston uses Symbol.for('splat')).
      const splatKey = Symbol.for('splat');
      const splatVal = (info as unknown as Record<PropertyKey, unknown>)[
        splatKey
      ];
      const splat = Array.isArray(splatVal)
        ? (splatVal as unknown[])
        : undefined;
      if (splat) {
        (meta as Record<string, unknown>).splat = splat;
      }

      const attrs = cleanAttributes(meta as Record<string, unknown>);
      if (timestamp) {
        attrs['logger.timestamp'] = timestamp;
      }

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
