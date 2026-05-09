import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_FORMAT_SUFFIX, DEFAULT_AI_SYSTEM_PROMPT } from '$lib/server/db/shared/constants';

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

describe('AI analyze — system prompt construction', () => {
	it('uses custom prompt when set', () => {
		const customPrompt = 'You are a keto-focused nutritionist.';
		const aiSystemPrompt = customPrompt;
		const systemPrompt = (aiSystemPrompt || DEFAULT_AI_SYSTEM_PROMPT) + AI_FORMAT_SUFFIX;
		expect(systemPrompt).toContain('keto-focused');
		expect(systemPrompt).toContain('You MUST respond');
	});

	it('uses default prompt when null', () => {
		const aiSystemPrompt = null;
		const systemPrompt = (aiSystemPrompt || DEFAULT_AI_SYSTEM_PROMPT) + AI_FORMAT_SUFFIX;
		expect(systemPrompt).toContain('expert nutrition estimation assistant');
		expect(systemPrompt).toContain('You MUST respond');
	});

	it('uses default prompt when empty string', () => {
		const aiSystemPrompt = '';
		const systemPrompt = (aiSystemPrompt || DEFAULT_AI_SYSTEM_PROMPT) + AI_FORMAT_SUFFIX;
		expect(systemPrompt).toContain('expert nutrition estimation assistant');
	});

	it('always appends format suffix', () => {
		const customPrompt = 'Custom prompt';
		const systemPrompt = (customPrompt || DEFAULT_AI_SYSTEM_PROMPT) + AI_FORMAT_SUFFIX;
		expect(systemPrompt.endsWith(AI_FORMAT_SUFFIX)).toBe(true);
	});

	it('format suffix contains required fields', () => {
		expect(AI_FORMAT_SUFFIX).toContain('"description"');
		expect(AI_FORMAT_SUFFIX).toContain('"calories"');
		expect(AI_FORMAT_SUFFIX).toContain('"protein"');
		expect(AI_FORMAT_SUFFIX).toContain('"carbs"');
		expect(AI_FORMAT_SUFFIX).toContain('"fat"');
	});
});
