import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import {
  addColors,
  createLogger,
  format,
  type Logger,
  transports,
} from 'winston';

import { loadConfig } from './configLoader.js';
import { OtelTransport } from './telemetry/otelLogTransport.js';

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
        (key) => !['message', 'stack', 'name'].includes(key)
      );
      if (errorProps.length > 0) {
        const customProps = errorProps.reduce(
          (acc, key) => {
            acc[key] = (info.error as Record<string, unknown>)[key];
            return acc;
          },
          {} as Record<string, unknown>
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
        !Number.isNaN(Number(key)) ||
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
    {} as Record<string, unknown>
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
    format.errors({ stack: true })
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize({ all: false, level: true }),
        consoleFormat
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

const EXIT_CODE = 1;
const EXIT_DELAY_MS = 500;
const CLOSE_TIMEOUT_MS = 1000;
const TRANSPORT_CLOSE_WAIT_MS = 200;
const excludedErrorKeys = new Set(['name', 'message', 'stack']);

interface ClosableTransport {
  close?: () => unknown;
  flush?: () => unknown;
}

const isPromiseLike = (value: unknown): value is Promise<unknown> => {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
    return false;
  }
  return typeof (value as { then?: unknown }).then === 'function';
};

const getErrorDetails = (error: Error): Record<string, unknown> => {
  const details: Record<string, unknown> = {};

  for (const key of Object.keys(error)) {
    if (excludedErrorKeys.has(key)) {
      continue;
    }

    const value = (error as unknown as Record<string, unknown>)[key];
    if (value !== undefined) {
      details[key] = value;
    }
  }

  return details;
};

const invokeSafely = (fn: (() => unknown) | undefined): unknown => {
  if (typeof fn !== 'function') {
    return undefined;
  }

  try {
    return fn();
  } catch {
    return undefined;
  }
};

const collectClosePromises = (): Promise<unknown>[] => {
  const closePromises: Promise<unknown>[] = [];

  const loggerCloseResult = invokeSafely(() =>
    (logger as unknown as Logger).close?.call(logger as Logger)
  );
  if (isPromiseLike(loggerCloseResult)) {
    closePromises.push(loggerCloseResult);
  }

  const transportsList: ClosableTransport[] =
    (logger as unknown as { transports?: ClosableTransport[] }).transports ??
    [];
  for (const transport of transportsList) {
    const flushResult = invokeSafely(transport.flush);
    if (isPromiseLike(flushResult)) {
      closePromises.push(flushResult);
      continue;
    }

    const closeResult = invokeSafely(transport.close);
    if (isPromiseLike(closeResult)) {
      closePromises.push(closeResult);
      continue;
    }

    if (typeof transport.close === 'function') {
      closePromises.push(
        new Promise((resolve) => setTimeout(resolve, TRANSPORT_CLOSE_WAIT_MS))
      );
    }
  }

  return closePromises;
};

const scheduleExit = (): void => {
  setTimeout(() => process.exit(EXIT_CODE), EXIT_DELAY_MS);
};

const flushAndExit = async (): Promise<void> => {
  try {
    const closePromises = collectClosePromises();

    if (closePromises.length === 0) {
      scheduleExit();
      return;
    }

    await Promise.race([
      Promise.all(closePromises),
      new Promise((resolve) => setTimeout(resolve, CLOSE_TIMEOUT_MS)),
    ]);

    process.exit(EXIT_CODE);
  } catch {
    scheduleExit();
  }
};

const logFatalUncaughtException = (error: Error): void => {
  logger.log('fatal', 'Uncaught Exception', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...getErrorDetails(error),
    },
  });
};

/**
 * Initialize the logger and set up global error handlers.
 */
export function initLogger() {
  // Set up global error handlers
  process.on('uncaughtException', async (error) => {
    logFatalUncaughtException(error);
    await flushAndExit();
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
