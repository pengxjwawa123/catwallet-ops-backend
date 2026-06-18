/**
 * Real otplib regression tests for 2FA (CRITICAL#1).
 *
 * We cannot import otplib directly in Jest because otplib v13 uses ESM-only
 * transitive dependencies (@scure/base, @noble/hashes) that ts-jest cannot
 * transform without invasive config changes.
 *
 * Instead we spawn a Node child process that requires the CJS dist directly.
 * This gives us a genuine, unmocked verification of the real library behavior
 * and proves the bug that existed before the fix.
 */
import { execSync } from 'child_process';
import * as path from 'path';

const NODE = process.execPath;
const OTPLIB_CJS = path.resolve(__dirname, '../../../../node_modules/otplib/dist/index.cjs');

function runOtpScript(script: string): unknown {
  const escaped = script.replace(/'/g, "'\\''");
  const output = execSync(`${NODE} -e '${escaped}'`, {
    cwd: path.resolve(__dirname, '../../../../'),
    encoding: 'utf8',
    timeout: 10000,
  });
  return JSON.parse(output.trim());
}

describe('otplib verifySync real-call regression (CRITICAL#1)', () => {
  it('verifySync returns an object with a valid boolean, NOT a plain boolean', () => {
    const result = runOtpScript(`
      const lib = require('${OTPLIB_CJS}');
      const secret = lib.generateSecret();
      const token = lib.generateSync({ secret, strategy: 'totp' });
      const result = lib.verifySync({ token, secret, strategy: 'totp' });
      // The original bug: treating the result object as boolean
      // An object is ALWAYS truthy, so "!result" was always false => every token passed
      console.log(JSON.stringify({
        typeofResult: typeof result,
        hasValidField: 'valid' in result,
        typeofValid: typeof result.valid,
        objectIsTruthy: !!result,
        resultDotValid: result.valid
      }));
    `);

    const r = result as Record<string, unknown>;
    // The return type is an object, not a boolean
    expect(r.typeofResult).toBe('object');
    expect(r.hasValidField).toBe(true);
    expect(r.typeofValid).toBe('boolean');

    // This is the original bug: object is truthy even when token is wrong
    expect(r.objectIsTruthy).toBe(true);

    // The correct check: result.valid
    expect(r.resultDotValid).toBe(true);
  });

  it('accepts a valid TOTP token via result.valid', () => {
    const result = runOtpScript(`
      const lib = require('${OTPLIB_CJS}');
      const secret = lib.generateSecret();
      const token = lib.generateSync({ secret, strategy: 'totp' });
      const result = lib.verifySync({ token, secret, strategy: 'totp' });
      console.log(JSON.stringify({ valid: result.valid }));
    `);

    expect((result as any).valid).toBe(true);
  });

  it('rejects a wrong TOTP token via result.valid', () => {
    const result = runOtpScript(`
      const lib = require('${OTPLIB_CJS}');
      const secret = lib.generateSecret();
      const realToken = lib.generateSync({ secret, strategy: 'totp' });
      // Pick a token that is guaranteed wrong
      const wrongToken = realToken === '000000' ? '000001' : '000000';
      const result = lib.verifySync({ token: wrongToken, secret, strategy: 'totp' });
      console.log(JSON.stringify({
        // FIXED check: must read .valid
        resultDotValid: result.valid,
        // BROKEN check (the original bug): always true because objects are truthy
        bangResult: !result,
      }));
    `);

    const r = result as Record<string, unknown>;
    // Fixed check: .valid is false for wrong token
    expect(r.resultDotValid).toBe(false);
    // Proves the bug: !result is ALWAYS false even for invalid tokens
    expect(r.bangResult).toBe(false);
  });

  it('rejects an obviously wrong token — demonstrates the original bypass', () => {
    // The original code: `if (!valid)` where valid = verifySync(...)
    // Since verifySync returns an object, !valid === false ALWAYS => never throws => bypass
    const result = runOtpScript(`
      const lib = require('${OTPLIB_CJS}');
      const secret = lib.generateSecret();
      const valid = lib.verifySync({ token: '123456', secret: lib.generateSecret(), strategy: 'totp' });
      // Original (BROKEN) check used in production before fix:
      const buggyCheck = !valid;           // always false => skip throw => token accepted
      // Fixed check:
      const fixedCheck = !valid.valid;     // correctly false or true based on token
      console.log(JSON.stringify({ buggyCheck, fixedCheck, validDotValid: valid.valid }));
    `);

    const r = result as Record<string, unknown>;
    // The bug: !valid (treating object as bool) is always false => no exception thrown
    expect(r.buggyCheck).toBe(false);
    // The fix: !valid.valid correctly catches invalid tokens
    expect(r.fixedCheck).toBe(true);
    expect(r.validDotValid).toBe(false);
  });
});
