import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { WebView } from "react-native-webview";
import { validateDoc, type DocNode } from "@/data/model";
import { documentFor, type EditorHandle, type EditorProps } from "./bridge";
export const Canvas = forwardRef<EditorHandle, EditorProps>(
  function Canvas(props, ref) {
    const web = useRef<WebView>(null);
    const pending = useRef(
      new Map<
        string,
        {
          resolve: (d: DocNode) => void;
          reject: (e: Error) => void;
          timer: ReturnType<typeof setTimeout>;
        }
      >(),
    );
    const callbacks = useRef(props);
    callbacks.current = props;
    // The document is mounted once; theme changes use a command and never reset selection.
    const source = useMemo(() => ({ html: documentFor(props) }), []); // eslint-disable-line react-hooks/exhaustive-deps
    const send = (value: unknown) =>
      web.current?.injectJavaScript(
        `window.offdayCommand(${JSON.stringify(value)});true;`,
      );
    useEffect(() => {
      send({ type: "theme", ...props.colors, font: props.font });
    }, [props.colors, props.font]);
    useEffect(() => {
      const tasks = pending.current;
      return () => {
        for (const p of tasks.values()) {
          clearTimeout(p.timer);
          p.reject(new Error("Editor closed before saving."));
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
            reject(
              new Error(
                "Editor did not respond. Stay on this page and try saving again.",
              ),
            );
          }, 4000);
          pending.current.set(request, { resolve, reject, timer });
          send({ type: "snapshot", request });
        }),
    }));
    return (
      <WebView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        ref={web}
        source={source}
        originWhitelist={["about:blank"]}
        onShouldStartLoadWithRequest={(request) =>
          request.url === "about:blank"
        }
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess={false}
        mixedContentMode="never"
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        bounces={false}
        style={{ flex: 1, backgroundColor: props.colors.background }}
        onError={props.onError}
        onMessage={(event) => {
          try {
            const msg = JSON.parse(event.nativeEvent.data);
            if (msg.type === "change" || msg.type === "snapshot") {
              validateDoc(msg.content);
              if (msg.type === "change")
                callbacks.current.onChange(msg.content);
              else {
                const p = pending.current.get(msg.request);
                if (p) {
                  clearTimeout(p.timer);
                  p.resolve(msg.content);
                  pending.current.delete(msg.request);
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
        }}
      />
    );
  },
);
