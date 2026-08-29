<script>
  export let data;
</script>

<header class="navbar">
  <div class="nav-container">
    <a href="/" class="brand">
      ⚔️ <span>RO Event Sales</span>
    </a>

    <nav class="nav-links">
      <a href="/">Dashboard</a>
      <a href="/runs">Runs</a>
      <a href="/items">Items</a>
      <a href="/participants">Teilnehmer</a>
    </nav>

    <div class="nav-actions">
      <a href="https://yggdrasil-eventseller-backend.up.railway.app/auth/login" class="login-btn">Login</a>
    </div>
  </div>
</header>

<main class="page-content">
  <slot />
</main>

<style>
  /* Globales Styling für die gesamte App */
  :global(body) {
    margin: 0;
    padding: 0;
    background-color: #0f172a; /* Slate 900 Dunkelgrau/Blau */
    color: #f8fafc;
    font-family: system-ui, -apple-system, sans-serif;
    min-height: 100vh;
  }

  /* Navigation Bar styling */
  .navbar {
    background-color: #1e293b; /* Slate 800 */
    border-bottom: 1px solid #334155;
    position: sticky;
    top: 0;
    z-index: 50;
  }

  .nav-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0.75rem 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 700;
    font-size: 1.125rem;
    color: #fbbf24; /* Amber Gold */
    text-decoration: none;
  }

  .nav-links {
    display: flex;
    gap: 1.5rem;
  }

  .nav-links a {
    color: #94a3b8;
    text-decoration: none;
    font-size: 0.95rem;
    font-weight: 500;
    transition: color 0.2s;
  }

  .nav-links a:hover {
    color: #f8fafc;
  }

  .login-btn {
    background-color: #d97706; /* Amber Button */
    color: white;
    padding: 0.4rem 1rem;
    border-radius: 6px;
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 600;
    transition: background-color 0.2s;
  }

  .login-btn:hover {
    background-color: #b45309;
  }

  /* Container für alle Seiten-Inhalte */
  .page-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1.5rem;
  }
</style>
