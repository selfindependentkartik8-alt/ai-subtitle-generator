import {
  handleUpload,
  type HandleUploadBody,
} from "@vercel/blob/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/webm",
  "audio/ogg",
  "audio/x-m4a",
];

export async function POST(request: Request) {
  try {
    const body =
      (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,

      onBeforeGenerateToken: async (
        pathname
      ) => {
        console.log(
          "Generating Blob client token for:",
          pathname
        );

        return {
          allowedContentTypes:
            ALLOWED_CONTENT_TYPES,

          maximumSizeInBytes:
            MAX_FILE_SIZE,

          addRandomSuffix: true,

          tokenPayload: JSON.stringify({
            pathname,
          }),
        };
      },

      /*
       * We don't need to do anything here.
       *
       * The browser receives the Blob result directly
       * after the upload completes.
       */
      onUploadCompleted: async ({
        blob,
        tokenPayload,
      }) => {
        console.log(
          "BLOB UPLOAD COMPLETED:",
          blob.pathname
        );

        console.log(
          "BLOB TOKEN PAYLOAD:",
          tokenPayload
        );
      },
    });

    console.log(
      "Blob client token generated successfully"
    );

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error(
      "BLOB CLIENT UPLOAD ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to create Blob upload token.",
      },
      { status: 400 }
    );
  }
}