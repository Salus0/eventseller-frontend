<script>
  import { onMount } from 'svelte';

  export let data;

  let user = null;

  // Hilfsfunktion zum Dekodieren des JWT-Tokens ohne externe Library
  function parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  function checkLogin() {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      const decoded = parseJwt(token);
      // Prüfen, ob das Token noch nicht abgelaufen ist
      if (decoded && decoded.exp * 1000 > Date.now()) {
        user = decoded;
      } else {
        localStorage.removeItem('jwt_token');
        user = null;
      }
    }
  }

  function logout() {
    localStorage.removeItem('jwt_token');
    user = null;
    window.location.reload();
  }

  onMount(() => {
    checkLogin();
  });
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
      {#if user}
        <div class="user-profile">
          {#if user.avatar}
            <img 
              src="https://cdn.discordapp.com/avatars/{user.sub}/{user.avatar}.png" 
              alt={user.username} 
              class="avatar" 
            />
          {/if}
          <span class="username">{user.username}</span>
          {#if user.role === 'admin'}
            <span class="badge admin">Admin</span>
          {/if}
          <button on:click={logout} class="logout-btn">Logout</button>
        </div>
      {:else}
        <a href="https://yggdrasil-eventseller-backend.up.railway.app/auth/login" class="login-btn">
          Login
        </a>
      {/if}
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

  .nav-actions {
    display: flex;
    align-items: center;
  }

  /* User Profile Styling */
  .user-profile {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: white;
  }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
  }

  .username {
    font-weight: 600;
    font-size: 0.95rem;
  }

  .badge.admin {
    background-color: #ef4444;
    color: white;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .logout-btn {
    background-color: transparent;
    border: 1px solid #475569;
    color: #cbd5e1;
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .logout-btn:hover {
    background-color: #334155;
    color: white;
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