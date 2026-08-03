<script>
  const backend = import.meta.env.PUBLIC_BACKEND_URL;
  const discordUrl = `${backend}/auth/discord`;
</script>

<h1>Login</h1>

<a href={discordUrl}>
  <button>Mit Discord einloggen</button>
</a>
