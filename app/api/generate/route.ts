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

  return languages[language];
}

function cleanText(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

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

    const blobToken =
      process.env.BLOB_READ_WRITE_TOKEN;

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

    if (!blobToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "BLOB_READ_WRITE_TOKEN is not configured.",
        },
        { status: 500 }
      );
    }

    console.log(
      "1. RETRIEVING PRIVATE BLOB"
    );

    /*
     * Private Vercel Blob files require the
     * Blob read/write token when retrieving them.
     */

    const fileResponse = await fetch(
      fileUrl,
      {
        headers: {
          Authorization: `Bearer ${blobToken}`,
        },
        cache: "no-store",
      }
    );

    console.log(
      "2. BLOB RESPONSE:",
      fileResponse.status
    );

    if (!fileResponse.ok) {
      const blobError =
        await fileResponse.text();

      console.error(
        "BLOB RETRIEVAL ERROR:",
        blobError
      );

      throw new Error(
        `Unable to retrieve uploaded media. Status: ${fileResponse.status}`
      );
    }

    const arrayBuffer =
      await fileResponse.arrayBuffer();

    console.log(
      "3. BLOB RETRIEVED:",
      arrayBuffer.byteLength,
      "bytes"
    );

    const mediaBlob = new Blob(
      [arrayBuffer],
      {
        type:
          typeof fileType === "string" &&
          fileType
            ? fileType
            : "application/octet-stream",
      }
    );

    const formData =
      new FormData();

    formData.append(
      "file",
      mediaBlob,
      fileName ||
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
      "4. SENDING TO GROQ"
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

    console.log(
      "5. GROQ RESPONSE:",
      groqResponse.status
    );

    const responseText =
      await groqResponse.text();

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
        "Groq returned an unexpected response."
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

    if (!transcript) {
      throw new Error(
        "No speech was detected in the uploaded media."
      );
    }

    const segments =
      Array.isArray(data?.segments)
        ? data.segments
        : [];

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