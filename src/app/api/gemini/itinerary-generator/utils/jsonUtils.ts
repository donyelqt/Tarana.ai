export function extractJson(text: string): string | null {
    let jsonText = text;

    const codeBlockMatch = jsonText.match(/```(?:json)?\n?([\s\S]*?)\n?```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
        jsonText = codeBlockMatch[1];
    }

    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        return jsonText.slice(firstBrace, lastBrace + 1);
    }

    const firstBracket = jsonText.indexOf('[');
    const lastBracket = jsonText.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
        return jsonText.slice(firstBracket, lastBracket + 1);
    }

    return null;
}