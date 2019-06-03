const { config } = require('../config');

/**
 * Check if caller address is present on spam protection whitelist or blacklist.
 * Throws when caller is on blacklist. Takes precedence over whitelist.
 * Returns true if caller is on whitelist.
 * @param originAddress {String}
 * @returns boolean Caller is whitelisted.
 */
module.exports.checkBWLists = (originAddress) => {
  let hasWhitelist = !!config.spamProtectionOptions.whitelist.length;
  let hasBlacklist = !!config.spamProtectionOptions.blacklist.length;
  let isWhitelisted = false;
  let isBlacklisted = false;
  if (hasBlacklist) {
    isBlacklisted = config.spamProtectionOptions.blacklist.includes(originAddress);
  }
  if (isBlacklisted) {
    throw new Error(`Blacklisted caller. Check information on trust clues provided at ${config.adapterOpts.baseUrl}/`);
  }
  if (hasWhitelist) {
    isWhitelisted = config.spamProtectionOptions.whitelist.includes(originAddress);
  }
  return isWhitelisted;
};

/**
 * Evaluate trust for caller address based on configured trust clues.
 * Throws when caller is not trusted.
 * When no trust clues are configured, caller is accepted.
 * @param originAddress {String}
 * @returns {Promise<void>}
 * @throws Error when caller is not trusted
 */
module.exports.evaluateTrust = async (originAddress) => {
  if (config.wtLibsOptions.trustClueOptions) {
    const interpretedClues = await config.wtLibs.getTrustClueClient().interpretAllValues(originAddress);

    // Let's say we're okay with at least one clue passing.
    // Customize following logic to suit your needs (e.g. use `interpretedClues.every`).
    // Also allow requests when no trust clues are configured.
    const someCluesPass = interpretedClues.length === 0 || interpretedClues.some(c => c.value);
    if (!someCluesPass) {
      throw new Error(`Untrusted caller. Check information on trust clues provided at ${config.adapterOpts.baseUrl}/`);
    }
  }
};
