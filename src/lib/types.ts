export interface Meal {
	id: string;
	description: string;
	calories: number;
	protein: number;
	carbs: number;
	fat: number;
	source: string;
}

export interface MealFormData {
	description: string;
	calories: number;
	protein: number;
	carbs: number;
	fat: number;
	date: string;
}
