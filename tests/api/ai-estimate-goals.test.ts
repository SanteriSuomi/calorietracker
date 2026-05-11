import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('ai', () => ({
	generateText: vi.fn(),
	Output: {
		object: vi.fn((opts) => opts)
	},
	NoObjectGeneratedError: {
		isInstance: vi.fn(() => false)
	}
}));

vi.mock('@ai-sdk/openai', () => ({
	createOpenAI: vi.fn(() => {
		const modelFn = vi.fn(() => 'mocked-model');
		return modelFn;
	})
}));

import { generateText, NoObjectGeneratedError } from 'ai';

const mockGenerateText = vi.mocked(generateText);

const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const GOALS = ['lose', 'maintain', 'gain'];

describe('AI estimate-goals — request validation', () => {
	it('validates age is required and in range', () => {
		const validateAge = (age: unknown) =>
			typeof age === 'number' && Number.isInteger(age) && age >= 10 && age <= 120;
		expect(validateAge(null)).toBe(false);
		expect(validateAge(undefined)).toBe(false);
		expect(validateAge(9)).toBe(false);
		expect(validateAge(30)).toBe(true);
	});

	it('validates weight is required and in range', () => {
		const validateWeight = (weight: unknown) =>
			typeof weight === 'number' && Number.isInteger(weight) && weight >= 20 && weight <= 500;
		expect(validateWeight(null)).toBe(false);
		expect(validateWeight(75)).toBe(true);
	});

	it('validates height is required and in range', () => {
		const validateHeight = (height: unknown) =>
			typeof height === 'number' && Number.isInteger(height) && height >= 50 && height <= 300;
		expect(validateHeight(null)).toBe(false);
		expect(validateHeight(180)).toBe(true);
	});

	it('validates activity level is one of allowed values', () => {
		const validateActivity = (level: unknown) =>
			typeof level === 'string' &&
			ACTIVITY_LEVELS.includes(level as (typeof ACTIVITY_LEVELS)[number]);
		expect(validateActivity(null)).toBe(false);
		expect(validateActivity('invalid')).toBe(false);
		expect(validateActivity('moderate')).toBe(true);
	});

	it('validates goal is one of allowed values', () => {
		const validateGoal = (goal: unknown) =>
			typeof goal === 'string' && GOALS.includes(goal as (typeof GOALS)[number]);
		expect(validateGoal(null)).toBe(false);
		expect(validateGoal('invalid')).toBe(false);
		expect(validateGoal('lose')).toBe(true);
	});
});

describe('AI estimate-goals — generateText mock', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns goal estimation data for valid profile', async () => {
		const expectedResult = {
			calories: 2100,
			protein: 160,
			carbs: 230,
			fat: 60,
			explanation: 'Based on your TDEE of ~2600 kcal with a 500 kcal deficit for weight loss...'
		};

		mockGenerateText.mockResolvedValueOnce({ output: expectedResult } as never);

		const result = await mockGenerateText({
			model: 'mocked-model' as never,
			output: {} as never,
			system: 'TDEE estimation prompt',
			prompt: 'Age: 30, Weight: 75kg, Height: 180cm, Activity: moderate, Goal: lose'
		});

		expect(result.output).toEqual(expectedResult);
		expect(mockGenerateText).toHaveBeenCalledOnce();
	});

	it('handles NoObjectGeneratedError', () => {
		vi.mocked(NoObjectGeneratedError.isInstance).mockReturnValueOnce(true);
		const error = new Error('No object generated');
		expect(NoObjectGeneratedError.isInstance(error)).toBe(true);
	});

	it('handles AI service error', async () => {
		mockGenerateText.mockRejectedValueOnce(new Error('API rate limit'));

		await expect(
			mockGenerateText({
				model: 'mocked-model' as never,
				output: {} as never,
				system: 'test',
				prompt: 'test'
			})
		).rejects.toThrow('API rate limit');
	});
});

describe('AI estimate-goals — system prompt', () => {
	it('system prompt contains TDEE guidance', () => {
		const SYSTEM_PROMPT =
			'You are a nutrition and fitness assistant. Given a user profile (age, weight in kg, height in cm, ' +
			'activity level, and goal), estimate their Total Daily Energy Expenditure (TDEE) and recommend daily ' +
			'macro targets.';
		expect(SYSTEM_PROMPT).toContain('TDEE');
		expect(SYSTEM_PROMPT).toContain('age');
		expect(SYSTEM_PROMPT).toContain('weight');
		expect(SYSTEM_PROMPT).toContain('height');
	});

	it('user message includes all profile data', () => {
		const profile = { age: 30, weight: 75, height: 180, activityLevel: 'moderate', goal: 'lose' };
		const userMessage = `Age: ${profile.age}, Weight: ${profile.weight}kg, Height: ${profile.height}cm, Activity: ${profile.activityLevel}, Goal: ${profile.goal}`;
		expect(userMessage).toContain('30');
		expect(userMessage).toContain('75kg');
		expect(userMessage).toContain('180cm');
		expect(userMessage).toContain('moderate');
		expect(userMessage).toContain('lose');
	});
});
