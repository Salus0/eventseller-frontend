<script>
	import { onMount } from 'svelte';
	import { env } from '$env/dynamic/public';
	import { goto } from '$app/navigation';

	const backendUrl = env.PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app';
	let runs = [];
	let isLoading = true;
	let authToken = '';
	let currentDiscordId = '';

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
				currentDiscordId = String(decoded.discord_id || decoded.discordId || decoded.sub || '').trim();
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
			const [partsRes, itemsRes, salesRes, summaryRes] = await Promise.all([
				fetch(`${backendUrl}/runs/${runId}/participants`, { headers }),
				fetch(`${backendUrl}/runs/${runId}/items`, { headers }),
				fetch(`${backendUrl}/runs/${runId}/sales`, { headers }),
				fetch(`${backendUrl}/runs/${runId}/summary`, { headers })
			]);

			let loadedParticipants = [];
			let loadedItems = [];
			let loadedSales = [];
			let loadedSummary = null;

			if (partsRes.ok) loadedParticipants = await partsRes.json();
			if (itemsRes.ok) loadedItems = await itemsRes.json();
			if (salesRes.ok) loadedSales = await salesRes.json();
			if (summaryRes.ok) loadedSummary = await summaryRes.json();

			runs = runs.map(r => {
				if (r.id === runId) {
					return {
						...r,
						participants: Array.isArray(loadedParticipants) ? loadedParticipants : [],
						items: Array.isArray(loadedItems) ? loadedItems : [],
						sales: Array.isArray(loadedSales) ? loadedSales : [],
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

	function isUserInRun(run) {
		if (!currentDiscordId || !run?.participants || !Array.isArray(run.participants)) {
			return false;
		}

		return run.participants.some(p => {
			const pDiscordId = String(p.discord_id || p.discordId || '').trim();
			return pDiscordId !== '' && pDiscordId === currentDiscordId;
		});
	}

	function getItemSalesInfo(run) {
		const totalDrops = (run.items || []).reduce((sum, item) => sum + (Number(item.quantity || item.amount) || 1), 0);
		const totalSold = (run.sales || []).reduce((sum, sale) => sum + (Number(sale.quantity) || 1), 0);
		
		return { 
			sold: totalSold, 
			total: totalDrops
		};
	}

	// 1:1 LOGIK AUS DER RUNS-SEITE
	function getRunStatusInfo(run) {
		const items = run.items || [];
		const participants = run.participants || [];

		const totalItems = items.length;
		const soldItems = (run.sales || []).length;
		const allItemsSold = totalItems > 0 && soldItems >= totalItems;

		const totalParticipants = participants.length;
		const paidParticipants = participants.filter(p => p.is_paid).length;
		const allPaidOut = totalParticipants > 0 && paidParticipants === totalParticipants;

		if (allItemsSold && allPaidOut) {
			return { label: 'Close', cssClass: 'status-close' };
		}
		if (allItemsSold) {
			return { label: 'Payout', cssClass: 'status-payout' };
		}
		if (soldItems > 0) {
			return { label: 'On Sale', cssClass: 'status-onsale' };
		}
		return { label: 'Open', cssClass: 'status-open' };
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
						{@const status = getRunStatusInfo(run)}
						<li class="run-item" on:click={() => openRunDetails(run.id)} role="button" tabindex="0">
							<div class="run-header">
								<div class="run-title-line">
									<strong class="run-name">{run.name}</strong>
									<span class="badge {status.cssClass}">
										{status.label}
									</span>
								</div>
								<span class="run-date">{formatDate(run.created_at || run.date)}</span>
							</div>

							<div class="run-details">
								{#if sales.total > 0}
									<span class="sales-progress">🛒 {sales.sold} / {sales.total} Items verkauft</span>
								{:else if sales.sold > 0}
									<span class="sales-progress">🛒 {sales.sold} Items verkauft</span>
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
	.run-title-line {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.run-name {
		font-size: 1rem;
		color: #f8fafc;
	}
	
	/* EXAKTE FARB-CLASSES DER RUNS-SEITE */
	.badge { 
		color: white; 
		font-size: 0.75rem; 
		font-weight: 600; 
		padding: 0.25rem 0.6rem; 
		border-radius: 4px; 
		text-transform: capitalize; 
	}
	.status-open { background-color: #059669; }     /* Grün */
	.status-onsale { background-color: #d97706; }   /* Gelb/Orange */
	.status-payout { background-color: #ca8a04; }   /* Gelb */
	.status-close { background-color: #dc2626; }    /* Rot */

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