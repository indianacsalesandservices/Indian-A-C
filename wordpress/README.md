# WordPress Site for Indian A/C Sales & Services

## Run Locally with Docker

1. Setup:
   ```
   copy .env.example .env
   ```

2. Start WordPress + MySQL:
   ```
   docker-compose up -d
   ```

3. Visit http://localhost:8080 and complete WordPress install

4. Activate custom theme:
   - Login to /wp-admin
   - Appearance > Themes > Indian A/C > Activate

## Deploy to Production

### Option 1: Traditional Hosting (Hostinger, Namecheap, etc.)
1. Install WordPress via cPanel Softaculous/one-click
2. Upload `theme/` folder to `/wp-content/themes/indian-ac/`
3. Activate theme from WordPress admin

### Option 2: Deploy to Render (MySQL required)
- WordPress needs MySQL (NOT PostgreSQL/Supabase)
- Use Render's MySQL or a separate MySQL provider

### Option 3: Upload to Public Hosting
1. Download WordPress from wordpress.org
2. Configure `wp-config.php` with your MySQL credentials
3. Upload via FTP/File Manager
4. Run the install wizard

## Note
This WordPress site is separate from the Flask app.
- Flask app: handles billing, attendance, employees
- WordPress: handles company website/marketing

## Custom Theme
The custom theme is at `theme/` and automatically mounts via Docker.
