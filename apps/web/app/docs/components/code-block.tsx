"use client";

import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";
import { CopyButton } from "@/components/copy-button";

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = "typescript" }: CodeBlockProps) {
  const [highlightedCode, setHighlightedCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function highlight() {
      try {
        const html = await codeToHtml(code, {
          lang: language,
          theme: "github-light",
        });
        setHighlightedCode(html);
      } catch {
        // Fallback to plain code if highlighting fails
        setHighlightedCode(`<pre><code>${code}</code></pre>`);
      } finally {
        setIsLoading(false);
      }
    }
    highlight();
  }, [code, language]);

  return (
    <div className="relative group">
      <div
        className="rounded-lg border border-neutral-200 overflow-x-auto text-sm [&_pre]:p-4 [&_pre]:m-0 [&_pre]:bg-neutral-50 [&_code]:font-(family-name:--font-geist-mono)"
        dangerouslySetInnerHTML={{
          __html: isLoading
            ? `<pre class="p-4 bg-neutral-50"><code class="text-neutral-500">Loading...</code></pre>`
            : highlightedCode,
        }}
      />
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton
          text={code}
          className="bg-white/90 backdrop-blur-sm border border-neutral-200 shadow-sm hover:bg-white"
        />
      </div>
    </div>
  );
}

