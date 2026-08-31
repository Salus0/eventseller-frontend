<script>
	import { onMount } from 'svelte';
	import { env } from '$env/dynamic/public';
	import { goto } from '$app/navigation';

	const backendUrl = env.PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app';
	let runs = [];
	let isLoading = true;
	let currentUserId = null;
	let authToken = '';

	// User-ID & Token aus Session / JWT laden
	function checkUserSession() {
		const token = localStorage.getItem('jwt_token');
		if (token) {
			authToken = token;
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
				
				// Liest die Discord-ID aus allen gängigen Token-Strukturen aus
				currentDiscordId = String(
					decoded.discord_id || decoded.discordId || decoded.sub || ''
				).trim();

				// Liest die ID & den Namen aus
				currentUserId = decoded.id || decoded.user_id || decoded.participant_id || null;
				currentUserName = String(decoded.name || decoded.username || decoded.sub || '').trim();

				console.log('Session Geladen:', { currentDiscordId, currentUserId, currentUserName });
			} catch (e) {
				console.error('Fehler beim Lesen des Tokens:', e);
			}
		}
	}
	
	function getAuthHeaders() {
		return {
			'Content-Type': 'application/json',
			...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
		};
	}

	async function loadRunDetails(runId) {
		try {
			const headers = getAuthHeaders();
			const [partsRes, itemsRes, summaryRes] = await Promise.all([
				fetch(`${backendUrl}/runs/${runId}/participants`, { headers }),
				fetch(`${backendUrl}/runs/${runId}/items`, { headers }),
				fetch(`${backendUrl}/runs/${runId}/summary`, { headers })
			]);

			let loadedParticipants = [];
			let loadedItems = [];
			let loadedSummary = null;

			if (partsRes.ok) loadedParticipants = await partsRes.json();
			if (itemsRes.ok) loadedItems = await itemsRes.json();
			if (summaryRes.ok) loadedSummary = await summaryRes.json();

			runs = runs.map(r => {
				if (r.id === runId) {
					return {
						...r,
						participants: Array.isArray(loadedParticipants) ? loadedParticipants : [],
						items: Array.isArray(loadedItems) ? loadedItems : [],
						summary: loadedSummary
					};
				}
				return r;
			});
		} catch (err) {
			console.error(`Fehler beim Laden der Details für Run ${runId}:`, err);
		}
	}

	async function loadRuns() {
		isLoading = true;
		try {
			const res = await fetch(`${backendUrl}/runs/`, {
				headers: getAuthHeaders()
			});

			if (res.status === 401) {
				console.error('Nicht autorisiert!');
				isLoading = false;
				return;
			}

			if (res.ok) {
				const loadedRuns = await res.json();
				runs = Array.isArray(loadedRuns) ? loadedRuns : [];
				await Promise.all(runs.map(r => loadRunDetails(r.id)));
			}
		} catch (err) {
			console.error('Fehler beim Laden der Runs:', err);
		} finally {
			isLoading = false;
		}
	}

	// Rein über participant_id / ID abgleichen
	function isUserInRun(run) {
		if (!run.participants || !Array.isArray(run.participants)) return false;

		return run.participants.some(p => {
			// 1. Felder aus dem Backend-Teilnehmerobjekt auslesen
			const pDbId = String(p.id ?? p.participant_id ?? p.user_id ?? '').trim();
			const pDiscordId = String(p.discord_id ?? p.discordId ?? '').trim();
			const pName = String(p.name ?? p.username ?? '').trim().toLowerCase();

			// 2. Gegen die JWT-Daten des eingeloggten Nutzers prüfen
			
			// Match 1: Discord-ID entspricht der Discord-ID im Token
			const matchDiscord = Boolean(
				currentDiscordId && 
				pDiscordId && 
				currentDiscordId === pDiscordId
			);

			// Match 2: Datenbank-ID entspricht der User/Participant-ID im Token
			const matchId = Boolean(
				currentUserId && 
				pDbId && 
				String(currentUserId) === pDbId
			);

			// Match 3: Name entspricht dem Namen im Token (Fallback)
			const matchName = Boolean(
				currentUserName && 
				pName && 
				currentUserName.toLowerCase() === pName
			);

			return matchDiscord || matchId || matchName;
		});
	}

	function getItemSalesInfo(run) {
		const items = run.items || [];
		const total = items.length;
		const sold = items.filter(i => Boolean(i.sale_price || i.price || i.actual_price)).length;
		return { sold, total, hasSales: sold > 0 };
	}

	function formatDate(dateString) {
		if (!dateString) return '';
		return new Date(dateString).toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
	}

	function formatZeny(amount) {
		return new Intl.NumberFormat('de-DE').format(amount || 0) + ' z';
	}

	function openRunDetails(runId) {
		goto(`/runs?open=${runId}`);
	}

	$: userRuns = runs
		.filter(run => isUserInRun(run))
		.sort((a, b) => new Date(b.created_at || b.date || 0) - new Date(a.created_at || a.date || 0));

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
		<section class="card">
			<h2>Meine aktiven Runs</h2>
			{#if userRuns.length > 0}
				<ul class="run-list">
					{#each userRuns as run}
						{@const sales = getItemSalesInfo(run)}
						<li class="run-item" on:click={() => openRunDetails(run.id)} role="button" tabindex="0">
							<div class="run-header">
								<strong class="run-name">{run.name}</strong>
								<span class="run-date">{formatDate(run.created_at || run.date)}</span>
							</div>

							<div class="run-details">
								{#if sales.hasSales}
									<span class="sales-progress">🛒 {sales.sold} / {sales.total} Items verkauft</span>
								{:else}
									<span class="no-sales">Keine Verkäufe</span>
								{/if}

								{#if run.summary}
									<span class="split-amount">Split: {formatZeny(run.summary.payout_per_player)}</span>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty-text">Du bist aktuell in keinen Runs eingetragen.</p>
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
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.run-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: #0f172a;
		padding: 1rem;
		border-radius: 6px;
		border-left: 4px solid #6366f1;
		cursor: pointer;
		transition: background-color 0.2s ease, transform 0.1s ease;
	}
	.run-item:hover {
		background: #1e293b;
		transform: translateY(-2px);
	}
	.run-header {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.run-name {
		font-size: 1rem;
		color: #f8fafc;
	}
	.run-date {
		font-size: 0.8rem;
		color: #94a3b8;
	}
	.run-details {
		display: flex;
		align-items: center;
		gap: 1.5rem;
	}
	.sales-progress {
		font-size: 0.85rem;
		color: #38bdf8;
	}
	.no-sales {
		font-size: 0.85rem;
		color: #64748b;
	}
	.split-amount {
		color: #fbbf24;
		font-weight: 600;
		font-size: 0.95rem;
	}
	.empty-text, .status {
		color: #94a3b8;
		font-style: italic;
	}
</style>