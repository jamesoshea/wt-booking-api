let _WTAdapter;

class UpstreamError extends Error {};
class InvalidUpdateError extends Error {};
class RestrictionsViolatedError extends Error {};
class RoomUnavailableError extends Error {};
class FlightUnavailableError extends Error {};
class IllFormedCancellationFeesError extends Error {};
class InadmissibleCancellationFeesError extends Error {};
class InvalidPriceError extends Error {};

/**
 * Get the previously set WTAdapter instance.
 */
function get () {
  if (!_WTAdapter) {
    throw new Error('No WTAdapter instance has been set!');
  }
  return _WTAdapter;
}

/**
 * Set WTAdapter instance during runtime.
 */
function set (wtAdapter) {
  _WTAdapter = wtAdapter;
}

module.exports = {
  get,
  set,
  UpstreamError,
  InvalidUpdateError,
  RoomUnavailableError,
  FlightUnavailableError,
  RestrictionsViolatedError,
  IllFormedCancellationFeesError,
  InadmissibleCancellationFeesError,
  InvalidPriceError,
};
