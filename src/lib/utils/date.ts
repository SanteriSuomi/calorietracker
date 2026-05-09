import { getLocale } from '$lib/paraglide/runtime';

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
	return new Date(y, m - 1, day).toLocaleDateString(getLocale(), {
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	});
}

function pad(n: number): string {
	return String(n).padStart(2, '0');
}

export function addMonths(d: string, months: number): string {
	const [y, m, day] = d.split('-').map(Number);
	const dt = new Date(y, m - 1 + months, day);
	return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function getDaysInMonth(year: number, month: number): number {
	return new Date(year, month, 0).getDate();
}

export function getFirstDayOfWeek(year: number, month: number): number {
	return new Date(year, month - 1, 1).getDay();
}

export function toDateString(year: number, month: number, day: number): string {
	return `${year}-${pad(month)}-${pad(day)}`;
}

export function formatMonthYear(monthStr: string): string {
	const [y, m] = monthStr.split('-').map(Number);
	return new Date(y, m - 1, 1).toLocaleDateString(getLocale(), {
		month: 'long',
		year: 'numeric'
	});
}

export function startOfMonth(d: string): string {
	return `${d.slice(0, 7)}-01`;
}

export function endOfMonth(d: string): string {
	const [y, m] = d.split('-').map(Number);
	return toDateString(y, m, getDaysInMonth(y, m));
}
