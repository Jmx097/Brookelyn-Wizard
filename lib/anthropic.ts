type JsonSchema = Record<string, unknown>;

type AnthropicModel =
  | "claude-3-5-haiku-latest"
  | "claude-3-7-sonnet-latest"
  | (string & {});

type AnthropicToolOptions = {
  model?: AnthropicModel;
  maxTokens?: number;
  toolDescription?: string;
};

function getAnthropicApiKey() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");
  return apiKey;
}

export const ANTHROPIC_MODELS = {
  cheap: (process.env.ANTHROPIC_MODEL_CHEAP || "claude-3-5-haiku-latest") as AnthropicModel,
  complex: (process.env.ANTHROPIC_MODEL_COMPLEX || "claude-3-7-sonnet-latest") as AnthropicModel,
} as const;

export async function callAnthropicTool<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: JsonSchema,
  toolName: string,
  options: AnthropicToolOptions = {},
): Promise<T> {
  const apiKey = getAnthropicApiKey();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: options.model || ANTHROPIC_MODELS.cheap,
      max_tokens: options.maxTokens ?? 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      tools: [
        {
          name: toolName,
          description: options.toolDescription || `Return structured output for ${toolName}`,
          input_schema: schema,
        },
      ],
      tool_choice: { type: "tool", name: toolName },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = await res.json();
  const toolUse = json?.content?.find?.((block: { type?: string; name?: string }) => block?.type === "tool_use" && block?.name === toolName);

  if (!toolUse?.input) {
    throw new Error("Anthropic did not return the requested tool payload");
  }

  return toolUse.input as T;
}
