<script lang="ts">
	import type { Plugin } from 'chart.js';
		import { ArcElement, Chart, DoughnutController, Legend, Tooltip } from 'chart.js';
		import { m } from '$lib/paraglide/messages';
	
		Chart.register(DoughnutController, ArcElement, Tooltip, Legend);
	
		let { eaten, goal }: { eaten: number; goal: number } = $props();
	
		let canvas: HTMLCanvasElement | undefined = $state();
		let chartInstance: Chart | undefined = $state();
	
		const centerTextPlugin: Plugin = {
			id: 'centerText',
			beforeDraw(chart) {
				const { ctx, width, height } = chart;
				const opts = (chart.options.plugins as Record<string, Record<string, string> | undefined>)
					?.centerText;
				if (!opts) return;
	
				ctx.save();
				const centerX = width / 2;
				const centerY = height / 2;
	
				ctx.font = 'bold 1.5rem sans-serif';
				ctx.fillStyle = 'var(--color-foreground)';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(opts.text ?? '', centerX, centerY - 10);
	
				ctx.font = '0.8rem sans-serif';
				ctx.fillStyle = 'var(--color-muted-foreground)';
				ctx.fillText(opts.subtext ?? '', centerX, centerY + 14);
	
				ctx.restore();
			}
		};
	
		function buildData(e: number, g: number) {
			const over = e > g;
			return over
				? {
						labels: [m.doughnut_over()],
						datasets: [{ data: [e], backgroundColor: ['#ef4444'], borderWidth: 0 }]
					}
				: {
						labels: [m.doughnut_eaten(), m.doughnut_remaining()],
						datasets: [{ data: [e, g - e], backgroundColor: ['#22c55e', '#e5e7eb'], borderWidth: 0 }]
					};
		}
	
		function buildOptions(e: number, g: number) {
			const over = e > g;
			const subtext = over
				? m.doughnut_center_over({ over: e - g })
				: m.doughnut_center_normal({ goal: g });
			return {
				responsive: true,
				maintainAspectRatio: true,
				cutout: '75%',
				animation: false,
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							label: (ctx: { label?: string; parsed: number }) => `${ctx.label}: ${ctx.parsed} kcal`
						}
					},
					centerText: { text: `${e}`, subtext }
				}
			} as any;
		}
	
		$effect(() => {
			if (!canvas) return;
	
			const snap = $state.snapshot({ eaten, goal });
	
			if (chartInstance) {
				chartInstance.data = buildData(snap.eaten, snap.goal);
				chartInstance.options = { ...chartInstance.options, ...buildOptions(snap.eaten, snap.goal) };
				chartInstance.update();
				return;
			}
	
			chartInstance = new Chart(canvas, {
				type: 'doughnut',
				data: buildData(snap.eaten, snap.goal),
				options: buildOptions(snap.eaten, snap.goal),
				plugins: [centerTextPlugin]
			});
		});
	
		$effect(() => () => chartInstance?.destroy());
</script>

<div class="mx-auto w-48 h-48 sm:w-56 sm:h-56">
	<canvas bind:this={canvas}></canvas>
</div>
