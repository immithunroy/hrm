// Patches zk-attendance-sdk to support device authentication (CMD_AUTH / 1102).
// ZKTeco devices with a communication password reply CMD_ACK_UNAUTH (2005) to
// CMD_CONNECT and expect a CMD_AUTH (username + password) exchange before any
// other command. The upstream SDK never implements this, so we add it here.
//
// Usage: node patch-zk-sdk.cjs <path-to-dist/index.js>
'use strict';

const fs = require('fs');
const path = require('path');

const target = process.argv[2];
if (!target) {
  console.error('Usage: node patch-zk-sdk.cjs <path-to-dist/index.js>');
  process.exit(1);
}

const filePath = path.resolve(target);
let src = fs.readFileSync(filePath, 'utf8');

function replace(oldText, newText, expectedCount, label) {
  const parts = src.split(oldText);
  const count = parts.length - 1;
  if (count !== expectedCount) {
    console.error(`FAIL: expected ${expectedCount} occurrence(s) of "${label}", found ${count}`);
    process.exit(1);
  }
  src = parts.join(newText);
  console.log(`OK: ${label} (${count})`);
}

// 1. Helper functions for device auth (makeCommKey, from pyzk "commpro.c - MakeKey").
replace(
  `  COMMANDS.CMD_ACK_ERROR_DATA
]);`,
  `  COMMANDS.CMD_ACK_ERROR_DATA
]);
function isConnectUnauth(command, replyCommandId) {
  return command === COMMANDS.CMD_CONNECT && replyCommandId === COMMANDS.CMD_ACK_UNAUTH;
}
// Scrambles the device comm password + session id into the 4-byte CMD_AUTH payload.
// Reference: pyzk zk/base.py make_commkey / node-zklib utils.js makeCommKey.
function makeCommKeyValue(key, sessionId) {
  key = Math.floor(key) >>> 0;
  sessionId = Math.floor(sessionId) >>> 0;
  let k = 0;
  for (let i = 0; i < 32; i++) {
    if (key & (1 << i)) {
      k = (k << 1) | 1;
    } else {
      k = k << 1;
    }
  }
  k = (k + sessionId) >>> 0;
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(k, 0);
  bytes[0] ^= 0x5a;
  bytes[1] ^= 0x4b;
  bytes[2] ^= 0x53;
  bytes[3] ^= 0x4f;
  const swapped = Buffer.from([bytes[2], bytes[3], bytes[0], bytes[1]]);
  const ticks = 50;
  const B = ticks & 0xff;
  return Buffer.from([swapped[0] ^ B, swapped[1] ^ B, B, swapped[3] ^ B]);
}`,
  1,
  'makeCommKey helper'
);

// 2. Allow CONNECT to resolve on UNAUTH (TCP + UDP executeCmd).
replace(
  `          if (ERROR_ACK_COMMAND_IDS.has(replyCommandId)) {`,
  `          if (ERROR_ACK_COMMAND_IDS.has(replyCommandId) && !isConnectUnauth(command, replyCommandId)) {`,
  2,
  'executeCmd UNAUTH bypass (TCP + UDP)'
);

// 3. Add auth() to both JTCP and JUDP after connect().
const connectBlock = `  async connect() {
    const reply = await this.executeCmd(COMMANDS.CMD_CONNECT, Buffer.alloc(0));
    return Boolean(reply);
  }`;
const authMethod = `  async auth(username, password) {
    const commKey = parseInt(password || "0", 10);
    if (Number.isNaN(commKey)) {
      throw new Error("Device communication password must be numeric");
    }
    const data = makeCommKeyValue(commKey, this.sessionId);
    const reply = await this.executeCmd(COMMANDS.CMD_AUTH, data);
    return reply.length > 0;
  }`;
replace(connectBlock, connectBlock + '\n' + authMethod, 2, 'auth() on JTCP + JUDP');

// 4. Expose auth() on the main ZKAttendanceClient.
replace(
  `  isConnected() {
    if (this.connectionType === "tcp") {`,
  `  async auth(username, password) {
    if (this.connectionType === "tcp") {
      return this.jtcp.auth(username, password);
    }
    if (this.connectionType === "udp") {
      return this.judp.auth(username, password);
    }
    throw new ZKError(new Error("Not connected"), "AUTH", this.ip);
  }
  isConnected() {
    if (this.connectionType === "tcp") {`,
  1,
  'auth() on ZKAttendanceClient'
);

// 5. Raise readWithBuffer chunk timeouts (10s TCP / 3s UDP -> 60s).
// The server-to-device path is slower than a LAN; short timeouts cut
// large transfers (e.g. ATTLOG) short and return partial data.
replace(
  `          const timeout = 1e4;`,
  `          const timeout = 6e4;`,
  1,
  'TCP readWithBuffer timeout 10s -> 60s'
);
replace(
  `          const timeout = 3e3;`,
  `          const timeout = 6e4;`,
  1,
  'UDP readWithBuffer timeout 3s -> 60s'
);

fs.writeFileSync(filePath, src);
console.log('Patch applied successfully.');