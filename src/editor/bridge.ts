import { editorDocument } from "./generated/document";
import type { DocNode } from "@/data/model";
export type EditorHandle = { snapshot: () => Promise<DocNode> };
export type EditorProps = {
  content: DocNode;
  colors: Record<string, string>;
  font: string;
  focus: boolean;
  onChange: (content: DocNode) => void;
  onError: () => void;
};
export function documentFor(props: EditorProps) {
  return editorDocument.replace(
    "__CONFIG__",
    JSON.stringify({
      ...props.colors,
      content: props.content,
      font: props.font,
      focus: props.focus,
    }).replaceAll("<", "\\u003c"),
  );
}
