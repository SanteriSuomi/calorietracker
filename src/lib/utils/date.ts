const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(d: string): boolean {
	if (!DATE_RE.test(d)) return false;
	const [y, m, day] = d.split('-').map(Number);
	const dt = new Date(y, m - 1, day);
	return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === day;
}

export function today(): string {
	const dt = new Date();
	return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function addDays(d: string, days: number): string {
	const [y, m, day] = d.split('-').map(Number);
	const dt = new Date(y, m - 1, day + days);
	return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function formatDate(d: string): string {
	const [y, m, day] = d.split('-').map(Number);
	return new Date(y, m - 1, day).toLocaleDateString('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	});
}
