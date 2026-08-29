<script>
	import { onMount } from 'svelte';
	import { env } from '$env/dynamic/public';

	const backendUrl = env.PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app';
	let runs = [];
	let isLoading = true;
	let currentUserName = '';
	let currentUserId = null;
	let currentDiscordId = '';

	// Token decodieren, um den eingeloggten User zu identifizieren
	function checkUserSession() {
		const token = localStorage.getItem('jwt_token');
		if (token) {
			try {
				const base64Url = token.split('.')[1];
				const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
				const jsonPayload = decodeURIComponent(
					atob(base64)
						.split('')
						.map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
						.join('')
				);
				const decoded = JSON.parse(jsonPayload);
				
				currentUserName = decoded.sub || decoded.name || decoded.username || '';
				currentUserId = decoded.id || decoded.userId || decoded.user_id || null;
				currentDiscordId = String(decoded.discord_id || decoded.discordId || '').trim();
			} catch (e) {
				console.error('Fehler beim Lesen des Tokens:', e);
			}
		}
	}

	// Alle Runs vom Backend laden
	async function loadRuns() {
		try {
			const res = await fetch(`${backendUrl}/runs/`);
			if (res.ok) {
				runs = await res.json();
			}
		} catch (err) {
			console.error('Fehler beim Laden der Runs:', err);
		} finally {
			isLoading = false;
		}
	}

	// Prüfen, ob der eingeloggte User Teilnehmer in diesem Run ist
	function isUserInRun(run) {
		if (!run.participants || !Array.isArray(run.participants)) return false;

		return run.participants.some(p => {
			// Falls der Teilnehmer verschachtelt ist (z.B. p.participant.name)
			const pObj = p.participant || p;
			
			const pId = p.participant_id || pObj.id || p.id;
			const pDiscordId = String(pObj.discord_id || pObj.discordId || p.discord_id || '').trim();
			const pName = (pObj.name || p.name || '').trim().toLowerCase();

			// 1. Match über Datenbank ID
			if (currentUserId && String(pId) === String(currentUserId)) return true;

			// 2. Match über Discord ID
			if (currentDiscordId && pDiscordId && currentDiscordId === pDiscordId) return true;

			// 3. Match über Name (Fallback)
			if (currentUserName && pName && currentUserName.toLowerCase() === pName) return true;

			return false;
		});
	}

	// Filter: Nur Runs des aktuellen Users
	$: userRuns = runs.filter(run => isUserInRun(run));

	// Unterteilung in Offen und Abgeschlossen
	$: openRuns = userRuns.filter(run => run.status !== 'completed' && run.status !== 'geschlossen');
	$: finishedRuns = userRuns.filter(run => run.status === 'completed' || run.status === 'geschlossen');

	onMount(() => {
		checkUserSession();
		loadRuns();
	});
</script>

<main class="container">
	<h1>Mein Dashboard</h1>

	{#if isLoading}
		<p class="status">Lade deine Runs...</p>
	{:else}
		<!-- SEKTION 1: OFFEN -->
		<section class="card">
			<h2>⏳ Offene Runs (Items im Verkauf / Auszahlung ausstehend)</h2>
			{#if openRuns.length > 0}
				<ul class="run-list">
					{#each openRuns as run}
						<li class="run-item open">
							<div class="run-info">
								<strong>{run.name}</strong>
								<span class="badge status-open">{run.status || 'In Bearbeitung'}</span>
							</div>
							<span class="date">{run.date || ''}</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty-text">Keine offenen Runs, bei denen du beteiligt bist.</p>
			{/if}
		</section>

		<!-- SEKTION 2: ABGESCHLOSSENE RUNS -->
		<section class="card">
			<h2>✅ Abgeschlossene Runs</h2>
			{#if finishedRuns.length > 0}
				<ul class="run-list">
					{#each finishedRuns as run}
						<li class="run-item finished">
							<div class="run-info">
								<strong>{run.name}</strong>
								<span class="badge status-finished">Abgeschlossen</span>
							</div>
							<span class="date">{run.date || ''}</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty-text">Noch keine abgeschlossenen Runs vorhanden.</p>
			{/if}
		</section>
	{/if}
</main>

<style>
	.container {
		max-width: 800px;
		margin: 2rem auto;
		font-family: sans-serif;
		padding: 0 1rem;
		color: #f8fafc;
	}
	h1 {
		color: #fbbf24;
		margin-bottom: 1.5rem;
	}
	.card {
		background: #1e293b;
		border: 1px solid #334155;
		padding: 1.5rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
	}
	h2 {
		font-size: 1.1rem;
		color: #f8fafc;
		margin-top: 0;
		margin-bottom: 1rem;
	}
	.run-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.run-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: #0f172a;
		padding: 0.8rem 1rem;
		border-radius: 6px;
		margin-bottom: 0.5rem;
		border-left: 4px solid #6366f1;
	}
	.run-item.open {
		border-left-color: #d97706;
	}
	.run-item.finished {
		border-left-color: #059669;
	}
	.run-info {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.badge {
		font-size: 0.75rem;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		font-weight: 600;
	}
	.status-open {
		background: rgba(217, 119, 6, 0.2);
		color: #fbbf24;
	}
	.status-finished {
		background: rgba(5, 150, 105, 0.2);
		color: #34d399;
	}
	.date {
		color: #94a3b8;
		font-size: 0.85rem;
	}
	.empty-text, .status {
		color: #94a3b8;
		font-style: italic;
	}
</style>