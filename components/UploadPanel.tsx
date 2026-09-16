"use client";

import { useEffect, useRef, useState } from "react";

const PIPELINE_STAGES = ["IR 분석", "체크포인트", "스토리 라인", "강점·보강점", "종합 의견", "재검증"];

export function UploadPanel({
  file,
  onFileChange,
  onSubmit,
  loading,
  error,
}: {
  file: File | null;
  onFileChange: (f: File | null) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading) {
      setStageIdx(0);
      return;
    }
    const id = setInterval(() => {
      setStageIdx((i) => Math.min(i + 1, PIPELINE_STAGES.length - 1));
    }, 2200);
    return () => clearInterval(id);
  }, [loading]);

  if (loading) {
    return (
      <div className="rounded-lg border border-panel-border bg-panel p-8 text-center">
        <div className="mx-auto mb-6 h-16 w-16 animate-spin rounded-full border-4 border-panel-border border-t-accent" />
        <div className="flex flex-wrap justify-center gap-2 text-xs">
          {PIPELINE_STAGES.map((stage, i) => (
            <span
              key={stage}
              className={`rounded-full px-3 py-1 ${
                i <= stageIdx ? "bg-accent/20 text-accent-soft" : "bg-white/5 text-muted"
              }`}
            >
              {stage}
            </span>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">IR 자료를 확인하고 있어요...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) onFileChange(dropped);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition ${
          dragOver ? "border-accent bg-accent/10" : "border-panel-border bg-panel"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div>
            <p className="font-medium">{file.name}</p>
            <p className="mt-1 text-xs text-muted">{(file.size / 1024 / 1024).toFixed(1)}MB — 다른 파일을 선택하려면 클릭하세요.</p>
          </div>
        ) : (
          <div>
            <p className="font-medium">파일 선택 / 드래그하여 업로드</p>
            <p className="mt-1 text-xs text-muted">PDF만 지원 (데모 버전)</p>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-bad/40 bg-bad/10 px-4 py-2 text-sm text-bad">{error}</p>
      )}

      <button
        onClick={onSubmit}
        disabled={!file}
        className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white transition enabled:hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
      >
        평가 시작
      </button>

      <p className="text-center text-xs text-muted">
        업로드하신 IR은 평가 직후 자동 폐기되며, 어떠한 형태로도 저장·재사용되지 않습니다.
      </p>
    </div>
  );
}
