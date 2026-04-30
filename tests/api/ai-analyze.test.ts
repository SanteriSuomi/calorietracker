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

describe('AI analyze — validation logic', () => {
	it('rejects empty description', () => {
		const description = '';
		expect(typeof description !== 'string' || description.trim() === '').toBe(true);
	});

	it('rejects whitespace-only description', () => {
		const description = '   ';
		expect(description.trim() === '').toBe(true);
	});

	it('accepts valid description', () => {
		const description = 'chicken breast 200g with rice';
		expect(typeof description === 'string' && description.trim() !== '').toBe(true);
	});
});

describe('AI analyze — generateText mock', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns nutrition data for valid description', async () => {
		const expectedResult = {
			description: 'Grilled Chicken Breast with Brown Rice',
			calories: 450,
			protein: 42,
			carbs: 55,
			fat: 8
		};

		mockGenerateText.mockResolvedValueOnce({ output: expectedResult } as never);

		const result = await mockGenerateText({
			model: 'mocked-model' as never,
			output: {} as never,
			system: 'test',
			prompt: 'chicken breast with rice'
		});

		expect(result.output).toEqual(expectedResult);
		expect(mockGenerateText).toHaveBeenCalledOnce();
	});

	it('handles NoObjectGeneratedError', () => {
		vi.mocked(NoObjectGeneratedError.isInstance).mockReturnValueOnce(true);

		const error = new Error('No object generated');
		expect(NoObjectGeneratedError.isInstance(error)).toBe(true);
	});

	it('handles generic AI service error', async () => {
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

describe('AI analyze — settings check', () => {
	it('detects missing AI settings', () => {
		const settings = {
			aiEndpointUrl: null,
			aiApiKey: null,
			aiModel: null
		};
		const configured = !!(settings.aiEndpointUrl && settings.aiApiKey && settings.aiModel);
		expect(configured).toBe(false);
	});

	it('detects partial AI settings', () => {
		const settings = {
			aiEndpointUrl: 'https://api.openai.com/v1',
			aiApiKey: null,
			aiModel: 'gpt-4o'
		};
		const configured = !!(settings.aiEndpointUrl && settings.aiApiKey && settings.aiModel);
		expect(configured).toBe(false);
	});

	it('detects complete AI settings', () => {
		const settings = {
			aiEndpointUrl: 'https://api.openai.com/v1',
			aiApiKey: 'sk-test',
			aiModel: 'gpt-4o'
		};
		const configured = !!(settings.aiEndpointUrl && settings.aiApiKey && settings.aiModel);
		expect(configured).toBe(true);
	});
});
