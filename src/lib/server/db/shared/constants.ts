export const DEFAULT_CALORIE_GOAL = 2000;
export const DEFAULT_PROTEIN_GOAL = 150;
export const DEFAULT_CARBS_GOAL = 250;
export const DEFAULT_FAT_GOAL = 65;

export const DEFAULT_AI_SYSTEM_PROMPT =
	'You are an expert nutrition estimation assistant. Given a food description and/or image, ' +
	'provide your best estimate of the nutritional content for a typical serving. Be specific ' +
	'and confident in your estimates. If the input is ambiguous, estimate for a standard portion.';

export const AI_FORMAT_SUFFIX =
	'\n\nYou MUST respond with ONLY a valid JSON object (no markdown, no explanation) with ' +
	'exactly these fields: { "description": string, "calories": number, "protein": number, ' +
	'"carbs": number, "fat": number }. All numeric values must be non-negative integers. ' +
	'"description" must be a concise cleaned-up food name.';

export const MEAL_SOURCES = ['manual', 'ai_text', 'ai_vision', 'ai_text_vision'] as const;
export type MealSource = (typeof MEAL_SOURCES)[number];
