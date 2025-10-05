import { loadConfig } from './configLoader.js';
import { OtelTransport } from './telemetry/otelLogTransport.js';

import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import {
  addColors,
  createLogger,
  format,
  transports,
  type Logger,
} from 'winston';

(BigInt.prototype as unknown as { toJSON: () => string }).toJSON =
  function (this: { toString: () => string }) {
    return this.toString();
  };

const config = loadConfig();

const colorizer = format.colorize({ level: true });

/**
 * Custom format for console output with improved readability
 */
const consoleFormat = format.printf((info) => {
  const rawLevel =
    (info[Symbol.for('level')] as string | undefined) ?? info.level ?? '';
  const levelLabel = colorizer.colorize(rawLevel, rawLevel.toUpperCase());
  let output = `${info.timestamp} [${levelLabel}]: ${info.message}`;

  // Handle error objects specially
  if (info.error) {
    if (info.error instanceof Error) {
      output += `\n  Error: ${info.error.message}`;
      if (info.error.stack) {
        output += `\n  Stack Trace:\n${info.error.stack
          .split('\n')
          .map((line) => `    ${line}`)
          .join('\n')}`;
      }
      // Add any custom error properties
      const errorProps = Object.keys(info.error).filter(
        (key) => !['message', 'stack', 'name'].includes(key),
      );
      if (errorProps.length > 0) {
        const customProps = errorProps.reduce(
          (acc, key) => {
            acc[key] = (info.error as Record<string, unknown>)[key];
            return acc;
          },
          {} as Record<string, unknown>,
        );
        output += `\n  Error Properties: ${JSON.stringify(customProps, null, 2)
          .split('\n')
          .map((line, i) => (i === 0 ? line : `    ${line}`))
          .join('\n')}`;
      }
    } else {
      // Non-Error error objects
      output += `\n  Error: ${JSON.stringify(info.error, null, 2)
        .split('\n')
        .map((line, i) => (i === 0 ? line : `    ${line}`))
        .join('\n')}`;
    }
  }

  // Add stack trace if present and no error object
  if (info.stack && !info.error && typeof info.stack === 'string') {
    output += `\n  Stack Trace:\n${info.stack
      .split('\n')
      .map((line) => `    ${line}`)
      .join('\n')}`;
  }

  // Clean and format metadata
  const cleanMeta = Object.keys(info).reduce(
    (acc, key) => {
      // Filter out internal winston properties and empty values
      if (
        !isNaN(Number(key)) ||
        key === 'level' ||
        key === 'message' ||
        key === 'timestamp' ||
        info[key] === undefined ||
        info[key] === null
      ) {
        return acc;
      }
      acc[key] = info[key];
      return acc;
    },
    {} as Record<string, unknown>,
  );

  // Add metadata if present, with pretty printing
  if (Object.keys(cleanMeta).length > 0) {
    output += `\n  Metadata:\n${JSON.stringify(cleanMeta, null, 2)
      .split('\n')
      .map((line) => `    ${line}`)
      .join('\n')}`;
  }

  return output;
});

/**
 * Winston Logger instance configured with console and optional OpenTelemetry transport.
 */
export const logger = createLogger({
  levels: {
    fatal: 0,
    crit: 1,
    error: 2,
    warn: 3,
    info: 4,
    http: 5,
    verbose: 6,
    debug: 7,
    silly: 8,
  },
  level: config.telemetry?.level ?? 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize({ all: false, level: true }),
        consoleFormat,
      ),
    }),
    ...(config.telemetry?.otel?.enabled
      ? [
          new OtelTransport({
            serviceName: config.telemetry.otel.serviceName ?? 'bot',
            otlpEndpoint:
              config.telemetry.otel.otlpEndpoint ?? 'http://localhost:4318',
            headers: config.telemetry.otel.headers,
            resourceAttributes: {
              [ATTR_SERVICE_NAME]: config.telemetry.otel.serviceName ?? 'bot',
              ...config.telemetry.otel.resourceAttributes,
            },
            batch: config.telemetry.otel.batch,
          }),
        ]
      : []),
  ],
});

/**
 * Custom log level definitions with colors
 */
addColors({
  fatal: 'red bold underline',
  crit: 'red bold',
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'cyan',
  verbose: 'blue',
  debug: 'magenta',
  silly: 'grey',
});

/**
 * Initialize the logger and set up global error handlers.
 */
export function initLogger() {
  // Set up global error handlers
  process.on('uncaughtException', async (error) => {
    // Log the fatal error first
    logger.log('fatal', 'Uncaught Exception', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...Object.keys(error).reduce<Record<string, unknown>>((acc, key) => {
          if (!['name', 'message', 'stack'].includes(key)) {
            const val = (error as unknown as Record<string, unknown>)[key];
            if (val !== undefined) acc[key] = val;
          }
          return acc;
        }, {}),
      },
    });

    // Try to gracefully flush/close transports before exiting so async
    // transports (file, network, OTEL, etc.) have a chance to send logs.
    try {
      const closePromises: Promise<unknown>[] = [];

      // If the logger exposes a close() that returns a Promise, use it.
      const maybeLoggerClose: ((this: Logger) => unknown) | undefined = (
        logger as unknown as Logger
      ).close;
      if (typeof maybeLoggerClose === 'function') {
        try {
          const res = maybeLoggerClose.call(logger as Logger);
          if (res && typeof (res as { then?: unknown }).then === 'function') {
            closePromises.push(res as Promise<unknown>);
          }
        } catch {
          // ignore errors from close invocation
        }
      }

      // Inspect individual transports for flush/close methods that may return a Promise
      const transportsList: Record<string, unknown>[] =
        (logger as unknown as { transports?: Record<string, unknown>[] })
          .transports ?? [];
      for (const t of transportsList) {
        if (!t) continue;

        // Safely narrow and call flush if present
        const maybeFlush = t.flush as unknown;
        if (typeof maybeFlush === 'function') {
          try {
            const r = (maybeFlush as (...args: unknown[]) => unknown)();
            if (r && typeof (r as { then?: unknown }).then === 'function') {
              closePromises.push(r as Promise<unknown>);
            }
          } catch {
            // ignore
          }
          continue;
        }

        // Otherwise try close(); many transports expose close(callback) or close()
        const maybeClose = t.close as unknown;
        if (typeof maybeClose === 'function') {
          try {
            const r = (maybeClose as (...args: unknown[]) => unknown)();
            if (r && typeof (r as { then?: unknown }).then === 'function') {
              closePromises.push(r as Promise<unknown>);
            } else {
              closePromises.push(
                new Promise((resolve) => setTimeout(resolve, 200)),
              );
            }
          } catch {
            // ignore
          }
        }
      }

      if (closePromises.length > 0) {
        await Promise.race([
          Promise.all(closePromises),
          new Promise((resolve) => setTimeout(resolve, 1000)),
        ]);

        process.exit(1);
      } else {
        setTimeout(() => process.exit(1), 500);
        return;
      }
    } catch {
      setTimeout(() => process.exit(1), 500);
      return;
    }
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: promise.toString(),
    });
  });

  logger.info('Logger initialized', {
    level: config.telemetry?.level ?? 'info',
    otelEnabled: config.telemetry?.otel?.enabled ?? false,
  });
}
