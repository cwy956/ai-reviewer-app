import { Fragment } from "react";

// 메일 본문(텍스트)을 보여줄 때 주소를 눌러서 열 수 있게 함.
// 다음·네이버 같은 웹메일의 "대용량 첨부"는 첨부파일이 아니라 본문 속 다운로드 주소라서, 텍스트로만 보이면
// 눌러서 받을 방법이 없었음. 주소는 새 탭에서 열리고(noopener), 긴 주소는 줄바꿈되어 가로로 넘치지 않음.

const URL_RE = /https?:\/\/[^\s\]\)>"'<]+/g;
// 문장 끝에 붙은 구두점은 주소에서 뺌 (예: "…/abc." → "…/abc")
const TRAILING_PUNCT = /[.,;:!?)]+$/;

export function LinkifiedText({ text, className = "" }: { text: string; className?: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    const raw = m[0];
    const url = raw.replace(TRAILING_PUNCT, "");
    if (start > last) parts.push(<Fragment key={key++}>{text.slice(last, start)}</Fragment>);
    parts.push(
      <a
        key={key++}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent-soft underline underline-offset-2 hover:text-accent"
      >
        {url}
      </a>
    );
    last = start + url.length;
  }
  if (last < text.length) parts.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);

  return <p className={`whitespace-pre-wrap [overflow-wrap:anywhere] ${className}`}>{parts}</p>;
}
