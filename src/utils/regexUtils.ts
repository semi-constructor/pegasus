import vm from 'vm';
import { logger } from './logger';

export interface RegexMatchResult {
  matches: string[];
  timedOut: boolean;
}

/**
 * Safely tests if a regex matches a string with a timeout to prevent ReDoS.
 */
export function safeRegexTest(pattern: string, flags: string, text: string, timeoutMs = 50): boolean {
  try {
    const sandbox = { result: false };
    const context = vm.createContext(sandbox);
    const script = new vm.Script(`result = new RegExp(${JSON.stringify(pattern)}, ${JSON.stringify(flags)}).test(${JSON.stringify(text)});`);
    script.runInContext(context, { timeout: timeoutMs });
    return sandbox.result;
  } catch (error) {
    if (error instanceof Error && error.message.includes('timed out')) {
      logger.warn(`Regex evaluation timed out for pattern: ${pattern}`);
    }
    return false;
  }
}

/**
 * Safely extracts all matches of a regex from a string with a timeout.
 */
export function safeRegexMatch(pattern: string, flags: string, text: string, timeoutMs = 50): RegexMatchResult {
  try {
    const sandbox = { matches: [] as string[] };
    const context = vm.createContext(sandbox);
    
    // Ensure the global flag is present for extracting multiple matches if needed
    // But since we want to be safe, we just let the sandbox execute a while loop
    const script = new vm.Script(`
      const regex = new RegExp(${JSON.stringify(pattern)}, ${JSON.stringify(flags)});
      const isGlobal = regex.global;
      let result;
      while ((result = regex.exec(${JSON.stringify(text)})) !== null) {
        matches.push(result[0]);
        if (!isGlobal) break;
      }
    `);
    
    script.runInContext(context, { timeout: timeoutMs });
    return { matches: sandbox.matches, timedOut: false };
  } catch (error) {
    if (error instanceof Error && error.message.includes('timed out')) {
      logger.warn(`Regex match evaluation timed out for pattern: ${pattern}`);
      return { matches: [], timedOut: true };
    }
    return { matches: [], timedOut: false };
  }
}
