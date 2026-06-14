const path = require("path");

const EXACT_PROBE_PATHS = new Set([
  "/.env",
  "/.env.local",
  "/.env.production",
  "/.git/config",
  "/wp-login.php",
  "/xmlrpc.php",
]);

const PREFIX_PROBE_PATHS = [
  "/.git/",
  "/wp-admin",
  "/wp-content",
  "/wp-includes",
  "/phpmyadmin",
  "/phpMyAdmin",
  "/pma/",
  "/administrator",
  "/.aws/",
  "/actuator",
  "/vendor/phpunit",
  "/cgi-bin/",
  "/.vscode/",
  "/server-status",
];

const SCRIPT_PROBE_EXTENSIONS = /\.(php|asp|aspx|jsp|cgi)$/i;

function normalizePathname(pathname) {
  if (!pathname || typeof pathname !== "string") {
    return "";
  }
  const withoutQuery = pathname.split("?")[0];
  const normalized = path.posix.normalize(withoutQuery);
  if (normalized === "." || normalized === "/") {
    return "/";
  }
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function isScannerProbePath(pathname) {
  const normalized = normalizePathname(pathname);
  if (!normalized || normalized === "/") {
    return false;
  }

  if (EXACT_PROBE_PATHS.has(normalized)) {
    return true;
  }

  const lower = normalized.toLowerCase();

  if (PREFIX_PROBE_PATHS.some((prefix) => lower.startsWith(prefix.toLowerCase()))) {
    return true;
  }

  if (lower.includes("/.env") || lower.includes("/.git")) {
    return true;
  }

  if (SCRIPT_PROBE_EXTENSIONS.test(lower)) {
    return true;
  }

  return false;
}

module.exports = { isScannerProbePath };