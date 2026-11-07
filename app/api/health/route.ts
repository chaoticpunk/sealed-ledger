import {
  fetchModels,
  isConfigured,
  isTeeHosted,
  selectedModel,
} from "@/lib/nearai/client";

export async function GET(): Promise<Response> {
  const modelId = selectedModel();
  const configured = isConfigured();

  let listed = false;
  let teeHosted = false;
  let owner: string | undefined;
  let error: string | undefined;

  try {
    const models = await fetchModels();
    const model = models.find((candidate) => candidate.id === modelId);
    listed = Boolean(model);
    teeHosted = model ? isTeeHosted(model) : false;
    owner = model?.owned_by;
  } catch {
    error = "Could not reach the NEAR AI Cloud models endpoint";
  }

  return Response.json(
    {
      configured,
      model: modelId,
      listed,
      teeHosted,
      owner,
      error,
      baseUrl: process.env.NEARAI_CLOUD_BASE_URL || "https://cloud-api.near.ai",
    },
    {
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    },
  );
}
