<svelte:head>
    <title>Yggdrasil Event Sales</title>
</svelte:head>

<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';

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

<div class="layout-wrapper">
<header class="navbar">
  <div class="nav-container">
    <a href="/" class="brand">
      <span>Yggdrasil Event Sales</span>
    </a>

    <nav class="nav-links">
      <a href="/" class:active={$page.url.pathname === '/'}>Dashboard</a>
      <a href="/runs" class:active={$page.url.pathname.startsWith('/runs')}>Runs</a>
      <a href="/items" class:active={$page.url.pathname.startsWith('/items')}>Items</a>
      <a href="/participants" class:active={$page.url.pathname.startsWith('/participants')}>Teilnehmer</a>
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
          <button on:click={logout} class="btn btn-secondary btn-small">Logout</button>
        </div>
      {:else}
        <a href="{PUBLIC_BACKEND_URL}/auth/login" class="btn btn-primary">
          Login
        </a>
      {/if}
    </div>
  </div>
</header>

<main class="page-content">
  <slot />
</main>

  <footer class="footer">
    <div class="footer-container">
      <div class="footer-info">
        <span class="footer-brand">Event-Seller</span>
        <p class="footer-description">
          Organisiert deine Drops, Verkäufe und Auszahlungen für Ragnarok-Events.
        </p>
      </div>
      <p class="footer-copyright">
        &copy; {new Date().getFullYear()} Saluso & Arlix. Alle Rechte vorbehalten.
      </p>
    </div>
  </footer>
</div>