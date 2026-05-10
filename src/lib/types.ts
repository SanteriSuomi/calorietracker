export interface Meal {
	id: string;
	description: string;
	calories: number;
	protein: number;
	carbs: number;
	fat: number;
	source: string;
	imageFilename?: string | null;
}

export interface MealFormData {
	description: string;
	calories: number;
	protein: number;
	carbs: number;
	fat: number;
	date: string;
}

export interface AiAnalysisResult {
	description: string;
	calories: number;
	protein: number;
	carbs: number;
	fat: number;
}

export interface UserSettings {
	dailyCalorieGoal: number;
	dailyProteinGoal: number | null;
	dailyCarbsGoal: number | null;
	dailyFatGoal: number | null;
	aiEndpointUrl: string | null;
	aiApiKey: string | null;
	aiModel: string | null;
	aiSystemPrompt: string | null;
}

export interface DaySummary {
	date: string;
	calories: number;
	protein: number;
	carbs: number;
	fat: number;
}
