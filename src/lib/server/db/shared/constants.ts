export const DEFAULT_CALORIE_GOAL = 2000;

export const MEAL_SOURCES = ['manual', 'ai_text', 'ai_vision', 'ai_text_vision'] as const;
export type MealSource = (typeof MEAL_SOURCES)[number];
