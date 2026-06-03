type ClientError = {
  error: string;
  status: number;
};

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
};

function asErrorLike(error: unknown): ErrorLike {
  return typeof error === "object" && error !== null
    ? (error as ErrorLike)
    : {};
}

export function toClientError(
  error: unknown,
  fallbackMessage: string,
): ClientError {
  const errorLike = asErrorLike(error);
  const message =
    typeof errorLike.message === "string" ? errorLike.message : "";
  const code = typeof errorLike.code === "string" ? errorLike.code : "";
  const status =
    typeof errorLike.status === "number" ? errorLike.status : undefined;

  if (message.includes("Missing OPENAI_API_KEY")) {
    return {
      error: "Missing OPENAI_API_KEY. Add it to .env.local, then restart the dev server.",
      status: 500,
    };
  }

  if (
    status === 401 ||
    code === "invalid_api_key" ||
    /incorrect api key|invalid api key/i.test(message)
  ) {
    return {
      error:
        "OpenAI rejected the configured API key. Replace OPENAI_API_KEY in .env.local with a valid key, then restart the dev server.",
      status: 500,
    };
  }

  if (code === "insufficient_quota" || /quota|credits|billing/i.test(message)) {
    return {
      error:
        "OpenAI billing or quota is preventing this request. Check your API billing and usage limits.",
      status: 500,
    };
  }

  if (status === 429 || code === "rate_limit_exceeded") {
    return {
      error: "OpenAI rate limit reached. Wait a moment and try again.",
      status: 429,
    };
  }

  return { error: fallbackMessage, status: 500 };
}
