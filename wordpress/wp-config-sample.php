<?php
define('DB_NAME', getenv('DB_NAME') ?: 'wordpress');
define('DB_USER', getenv('DB_USER') ?: 'wpuser');
define('DB_PASSWORD', getenv('DB_PASSWORD') ?: 'wpsecret');
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_CHARSET', 'utf8');
define('DB_COLLATE', '');

$table_prefix = getenv('WP_TABLE_PREFIX') ?: 'wp_';

define('WP_DEBUG', false);

if (!defined('ABSPATH')) {
    define('ABSPATH', __DIR__ . '/');
}
require_once ABSPATH . 'wp-settings.php';
