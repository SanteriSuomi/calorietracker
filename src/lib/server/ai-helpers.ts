export function extractJsonFromResponse(text: string): unknown {
	let cleaned = text;

	cleaned = cleaned.replace(/<think[\s\S]*?<\/think>/gi, '');
	cleaned = cleaned.replace(/<reasoning[\s\S]*?<\/reasoning>/gi, '');
	cleaned = cleaned.replace(/<reflection[\s\S]*?<\/reflection>/gi, '');

	const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
	if (codeBlockMatch) {
		cleaned = codeBlockMatch[1].trim();
	}

	const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		throw new Error('No JSON object found in AI response');
	}

	return JSON.parse(jsonMatch[0]);
}
