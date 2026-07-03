import type { LanguageModelV3Prompt } from "@ai-sdk/provider";

type AISearchMessage = AiSearchChatCompletionsRequest["messages"][number];

function stringifyOutput(output: unknown): string {
	if (output == null) {
		return "";
	}

	if (typeof output !== "object") {
		return String(output);
	}

	const typed = output as { type?: string; value?: unknown; reason?: string };
	switch (typed.type) {
		case "text":
		case "error-text": {
			return typeof typed.value === "string" ? typed.value : String(typed.value ?? "");
		}
		case "json":
		case "error-json": {
			return JSON.stringify(typed.value);
		}
		case "execution-denied": {
			return typed.reason
				? `Tool execution denied: ${typed.reason}`
				: "Tool execution was denied.";
		}
		case "content": {
			const value = typed.value;
			return Array.isArray(value)
				? value
						.filter(
							(part): part is { type: "text"; text: string } =>
								part?.type === "text" && typeof part.text === "string",
						)
						.map((part) => part.text)
						.join("\n")
				: "";
		}
		default: {
			return JSON.stringify(output);
		}
	}
}

// AI Search chat is text-only. Unsupported *content* (file/image parts) is a hard
// error rather than a silent drop — unlike unsupported generation *options*
// (temperature, tools, …), which are surfaced as warnings and ignored. Dropping a
// file part would otherwise yield a confident answer that never saw the content.
function assertTextOnlyContent(type: string): never {
	throw new Error(`AI Search chat only supports text message content. Received ${type}.`);
}

export function convertToAISearchMessages(prompt: LanguageModelV3Prompt): AISearchMessage[] {
	const messages: AISearchMessage[] = [];

	for (const { role, content } of prompt) {
		switch (role) {
			case "system": {
				messages.push({ role: "system", content });
				break;
			}

			case "user": {
				const textParts: string[] = [];
				for (const part of content) {
					switch (part.type) {
						case "text": {
							textParts.push(part.text);
							break;
						}
						case "file": {
							assertTextOnlyContent(part.type);
						}
					}
				}
				messages.push({ role: "user", content: textParts.join("\n") });
				break;
			}

			case "assistant": {
				const textParts: string[] = [];
				for (const part of content) {
					switch (part.type) {
						case "text": {
							textParts.push(part.text);
							break;
						}
						case "reasoning": {
							textParts.push(part.text);
							break;
						}
						case "tool-call": {
							textParts.push(`Tool call ${part.toolName}: ${JSON.stringify(part.input)}`);
							break;
						}
						case "tool-result": {
							textParts.push(stringifyOutput(part.output));
							break;
						}
						case "file": {
							assertTextOnlyContent(part.type);
						}
					}
				}
				messages.push({ role: "assistant", content: textParts.join("\n") });
				break;
			}

			case "tool": {
				const textParts: string[] = [];
				for (const part of content) {
					if (part.type === "tool-result") {
						textParts.push(stringifyOutput(part.output));
					}
				}
				messages.push({ role: "tool", content: textParts.join("\n") });
				break;
			}

			default: {
				const exhaustiveCheck = role satisfies never;
				throw new Error(`Unsupported role: ${exhaustiveCheck}`);
			}
		}
	}

	return messages;
}
