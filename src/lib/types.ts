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
	aiEndpointUrl: string | null;
	aiApiKey: string | null;
	aiModel: string | null;
}
