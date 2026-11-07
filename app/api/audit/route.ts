import { NearAiError } from "@/lib/nearai/client";
import type { PipelineStep } from "@/lib/progress";
import { runAuditPipeline, type UploadedFile } from "@/lib/pipeline";

export const maxDuration = 300;

function errorPayload(error: unknown): { message: string; code: string } {
  if (error instanceof NearAiError) {
    if (error.code === "missing_api_key") {
      return {
        code: error.code,
        message:
          "NEAR AI Cloud is not configured. Add NEARAI_CLOUD_API_KEY to .env.local and restart the server.",
      };
    }
    if (error.status === 401 || error.status === 403) {
      return {
        code: "auth_failed",
        message:
          "NEAR AI Cloud rejected the API key. Check NEARAI_CLOUD_API_KEY and your credits.",
      };
    }
    if (error.status === 402) {
      return {
        code: "insufficient_credits",
        message: "NEAR AI Cloud reports insufficient credits for this request.",
      };
    }
    return { code: error.code, message: error.message };
  }

  if (error instanceof Error) {
    return { code: "audit_failed", message: error.message };
  }

  return { code: "audit_failed", message: "The private audit could not be completed." };
}

export async function POST(request: Request): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (value: unknown) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
        } catch {
          // The client disconnected; there is nothing to retain or retry.
        }
      };

      let lastStep: PipelineStep = "ingest";

      try {
        const form = await request.formData();
        const entries = form.getAll("files");
        const files: UploadedFile[] = [];

        for (const entry of entries) {
          if (!(entry instanceof File)) continue;
          files.push({
            name: entry.name.slice(0, 160),
            mimeType: entry.type || "application/octet-stream",
            buffer: Buffer.from(await entry.arrayBuffer()),
          });
        }

        const result = await runAuditPipeline({
          files,
          onProgress: (event) => {
            lastStep = event.step;
            send({ type: "progress", event });
          },
        });

        send({ type: "result", data: result });
      } catch (error) {
        const payload = errorPayload(error);
        send({
          type: "progress",
          event: {
            step: lastStep,
            status: "error",
            detail: payload.message,
          },
        });
        send({ type: "error", ...payload });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-accel-buffering": "no",
      "x-content-type-options": "nosniff",
    },
  });
}
