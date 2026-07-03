import type { LanguageModelV3, SharedV3Warning } from "@ai-sdk/provider";
import type { AISearchChatSettings } from "./aisearch-chat-settings";
import { convertToAISearchMessages } from "./convert-to-aisearch-chat-messages";
import { mapAISearchFinishReason } from "./map-aisearch-finish-reason";
import { mapAISearchChunkToSource } from "./map-aisearch-source";
import { mapAISearchUsage } from "./map-aisearch-usage";
import { getMappedAISearchStream, prependStreamStart } from "./streaming";

type AISearchChatConfig = {
	provider: string;
	binding: AiSearchInstance;
};

export class AISearchChatLanguageModel implements LanguageModelV3 {
	readonly specificationVersion = "v3";

	readonly supportedUrls: Record<string, RegExp[]> | PromiseLike<Record<string, RegExp[]>> = {};

	readonly modelId: string;
	readonly settings: AISearchChatSettings;

	private readonly config: AISearchChatConfig;

	constructor(modelId: string, settings: AISearchChatSettings, config: AISearchChatConfig) {
		this.modelId = modelId;
		this.settings = settings;
		this.config = config;
	}

	get provider(): string {
		return this.config.provider;
	}

	private getWarnings({
		tools,
		toolChoice,
		maxOutputTokens,
		temperature,
		stopSequences,
		topP,
		topK,
		frequencyPenalty,
		presencePenalty,
		responseFormat,
		seed,
		includeRawChunks,
	}: Parameters<LanguageModelV3["doGenerate"]>[0]): SharedV3Warning[] {
		const warnings: SharedV3Warning[] = [];

		if (tools != null && tools.length > 0) {
			warnings.push({ feature: "tools", type: "unsupported" });
		}

		if (toolChoice != null) {
			warnings.push({ feature: "toolChoice", type: "unsupported" });
		}

		if (maxOutputTokens != null) {
			warnings.push({ feature: "maxOutputTokens", type: "unsupported" });
		}

		if (temperature != null) {
			warnings.push({ feature: "temperature", type: "unsupported" });
		}

		if (stopSequences != null) {
			warnings.push({ feature: "stopSequences", type: "unsupported" });
		}

		if (topP != null) {
			warnings.push({ feature: "topP", type: "unsupported" });
		}

		if (topK != null) {
			warnings.push({ feature: "topK", type: "unsupported" });
		}

		if (frequencyPenalty != null) {
			warnings.push({ feature: "frequencyPenalty", type: "unsupported" });
		}

		if (presencePenalty != null) {
			warnings.push({ feature: "presencePenalty", type: "unsupported" });
		}

		if (responseFormat?.type === "json") {
			warnings.push({ feature: "responseFormat", type: "unsupported" });
		}

		if (seed != null) {
			warnings.push({ feature: "seed", type: "unsupported" });
		}

		if (includeRawChunks === true) {
			warnings.push({ feature: "includeRawChunks", type: "unsupported" });
		}

		return warnings;
	}

	private buildRequest(
		prompt: Parameters<LanguageModelV3["doGenerate"]>[0]["prompt"],
		options?: { stream?: boolean },
	): AiSearchChatCompletionsRequest {
		// `model` and `stream` are handled explicitly below; everything else on
		// settings is forwarded to the binding as-is (see AISearchChatSettings).
		const {
			model,
			stream: _stream,
			...settings
		} = this.settings as AISearchChatSettings & {
			stream?: boolean;
		};

		return {
			...settings,
			messages: convertToAISearchMessages(prompt),
			...(model ? { model } : {}),
			...(options?.stream ? { stream: true } : {}),
		};
	}

	async doGenerate(
		options: Parameters<LanguageModelV3["doGenerate"]>[0],
	): Promise<Awaited<ReturnType<LanguageModelV3["doGenerate"]>>> {
		const warnings = this.getWarnings(options);
		const output = await this.config.binding.chatCompletions(this.buildRequest(options.prompt));
		const chunks = output.chunks ?? [];
		const messageContent = output.choices?.[0]?.message?.content;

		return {
			finishReason: mapAISearchFinishReason(output),
			content: [
				...chunks.map(mapAISearchChunkToSource),
				{ type: "text" as const, text: messageContent == null ? "" : String(messageContent) },
			],
			usage: mapAISearchUsage(output),
			warnings,
		};
	}

	async doStream(
		options: Parameters<LanguageModelV3["doStream"]>[0],
	): Promise<Awaited<ReturnType<LanguageModelV3["doStream"]>>> {
		const warnings = this.getWarnings(options);
		// The cast selects the streaming `chatCompletions` overload (which returns a
		// ReadableStream); buildRequest's return type doesn't carry the `stream: true`
		// literal on its own.
		const request = this.buildRequest(options.prompt, {
			stream: true,
		}) as AiSearchChatCompletionsRequest & { stream: true };
		const response = await this.config.binding.chatCompletions(request);

		return {
			stream: prependStreamStart(getMappedAISearchStream(response), warnings),
		};
	}
}
