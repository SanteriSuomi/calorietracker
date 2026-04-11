import { describe, it, expect } from 'vitest';
import { MEAL_SOURCES, DEFAULT_CALORIE_GOAL } from '$lib/server/db/shared/constants';

describe('shared constants', () => {
	it('has correct meal source values', () => {
		expect(MEAL_SOURCES).toEqual(['manual', 'ai_text', 'ai_vision', 'ai_text_vision']);
	});

	it('has correct default calorie goal', () => {
		expect(DEFAULT_CALORIE_GOAL).toBe(2000);
	});
});
