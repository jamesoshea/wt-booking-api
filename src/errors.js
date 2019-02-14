class HttpError extends Error {
  constructor (code, msgLong, msgShort, additionalHeaders) {
    super();
    this.code = code || this.constructor.defaultCode;
    this.msgShort = msgShort || this.constructor.defaultMsgShort;
    this.msgLong = msgLong || this.constructor.defaultMsgLong || '';
    this.status = this.constructor.status;
    this.headers = additionalHeaders;
    // For compatibility with the Error class:
    this.message = this.msgLong || this.msgShort || this.code;
  }

  toPlainObject () {
    return {
      status: this.status,
      code: `#${this.code}`,
      short: this.msgShort,
      long: this.msgLong,
    };
  }
}

class HttpBadRequestError extends HttpError {};
HttpBadRequestError.status = 400;
HttpBadRequestError.defaultCode = 'badRequest';
HttpBadRequestError.defaultMsgShort = 'Bad request.';

class HttpForbiddenError extends HttpError {};
HttpForbiddenError.status = 403;
HttpForbiddenError.defaultCode = 'forbidden';
HttpForbiddenError.defaultMsgShort = 'Forbidden.';
HttpForbiddenError.defaultMsgLong = 'The requested action is forbidden.';

class Http404Error extends HttpError {};
Http404Error.status = 404;
Http404Error.defaultCode = 'notFound';
Http404Error.defaultMsgShort = 'Page not found.';
Http404Error.defaultMsgLong = 'This endpoint does not exist.';

class HttpConflictError extends HttpError {};
HttpConflictError.status = 409;
HttpConflictError.defaultCode = 'conflictError';
HttpConflictError.defaultMsgShort = 'Conflict.';
HttpConflictError.defaultMsgLong = 'The resource cannot be updated, possibly due to an update conflict.';

class HttpValidationError extends HttpError {};
HttpValidationError.status = 422;
HttpValidationError.defaultCode = 'validationFailed';
HttpValidationError.defaultMsgShort = 'Validation did not pass.';

class HttpInternalError extends HttpError {};
HttpInternalError.status = 500;
HttpInternalError.defaultCode = 'genericError';
HttpInternalError.defaultMsgShort = 'Something went wrong.';
HttpInternalError.defaultMsgLong = 'Something went wrong. Please contact the administrator.';

class HttpBadGatewayError extends HttpError {};
HttpBadGatewayError.status = 502;
HttpBadGatewayError.defaultCode = 'badGatewayError';
HttpBadGatewayError.defaultMsgShort = 'Bad gateway.';
HttpBadGatewayError.defaultMsgLong = 'Invalid response from an upstream server.';

class HttpServiceUnavailable extends HttpError {};
HttpServiceUnavailable.status = 503;
HttpServiceUnavailable.defaultCode = 'serviceUnavailable';
HttpServiceUnavailable.defaultMsgShort = 'Service unavailable.';
HttpServiceUnavailable.defaultMsgLong = 'Service is temporarily unavailable. Try again later.';

module.exports = {
  HttpError,
  Http404Error,
  HttpForbiddenError,
  HttpConflictError,
  HttpBadRequestError,
  HttpValidationError,
  HttpInternalError,
  HttpBadGatewayError,
  HttpServiceUnavailable,
};
