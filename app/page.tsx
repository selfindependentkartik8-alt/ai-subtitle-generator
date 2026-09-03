"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";

type SubtitleSegment = {
  start: number;
  end: number;
  text: string;
};

type Result = {
  transcript: string;
  subtitles: SubtitleSegment[];
};

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("English");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!file) {
      setError("Please upload a video or audio file.");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setError("File size must be 25 MB or less.");
      return;
    }

    setLoading(true);
    setUploading(true);
    setUploadProgress(0);
    setResult(null);
    setError("");

    try {
      console.log("1. STARTING DIRECT BLOB UPLOAD");
      console.log("FILE:", file.name, file.size, file.type);

      /*
       * IMPORTANT:
       * The browser uploads the media directly to
       * the private Vercel Blob store.
       *
       * The actual media file does NOT pass through
       * /api/upload, so the Vercel 4.5 MB Function
       * payload limit does not apply to the upload.
       */

      const blob = await upload(
        `uploads/${Date.now()}-${file.name}`,
        file,
        {
          access: "private",

          handleUploadUrl: "/api/upload",

          onUploadProgress: (progress) => {
            console.log(
              "UPLOAD:",
              progress.percentage + "%"
            );

            setUploadProgress(
              Math.round(progress.percentage)
            );
          },
        }
      );

      console.log("2. BLOB UPLOAD SUCCESS");
      console.log("BLOB URL:", blob.url);

      if (!blob?.url) {
        throw new Error(
          "Upload completed but no Blob URL was returned."
        );
      }

      setUploading(false);

      console.log("3. STARTING GENERATE REQUEST");

      const response = await fetch("/api/generate", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          fileUrl: blob.url,
          fileName: file.name,
          fileType: file.type,
          language,
        }),
      });

      console.log(
        "4. GENERATE RESPONSE STATUS:",
        response.status
      );

      const responseText = await response.text();

      console.log(
        "5. GENERATE RAW RESPONSE:",
        responseText
      );

      let data: any;

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          "Generate API returned an invalid response."
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Something went wrong while generating subtitles."
        );
      }

      if (!data?.result) {
        throw new Error(
          "AI returned an empty result."
        );
      }

      console.log(
        "6. SUBTITLE GENERATION SUCCESS"
      );

      setResult({
        transcript: data.result.transcript || "",

        subtitles: Array.isArray(
          data.result.subtitles
        )
          ? data.result.subtitles
          : [],
      });
    } catch (err) {
      console.error(
        "SUBTITLE ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to generate subtitles."
      );
    } finally {
      setUploading(false);
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const formatTime = (seconds: number) => {
    const totalMilliseconds = Math.max(
      0,
      Math.round(seconds * 1000)
    );

    const hours = Math.floor(
      totalMilliseconds / 3600000
    );

    const minutes = Math.floor(
      (totalMilliseconds % 3600000) / 60000
    );

    const secs = Math.floor(
      (totalMilliseconds % 60000) / 1000
    );

    const milliseconds =
      totalMilliseconds % 1000;

    return `${String(hours).padStart(
      2,
      "0"
    )}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(secs).padStart(
      2,
      "0"
    )},${String(milliseconds).padStart(
      3,
      "0"
    )}`;
  };

  const formatVTTTime = (seconds: number) => {
    const totalMilliseconds = Math.max(
      0,
      Math.round(seconds * 1000)
    );

    const hours = Math.floor(
      totalMilliseconds / 3600000
    );

    const minutes = Math.floor(
      (totalMilliseconds % 3600000) / 60000
    );

    const secs = Math.floor(
      (totalMilliseconds % 60000) / 1000
    );

    const milliseconds =
      totalMilliseconds % 1000;

    return `${String(hours).padStart(
      2,
      "0"
    )}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(secs).padStart(
      2,
      "0"
    )}.${String(milliseconds).padStart(
      3,
      "0"
    )}`;
  };

  const createSRT = () => {
    if (!result?.subtitles.length) {
      return "";
    }

    return result.subtitles
      .map(
        (subtitle, index) =>
          `${index + 1}
${formatTime(subtitle.start)} --> ${formatTime(
            subtitle.end
          )}
${subtitle.text}
`
      )
      .join("\n");
  };

  const createVTT = () => {
    if (!result?.subtitles.length) {
      return "";
    }

    const cues = result.subtitles
      .map(
        (subtitle) =>
          `${formatVTTTime(
            subtitle.start
          )} --> ${formatVTTTime(
            subtitle.end
          )}
${subtitle.text}
`
      )
      .join("\n");

    return `WEBVTT\n\n${cues}`;
  };

  const downloadFile = (
    content: string,
    filename: string,
    type: string
  ) => {
    if (!content) {
      return;
    }

    const blob = new Blob(
      [content],
      { type }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);
  };

  const copyTranscript = async () => {
    if (!result?.transcript) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        result.transcript
      );

      alert("Transcript copied!");
    } catch {
      alert("Unable to copy transcript.");
    }
  };

  const copySubtitles = async () => {
    if (!result?.subtitles.length) {
      return;
    }

    const text = result.subtitles
      .map(
        (subtitle, index) =>
          `${index + 1}. ${formatTime(
            subtitle.start
          )} → ${formatTime(
            subtitle.end
          )}\n${subtitle.text}`
      )
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(
        text
      );

      alert("Subtitles copied!");
    } catch {
      alert("Unable to copy subtitles.");
    }
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-gradient-to-b from-[#18072b] via-[#0b0612] to-black text-white">

      {/* Background */}

      <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[600px] w-[800px] max-w-[100vw] -translate-x-1/2 rounded-full bg-purple-600/20 blur-[150px]" />

      <div className="pointer-events-none absolute left-[-180px] top-[45%] h-[350px] w-[350px] rounded-full bg-fuchsia-600/10 blur-[140px]" />

      <div className="pointer-events-none absolute right-[-180px] top-[60%] h-[350px] w-[350px] rounded-full bg-violet-500/10 blur-[140px]" />

      {/* Navbar */}

      <nav className="relative z-20 mx-4 mt-5 rounded-3xl border border-purple-400/10 bg-zinc-950/75 px-4 py-4 shadow-2xl shadow-purple-950/30 backdrop-blur-2xl sm:mx-auto sm:max-w-6xl sm:px-6">

        <div className="flex items-center justify-between gap-4">

          <div className="flex min-w-0 items-center gap-3">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-purple-400/20 bg-white/10">
              <img
                src="/logo.png"
                alt="KrishAIWorks"
                className="h-full w-full rounded-full object-cover"
              />
            </div>

            <div className="min-w-0">

              <h2 className="truncate text-sm font-bold sm:text-base">
                KrishAIWorks
              </h2>

              <p className="text-[10px] text-zinc-500 sm:text-xs">
                AI Solutions That Work
              </p>

            </div>

          </div>

          <div className="hidden items-center gap-7 text-sm text-zinc-300 md:flex">

            <a
              href="#home"
              className="hover:text-purple-300"
            >
              Home
            </a>

            <a
              href="#features"
              className="hover:text-purple-300"
            >
              Features
            </a>

            <a
              href="#how"
              className="hover:text-purple-300"
            >
              How To Use
            </a>

            <a
              href="#faq"
              className="hover:text-purple-300"
            >
              FAQ
            </a>

            <a
              href="https://www.instagram.com/krishaiworks/"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-purple-400 px-5 py-2 font-medium text-black"
            >
              Follow
            </a>

          </div>

          <button
            type="button"
            onClick={() =>
              setMenuOpen(!menuOpen)
            }
            className="rounded-full border border-purple-400/20 bg-purple-400/10 px-4 py-2 text-xs text-purple-300 md:hidden"
          >
            {menuOpen ? "Close" : "Menu"}
          </button>

        </div>

      </nav>

      {/* Mobile Menu */}

      {menuOpen && (
        <div className="relative z-30 mx-4 mt-2 rounded-3xl border border-purple-400/10 bg-zinc-950/95 p-4 backdrop-blur-xl md:hidden">

          <div className="flex flex-col gap-1">

            {[
              ["#home", "Home"],
              ["#features", "Features"],
              ["#how", "How To Use"],
              ["#faq", "FAQ"],
            ].map(
              ([href, label]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() =>
                    setMenuOpen(false)
                  }
                  className="rounded-2xl px-4 py-3 text-sm text-zinc-300 hover:bg-purple-400/10 hover:text-purple-300"
                >
                  {label}
                </a>
              )
            )}

            <a
              href="https://www.instagram.com/krishaiworks/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 rounded-2xl bg-purple-400 px-4 py-3 text-center text-sm font-semibold text-black"
            >
              Follow
            </a>

          </div>

        </div>
      )}

      {/* Hero */}

      <section
        id="home"
        className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-4 pb-20 pt-16 text-center sm:px-8 sm:pt-24"
      >

        <div className="rounded-full border border-purple-400/20 bg-purple-400/10 px-4 py-2 text-xs text-purple-200">
          🎬 AI-Powered Subtitle Generator
        </div>

        <p className="mt-4 text-xs text-zinc-500">
          Built by{" "}
          <span className="font-semibold text-purple-400">
            KrishAIWorks
          </span>
        </p>

        <h1 className="mt-7 max-w-4xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
          Turn Your Videos Into
          <br />

          <span className="bg-gradient-to-r from-purple-300 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent">
            Accurate Subtitles.
          </span>

        </h1>

        <p className="mt-6 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base sm:leading-8">
          Upload your video or audio and let AI transcribe the speech
          into timestamped subtitles ready for your content.
        </p>

        <div className="mt-7 flex max-w-full flex-wrap justify-center gap-3">

          <span className="rounded-full border border-white/5 bg-white/[0.04] px-4 py-2 text-xs text-zinc-300">
            🎙️ AI Transcription
          </span>

          <span className="rounded-full border border-white/5 bg-white/[0.04] px-4 py-2 text-xs text-zinc-300">
            ⏱️ Timestamps
          </span>

          <span className="rounded-full border border-white/5 bg-white/[0.04] px-4 py-2 text-xs text-zinc-300">
            📄 SRT & VTT
          </span>

        </div>

        {/* Generator */}

        <div className="mt-12 w-full max-w-4xl">

          <div className="rounded-[2rem] border border-purple-400/10 bg-zinc-950/60 p-4 text-left shadow-2xl shadow-purple-950/30 backdrop-blur-2xl sm:p-7">

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-400">
              Subtitle Generator
            </p>

            <h2 className="mt-3 text-lg font-semibold sm:text-xl">
              Upload your media and generate subtitles.
            </h2>

            <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
              Maximum file size: 25 MB.
            </p>

            <div className="mt-7 space-y-5">

              {/* Upload */}

              <div>

                <label className="mb-2 block text-xs font-medium text-zinc-400">
                  Video / Audio File
                </label>

                <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-purple-400/20 bg-purple-400/[0.03] px-5 py-8 text-center hover:border-purple-400/40">

                  <span className="text-4xl">
                    🎬
                  </span>

                  <span className="mt-4 break-all text-sm font-semibold text-white">
                    {file
                      ? file.name
                      : "Choose a video or audio file"}
                  </span>

                  <span className="mt-2 text-xs text-zinc-600">
                    MP4, MOV, WebM, MP3, WAV and more
                  </span>

                  <input
                    type="file"
                    accept="video/*,audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const selected =
                        e.target.files?.[0] ||
                        null;

                      if (
                        selected &&
                        selected.size >
                          25 *
                            1024 *
                            1024
                      ) {
                        setError(
                          "File size must be 25 MB or less."
                        );

                        setFile(null);
                        return;
                      }

                      setError("");
                      setFile(selected);
                      setResult(null);
                    }}
                  />

                </label>

              </div>

              {/* Language */}

              <div>

                <label className="mb-2 block text-xs font-medium text-zinc-400">
                  Spoken Language
                </label>

                <select
                  value={language}
                  onChange={(e) =>
                    setLanguage(
                      e.target.value
                    )
                  }
                  className="box-border h-14 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-sm text-white outline-none focus:border-purple-400/50"
                >
                  <option>
                    English
                  </option>

                  <option>
                    Hindi
                  </option>

                  <option>
                    Spanish
                  </option>

                  <option>
                    French
                  </option>

                  <option>
                    German
                  </option>

                  <option>
                    Urdu
                  </option>

                  <option>
                    Auto Detect
                  </option>

                </select>

              </div>

              {/* Upload Progress */}

              {uploading && (
                <div className="rounded-2xl border border-purple-400/10 bg-purple-400/[0.04] p-4">

                  <div className="flex items-center justify-between text-xs">

                    <span className="text-purple-300">
                      ☁️ Uploading media...
                    </span>

                    <span className="text-zinc-500">
                      {uploadProgress}%
                    </span>

                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">

                    <div
                      className="h-full rounded-full bg-purple-400 transition-all duration-300"
                      style={{
                        width: `${uploadProgress}%`,
                      }}
                    />

                  </div>

                </div>
              )}

              {/* Generate */}

              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="h-14 w-full rounded-2xl bg-purple-400 px-5 text-sm font-semibold text-black shadow-xl shadow-purple-400/20 transition hover:bg-purple-300 disabled:cursor-not-allowed disabled:opacity-60"
              >

                {uploading
                  ? `☁️ Uploading ${uploadProgress}%...`
                  : loading
                  ? "🧠 Generating Subtitles..."
                  : "✨ Generate Subtitles"}

              </button>

            </div>

            {/* Error */}

            {error && (
              <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm leading-6 text-red-300">
                ⚠️ {error}
              </div>
            )}

            {/* Result */}

            {result && (
              <div className="mt-8 rounded-3xl border border-purple-400/10 bg-black/40 p-5 sm:p-7">

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                  <div>

                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-400">
                      AI Generated Result
                    </p>

                    <h3 className="mt-2 text-xl font-bold">
                      Your Subtitles
                    </h3>

                  </div>

                  <div className="flex flex-wrap gap-2">

                    <button
                      type="button"
                      onClick={() =>
                        downloadFile(
                          createSRT(),
                          "subtitles.srt",
                          "text/plain"
                        )
                      }
                      className="rounded-xl border border-purple-400/20 bg-purple-400/10 px-4 py-2 text-xs font-medium text-purple-300"
                    >
                      ⬇️ SRT
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        downloadFile(
                          createVTT(),
                          "subtitles.vtt",
                          "text/vtt"
                        )
                      }
                      className="rounded-xl border border-purple-400/20 bg-purple-400/10 px-4 py-2 text-xs font-medium text-purple-300"
                    >
                      ⬇️ VTT
                    </button>

                  </div>

                </div>

                {/* Transcript */}

                <div className="mt-8">

                  <div className="flex items-center justify-between gap-3">

                    <h4 className="text-sm font-bold uppercase tracking-wider text-purple-300">
                      📝 Full Transcript
                    </h4>

                    <button
                      type="button"
                      onClick={
                        copyTranscript
                      }
                      className="text-xs text-purple-400"
                    >
                      📋 Copy
                    </button>

                  </div>

                  <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-white/5 bg-zinc-950/70 p-5 text-sm leading-8 text-zinc-300">
                    {result.transcript ||
                      "No transcript returned."}
                  </div>

                </div>

                {/* Subtitles */}

                <div className="mt-8">

                  <div className="flex flex-wrap items-center justify-between gap-3">

                    <h4 className="text-sm font-bold uppercase tracking-wider text-purple-300">
                      ⏱️ Timestamped Subtitles
                    </h4>

                    <button
                      type="button"
                      onClick={
                        copySubtitles
                      }
                      className="text-xs text-purple-400"
                    >
                      📋 Copy
                    </button>

                  </div>

                  <div className="mt-4 space-y-3">

                    {result.subtitles.length >
                    0 ? (
                      result.subtitles.map(
                        (
                          subtitle,
                          index
                        ) => (
                          <div
                            key={index}
                            className="rounded-2xl border border-white/5 bg-zinc-950/70 p-4 hover:border-purple-400/20"
                          >

                            <div className="text-[11px] font-semibold text-purple-400">

                              {formatTime(
                                subtitle.start
                              )}{" "}
                              →{" "}
                              {formatTime(
                                subtitle.end
                              )}

                            </div>

                            <p className="mt-2 text-sm leading-7 text-zinc-300">
                              {subtitle.text}
                            </p>

                          </div>
                        )
                      )
                    ) : (
                      <div className="rounded-2xl border border-white/5 bg-zinc-950/60 p-4 text-sm text-zinc-500">
                        No timestamped subtitles returned.
                      </div>
                    )}

                  </div>

                </div>

              </div>
            )}

            <p className="mt-4 text-xs text-zinc-600">
              Review AI-generated subtitles before publishing.
            </p>

          </div>

        </div>

      </section>

      {/* Features */}

      <section
        id="features"
        className="relative z-10 mx-auto max-w-6xl px-4 py-20 sm:px-8"
      >

        <div className="grid gap-5 md:grid-cols-3">

          {[
            [
              "🎙️",
              "AI Transcription",
              "Convert spoken audio into clean text using AI.",
            ],

            [
              "⏱️",
              "Accurate Timestamps",
              "Get subtitle segments synchronized with your media.",
            ],

            [
              "📄",
              "SRT & VTT",
              "Download subtitles in popular caption formats.",
            ],
          ].map(
            ([
              icon,
              title,
              description,
            ]) => (
              <div
                key={title}
                className="rounded-3xl border border-white/5 bg-zinc-950/60 p-6 backdrop-blur-xl"
              >

                <div className="text-3xl">
                  {icon}
                </div>

                <h3 className="mt-5 text-base font-bold">
                  {title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-zinc-500">
                  {description}
                </p>

              </div>
            )
          )}

        </div>

      </section>

      {/* How To Use */}

      <section
        id="how"
        className="relative z-10 mx-auto max-w-6xl px-4 py-20 sm:px-8"
      >

        <div className="text-center">

          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-400">
            How To Use
          </p>

          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
            Generate subtitles in three steps.
          </h2>

        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">

          {[
            [
              "01",
              "Upload",
              "Choose your video or audio file.",
            ],

            [
              "02",
              "Generate",
              "AI transcribes the spoken content and creates timestamps.",
            ],

            [
              "03",
              "Download",
              "Copy or download your subtitles as SRT or VTT.",
            ],
          ].map(
            ([
              number,
              title,
              description,
            ]) => (
              <div
                key={number}
                className="rounded-3xl border border-white/5 bg-zinc-950/60 p-6"
              >

                <span className="text-sm font-bold text-purple-400">
                  {number}
                </span>

                <h3 className="mt-5 text-lg font-bold">
                  {title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-zinc-500">
                  {description}
                </p>

              </div>
            )
          )}

        </div>

      </section>

      {/* FAQ */}

      <section
        id="faq"
        className="relative z-10 mx-auto max-w-4xl px-4 py-20 sm:px-8"
      >

        <div className="text-center">

          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-400">
            FAQ
          </p>

          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
            Frequently Asked Questions
          </h2>

        </div>

        <div className="mt-10 space-y-4">

          {[
            [
              "What files can I upload?",
              "You can upload common video and audio formats such as MP4, MOV, WebM, MP3 and WAV.",
            ],

            [
              "What is the maximum file size?",
              "The current generator accepts files up to 25 MB.",
            ],

            [
              "Can I generate Hindi subtitles?",
              "Yes. Select Hindi as the spoken language before generating subtitles.",
            ],

            [
              "Can I download the subtitles?",
              "Yes. You can download generated subtitles as SRT or VTT files.",
            ],
          ].map(
            ([
              question,
              answer,
            ]) => (
              <div
                key={question}
                className="rounded-3xl border border-white/5 bg-zinc-950/60 p-6"
              >

                <h3 className="text-sm font-bold">
                  {question}
                </h3>

                <p className="mt-3 text-sm leading-7 text-zinc-500">
                  {answer}
                </p>

              </div>
            )
          )}

        </div>

      </section>
{/* ================================================= */}
{/* FOOTER */}
{/* ================================================= */}

<footer className="relative z-10 border-t border-white/5 px-4 py-10">
  <div className="mx-auto max-w-6xl">

    {/* Related Tools */}
    <div className="mb-10 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-300">
        Explore More
      </p>

      <h3 className="mt-2 text-xl font-bold text-white">
        More AI & Video Tools
      </h3>

      <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-500">
        Explore more powerful AI tools from KrishAIWorks to create,
        summarize, and optimize your content.
      </p>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

      {/* YouTube AI Summarizer */}
      <a
        href="https://youtubeaisummarizer.krishaiworks.com/"
        className="group rounded-2xl border border-purple-400/10 bg-white/[0.03] p-5 transition-all duration-300 hover:border-purple-400/30 hover:bg-purple-400/[0.05]"
      >
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-purple-400/20 bg-purple-400/10 text-lg">
          ▶️
        </div>

        <h4 className="font-semibold text-white transition-colors group-hover:text-purple-300">
          YouTube AI Summarizer
        </h4>

        <p className="mt-2 text-xs leading-5 text-zinc-500">
          Turn long YouTube videos into quick, useful summaries.
        </p>
      </a>

      {/* AI YouTube Title & Description Generator */}
      <a
        href="https://aiyoutubetitledescriptiongenerator.krishaiworks.com/"
        className="group rounded-2xl border border-purple-400/10 bg-white/[0.03] p-5 transition-all duration-300 hover:border-purple-400/30 hover:bg-purple-400/[0.05]"
      >
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-purple-400/20 bg-purple-400/10 text-lg">
          🎬
        </div>

        <h4 className="font-semibold text-white transition-colors group-hover:text-purple-300">
          YouTube Title & Description
        </h4>

        <p className="mt-2 text-xs leading-5 text-zinc-500">
          Generate engaging titles and descriptions for your videos.
        </p>
      </a>

      {/* AI Blog Generator */}
      <a
        href="https://aibloggenerator.krishaiworks.com/"
        className="group rounded-2xl border border-purple-400/10 bg-white/[0.03] p-5 transition-all duration-300 hover:border-purple-400/30 hover:bg-purple-400/[0.05]"
      >
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-purple-400/20 bg-purple-400/10 text-lg">
          ✍️
        </div>

        <h4 className="font-semibold text-white transition-colors group-hover:text-purple-300">
          AI Blog Generator
        </h4>

        <p className="mt-2 text-xs leading-5 text-zinc-500">
          Create high-quality blog content with the power of AI.
        </p>
      </a>

      {/* AI Text Humanizer */}
      <a
        href="https://aitexthumanizer.krishaiworks.com/"
        className="group rounded-2xl border border-purple-400/10 bg-white/[0.03] p-5 transition-all duration-300 hover:border-purple-400/30 hover:bg-purple-400/[0.05]"
      >
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-purple-400/20 bg-purple-400/10 text-lg">
          📝
        </div>

        <h4 className="font-semibold text-white transition-colors group-hover:text-purple-300">
          AI Text Humanizer
        </h4>

        <p className="mt-2 text-xs leading-5 text-zinc-500">
          Make AI-generated content sound more natural and human.
        </p>
      </a>

    </div>

    {/* Main Footer */}
    <div className="mt-10 flex flex-col items-center justify-between gap-5 border-t border-white/5 pt-8 text-center sm:flex-row sm:text-left">

      <div className="flex items-center gap-3">

        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-purple-400/20">
          <img
            src="/logo.png"
            alt="KrishAIWorks"
            className="h-full w-full rounded-full object-cover"
          />
        </div>

        <div>
          <p className="text-sm font-bold text-white">
            KrishAIWorks
          </p>

          <p className="text-xs text-zinc-600">
            AI Solutions That Work
          </p>
        </div>

      </div>

      <p className="text-xs text-zinc-600">
        © {new Date().getFullYear()} KrishAIWorks. All rights reserved.
      </p>

    </div>

  </div>
</footer>

    </main>
  );
}