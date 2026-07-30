// Wraps an async Express route handler so a rejected promise (e.g. a failed
// DB query) is forwarded to Express's error-handling middleware instead of
// becoming an unhandled promise rejection.
//
// Without this, a single failed query crashes the whole Node process (Node
// terminates on unhandled rejections by default) -- which is especially
// confusing in Docker, where `restart: unless-stopped` just silently
// restarts the container, making it look fine again until the same request
// crashes it a second time.
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
