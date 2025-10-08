import { effect, track } from 'ripple';
import { get } from 'ripple/internal/client';

// Type definitions for the logger
type LogLevel = 'log' | 'warn' | 'error' | 'info';

type LoggerColors = {
    [K in LogLevel]: string;
};

interface LoggerMethods {
    whenever: <T>(
        condition: () => boolean,
        callback: () => T,
        name: string
    ) => void;
    assert: (
        condition: () => boolean,
        message: string
    ) => void;
    log: <T>(args: () => T, name: string) => void;
    warn: <T>(args: () => T, name: string) => void;
    error: <T>(args: () => T, name: string) => void;
    info: <T>(args: () => T, name: string) => void;
}

// Extend the global Window interface to include $r
declare global {
    interface Window {
        $r: LoggerMethods;
    }

    interface ImportMetaEnv {
        readonly DEV: boolean;
    }

    interface ImportMeta {
        readonly env: ImportMetaEnv;
    }
}

export function inject(): void {
    if (import.meta.env.DEV) {
        const colors: LoggerColors = {
            log: '#2196F3',
            warn: '#FFA726',
            error: '#EF5350',
            info: '#66BB6A'
        };

        const loggerHandler: ProxyHandler<{}> = {
            get(target: {}, prop: string | symbol): any {
                if (prop === 'whenever') {
                    return <T>(_condition: () => boolean, callback: () => T, name: string): void => {
                        const condition = track(() => _condition());
                        const res = track(() => callback());
                        effect(() => {
                            if (get(condition)) {
                                console.log(
                                    `%c${name}`,
                                    `color: ${colors.log}; font-weight: bold`,
                                    get(res)
                                );
                            }
                        });
                    };
                }

                if (prop === 'assert') {
                    return (_condition: () => boolean, message: string): void => {
                        const condition = track(() => _condition());
                        effect(() => {
                            if (!get(condition)) {
                                console.error(
                                    `%cAssertion failed`,
                                    `color: ${colors.error}; font-weight: bold`,
                                    message
                                );
                                throw new Error(message);
                            }
                        });
                    };
                }

                if (typeof prop === 'string' && prop in colors) {
                    const logLevel = prop as LogLevel;
                    return <T>(args: () => T, name: string): void => {
                        const res = track(() => args());
                        effect(() => {
                            console[logLevel](
                                `%c${name}`,
                                `color: ${colors[logLevel]}; font-weight: bold`,
                                get(res)
                            );
                        });
                    };
                }

                return target[prop];
            }
        };

        window.$r = new Proxy({}, loggerHandler) as LoggerMethods;
    }

}
