export const BW = "\x1b[36m\x1b[1m[BW]\x1b[0m";
export const BW_OK = "\x1b[32m\x1b[1m[BW ✓]\x1b[0m";
export const BW_WARN = "\x1b[33m\x1b[1m[BW !]\x1b[0m";
export const BW_ERR = "\x1b[31m\x1b[1m[BW ✗]\x1b[0m";

export function bwLog(msg: string) { console.log(`${BW} ${msg}`); }
export function bwOk(msg: string) { console.log(`${BW_OK} ${msg}`); }
export function bwWarn(msg: string) { console.log(`${BW_WARN} ${msg}`); }
export function bwErr(msg: string) { console.log(`${BW_ERR} ${msg}`); }
