<script>
	import { onMount } from 'svelte';

	// Backend-URL (Kannst du hier fest eintragen oder dynamisch steuern)
	import { env } from '$env/dynamic/public';
  const backendUrl = env.PUBLIC_BACKEND_URL;
	let runs = [];
	let selectedRunId = null;
	let newRunName = '';

	// Daten vom Railway-Backend laden
	async function loadRuns() {
		try {
			const res = await fetch(`${backendUrl}/runs/`);
			if (res.ok) {
				runs = await res.json();
			}
		} catch (err) {
			console.error('Fehler beim Laden der Runs:', err);
		}
	}

	async function createRun() {
		if (!newRunName) return;
		try {
			const res = await fetch(`${backendUrl}/runs/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newRunName })
			});
			if (res.ok) {
				newRunName = '';
				await loadRuns();
			}
		} catch (err) {
			console.error('Fehler beim Erstellen:', err);
		}
	}

	onMount(() => {
		loadRuns();
	});
</script>

<main class="container">
	<h1>Ragnarok Event-Verkäufe</h1>

	<section class="card">
		<h2>Neuen Event-Run starten</h2>
		<div class="form-group">
			<input type="text" bind:value={newRunName} placeholder="z. B. Endless Tower 04.08." />
			<button on:click={createRun}>Run anlegen</button>
		</div>
	</section>

	<section class="card">
		<h2>Vorhandene Runs</h2>
		<ul>
			{#each runs as run}
				<li>
					<strong>{run.name}</strong> ({run.status})
				</li>
			{:else}
				<p>Noch keine Runs vorhanden.</p>
			{/each}
		</ul>
	</section>
</main>

<style>
	.container {
		max-width: 800px;
		margin: 2rem auto;
		font-family: sans-serif;
		padding: 0 1rem;
	}
	.card {
		background: #f4f4f9;
		padding: 1.5rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
	}
	.form-group {
		display: flex;
		gap: 0.5rem;
	}
	input {
		flex: 1;
		padding: 0.5rem;
	}
	button {
		padding: 0.5rem 1rem;
		background: #0070f3;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}
</style>
