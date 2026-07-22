<?php get_header(); ?>

<main class="site-main">
  <section class="hero">
    <h1><?php bloginfo('name'); ?></h1>
    <p><?php bloginfo('description'); ?></p>
  </section>

  <section class="services">
    <h2>Our Services</h2>
    <div class="service-grid">
      <div class="service-card">
        <h3>AC Sales</h3>
        <p>Premium air conditioning units from top brands</p>
      </div>
      <div class="service-card">
        <h3>AC Service & Repair</h3>
        <p>Professional maintenance and repair services</p>
      </div>
      <div class="service-card">
        <h3>Installation</h3>
        <p>Expert installation for all AC types</p>
      </div>
    </div>
  </section>

  <section class="about">
    <h2>About Us</h2>
    <p>Indian A/C Sales & Services is your trusted partner for all air conditioning needs.</p>
  </section>

  <section class="contact">
    <h2>Contact Us</h2>
    <p>Get in touch for quotes and service requests.</p>
    <?php echo do_shortcode('[contact-form-7]'); ?>
  </section>
</main>

<?php get_footer(); ?>
