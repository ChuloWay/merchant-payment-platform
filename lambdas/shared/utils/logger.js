"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
class Logger {
    constructor(context) {
        this.context = context;
    }
    log(message, data) {
        console.log(JSON.stringify({
            level: 'INFO',
            context: this.context,
            message,
            data,
            timestamp: new Date().toISOString(),
        }));
    }
    error(message, error) {
        console.error(JSON.stringify({
            level: 'ERROR',
            context: this.context,
            message,
            error: error?.message || error,
            stack: error?.stack,
            timestamp: new Date().toISOString(),
        }));
    }
    warn(message, data) {
        console.warn(JSON.stringify({
            level: 'WARN',
            context: this.context,
            message,
            data,
            timestamp: new Date().toISOString(),
        }));
    }
}
exports.Logger = Logger;
