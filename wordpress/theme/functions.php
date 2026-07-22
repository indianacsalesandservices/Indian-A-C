<?php
function indianac_setup() {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    register_nav_menu('primary', 'Primary Menu');
}
add_action('after_setup_theme', 'indianac_setup');

function indianac_assets() {
    wp_enqueue_style('indianac-style', get_stylesheet_uri());
}
add_action('wp_enqueue_scripts', 'indianac_assets');
