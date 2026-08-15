import { get } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GROQ_API_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";

function getLanguageCode(language: string) {
  const languages: Record<string, string> = {
    English: "en",
    Hindi: "hi",
    Spanish: "es",
    French: "fr",
    German: "de",
    Urdu: "ur",
  };

  return languages[language] || undefined;
}

function cleanText(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      fileUrl,
      fileName,
      fileType,
      language,
    } = body;

    if (
      !fileUrl ||
      typeof fileUrl !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Uploaded file URL is required.",
        },
        { status: 400 }
      );
    }

    const apiKey =
      process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "GROQ_API_KEY is not configured.",
        },
        { status: 500 }
      );
    }

    console.log(
      "1. STARTING PRIVATE BLOB READ"
    );

    /*
     * IMPORTANT:
     *
     * The Blob store is PRIVATE.
     *
     * Therefore we CANNOT simply fetch(fileUrl).
     *
     * We use Vercel Blob's authenticated get()
     * method on the SERVER.
     */

    const blobResult = await get(
      fileUrl,
      {
        access: "private",
      }
    );

    if (
      !blobResult ||
      blobResult.statusCode !== 200 ||
      !blobResult.stream
    ) {
      throw new Error(
        "Unable to retrieve uploaded media from private Blob storage."
      );
    }

    console.log(
      "2. PRIVATE BLOB READ SUCCESS"
    );

    /*
     * Convert the Blob stream into an ArrayBuffer.
     */

    const mediaArrayBuffer =
      await new Response(
        blobResult.stream
      ).arrayBuffer();

    console.log(
      "3. MEDIA DOWNLOADED:",
      mediaArrayBuffer.byteLength,
      "bytes"
    );

    const mediaBlob = new Blob(
      [mediaArrayBuffer],
      {
        type:
          typeof fileType === "string" &&
          fileType
            ? fileType
            : blobResult.blob
                .contentType ||
              "application/octet-stream",
      }
    );

    /*
     * Prepare Groq Whisper request.
     */

    const formData =
      new FormData();

    formData.append(
      "file",
      mediaBlob,
      fileName ||
        blobResult.blob.pathname ||
        "uploaded-media"
    );

    formData.append(
      "model",
      "whisper-large-v3-turbo"
    );

    formData.append(
      "response_format",
      "verbose_json"
    );

    formData.append(
      "timestamp_granularities[]",
      "segment"
    );

    const languageCode =
      language &&
      language !== "Auto Detect"
        ? getLanguageCode(language)
        : undefined;

    if (languageCode) {
      formData.append(
        "language",
        languageCode
      );
    }

    console.log(
      "4. STARTING GROQ TRANSCRIPTION"
    );

    const groqResponse =
      await fetch(
        GROQ_API_URL,
        {
          method: "POST",

          headers: {
            Authorization: `Bearer ${apiKey}`,
          },

          body: formData,
        }
      );

    const responseText =
      await groqResponse.text();

    console.log(
      "5. GROQ RESPONSE STATUS:",
      groqResponse.status
    );

    let data: any;

    try {
      data =
        JSON.parse(responseText);
    } catch {
      console.error(
        "NON-JSON GROQ RESPONSE:",
        responseText
      );

      throw new Error(
        `Groq returned an invalid response. Status: ${groqResponse.status}`
      );
    }

    if (!groqResponse.ok) {
      console.error(
        "GROQ ERROR:",
        data
      );

      throw new Error(
        data?.error?.message ||
          "Groq transcription failed."
      );
    }

    const transcript =
      cleanText(
        data?.text || ""
      );

    const segments =
      Array.isArray(data?.segments)
        ? data.segments
        : [];

    if (!transcript) {
      throw new Error(
        "No speech was detected in the uploaded media."
      );
    }

    const subtitles =
      segments
        .map(
          (segment: any) => ({
            start: Number(
              segment?.start || 0
            ),

            end: Number(
              segment?.end || 0
            ),

            text: cleanText(
              segment?.text || ""
            ),
          })
        )
        .filter(
          (segment: any) =>
            segment.text &&
            segment.end >
              segment.start
        );

    console.log(
      "6. TRANSCRIPTION SUCCESS:",
      subtitles.length,
      "segments"
    );

    return NextResponse.json({
      success: true,

      result: {
        transcript,

        subtitles,
      },
    });
  } catch (error) {
    console.error(
      "SUBTITLE GENERATION ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to generate subtitles.",
      },
      { status: 500 }
    );
  }
}