import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { validateDoc, type DocNode } from "@/data/model";
import { documentFor, type EditorHandle, type EditorProps } from "./bridge";
export const Canvas = forwardRef<EditorHandle, EditorProps>(
  function Canvas(props, ref) {
    const frame = useRef<HTMLIFrameElement>(null);
    const pending = useRef(
      new Map<
        string,
        {
          resolve: (doc: DocNode) => void;
          reject: (e: Error) => void;
          timer: ReturnType<typeof setTimeout>;
        }
      >(),
    );
    const callbacks = useRef(props);
    callbacks.current = props;
    const html = useMemo(() => documentFor(props), []); // eslint-disable-line react-hooks/exhaustive-deps
    const send = (data: unknown) =>
      frame.current?.contentWindow?.postMessage(JSON.stringify(data), "*");
    useEffect(() => {
      send({ type: "theme", ...props.colors, font: props.font });
    }, [props.colors, props.font]);
    useEffect(() => {
      const tasks = pending.current;
      const listener = (e: MessageEvent) => {
        if (
          e.source !== frame.current?.contentWindow ||
          typeof e.data !== "string"
        )
          return;
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "change" || msg.type === "snapshot") {
            validateDoc(msg.content);
            if (msg.type === "change") callbacks.current.onChange(msg.content);
            else {
              const task = tasks.get(msg.request);
              if (task) {
                clearTimeout(task.timer);
                task.resolve(msg.content);
                tasks.delete(msg.request);
              }
            }
          } else if (msg.type === "error") callbacks.current.onError();
          else if (msg.type === "ready")
            send({
              type: "theme",
              ...callbacks.current.colors,
              font: callbacks.current.font,
            });
        } catch {
          callbacks.current.onError();
        }
      };
      window.addEventListener("message", listener);
      return () => {
        window.removeEventListener("message", listener);
        for (const p of tasks.values()) {
          clearTimeout(p.timer);
          p.reject(new Error("Editor closed."));
        }
        tasks.clear();
      };
    }, []);
    useImperativeHandle(ref, () => ({
      snapshot: () =>
        new Promise((resolve, reject) => {
          const request = String(Date.now()) + Math.random();
          const timer = setTimeout(() => {
            pending.current.delete(request);
            reject(new Error("Editor did not respond."));
          }, 4000);
          pending.current.set(request, { resolve, reject, timer });
          send({ type: "snapshot", request });
        }),
    }));
    return (
      <iframe
        ref={frame}
        title="Note editor"
        sandbox="allow-scripts"
        srcDoc={html}
        style={{ flex: 1, width: "100%", border: 0, minHeight: 200 }}
      />
    );
  },
);
