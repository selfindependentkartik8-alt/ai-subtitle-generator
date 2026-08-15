import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "No media file was provided.",
        },
        { status: 400 }
      );
    }

    const maxSize = 25 * 1024 * 1024;

    if (file.size > maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: "File size must be 25 MB or less.",
        },
        { status: 400 }
      );
    }

    const token =
      process.env.BLOB_READ_WRITE_TOKEN;

    if (!token) {
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
      "SERVER RECEIVED FILE:",
      file.name,
      file.size,
      file.type
    );

    const blob = await put(
      `uploads/${Date.now()}-${file.name}`,
      file,
      {
        access: "private",
        token,
        addRandomSuffix: true,
      }
    );

    console.log(
      "VERCEL BLOB UPLOAD SUCCESS:",
      blob.url
    );

    return NextResponse.json({
      success: true,
      url: blob.url,
    });
  } catch (error) {
    console.error(
      "VERCEL BLOB UPLOAD ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to upload media.",
      },
      { status: 500 }
    );
  }
}