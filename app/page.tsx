"use client";

import { useState } from "react";

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
    setResult(null);
    setError("");

    try {
      console.log("1. STARTING UPLOAD");
      console.log("FILE:", file.name, file.size, file.type);

      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      console.log(
        "2. UPLOAD RESPONSE:",
        uploadResponse.status
      );

      const uploadData = await uploadResponse.json();

      console.log("3. UPLOAD DATA:", uploadData);

      if (!uploadResponse.ok) {
        throw new Error(
          uploadData?.error || "Media upload failed."
        );
      }

      if (!uploadData?.url) {
        throw new Error(
          "Upload succeeded but no Blob URL was returned."
        );
      }

      const fileUrl = uploadData.url;

      console.log("4. BLOB UPLOAD SUCCESS");
      console.log("BLOB URL:", fileUrl);

      setUploading(false);

      console.log("5. STARTING GENERATION");

      const generateResponse = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileUrl,
          fileName: file.name,
          fileType: file.type,
          language,
        }),
      });

      console.log(
        "6. GENERATE RESPONSE:",
        generateResponse.status
      );

      const generateData = await generateResponse.json();

      console.log(
        "7. GENERATE DATA:",
        generateData
      );

      if (!generateResponse.ok) {
        throw new Error(
          generateData?.error ||
            "Something went wrong while generating subtitles."
        );
      }

      if (!generateData?.result) {
        throw new Error(
          "AI returned an empty result."
        );
      }

      setResult({
        transcript:
          generateData.result.transcript || "",

        subtitles:
          Array.isArray(
            generateData.result.subtitles
          )
            ? generateData.result.subtitles
            : [],
      });

      console.log(
        "8. SUBTITLE GENERATION SUCCESS"
      );
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
          `${index + 1}\n${formatTime(
            subtitle.start
          )} --> ${formatTime(
            subtitle.end
          )}\n${subtitle.text}\n`
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
          )}\n${subtitle.text}\n`
      )
      .join("\n");

    return `WEBVTT\n\n${cues}`;
  };

  const downloadFile = (
    content: string,
    filename: string,
    type: string
  ) => {
    if (!content) return;

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
    if (!result?.transcript) return;

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

    const text =
      result.subtitles
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

      <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[600px] w-[800px] max-w-[100vw] -translate-x-1/2 rounded-full bg-purple-600/20 blur-[150px]" />

      <div className="pointer-events-none absolute left-[-180px] top-[45%] h-[350px] w-[350px] rounded-full bg-fuchsia-600/10 blur-[140px]" />

      <div className="pointer-events-none absolute right-[-180px] top-[60%] h-[350px] w-[350px] rounded-full bg-violet-500/10 blur-[140px]" />

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

      {menuOpen && (
        <div className="relative z-30 mx-4 mt-2 rounded-3xl border border-purple-400/10 bg-zinc-950/95 p-4 backdrop-blur-xl md:hidden">

          <div className="flex flex-col gap-1">

            {[
              ["#home", "Home"],
              ["#features", "Features"],
              ["#how", "How To Use"],
              ["#faq", "FAQ"],
            ].map(([href, label]) => (
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
            ))}

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
          Upload your video or audio and let AI transcribe the speech into timestamped subtitles ready for your content.
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
                  <option>English</option>
                  <option>Hindi</option>
                  <option>Spanish</option>
                  <option>French</option>
                  <option>German</option>
                  <option>Urdu</option>
                  <option>Auto Detect</option>
                </select>

              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="h-14 w-full rounded-2xl bg-purple-400 px-5 text-sm font-semibold text-black shadow-xl shadow-purple-400/20 transition hover:bg-purple-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading
                  ? "☁️ Uploading Media..."
                  : loading
                  ? "🧠 Generating Subtitles..."
                  : "✨ Generate Subtitles"}
              </button>

            </div>

            {error && (
              <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm leading-6 text-red-300">
                ⚠️ {error}
              </div>
            )}

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

                <div className="mt-8">

                  <div className="flex items-center justify-between gap-3">

                    <h4 className="text-sm font-bold uppercase tracking-wider text-purple-300">
                      📝 Full Transcript
                    </h4>

                    <button
                      type="button"
                      onClick={copyTranscript}
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

                <div className="mt-8">

                  <div className="flex flex-wrap items-center justify-between gap-3">

                    <h4 className="text-sm font-bold uppercase tracking-wider text-purple-300">
                      ⏱️ Timestamped Subtitles
                    </h4>

                    <button
                      type="button"
                      onClick={copySubtitles}
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

      <footer className="relative z-10 border-t border-white/5 px-4 py-10">

        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-left">

          <div className="flex items-center gap-3">

            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-purple-400/20">
              <img
                src="/logo.png"
                alt="KrishAIWorks"
                className="h-full w-full rounded-full object-cover"
              />
            </div>

            <div>

              <p className="text-sm font-bold">
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

      </footer>

    </main>
  );
}